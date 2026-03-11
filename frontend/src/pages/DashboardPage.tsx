import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
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
    <div className="flex items-center gap-3 rounded-xl p-4 mb-6 text-sm text-red-400"
      style={{ background: '#ef44441a', border: '1px solid #ef444433' }}>
      <AlertCircle size={15} className="shrink-0" /> {msg}
    </div>
  )
}

function SuccessBox({ msg }: { msg: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl p-4 mb-6 text-sm text-green-400"
      style={{ background: '#22c55e1a', border: '1px solid #22c55e33' }}>
      <CheckCircle2 size={15} className="shrink-0" /> {msg}
    </div>
  )
}

export default function DashboardPage() {
  const nav = useNavigate()
  const { session, clearSession } = useAuthStore()
  const [tab, setTab] = useState<Tab>('search')

  // search
  const [addr,       setAddr]       = useState('')
  const [reports,    setReports]    = useState<ReportMeta[]>([])
  const [searching,  setSearching]  = useState(false)
  const [searchErr,  setSearchErr]  = useState('')
  const [requesting, setRequesting] = useState<number | null>(null)
  const [reqDone,    setReqDone]    = useState<number | null>(null)

  // granted reports
  const [granted,       setGranted]       = useState<GrantedReport[]>([])
  const [loadingGrants, setLoadingGrants] = useState(false)
  const [opening,       setOpening]       = useState<number | null>(null)
  const [openErr,       setOpenErr]       = useState('')
  const [reportSigned,  setReportSigned]  = useState<Record<number, boolean>>({})
  const [copied,        setCopied]        = useState(false)

  // signatures
  const [sigRequests,    setSigRequests]    = useState<any[]>([])
  const [loadingSigReqs, setLoadingSigReqs] = useState(false)
  const [signing,        setSigning]        = useState<number | null>(null)
  const [declining,      setDeclining]      = useState<number | null>(null)
  const [sigErr,         setSigErr]         = useState('')
  const [sigSuccess,     setSigSuccess]     = useState('')

  useEffect(() => { if (!session) nav('/auth'); else { loadGranted(); loadSigRequests() } }, [])

  // ── Load granted reports ──────────────────────────────────────────────────
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

  // ── Load signature requests ───────────────────────────────────────────────
  async function loadSigRequests() {
    if (!session) return
    setLoadingSigReqs(true)
    try {
      const reqs = await getPendingSignatureRequests(session.walletAddress)
      setSigRequests(reqs)
    } catch (e) { console.error(e) }
    setLoadingSigReqs(false)
  }

  // ── Search patient ────────────────────────────────────────────────────────
  async function search() {
    if (!addr.trim()) return
    setSearching(true); setSearchErr(''); setReports([])
    try {
      const valid = await isPatientRegistered(addr.trim())
      if (!valid) { setSearchErr('No registered patient at this address.'); setSearching(false); return }
      const ids = await getAllReportsID(addr.trim())
      const rows: ReportMeta[] = []
      for (const id of ids) {
        const r = await getReportById(id)
        if (r) rows.push({ id: r.id, cid: r.cid, patientAddress: r.patientAddress, uploadedAt: r.uploadedAt })
      }
      setReports(rows.sort((a, b) => b.uploadedAt - a.uploadedAt))
    } catch { setSearchErr('Failed to fetch reports.') }
    setSearching(false)
  }

  // ── Request access ────────────────────────────────────────────────────────
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

  // ── Open report ───────────────────────────────────────────────────────────
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

  // ── Sign report ───────────────────────────────────────────────────────────
  async function doSign(req: any) {
    if (!session) return
    setSigning(req.report_id); setSigErr(''); setSigSuccess('')
    try {
      const acc = getAccount(session.mnemonic)
      // Fetch CID of this report
      const report = await getReportById(Number(req.report_id))
      if (!report) throw new Error('Report not found')
      // Sign the CID
      const { signature, pubkey } = await signCid(report.cid, acc)
      // Submit to blockchain
      await signReport(acc, Number(req.report_id), report.cid, signature, pubkey)
      setSigSuccess(`Report #${req.report_id} signed successfully!`)
      await loadSigRequests()
      await loadGranted()
    } catch (e: any) { setSigErr(`Failed to sign: ${e.message}`) }
    setSigning(null)
  }

  // ── Decline signature request ─────────────────────────────────────────────
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

  // ── Verify signature ──────────────────────────────────────────────────────
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

  if (!session) return null

  const NAV: { id: Tab; icon: any; label: string; badge?: number }[] = [
    { id: 'search',     icon: Search,   label: 'Search Patient' },
    { id: 'reports',    icon: FileText, label: 'My Reports' },
    { id: 'signatures', icon: PenLine,  label: 'Sign Requests', badge: sigRequests.length },
    { id: 'profile',    icon: User,     label: 'Profile' },
  ]

  return (
    <div className="min-h-screen flex" style={{ background: '#0a0a0a' }}>

      {/* Sidebar */}
      <aside className="w-60 border-r flex flex-col shrink-0 sticky top-0 h-screen"
        style={{ borderColor: '#1a1a1a', background: '#0d0d0d' }}>
        <div className="p-5 border-b" style={{ borderColor: '#1a1a1a' }}>
          <div className="flex items-center gap-2 font-bold text-lg mb-3">
            <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
              <Activity size={13} className="text-white" />
            </div>
            Medi<span className="text-primary">Nex</span>
          </div>
          <span className="text-xs font-mono px-2 py-1 rounded-full"
            style={{ background: '#199a8e15', color: '#199a8e', border: '1px solid #199a8e33' }}>
            Doctor Portal
          </span>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {NAV.map(({ id, icon: Icon, label, badge }) => (
            <button key={id} onClick={() => setTab(id)}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm transition-all"
              style={tab === id
                ? { background: '#199a8e18', color: '#199a8e', border: '1px solid #199a8e33' }
                : { color: '#888', border: '1px solid transparent' }}>
              <Icon size={16} />
              <span className="flex-1 text-left">{label}</span>
              {badge !== undefined && badge > 0 && (
                <span className="text-xs px-1.5 py-0.5 rounded-full font-bold"
                  style={{ background: '#199a8e', color: 'white' }}>
                  {badge}
                </span>
              )}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t" style={{ borderColor: '#1a1a1a' }}>
          <div className="px-2 mb-3">
            <div className="text-xs text-gray-600 mb-0.5">Logged in as</div>
            <div className="text-sm font-medium truncate">{session.name || 'Doctor'}</div>
            <div className="text-xs text-gray-600 font-mono truncate">{short(session.walletAddress)}</div>
          </div>
          <button onClick={() => { clearSession(); nav('/') }}
            className="w-full flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm text-red-400 hover:bg-red-500/10 transition-colors">
            <LogOut size={15} /> Logout
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-y-auto">
        <div className="sticky top-0 z-10 border-b px-8 py-4"
          style={{ borderColor: '#1a1a1a', background: '#0a0a0acc', backdropFilter: 'blur(12px)' }}>
          <h1 className="text-xl font-bold">
            {tab === 'search'     && 'Search Patient'}
            {tab === 'reports'    && 'My Reports'}
            {tab === 'signatures' && 'Signature Requests'}
            {tab === 'profile'    && 'My Profile'}
          </h1>
          <p className="text-gray-500 text-xs mt-0.5">
            {tab === 'search'     && 'Enter a patient wallet address to view and request reports'}
            {tab === 'reports'    && 'Reports patients have granted you access to'}
            {tab === 'signatures' && 'Patients requesting you to digitally sign their reports'}
            {tab === 'profile'    && 'Your verified doctor credentials'}
          </p>
        </div>

        <div className="p-8">

          {/* ── SEARCH ── */}
          {tab === 'search' && (
            <div>
              <div className="flex gap-3 mb-8">
                <div className="flex-1 relative">
                  <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600" />
                  <input value={addr} onChange={e => { setAddr(e.target.value); setSearchErr('') }}
                    onKeyDown={e => e.key === 'Enter' && search()}
                    placeholder="Enter patient wallet address (0x...)"
                    className="input-field font-mono" style={{ paddingLeft: '44px' }} />
                </div>
                <button onClick={search} disabled={searching || !addr.trim()}
                  className="btn-primary px-6 py-3 rounded-xl flex items-center gap-2 shrink-0">
                  {searching ? <Loader size={15} className="animate-spin" /> : <><Search size={15} /> Search</>}
                </button>
              </div>

              {searchErr && <ErrBox msg={searchErr} />}

              {reports.length > 0 && (
                <div>
                  <h2 className="font-semibold text-lg mb-4">{reports.length} report{reports.length !== 1 ? 's' : ''} found</h2>
                  <div className="space-y-3">
                    {reports.map(r => (
                      <div key={r.id} className="card rounded-2xl p-5 flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                          style={{ background: '#199a8e15' }}>
                          <FileText size={18} className="text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold">Report #{r.id}</div>
                          <div className="text-xs text-gray-500 font-mono truncate mt-0.5">{r.cid}</div>
                          <div className="text-xs text-gray-600 mt-1 flex items-center gap-1">
                            <Clock size={11} /> {fmtDate(r.uploadedAt)}
                          </div>
                        </div>
                        {reqDone === r.id
                          ? <span className="text-xs text-green-400 flex items-center gap-1.5 px-3 py-2 rounded-xl shrink-0"
                              style={{ background: '#22c55e15' }}>
                              <CheckCircle2 size={13} /> Requested!
                            </span>
                          : <button onClick={() => doRequest(r)} disabled={requesting === r.id}
                              className="btn-primary px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 shrink-0">
                              {requesting === r.id
                                ? <Loader size={12} className="animate-spin" />
                                : <><Shield size={12} /> Request Access</>}
                            </button>
                        }
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {!searching && reports.length === 0 && !searchErr && (
                <div className="text-center py-24 text-gray-600">
                  <Search size={40} className="mx-auto mb-4 opacity-20" />
                  <p className="text-lg font-semibold mb-1">Search for a patient</p>
                  <p className="text-sm">Enter their Aptos wallet address to view reports</p>
                </div>
              )}
            </div>
          )}

          {/* ── MY REPORTS ── */}
          {tab === 'reports' && (
            <div>
              <div className="flex justify-end mb-6">
                <button onClick={loadGranted} disabled={loadingGrants}
                  className="flex items-center gap-2 text-sm text-gray-400 hover:text-primary transition-colors">
                  <RefreshCw size={14} className={loadingGrants ? 'animate-spin' : ''} /> Refresh
                </button>
              </div>
              {openErr && <ErrBox msg={openErr} />}
              {loadingGrants
                ? <div className="flex items-center justify-center py-24 gap-3 text-gray-500">
                    <Loader size={20} className="animate-spin text-primary" /> Loading…
                  </div>
                : granted.length === 0
                  ? <div className="text-center py-24 text-gray-600">
                      <FileText size={40} className="mx-auto mb-4 opacity-20" />
                      <p className="text-lg font-semibold mb-1">No granted reports yet</p>
                      <p className="text-sm">Reports patients grant you will appear here</p>
                    </div>
                  : <div className="space-y-3">
                      {granted.map(r => (
                        <div key={r.reportId} className="card rounded-2xl p-5">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                              style={{ background: '#199a8e15' }}>
                              <FileText size={18} className="text-primary" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold">Report #{r.reportId}</span>
                                {reportSigned[r.reportId] && (
                                  <span className="text-xs text-green-400 flex items-center gap-1 px-2 py-0.5 rounded-full"
                                    style={{ background: '#22c55e15', border: '1px solid #22c55e33' }}>
                                    <BadgeCheck size={11} /> Digitally Signed
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-gray-500 mt-0.5">{short(r.patientAddress)}</div>
                              <div className="text-xs text-green-400 mt-1 flex items-center gap-1">
                                <CheckCircle2 size={11} /> Access Granted
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {reportSigned[r.reportId] && (
                                <button
                                  onClick={() => verifySignature(r.reportId, r.cid)}
                                  className="btn-outline px-3 py-2 rounded-xl text-xs flex items-center gap-1.5">
                                  <CheckCheck size={13} /> Verify
                                </button>
                              )}
                              <button onClick={() => openReport(r)} disabled={opening === r.reportId}
                                className="btn-primary px-5 py-2.5 rounded-xl text-sm flex items-center gap-2">
                                {opening === r.reportId
                                  ? <Loader size={14} className="animate-spin" />
                                  : <><Download size={14} /> Open</>}
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
              <div className="flex justify-end mb-6">
                <button onClick={loadSigRequests} disabled={loadingSigReqs}
                  className="flex items-center gap-2 text-sm text-gray-400 hover:text-primary transition-colors">
                  <RefreshCw size={14} className={loadingSigReqs ? 'animate-spin' : ''} /> Refresh
                </button>
              </div>

              {sigErr     && <ErrBox msg={sigErr} />}
              {sigSuccess && <SuccessBox msg={sigSuccess} />}

              {loadingSigReqs
                ? <div className="flex items-center justify-center py-24 gap-3 text-gray-500">
                    <Loader size={20} className="animate-spin text-primary" /> Loading…
                  </div>
                : sigRequests.length === 0
                  ? <div className="text-center py-24 text-gray-600">
                      <PenLine size={40} className="mx-auto mb-4 opacity-20" />
                      <p className="text-lg font-semibold mb-1">No signature requests</p>
                      <p className="text-sm">Patients requesting your digital signature will appear here</p>
                    </div>
                  : <div className="space-y-3">
                      {sigRequests.map((req, i) => (
                        <div key={i} className="card rounded-2xl p-5">
                          <div className="flex items-start gap-4">
                            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                              style={{ background: '#199a8e15' }}>
                              <PenLine size={18} className="text-primary" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="font-semibold mb-1">
                                Signature Request — Report #{req.report_id}
                              </div>
                              <div className="text-xs text-gray-500 mb-1">
                                Patient: <span className="font-mono">{short(req.patient_address)}</span>
                              </div>
                              <div className="text-xs text-gray-600 flex items-center gap-1">
                                <Clock size={11} /> Requested {fmtDate(Number(req.requested_at))}
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <button
                                onClick={() => doDecline(req)}
                                disabled={declining === req.report_id || signing === req.report_id}
                                className="btn-outline px-4 py-2 rounded-xl text-xs flex items-center gap-1.5"
                                style={{ borderColor: '#ef444433', color: '#f87171' }}>
                                {declining === req.report_id
                                  ? <Loader size={12} className="animate-spin" />
                                  : <><XCircle size={12} /> Decline</>}
                              </button>
                              <button
                                onClick={() => doSign(req)}
                                disabled={signing === req.report_id || declining === req.report_id}
                                className="btn-primary px-4 py-2 rounded-xl text-xs flex items-center gap-1.5">
                                {signing === req.report_id
                                  ? <Loader size={12} className="animate-spin" />
                                  : <><PenLine size={12} /> Sign Report</>}
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
            <div className="max-w-xl space-y-5">
              <div className="card rounded-3xl p-7">
                <div className="flex items-start gap-4 mb-7">
                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0"
                    style={{ background: '#199a8e15' }}>
                    <User size={26} className="text-primary" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold">{session.name || 'Doctor'}</div>
                    <div className="text-primary text-sm mt-0.5">{session.speciality || 'General Physician'}</div>
                    <span className="text-xs font-mono mt-2 px-2 py-0.5 rounded-full inline-block"
                      style={{ background: '#199a8e15', color: '#199a8e', border: '1px solid #199a8e33' }}>
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
                    <div key={l} className="rounded-xl p-4" style={{ background: '#0d0d0d', border: '1px solid #1a1a1a' }}>
                      <div className="text-xs text-gray-500 mb-1">{l}</div>
                      <div className="font-mono text-sm">{v || '—'}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="card rounded-3xl p-7">
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                    style={{ background: '#199a8e15' }}>
                    <Shield size={16} className="text-primary" />
                  </div>
                  <div>
                    <div className="font-semibold">Crypto Wallet</div>
                    <div className="text-xs text-gray-500">Aptos Testnet</div>
                  </div>
                </div>
                <div className="rounded-xl p-4 mb-3" style={{ background: '#0d0d0d', border: '1px solid #1a1a1a' }}>
                  <div className="text-xs text-gray-500 mb-2">Wallet Address</div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-mono text-sm truncate">{session.walletAddress}</span>
                    <button onClick={() => { navigator.clipboard.writeText(session.walletAddress); setCopied(true); setTimeout(() => setCopied(false), 2000) }}
                      className="text-gray-500 hover:text-primary transition-colors shrink-0">
                      <Copy size={14} />
                    </button>
                  </div>
                  {copied && <div className="text-xs text-primary mt-2">✓ Copied!</div>}
                </div>
                <div className="rounded-xl p-4" style={{ background: '#0d0d0d', border: '1px solid #1a1a1a' }}>
                  <div className="text-xs text-gray-500 mb-2">Crypto Public Key (X25519)</div>
                  <div className="font-mono text-xs text-gray-400 break-all">{session.cryptoPublicKey}</div>
                </div>
                <div className="mt-4 text-xs text-yellow-400 rounded-xl p-4"
                  style={{ background: '#f59e0b0d', border: '1px solid #f59e0b22' }}>
                  ⚠️ Your mnemonic is stored in browser storage. Never share it.
                </div>
              </div>

              <div className="card rounded-3xl p-6">
                <h3 className="font-semibold mb-4 text-red-400">Danger Zone</h3>
                <button onClick={() => { clearSession(); nav('/') }}
                  className="flex items-center gap-2 px-5 py-3 rounded-xl text-sm text-red-400 transition-colors"
                  style={{ border: '1px solid #ef444430' }}>
                  <LogOut size={15} /> Logout &amp; Clear Session
                </button>
              </div>
            </div>
          )}

        </div>
      </main>
    </div>
  )
}