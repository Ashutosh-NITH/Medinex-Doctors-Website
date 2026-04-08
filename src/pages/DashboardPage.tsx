import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTheme } from '../ThemeContext'
import { QRCodeCanvas } from "qrcode.react";
import QRScanner from "../components/QRScanner"; 
import {
  Search, FileText, User, LogOut, Activity,
  RefreshCw, Download, Clock, CheckCircle2,
  AlertCircle, Copy, Shield, Loader, PenLine,
  CheckCheck, XCircle, BadgeCheck
} from 'lucide-react'
import { useAuthStore } from '../store/authStore'
import {
  isPatientRegistered, getAllReportsID, getReportById,
  getDoctorGranted, getEncryptedKey, requestAccess,
  initDoctorStore, getAccount, getPatientData,
  getPendingSignatureRequests, signReport, declineSignature,
  getSignatures, isReportSigned
} from '../services/aptos'
import { fetchJSON, fetchEncryptedFile } from '../services/ipfs'
import {
  deriveKeyPair, fromB64, ecdh, unwrapAesKey,
  decryptFile, detectExt, signCid, verifyCidSignature
} from '../services/crypto'
import type { ReportMeta, GrantedReport } from '../types'

type Tab = 'search' | 'reports' | 'signatures' | 'profile'

const short   = (a: string) => a ? a.slice(0, 8) + '…' + a.slice(-6) : ''
const fmtDate = (s: number) => new Date(s * 1000).toLocaleDateString('en-IN', {
  day: 'numeric', month: 'short', year: 'numeric'
})


function ErrBox({ msg }: { msg: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl p-4 mb-6 text-sm"
      style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626' }}>
      <AlertCircle size={15} className="shrink-0" /> {msg}
    </div>
  )
}

function SuccessBox({ msg }: { msg: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl p-4 mb-6 text-sm"
      style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#16a34a' }}>
      <CheckCircle2 size={15} className="shrink-0" /> {msg}
    </div>
  )
}

