import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import { MongoClient, Collection, Db } from 'mongodb'
import twilio from 'twilio'
import rateLimit from 'express-rate-limit'
import axios from 'axios'
import { z } from 'zod'

dotenv.config()

const app  = express()
const PORT = process.env.PORT || 4000

// ── MongoDB ──────────────────────────────────────────────────────────────────
let db:         Db
let doctors:    Collection
let otpStore:   Collection

async function connectDB() {
  const client = new MongoClient(process.env.MONGODB_URI!)
  await client.connect()
  db       = client.db('Medinex')                          // database name
  doctors  = db.collection('state_medical_council')
  otpStore = db.collection('otp_store')

  // Indexes
  await doctors.createIndex({ nmr_id: 1 }, { unique: true })
  await otpStore.createIndex({ expires_at: 1 }, { expireAfterSeconds: 0 }) // TTL auto-delete

  console.log('✅ MongoDB connected')
}

// ── Twilio ───────────────────────────────────────────────────────────────────
const smsClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)

// ── Middleware ───────────────────────────────────────────────────────────────
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173', credentials: true }))
app.use(express.json())

const otpLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 5,
  message: { message: 'Too many requests. Try again in 10 minutes.' }
})

// ── Seed sample doctors (runs once — skips if already exist) ─────────────────
async function seedDoctors() {
  const sampleDoctors = [
    { nmr_id: 'MH-2024-00001', name: 'Dr. Priya Sharma',  phone: '+919876543210', council: 'Maharashtra Medical Council', speciality: 'Cardiology',  reg_year: '2018', qualify_year: '2016', registration_number: 100001, is_active: true },
    { nmr_id: 'DL-2022-00042', name: 'Dr. Arjun Mehta',   phone: '+919123456789', council: 'Delhi Medical Council',       speciality: 'Neurology',   reg_year: '2022', qualify_year: '2020', registration_number: 100042, is_active: true },
    { nmr_id: 'KA-2021-00099', name: 'Dr. Kavitha Reddy', phone: '+918765432109', council: 'Karnataka Medical Council',   speciality: 'Pediatrics',  reg_year: '2021', qualify_year: '2019', registration_number: 100099, is_active: true },
    { nmr_id: 'TN-2023-00200', name: 'Dr. Rajesh Iyer',   phone: '+917654321098', council: 'Tamil Nadu Medical Council',  speciality: 'Orthopedics', reg_year: '2023', qualify_year: '2021', registration_number: 100200, is_active: true },
    { nmr_id: 'UP-2020-00310', name: 'Dr. Ananya Singh',  phone: '+916543210987', council: 'UP Medical Council',          speciality: 'Dermatology', reg_year: '2020', qualify_year: '2018', registration_number: 100310, is_active: true },
    { nmr_id: 'AS-2024-00001', name: 'Dr. Ashutosh Kumar',phone: '+919229258016', council: 'Himachal Pradesh Medical Council', speciality: 'General Medicine', reg_year: '2020', qualify_year: '2018', registration_number: 200001, is_active: true },
  ]

  for (const doc of sampleDoctors) {
    await doctors.updateOne(
      { nmr_id: doc.nmr_id },
      { $setOnInsert: doc },
      { upsert: true }
    )
  }
  console.log('✅ Doctor records seeded')
}

// ── OTP helpers ──────────────────────────────────────────────────────────────
function genOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

async function sendOtp(nmrId: string, phone: string) {
  const otp = genOtp()
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000)

  // Invalidate any existing unused OTPs for this NMR
  await otpStore.updateMany({ nmr_id: nmrId, used: false }, { $set: { used: true } })

  // Insert new OTP
  await otpStore.insertOne({ nmr_id: nmrId, otp, expires_at: expiresAt, used: false, created_at: new Date() })

  await smsClient.messages.create({
    body: `MediNex OTP: ${otp} — valid 10 min. Do not share.`,
    from: process.env.TWILIO_PHONE_NUMBER,
    to: phone,
  })
}

async function verifyOtp(nmrId: string, otp: string): Promise<boolean> {
  const record = await otpStore.findOne({
    nmr_id: nmrId,
    otp,
    used: false,
    expires_at: { $gt: new Date() }
  })
  if (!record) return false
  await otpStore.updateOne({ _id: record._id }, { $set: { used: true } })
  return true
}

// ── Routes ───────────────────────────────────────────────────────────────────

// Check NMR — returns doctor info if found in council DB
app.post('/api/auth/check-nmr', async (req, res) => {
  try {
    const { nmrId } = z.object({ nmrId: z.string().min(1) }).parse(req.body)

    const doc = await doctors.findOne({ nmr_id: nmrId, is_active: true })
    if (!doc)
      return res.json({ status: 'not_found', message: 'NMR ID not registered with any State Medical Council.' })

    const info = {
      name:                doc.name,
      council:             doc.council,
      speciality:          doc.speciality,
      reg_year:            doc.reg_year,
      qualify_year:        doc.qualify_year,
      phone:               (doc.phone as string).slice(-4).padStart((doc.phone as string).length, '*'),
      registration_number: doc.registration_number,
    }
    return res.json({ status: 'council_registered', doctorInfo: info })
  } catch (e: any) {
    return res.status(500).json({ message: e.message })
  }
})

// Send OTP
app.post('/api/auth/send-otp', otpLimiter, async (req, res) => {
  try {
    const { nmrId } = z.object({ nmrId: z.string().min(1) }).parse(req.body)
    const doc = await doctors.findOne({ nmr_id: nmrId })
    if (!doc) return res.status(404).json({ message: 'Doctor not found.' })
    await sendOtp(nmrId, doc.phone as string)
    res.json({ message: 'OTP sent.' })
  } catch (e: any) {
    res.status(500).json({ message: e.message })
  }
})

// Verify OTP
app.post('/api/auth/verify-otp', otpLimiter, async (req, res) => {
  try {
    const { nmrId, otp } = z.object({ nmrId: z.string(), otp: z.string().length(6) }).parse(req.body)
    const ok = await verifyOtp(nmrId, otp)
    if (!ok) return res.status(400).json({ message: 'Invalid or expired OTP.' })
    res.json({ message: 'OTP verified.' })
  } catch (e: any) {
    res.status(500).json({ message: e.message })
  }
})

// Get doctor info by NMR (used by dashboard, etc.)
app.get('/api/auth/doctor-info/:nmrId', async (req, res) => {
  try {
    const doc = await doctors.findOne(
      { nmr_id: req.params.nmrId },
      { projection: { nmr_id: 1, name: 1, council: 1, speciality: 1, reg_year: 1, qualify_year: 1 } }
    )
    if (!doc) return res.status(404).json({ message: 'Not found.' })
    res.json({ doctor: doc })
  } catch (e: any) {
    res.status(500).json({ message: e.message })
  }
})

app.get('/health', (_req, res) => res.json({ ok: true }))

// ── Start ────────────────────────────────────────────────────────────────────
connectDB()
  .then(() => seedDoctors())
  .then(() => app.listen(PORT, () => console.log(`🚀 Backend running on http://localhost:${PORT}`)))
  .catch(e => { console.error(e); process.exit(1) })