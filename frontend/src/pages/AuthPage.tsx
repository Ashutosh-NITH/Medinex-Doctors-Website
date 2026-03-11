import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Eye, EyeOff, Copy, Activity, AlertCircle, Loader, CheckCircle } from 'lucide-react'
import { authApi } from '../services/api'
import { deriveKeyPair, toB64 } from '../services/crypto'
import { getAccount, isDoctorRegistered, initDoctorStore, registerDoctor, isNmrOnChain } from '../services/aptos'
import { useAuthStore } from '../store/authStore'
import { generateMnemonic } from 'bip39'

const CONTRACT = import.meta.env.VITE_CONTRACT_ADDRESS

type Step = 'nmr' | 'mnemonic-login' | 'otp' | 'wallet' | 'registering'

function ErrorBox({ msg }: { msg: string }) {
  return (
    <div className="flex items-start gap-3 rounded-xl p-4 mb-6 text-sm text-red-400"
      style={{ background: '#ef44441a', border: '1px solid #ef444433' }}>
      <AlertCircle size={15} className="mt-0.5 shrink-0" />
      {msg}
    </div>
  )
}

export default function AuthPage() {
  const nav = useNavigate()
  const setSession = useAuthStore(s => s.setSession)

  const [step,        setStep]        = useState<Step>('nmr')
  const [nmrId,       setNmrId]       = useState('')
  const [mnemonic,    setMnemonic]    = useState('')
  const [genMnemonic, setGenMnemonic] = useState('')
  const [otp,         setOtp]         = useState('')
  const [walletMode,  setWalletMode]  = useState<'generate' | 'import' | null>(null)
  const [showWords,   setShowWords]   = useState(false)
  const [doctorInfo,  setDoctorInfo]  = useState<any>(null)
  const [loading,     setLoading]     = useState(false)
  const [error,       setError]       = useState('')
  const [copied,      setCopied]      = useState(false)

  // ── Helper: build and persist session ─────────────────────────────────────
  function buildAndSetSession(finalMnemonic: string, address: string, info: any) {
    const { privateKey, publicKey } = deriveKeyPair(finalMnemonic)
    setSession({
      walletAddress:    address,
      nmrId,
      mnemonic:         finalMnemonic,
      cryptoPrivateKey: toB64(privateKey),
      cryptoPublicKey:  toB64(publicKey),
      name:        info?.name         || '',
      council:     info?.council      || '',
      speciality:  info?.speciality   || '',
      regYear:     info?.reg_year     || '',
      qualifyYear: info?.qualify_year || '',
    })
  }

  // ── Step 1: Check NMR ─────────────────────────────────────────────────────
  async function checkNmr() {
    if (!nmrId.trim()) return
    setLoading(true); setError('')
    try {

      // ── 1a: Check blockchain — isNmrOnChain now THROWS on real errors ─────
      let onChain = false
      try {
        onChain = await isNmrOnChain(nmrId.trim())
      } catch (chainErr: any) {
        // Real error (missing CONTRACT, RPC down, etc.) — stop and show it
        setError('Blockchain check failed: ' + (chainErr.message || 'Could not reach Aptos node'))
        setLoading(false)
        return
      }

      if (onChain) {
        // ── EXISTING DOCTOR → ask mnemonic only, no OTP ───────────────────
        try {
          const res = await authApi.checkNmr(nmrId.trim())
          setDoctorInfo(res.data.doctorInfo)
        } catch { /* display info only — not critical */ }
        setStep('mnemonic-login')
        setLoading(false)
        return
      }

      // ── 1b: Not on chain → check State Medical Council DB ─────────────────
      const res = await authApi.checkNmr(nmrId.trim())
      const { status, doctorInfo: info } = res.data
      setDoctorInfo(info)

      if (status === 'council_registered') {
        // New doctor — OTP to verify identity
        await authApi.sendOtp(nmrId.trim())
        setStep('otp')
      } else {
        setError('This NMR ID is not registered with any State Medical Council.')
      }

    } catch (e: any) {
      setError(e.response?.data?.message || e.message || 'Something went wrong.')
    }
    setLoading(false)
  }

  // ── Step 2A: Login with mnemonic (existing on-chain doctor) ───────────────
  async function loginWithMnemonic() {
    if (mnemonic.trim().split(' ').length !== 12)
      return setError('Enter a valid 12-word mnemonic.')
    setLoading(true); setError('')
    try {
      const account    = getAccount(mnemonic.trim())
      const address    = account.accountAddress.toString()
      const registered = await isDoctorRegistered(address)

      if (!registered) {
        setLoading(false)
        return setError('No doctor account found for this mnemonic. Make sure you are using the correct mnemonic.')
      }

      buildAndSetSession(mnemonic.trim(), address, doctorInfo)
      nav('/dashboard')
    } catch {
      setError('Login failed. Please check your mnemonic.')
    }
    setLoading(false)
  }

  // ── Step 2B: Verify OTP (new doctor) ─────────────────────────────────────
  async function verifyOtp() {
    if (otp.length !== 6) return setError('Enter the 6-digit OTP.')
    setLoading(true); setError('')
    try {
      await authApi.verifyOtp(nmrId.trim(), otp)
      setStep('wallet')
    } catch (e: any) {
      setError(e.response?.data?.message || 'Invalid OTP.')
    }
    setLoading(false)
  }

  // ── Step 3: Complete registration ─────────────────────────────────────────
  async function completeRegistration() {
    const finalMnemonic = walletMode === 'generate' ? genMnemonic : mnemonic.trim()
    if (finalMnemonic.split(' ').length !== 12) return setError('Invalid mnemonic.')

    setStep('registering'); setError('')
    try {
      const account = getAccount(finalMnemonic)
      const address = account.accountAddress.toString()

      // Guard: if wallet already registered (e.g. re-registration after browser crash)
      const alreadyRegistered = await isDoctorRegistered(address)
      if (alreadyRegistered) {
        buildAndSetSession(finalMnemonic, address, doctorInfo)
        nav('/dashboard')
        return
      }

      // Fresh registration
      await initDoctorStore(account)
      await registerDoctor(
        account,
        nmrId.trim(),
        doctorInfo?.council             || '',
        doctorInfo?.reg_year            || '',
        doctorInfo?.qualify_year        || '',
        doctorInfo?.registration_number || 0,
        CONTRACT
      )

      buildAndSetSession(finalMnemonic, address, doctorInfo)
      nav('/dashboard')
    } catch (e: any) {
      setError('Registration failed: ' + (e.message || 'Unknown error'))
      setStep('wallet')
    }
  }

  function genNewMnemonic() {
    setGenMnemonic(generateMnemonic())
    setWalletMode('generate')
  }

  function copyMnemonic() {
    navigator.clipboard.writeText(genMnemonic)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#0a0a0a' }}>

      {/* Header */}
      <div className="p-6 flex items-center justify-between">
        <button onClick={() => nav('/')}
          className="flex items-center gap-2 text-gray-500 hover:text-white transition-colors text-sm">
          <ArrowLeft size={16} /> Back to home
        </button>
        <div className="flex items-center gap-2 font-bold text-lg">
          <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
            <Activity size={13} className="text-white" />
          </div>
          Medi<span className="text-primary">Nex</span>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">

          {/* ── Enter NMR ── */}
          {step === 'nmr' && (
            <div className="card rounded-3xl p-8">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-6"
                style={{ background: '#199a8e15' }}>
                <Activity size={22} className="text-primary" />
              </div>
              <h1 className="text-3xl font-bold mb-2">Doctor Portal</h1>
              <p className="text-gray-400 text-sm mb-8">
                Enter your NMR ID to verify credentials against the State Medical Council.
              </p>
              {error && <ErrorBox msg={error} />}
              <label className="block text-xs text-gray-500 mb-2 uppercase tracking-wider">NMR ID</label>
              <input
                value={nmrId}
                onChange={e => { setNmrId(e.target.value); setError('') }}
                onKeyDown={e => e.key === 'Enter' && checkNmr()}
                placeholder="e.g. AS-2024-00001"
                className="input-field mb-6"
                disabled={loading}
              />
              <button onClick={checkNmr} disabled={loading || !nmrId.trim()}
                className="btn-primary w-full py-3.5 rounded-xl flex items-center justify-center gap-2">
                {loading ? <Loader size={16} className="animate-spin" /> : 'Verify NMR ID →'}
              </button>
            </div>
          )}

          {/* ── Mnemonic Login (EXISTING doctor — on chain) ── */}
          {step === 'mnemonic-login' && (
            <div className="card rounded-3xl p-8">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-6"
                style={{ background: '#199a8e15' }}>
                <CheckCircle size={22} className="text-primary" />
              </div>
              <h1 className="text-2xl font-bold mb-1">Welcome back</h1>
              {doctorInfo?.name && (
                <p className="text-primary text-sm mb-2">{doctorInfo.name}</p>
              )}
              <p className="text-gray-400 text-sm mb-8">
                Your NMR is registered on-chain. Enter your 12-word mnemonic to unlock your account.
              </p>
              {error && <ErrorBox msg={error} />}
              <label className="block text-xs text-gray-500 mb-2 uppercase tracking-wider">
                12-Word Mnemonic
              </label>
              <div className="relative mb-6">
                <textarea
                  value={mnemonic}
                  onChange={e => { setMnemonic(e.target.value); setError('') }}
                  placeholder="word1 word2 word3 ... word12"
                  rows={3}
                  className="input-field resize-none font-mono text-sm w-full"
                  style={{ paddingRight: '44px', filter: showWords ? 'none' : 'blur(4px)' }}
                  disabled={loading}
                />
                <button
                  onClick={() => setShowWords(!showWords)}
                  className="absolute top-3 right-3 text-gray-500 hover:text-white transition-colors">
                  {showWords ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <button
                onClick={loginWithMnemonic}
                disabled={loading || mnemonic.trim().split(' ').length !== 12}
                className="btn-primary w-full py-3.5 rounded-xl flex items-center justify-center gap-2">
                {loading ? <Loader size={16} className="animate-spin" /> : 'Unlock & Login →'}
              </button>
              <button
                onClick={() => { setStep('nmr'); setMnemonic(''); setError('') }}
                className="w-full mt-3 py-2 text-sm text-gray-500 hover:text-gray-300 transition-colors">
                ← Back
              </button>
            </div>
          )}

          {/* ── OTP (NEW doctor only) ── */}
          {step === 'otp' && (
            <div className="card rounded-3xl p-8">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-6"
                style={{ background: '#199a8e15' }}>
                <CheckCircle size={22} className="text-primary" />
              </div>
              <h1 className="text-2xl font-bold mb-2">Verify Identity</h1>
              {doctorInfo?.name && (
                <p className="text-primary text-sm mb-1">{doctorInfo.name}</p>
              )}
              <p className="text-gray-400 text-sm mb-8">
                OTP sent to the phone number linked to your NMR ID in the council database.
              </p>
              {error && <ErrorBox msg={error} />}
              <label className="block text-xs text-gray-500 mb-2 uppercase tracking-wider">
                6-Digit OTP
              </label>
              <input
                value={otp}
                onChange={e => { setOtp(e.target.value.replace(/\D/g, '').slice(0, 6)); setError('') }}
                onKeyDown={e => e.key === 'Enter' && verifyOtp()}
                placeholder="000000"
                className="input-field text-center text-2xl tracking-widest font-mono mb-6"
                maxLength={6}
                inputMode="numeric"
                disabled={loading}
              />
              <button onClick={verifyOtp} disabled={loading || otp.length !== 6}
                className="btn-primary w-full py-3.5 rounded-xl flex items-center justify-center gap-2">
                {loading ? <Loader size={16} className="animate-spin" /> : 'Verify OTP →'}
              </button>
              <button
                onClick={async () => {
                  setLoading(true)
                  await authApi.sendOtp(nmrId)
                  setOtp('')
                  setLoading(false)
                }}
                className="w-full mt-3 py-2 text-sm text-gray-500 hover:text-primary transition-colors text-center">
                Resend OTP
              </button>
            </div>
          )}

          {/* ── Wallet Setup (NEW doctor) ── */}
          {step === 'wallet' && (
            <div className="card rounded-3xl p-8">
              <h1 className="text-2xl font-bold mb-2">Set Up Your Wallet</h1>
              <p className="text-gray-400 text-sm mb-8">
                Your wallet is used for blockchain transactions and encrypted report access.
              </p>
              {error && <ErrorBox msg={error} />}

              {!walletMode && (
                <div className="space-y-3">
                  <button onClick={genNewMnemonic}
                    className="w-full card rounded-2xl p-5 text-left hover:border-primary transition-all">
                    <div className="font-semibold mb-1">Generate New Wallet</div>
                    <div className="text-sm text-gray-500">Create a fresh 12-word mnemonic phrase.</div>
                  </button>
                  <button onClick={() => setWalletMode('import')}
                    className="w-full card rounded-2xl p-5 text-left hover:border-primary transition-all">
                    <div className="font-semibold mb-1">Import Existing Wallet</div>
                    <div className="text-sm text-gray-500">Already have a 12-word mnemonic? Import it.</div>
                  </button>
                </div>
              )}

              {walletMode === 'generate' && genMnemonic && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs text-gray-500 uppercase tracking-wider">Save this mnemonic!</span>
                    <button onClick={copyMnemonic} className="text-xs text-primary flex items-center gap-1">
                      <Copy size={12} /> {copied ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                  <div className="grid grid-cols-3 gap-2 mb-4">
                    {genMnemonic.split(' ').map((word, i) => (
                      <div key={i} className="rounded-xl px-3 py-2 text-center text-sm"
                        style={{ background: '#1a1a1a', border: '1px solid #222' }}>
                        <span className="text-gray-600 text-xs mr-1">{i + 1}.</span>
                        <span className={`font-mono ${showWords ? '' : 'blur-sm select-none'}`}>{word}</span>
                      </div>
                    ))}
                  </div>
                  <button onClick={() => setShowWords(!showWords)}
                    className="text-xs text-gray-500 hover:text-gray-300 flex items-center gap-1 mb-4 transition-colors">
                    {showWords ? <EyeOff size={12} /> : <Eye size={12} />}
                    {showWords ? 'Hide' : 'Reveal'} words
                  </button>
                  <div className="text-sm text-yellow-400 rounded-xl p-4 mb-6"
                    style={{ background: '#f59e0b0d', border: '1px solid #f59e0b22' }}>
                    ⚠️ Save this mnemonic safely. It cannot be recovered if lost.
                  </div>
                  <button onClick={completeRegistration}
                    className="btn-primary w-full py-3.5 rounded-xl">
                    I've saved it — Register on Blockchain →
                  </button>
                </div>
              )}

              {walletMode === 'import' && (
                <div>
                  <label className="block text-xs text-gray-500 mb-2 uppercase tracking-wider">
                    Your 12-Word Mnemonic
                  </label>
                  <textarea
                    value={mnemonic}
                    onChange={e => { setMnemonic(e.target.value); setError('') }}
                    placeholder="word1 word2 word3 ... word12"
                    rows={3}
                    className="input-field resize-none font-mono text-sm mb-6"
                    disabled={loading}
                  />
                  <button
                    onClick={completeRegistration}
                    disabled={loading || mnemonic.trim().split(' ').length !== 12}
                    className="btn-primary w-full py-3.5 rounded-xl flex items-center justify-center gap-2">
                    {loading ? <Loader size={16} className="animate-spin" /> : 'Register on Blockchain →'}
                  </button>
                  <button onClick={() => setWalletMode(null)}
                    className="w-full mt-3 py-2 text-sm text-gray-500 hover:text-gray-300 transition-colors">
                    ← Back
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ── Registering spinner ── */}
          {step === 'registering' && (
            <div className="card rounded-3xl p-8 text-center">
              <div className="w-16 h-16 rounded-full border-2 border-primary border-t-transparent animate-spin mx-auto mb-6" />
              <h2 className="text-2xl font-bold mb-2">Registering on Blockchain</h2>
              <p className="text-gray-400 text-sm">Submitting transaction to Aptos testnet…</p>
              {error && <div className="mt-6"><ErrorBox msg={error} /></div>}
            </div>
          )}

        </div>
      </div>
    </div>
  )
}