export default function DashboardPage() {
  const nav = useNavigate()
  const { theme, toggle } = useTheme()
       
  const darkMode = theme === 'dark'   
  const { session, clearSession } = useAuthStore()
  const C = {
  bg:          darkMode ? '#0f172a' : '#ebf7f6',
  sidebar:     darkMode ? '#1e293b' : '#ffffff',
  surface:     darkMode ? '#1e293b' : '#ffffff',
  card:        darkMode ? '#1e293b' : '#f0faf9',
  border:      darkMode ? '#334155' : '#d1ece8',
  borderLight: darkMode ? '#334155' : '#e2f4f1',
  text:        darkMode ? '#e2e8f0' : '#0f172a',
  textMuted:   darkMode ? '#94a3b8' : '#64748b',
  textFaint:   darkMode ? '#64748b'  : '#94a3b8',
  topbar: darkMode ? 'rgba(15,23,42,0.85)' : 'rgba(255,255,255,0.85)',
  primary:     '#199a8e',
  primaryBg:   '#199a8e15',
  primaryBdr:  '#199a8e33',
}
  const [tab, setTab] = useState<Tab>('search')
  const [searchMode, setSearchMode] = useState<'address' | 'reportId'>('address')
  const [reportIdInput, setReportIdInput] = useState('')
  const [singleReport, setSingleReport] = useState<ReportMeta | null>(null)
  const [addr,       setAddr]       = useState('')
  const [reports,    setReports]    = useState<ReportMeta[]>([])
  const [searching,  setSearching]  = useState(false)
  const [searchErr,  setSearchErr]  = useState('')
  const [requesting, setRequesting] = useState<number | null>(null)
  const [reqDone,    setReqDone]    = useState<number | null>(null)

  const [granted,       setGranted]       = useState<GrantedReport[]>([])
  const [loadingGrants, setLoadingGrants] = useState(false)
  const [opening,       setOpening]       = useState<number | null>(null)
  const [openErr,       setOpenErr]       = useState('')
  const [reportSigned,  setReportSigned]  = useState<Record<number, boolean>>({})
  const [copied,        setCopied]        = useState(false)

  const [sigRequests,    setSigRequests]    = useState<any[]>([])
  const [loadingSigReqs, setLoadingSigReqs] = useState(false)
  const [signing,        setSigning]        = useState<number | null>(null)
  const [declining,      setDeclining]      = useState<number | null>(null)
  const [sigErr,         setSigErr]         = useState('')
  const [sigSuccess,     setSigSuccess]     = useState('')
  const [showScanner, setShowScanner] = useState(false);
  

  useEffect(() => { if (!session) nav('/auth'); else { loadGranted(); loadSigRequests() } }, [])

  async function loadGranted() {
    if (!session) return
    setLoadingGrants(true)
    try {
      const ids = await getDoctorGranted(session.walletAddress)
      const rows: GrantedReport[] = []
      const signedMap: Record<number, boolean> = {}
      for (const id of ids) {
        const [encKey, report] = await Promise.all([
          getEncryptedKey(session.walletAddress, id),
          getReportById(id)
        ])
        if (!encKey || !report) continue
        const pd = await getPatientData(report.patientAddress)
        const profile = await fetchJSON(pd[3] as string)
        rows.push({
          reportId: id, patientAddress: report.patientAddress,
          encryptedAesKey: encKey, cid: report.cid,
          patientCryptoPubkey: profile.cryptoPublicKey || ''
        })
        signedMap[id] = await isReportSigned(id)
      }
      setGranted(rows)
      setReportSigned(signedMap)
    } catch (e) { console.error(e) }
    setLoadingGrants(false)
  }

  async function loadSigRequests() {
    if (!session) return
    setLoadingSigReqs(true)
    try {
      const reqs = await getPendingSignatureRequests(session.walletAddress)
      setSigRequests(reqs)
    } catch (e) { console.error(e) }
    setLoadingSigReqs(false)
  }

// Add this function alongside your existing `search()`:
async function searchByAddress(target: string) {
  const trimmed = target.trim()
  if (!trimmed) return
  setAddr(trimmed)           // update the input field visually
  setSearching(true); setSearchErr(''); setReports([])
  try {
    const valid = await isPatientRegistered(trimmed)
    if (!valid) { setSearchErr('No registered patient at this address.'); setSearching(false); return }
    const ids = await getAllReportsID(trimmed)
    const rows: ReportMeta[] = []
    for (const id of ids) {
      const r = await getReportById(id)
      if (r) rows.push({ id: r.id, cid: r.cid, patientAddress: r.patientAddress, uploadedAt: r.uploadedAt })
    }
    setReports(rows.sort((a, b) => b.uploadedAt - a.uploadedAt))
  } catch { setSearchErr('Failed to fetch reports.') }
  setSearching(false)
}

// Also update your existing search() to call the helper:
async function search() {
  await searchByAddress(addr)
}

  async function doRequest(r: ReportMeta) {
    if (!session) return
    setRequesting(r.id)
    try {
      const acc = getAccount(session.mnemonic)
      await initDoctorStore(acc)
      await requestAccess(acc, r.patientAddress, r.id, session.cryptoPublicKey)
      setReqDone(r.id)
      setTimeout(() => setReqDone(null), 3000)
    } catch (e) { console.error(e) }
    setRequesting(null)
  }

  async function openReport(r: GrantedReport) {
    if (!session) return
    setOpening(r.reportId); setOpenErr('')
    try {
      const { privateKey } = deriveKeyPair(session.mnemonic)
      const shared   = ecdh(privateKey, fromB64(r.patientCryptoPubkey))
      const aesKey   = unwrapAesKey(JSON.parse(r.encryptedAesKey), shared)
      const encBytes = await fetchEncryptedFile(r.cid)
      const decBytes = await decryptFile(encBytes, aesKey)
      const url = URL.createObjectURL(new Blob([decBytes.buffer as ArrayBuffer]))
      const a = document.createElement('a')
      a.href = url; a.download = `report_${r.reportId}${detectExt(decBytes)}`; a.click()
      URL.revokeObjectURL(url)
    } catch (e: any) { setOpenErr(`Failed to open report #${r.reportId}: ${e.message}`) }
    setOpening(null)
  }

  async function doSign(req: any) {
    if (!session) return
    setSigning(req.report_id); setSigErr(''); setSigSuccess('')
    try {
      const acc = getAccount(session.mnemonic)
      const report = await getReportById(Number(req.report_id))
      if (!report) throw new Error('Report not found')
      const { signature, pubkey } = await signCid(report.cid, acc)
      await signReport(acc, Number(req.report_id), report.cid, signature, pubkey)
      setSigSuccess(`Report #${req.report_id} signed successfully!`)
      await loadSigRequests()
      await loadGranted()
    } catch (e: any) { setSigErr(`Failed to sign: ${e.message}`) }
    setSigning(null)
  }

  async function doDecline(req: any) {
    if (!session) return
    setDeclining(req.report_id); setSigErr(''); setSigSuccess('')
    try {
      const acc = getAccount(session.mnemonic)
      await declineSignature(acc, Number(req.report_id), req.patient_address)
      setSigSuccess(`Declined signature request for Report #${req.report_id}`)
      await loadSigRequests()
    } catch (e: any) { setSigErr(`Failed to decline: ${e.message}`) }
    setDeclining(null)
  }

  async function verifySignature(reportId: number, cid: string) {
    try {
      const sigs = await getSignatures(reportId)
      if (!sigs.length) return alert('No signatures found for this report.')
      let results = ''
      for (const sig of sigs) {
        const valid = await verifyCidSignature(cid, sig.signature, sig.doctor_pubkey)
        results += `Doctor: ${short(sig.doctor_address)}\nSigned: ${fmtDate(Number(sig.signed_at))}\nValid: ${valid ? '✅ YES' : '❌ NO'}\n\n`
      }
      alert(results)
    } catch (e: any) { alert('Verification failed: ' + e.message) }
  }
  function UserQR({ address }) {
    return (
      <div style={{ textAlign: "center" }}>
        <h3>Your Wallet Address</h3>
        <p style={{ wordBreak: "break-all" }}>{address}</p>

        <QRCodeCanvas 
          value={address}
          size={200}
          bgColor="#ffffff"
          fgColor="#000000"
          level="H"
        />
      </div>
    );
  }
  // In DashboardPage — add alongside search() and searchByAddress()
async function searchByReportId() {
  const id = parseInt(reportIdInput.trim())
  if (!id || id < 1) { setSearchErr('Please enter a valid Report ID.'); return }
  setSearching(true); setSearchErr(''); setSingleReport(null); setReports([])
  try {
    const r = await getReportById(id)
    if (!r) { setSearchErr(`No report found with ID #${id}.`); setSearching(false); return }
    setSingleReport({ id: r.id, cid: r.cid, patientAddress: r.patientAddress, uploadedAt: r.uploadedAt })
  } catch { setSearchErr(`Failed to fetch Report #${id}.`) }
  setSearching(false)
}
  if (!session) return null

  const NAV: { id: Tab; icon: any; label: string; badge?: number }[] = [
    { id: 'search',     icon: Search,   label: 'Search Patient' },
    { id: 'reports',    icon: FileText, label: 'My Reports' },
    { id: 'signatures', icon: PenLine,  label: 'Sign Requests', badge: sigRequests.length },
    { id: 'profile',    icon: User,     label: 'Profile' },
  ]

  return (
    <div className="min-h-screen flex flex-col md:flex-row" style={{ background: C.bg }}>

      {/* ── DESKTOP SIDEBAR — md se upar ── */}
      <aside className="hidden md:flex w-60 border-r flex-col shrink-0 sticky top-0 h-screen"
        style={{ borderColor: C.border, background: C.sidebar }}>

        <div className="p-5 border-b" style={{ borderColor: C.border }}>
          <div className="flex items-center gap-2 font-bold text-lg mb-3" style={{ color: C.text }}>
            <div className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: C.primary }}>
              <Activity size={13} className="text-white" />
            </div>
            Medi<span style={{ color: C.primary }}>Nex</span>
          </div>
          <span className="text-xs font-mono px-2 py-1 rounded-full"
            style={{ background: C.primaryBg, color: C.primary, border: `1px solid ${C.primaryBdr}` }}>
            Doctor Portal
          </span>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {NAV.map(({ id, icon: Icon, label, badge }) => (
            <button key={id} onClick={() => setTab(id)}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm transition-all"
              style={tab === id
                ? { background: C.primaryBg, color: C.primary, border: `1px solid ${C.primaryBdr}` }
                : { color: C.textMuted, border: '1px solid transparent' }}>
              <Icon size={16} />
              <span className="flex-1 text-left">{label}</span>
              {badge !== undefined && badge > 0 && (
                <span className="text-xs px-1.5 py-0.5 rounded-full font-bold text-white"
                  style={{ background: C.primary }}>
                  {badge}
                </span>
              )}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t" style={{ borderColor: C.border }}>
          <div className="px-2 mb-3">
            <div className="text-xs mb-0.5" style={{ color: C.textFaint }}>Logged in as</div>
            <div className="text-sm font-medium truncate" style={{ color: C.text }}>{session.name || 'Doctor'}</div>
            <div className="text-xs font-mono truncate" style={{ color: C.textFaint }}>{short(session.walletAddress)}</div>
          </div>
          <button onClick={() => { clearSession(); nav('/') }}
            className="w-full flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm transition-colors"
            style={{ color: '#dc2626' }}
            onMouseEnter={e => (e.currentTarget.style.background = '#fef2f2')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
            <LogOut size={15} /> Logout
          </button>
        </div>
      </aside>

      {/* ── MOBILE TOP BAR — sirf md se neeche ── */}
      <div className="md:hidden flex items-center justify-between px-4 py-3 border-b sticky top-0 z-50"
        style={{ background: C.sidebar, borderColor: C.border }}>
        <div className="flex items-center gap-2 font-bold text-base" style={{ color: C.text }}>
          <div className="w-6 h-6 rounded-md flex items-center justify-center"
            style={{ background: C.primary }}>
            <Activity size={11} className="text-white" />
          </div>
          Medi<span style={{ color: C.primary }}>Nex</span>
        </div>

        <div className="flex items-center gap-3">
          {/* Theme toggle — mobile */}
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-full"
            style={{
              background: darkMode ? 'rgba(15,23,42,0.5)' : '#f0f9f7',
              border: `1px solid ${darkMode ? '#334155' : '#cce6e1'}`
            }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
              stroke={!darkMode ? '#199a8e' : '#64748b'} strokeWidth="2">
              <circle cx="12" cy="12" r="5"/>
              <line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
              <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
              <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
              <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
            </svg>
            <button onClick={toggle}
              className="relative w-8 h-4 rounded-full transition-colors duration-300 focus:outline-none"
              style={{ background: darkMode ? '#199a8e' : '#cbd5e1' }}>
              <span className="absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full shadow transition-transform duration-300"
                style={{ transform: darkMode ? 'translateX(16px)' : 'translateX(0px)' }} />
            </button>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
              stroke={darkMode ? '#199a8e' : '#94a3b8'} strokeWidth="2">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
            </svg>
          </div>

          <span className="text-xs font-mono px-2 py-0.5 rounded-full"
            style={{ background: C.primaryBg, color: C.primary, border: `1px solid ${C.primaryBdr}` }}>
            {session.name || 'Doctor'}
          </span>
        </div>
      </div>

      {/* ── MAIN CONTENT ── */}
      <main className="flex-1 overflow-y-auto pb-20 md:pb-0">

        {/* Top bar — desktop only */}
<div className="hidden md:flex items-center justify-between sticky top-0 z-10 border-b px-8 py-4"
  style={{ borderColor: C.border, background: darkMode ? 'rgba(15,23,42,0.85)' : 'rgba(235,247,246,0.85)', backdropFilter: 'blur(12px)' }}>

  <div>
    <h1 className="text-xl font-bold" style={{ color: C.text }}>
      {tab === 'search' && 'Search Patient'}
      {tab === 'reports' && 'My Reports'}
      {tab === 'signatures' && 'Signature Requests'}
      {tab === 'profile' && 'My Profile'}
    </h1>
  </div>

            {/* Sun + Toggle + Moon pill */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full"
              style={{
                background: darkMode ? 'rgba(15,23,42,0.5)' : '#f0f9f7',
                border: `1px solid ${darkMode ? '#334155' : '#cce6e1'}`
              }}>

              {/* Sun */}
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                stroke={!darkMode ? '#199a8e' : '#64748b'} strokeWidth="2">
                <circle cx="12" cy="12" r="5"/>
                <line x1="12" y1="1" x2="12" y2="3"/>
                <line x1="12" y1="21" x2="12" y2="23"/>
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                <line x1="1" y1="12" x2="3" y2="12"/>
                <line x1="21" y1="12" x2="23" y2="12"/>
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
              </svg>

              {/* Track */}
              <button
                onClick={toggle}
                className="relative w-10 h-5 rounded-full transition-colors duration-300 focus:outline-none"
                style={{ background: darkMode ? '#199a8e' : '#cbd5e1' }}
              >
                <span
                  className="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform duration-300"
                  style={{ transform: darkMode ? 'translateX(20px)' : 'translateX(0px)' }}
                />
              </button>

              {/* Moon */}
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                stroke={darkMode ? '#199a8e' : '#94a3b8'} strokeWidth="2">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
              </svg>

            </div>

</div>

        {/* Mobile page title */}
        <div className="md:hidden px-4 pt-4 pb-2">
          <h1 className="text-lg font-bold" style={{ color: C.text }}>
            {tab === 'search'     && 'Search Patient'}
            {tab === 'reports'    && 'My Reports'}
            {tab === 'signatures' && 'Signature Requests'}
            {tab === 'profile'    && 'My Profile'}
          </h1>
        </div>

        <div className="p-4 md:p-8">

          {/* ── SEARCH ── */}
                        {tab === 'search' && (
                <div>

                  {/* ── Mode Toggle ── */}
                  <div className="flex gap-2 mb-5 p-1 rounded-xl w-fit"
                    style={{ background: C.card, border: `1px solid ${C.border}` }}>
                    {(['address', 'reportId'] as const).map(mode => (
                      <button key={mode} onClick={() => {
                        setSearchMode(mode)
                        setSearchErr(''); setReports([]); setSingleReport(null)
                      }}
                        className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
                        style={searchMode === mode
                          ? { background: C.primary, color: '#fff' }
                          : { color: C.textMuted }}>
                        {mode === 'address' ? '🔍 By Wallet Address' : '🆔 By Report ID'}
                      </button>
                    ))}
                  </div>

                  {/* ── Address Search ── */}
                  {searchMode === 'address' && (
                    <div className="flex gap-3 mb-8">
                      <div className="flex-1 relative">
                        <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2"
                          style={{ color: C.textFaint }} />
                        <input
                          value={addr}
                          onChange={e => { setAddr(e.target.value); setSearchErr('') }}
                          onKeyDown={e => e.key === 'Enter' && search()}
                          placeholder="Patient wallet address (0x...)"
                          className="w-full rounded-xl px-4 py-3 text-sm font-mono outline-none"
                          style={{ paddingLeft: '44px', background: C.surface, border: `1px solid ${C.border}`, color: C.text }}
                        />
                      </div>
                      <button onClick={() => setShowScanner(true)}
                        className="px-3 py-3 rounded-xl border flex items-center justify-center"
                        style={{ borderColor: C.border }}>📷</button>
                      <button onClick={search} disabled={searching || !addr.trim()}
                        className="btn-primary px-4 md:px-6 py-3 rounded-xl flex items-center gap-2 shrink-0">
                        {searching ? <Loader size={15} className="animate-spin" /> : <><Search size={15} /><span className="hidden md:inline">Search</span></>}
                      </button>
                    </div>
                  )}

                  {/* ── Report ID Search ── */}
                  {searchMode === 'reportId' && (
                    <div className="flex gap-3 mb-8">
                      <div className="flex-1 relative">
                        <FileText size={16} className="absolute left-4 top-1/2 -translate-y-1/2"
                          style={{ color: C.textFaint }} />
                        <input
                          value={reportIdInput}
                          onChange={e => { setReportIdInput(e.target.value.replace(/\D/g, '')); setSearchErr('') }}
                          onKeyDown={e => e.key === 'Enter' && searchByReportId()}
                          placeholder="Enter Report ID (e.g. 42)"
                          type="number"
                          min="1"
                          className="w-full rounded-xl px-4 py-3 text-sm font-mono outline-none"
                          style={{ paddingLeft: '44px', background: C.surface, border: `1px solid ${C.border}`, color: C.text }}
                        />
                      </div>
                      <button onClick={searchByReportId} disabled={searching || !reportIdInput.trim()}
                        className="btn-primary px-4 md:px-6 py-3 rounded-xl flex items-center gap-2 shrink-0">
                        {searching ? <Loader size={15} className="animate-spin" /> : <><Search size={15} /><span className="hidden md:inline">Search</span></>}
                      </button>
                    </div>
                  )}

                  {/* ── QR Scanner Modal (unchanged) ── */}
                  {showScanner && (
                    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 1000,
                      display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <div style={{ background: "#fff", padding: "20px", borderRadius: "12px", width: "320px", maxWidth: "90%" }}>
                        <h3 style={{ textAlign: "center", marginBottom: "10px" }}>Scan QR Code</h3>
                        <QRScanner onScan={(data) => {
                          let extracted = data
                          if (data.includes('/user/')) extracted = data.split('/user/')[1]
                          setShowScanner(false)
                          searchByAddress(extracted)
                        }} />
                        <button onClick={() => setShowScanner(false)}
                          style={{ marginTop: "10px", width: "100%", padding: "8px", cursor: "pointer" }}>
                          Close
                        </button>
                      </div>
                    </div>
                  )}

                  {searchErr && <ErrBox msg={searchErr} />}

                  {/* ── Single Report Result (Report ID mode) ── */}
                  {singleReport && (
                    <div>
                      <h2 className="font-semibold text-lg mb-4" style={{ color: C.text }}>Report found</h2>
                      <div className="rounded-2xl p-4 flex items-center gap-3"
                        style={{ background: C.surface, border: `1px solid ${C.border}` }}>
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                          style={{ background: C.primaryBg }}>
                          <FileText size={16} style={{ color: C.primary }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-sm" style={{ color: C.text }}>Report #{singleReport.id}</div>
                          <div className="text-xs font-mono truncate mt-0.5" style={{ color: C.textFaint }}>{singleReport.cid}</div>
                          <div className="text-xs mt-1" style={{ color: C.textMuted }}>
                            Patient: <span className="font-mono">{short(singleReport.patientAddress)}</span>
                          </div>
                          <div className="text-xs mt-0.5 flex items-center gap-1" style={{ color: C.textMuted }}>
                            <Clock size={10} /> {fmtDate(singleReport.uploadedAt)}
                          </div>
                        </div>
                        {reqDone === singleReport.id ? (
                          <span className="text-xs flex items-center gap-1 px-2 py-1.5 rounded-xl shrink-0"
                            style={{ background: '#f0fdf4', color: '#16a34a' }}>
                            <CheckCircle2 size={12} /> Done
                          </span>
                        ) : (
                          <button onClick={() => doRequest(singleReport)} disabled={requesting === singleReport.id}
                            className="btn-primary px-3 py-1.5 rounded-xl text-xs flex items-center gap-1 shrink-0">
                            {requesting === singleReport.id
                              ? <Loader size={11} className="animate-spin" />
                              : <><Shield size={11} /><span className="hidden sm:inline"> Request</span></>}
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {/* ── Address Search Results (unchanged) ── */}
                  {reports.length > 0 && (
                    <div>
                      <h2 className="font-semibold text-lg mb-4" style={{ color: C.text }}>
                        {reports.length} report{reports.length !== 1 ? 's' : ''} found
                      </h2>
                      <div className="space-y-3">
                        {reports.map(r => (
                          <div key={r.id} className="rounded-2xl p-4 flex items-center gap-3"
                            style={{ background: C.surface, border: `1px solid ${C.border}` }}>
                            <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                              style={{ background: C.primaryBg }}>
                              <FileText size={16} style={{ color: C.primary }} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="font-semibold text-sm" style={{ color: C.text }}>Report #{r.id}</div>
                              <div className="text-xs font-mono truncate mt-0.5" style={{ color: C.textFaint }}>{r.cid}</div>
                              <div className="text-xs mt-1 flex items-center gap-1" style={{ color: C.textMuted }}>
                                <Clock size={10} /> {fmtDate(r.uploadedAt)}
                              </div>
                            </div>
                            {reqDone === r.id ? (
                              <span className="text-xs flex items-center gap-1 px-2 py-1.5 rounded-xl shrink-0"
                                style={{ background: '#f0fdf4', color: '#16a34a' }}>
                                <CheckCircle2 size={12} /> Done
                              </span>
                            ) : (
                              <button onClick={() => doRequest(r)} disabled={requesting === r.id}
                                className="btn-primary px-3 py-1.5 rounded-xl text-xs flex items-center gap-1 shrink-0">
                                {requesting === r.id
                                  ? <Loader size={11} className="animate-spin" />
                                  : <><Shield size={11} /><span className="hidden sm:inline"> Request</span></>}
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {!searching && reports.length === 0 && !singleReport && !searchErr && (
                    <div className="text-center py-20" style={{ color: C.textFaint }}>
                      <Search size={36} className="mx-auto mb-4 opacity-30" />
                      <p className="text-base font-semibold mb-1" style={{ color: C.textMuted }}>
                        {searchMode === 'address' ? 'Search for a patient' : 'Search by Report ID'}
                      </p>
                      <p className="text-sm">
                        {searchMode === 'address' ? 'Enter their Aptos wallet address' : 'Enter a numeric report ID'}
                      </p>
                    </div>
                  )}
                </div>
              )}

          {/* ── MY REPORTS ── */}
          {tab === 'reports' && (
            <div>
              <div className="flex justify-end mb-4">
                <button onClick={loadGranted} disabled={loadingGrants}
                  className="flex items-center gap-2 text-sm transition-colors"
                  style={{ color: C.textMuted }}
                  onMouseEnter={e => (e.currentTarget.style.color = C.primary)}
                  onMouseLeave={e => (e.currentTarget.style.color = C.textMuted)}>
                  <RefreshCw size={14} className={loadingGrants ? 'animate-spin' : ''} /> Refresh
                </button>
              </div>
              {openErr && <ErrBox msg={openErr} />}
              {loadingGrants
                ? <div className="flex items-center justify-center py-20 gap-3" style={{ color: C.textMuted }}>
                    <Loader size={20} className="animate-spin" style={{ color: C.primary }} /> Loading…
                  </div>
                : granted.length === 0
                  ? <div className="text-center py-20" style={{ color: C.textFaint }}>
                      <FileText size={36} className="mx-auto mb-4 opacity-30" />
                      <p className="text-base font-semibold mb-1" style={{ color: C.textMuted }}>No granted reports yet</p>
                      <p className="text-sm">Reports patients grant you will appear here</p>
                    </div>
                  : <div className="space-y-3">
                      {granted.map(r => (
                        <div key={r.reportId} className="rounded-2xl p-4"
                          style={{ background: C.surface, border: `1px solid ${C.border}` }}>
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                              style={{ background: C.primaryBg }}>
                              <FileText size={16} style={{ color: C.primary }} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-semibold text-sm" style={{ color: C.text }}>Report #{r.reportId}</span>
                                {reportSigned[r.reportId] && (
                                  <span className="text-xs flex items-center gap-1 px-2 py-0.5 rounded-full"
                                    style={{ background: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0' }}>
                                    <BadgeCheck size={10} /> Signed
                                  </span>
                                )}
                              </div>
                              <div className="text-xs mt-0.5" style={{ color: C.textFaint }}>{short(r.patientAddress)}</div>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              {reportSigned[r.reportId] && (
                                <button onClick={() => verifySignature(r.reportId, r.cid)}
                                  className="btn-outline px-2.5 py-1.5 rounded-xl text-xs flex items-center gap-1">
                                  <CheckCheck size={12} /><span className="hidden sm:inline"> Verify</span>
                                </button>
                              )}
                              <button onClick={() => openReport(r)} disabled={opening === r.reportId}
                                className="btn-primary px-3 py-1.5 rounded-xl text-xs flex items-center gap-1.5">
                                {opening === r.reportId
                                  ? <Loader size={13} className="animate-spin" />
                                  : <><Download size={13} /> Open</>}
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
              }
            </div>
          )}

          {/* ── SIGNATURE REQUESTS ── */}
          {tab === 'signatures' && (
            <div>
              <div className="flex justify-end mb-4">
                <button onClick={loadSigRequests} disabled={loadingSigReqs}
                  className="flex items-center gap-2 text-sm transition-colors"
                  style={{ color: C.textMuted }}>
                  <RefreshCw size={14} className={loadingSigReqs ? 'animate-spin' : ''} /> Refresh
                </button>
              </div>

              {sigErr     && <ErrBox msg={sigErr} />}
              {sigSuccess && <SuccessBox msg={sigSuccess} />}

              {loadingSigReqs
                ? <div className="flex items-center justify-center py-20 gap-3" style={{ color: C.textMuted }}>
                    <Loader size={20} className="animate-spin" style={{ color: C.primary }} /> Loading…
                  </div>
                : sigRequests.length === 0
                  ? <div className="text-center py-20" style={{ color: C.textFaint }}>
                      <PenLine size={36} className="mx-auto mb-4 opacity-30" />
                      <p className="text-base font-semibold mb-1" style={{ color: C.textMuted }}>No signature requests</p>
                      <p className="text-sm">Patients requesting your digital signature will appear here</p>
                    </div>
                  : <div className="space-y-3">
                      {sigRequests.map((req, i) => (
                        <div key={i} className="rounded-2xl p-4"
                          style={{ background: C.surface, border: `1px solid ${C.border}` }}>
                          <div className="flex items-start gap-3">
                            <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                              style={{ background: C.primaryBg }}>
                              <PenLine size={16} style={{ color: C.primary }} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="font-semibold text-sm mb-1" style={{ color: C.text }}>
                                Report #{req.report_id}
                              </div>
                              <div className="text-xs mb-1" style={{ color: C.textMuted }}>
                                <span className="font-mono">{short(req.patient_address)}</span>
                              </div>
                              <div className="text-xs flex items-center gap-1" style={{ color: C.textFaint }}>
                                <Clock size={10} /> {fmtDate(Number(req.requested_at))}
                              </div>
                            </div>
                            <div className="flex flex-col gap-1.5 shrink-0">
                              <button
                                onClick={() => doSign(req)}
                                disabled={signing === req.report_id || declining === req.report_id}
                                className="btn-primary px-3 py-1.5 rounded-xl text-xs flex items-center gap-1">
                                {signing === req.report_id
                                  ? <Loader size={11} className="animate-spin" />
                                  : <><PenLine size={11} /> Sign</>}
                              </button>
                              <button
                                onClick={() => doDecline(req)}
                                disabled={declining === req.report_id || signing === req.report_id}
                                className="px-3 py-1.5 rounded-xl text-xs flex items-center gap-1 transition-colors"
                                style={{ border: '1px solid #fecaca', color: '#dc2626', background: '#fef2f2' }}>
                                {declining === req.report_id
                                  ? <Loader size={11} className="animate-spin" />
                                  : <><XCircle size={11} /> Decline</>}
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
              }
            </div>
          )}

          {/* ── PROFILE ── */}
          {tab === 'profile' && (
            <div className="max-w-xl space-y-4 mx-auto">
              <div className="rounded-3xl p-5 md:p-7"
                style={{ background: C.surface, border: `1px solid ${C.border}` }}>
                <div className="flex items-start gap-4 mb-6">
                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0"
                    style={{ background: C.primaryBg }}>
                    <User size={26} style={{ color: C.primary }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xl md:text-2xl font-bold" style={{ color: C.text }}>{session.name || 'Doctor'}</div>
                    <div className="text-sm mt-0.5" style={{ color: C.primary }}>{session.speciality || 'General Physician'}</div>
                    <span className="text-xs font-mono mt-2 px-2 py-0.5 rounded-full inline-block"
                      style={{ background: C.primaryBg, color: C.primary, border: `1px solid ${C.primaryBdr}` }}>
                      ✓ Verified on Blockchain
                    </span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    ['NMR ID',               session.nmrId],
                    ['Medical Council',       session.council],
                    ['Year of Registration',  session.regYear],
                    ['Year of Qualification', session.qualifyYear],
                  ].map(([l, v]) => (
                    <div key={l} className="rounded-xl p-3"
                      style={{ background: C.card, border: `1px solid ${C.borderLight}` }}>
                      <div className="text-xs mb-1" style={{ color: C.textFaint }}>{l}</div>
                      <div className="font-mono text-sm" style={{ color: C.text }}>{v || '—'}</div>
                    </div>
                  ))}
                </div>
              </div>


<div className="rounded-3xl p-5 md:p-7"
  style={{ background: C.surface, border: `1px solid ${C.border}` }}>

  {/* Header */}
  <div className="flex items-center gap-3 mb-5">
    <div className="w-9 h-9 rounded-xl flex items-center justify-center"
      style={{ background: C.primaryBg }}>
      <Shield size={16} style={{ color: C.primary }} />
    </div>
    <div>
      <div className="font-semibold" style={{ color: C.text }}>Crypto Wallet</div>
      <div className="text-xs" style={{ color: C.textFaint }}>Aptos Testnet</div>
    </div>
  </div>

  {/* Wallet Address + QR */}
  <div className="rounded-xl p-4 mb-3"
    style={{ background: C.card, border: `1px solid ${C.borderLight}` }}>

    <div className="text-xs mb-2" style={{ color: C.textFaint }}>
      Wallet Address
    </div>

    {/* Address + Copy */}
    <div className="flex items-center justify-between gap-3 mb-3">
      <span className="font-mono text-xs truncate" style={{ color: C.text }}>
        {session.walletAddress}
      </span>

      <button
        onClick={() => {
          navigator.clipboard.writeText(session.walletAddress);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }}
        className="transition-colors shrink-0"
        style={{ color: C.textFaint }}
      >
        <Copy size={14} />
      </button>
    </div>

    {copied && (
      <div className="text-xs mb-3" style={{ color: C.primary }}>
        ✓ Copied!
      </div>
    )}

    {/* 🔥 QR CODE */}
    <div className="flex flex-col items-center justify-center mt-4">
      <QRCodeCanvas
        value={`${session.walletAddress}`} 
        size={180}
        level="H"
        bgColor="#ffffff"
        fgColor="#000000"
      />

      <div className="text-xs mt-2 text-center" style={{ color: C.textFaint }}>
        Scan to view profile
      </div>
    </div>
  </div>

  {/* Warning */}
  <div className="mt-4 text-xs rounded-xl p-4"
    style={{ background: '#fffbeb', border: '1px solid #fde68a', color: '#92400e' }}>
    ⚠️ Your mnemonic is stored in browser storage. Never share it.
  </div>
</div>
              <div className="rounded-3xl p-5 md:p-6"
                style={{ background: C.surface, border: `1px solid ${C.border}` }}>
                <h3 className="font-semibold mb-4" style={{ color: '#dc2626' }}>Danger Zone</h3>
                <button onClick={() => { clearSession(); nav('/') }}
                  className="flex items-center gap-2 px-5 py-3 rounded-xl text-sm transition-colors"
                  style={{ border: '1px solid #fecaca', color: '#dc2626' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#fef2f2')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  <LogOut size={15} /> Logout &amp; Clear Session
                </button>
              </div>
            </div>
          )}

        </div>
      </main>

      {/* ── MOBILE BOTTOM NAV — sirf md se neeche ── */}
      <div className="md:hidden fixed bottom-0 inset-x-0 z-50 border-t"
        style={{ background: C.sidebar, borderColor: C.border }}>
        <div className="flex items-center justify-around px-2 py-1">
          {NAV.map(({ id, icon: Icon, label, badge }) => (
            <button key={id} onClick={() => setTab(id)}
              className="relative flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl transition-all flex-1"
              style={{ color: tab === id ? C.primary : C.textFaint }}>
              <Icon size={20} />
              {badge !== undefined && badge > 0 && (
                <span className="absolute top-1 right-2 w-4 h-4 rounded-full text-white flex items-center justify-center font-bold"
                  style={{ background: C.primary, fontSize: '9px' }}>
                  {badge}
                </span>
              )}
              <span style={{ fontSize: '10px', fontWeight: tab === id ? 500 : 400 }}>{label}</span>
            </button>
          ))}
          <button
            onClick={() => { clearSession(); nav('/') }}
            className="flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl flex-1"
            style={{ color: '#dc2626' }}>
            <LogOut size={20} />
            <span style={{ fontSize: '10px' }}>Logout</span>
          </button>
        </div>
      </div>

    </div>
  )
}