import { useNavigate } from 'react-router-dom'
import { Shield, Lock, Globe, Key, ArrowRight, Download, Stethoscope, Activity } from 'lucide-react'
import { useTheme } from '../ThemeContext'


export default function LandingPage() {
  const nav = useNavigate()
  const { theme, toggle } = useTheme()
  const darkMode = theme === 'dark'

  const bg      = darkMode ? '#0f172a' : '#ebf7f6'
  const surface = darkMode ? '#1e293b' : '#ffffff'
  const card    = darkMode ? '#1e293b' : '#f0faf9'
  const heading = darkMode ? '#e2e8f0' : '#64748b'
  const subtext = darkMode ? '#94a3b8' : '#6b7280'
  const border  = darkMode ? '#334155' : '#f1f5f9'

  return (
    <div className="min-h-screen transition-colors duration-500" style={{ background: bg }}>

      {/* Navbar */}
      <nav
        className="fixed top-0 inset-x-0 z-50 backdrop-blur-md shadow-[0_4px_20px_rgb(0,0,0,0.12)] transition-all duration-500"
        style={{ background: darkMode ? 'rgba(15,23,42,0.85)' : 'rgba(255,255,255,0.85)' }}
      >
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">

          {/* Logo */}
          <div className="flex items-center gap-2 font-bold text-lg">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Activity size={15} className="text-white" />
            </div>
            <span style={{ color: darkMode ? '#cbd5e1' : '#64748b' }}>Medi</span>
            <span className="text-primary">Nex</span>
          </div>

          {/* Right */}
          <div className="flex items-center gap-4">

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

            {/* Doctor Portal */}
            <button
              type="button"
              onClick={() => nav('/auth')}
              className="btn-primary px-5 py-2 rounded-xl text-sm flex items-center gap-2"
            >
              <Stethoscope size={14} /> Doctor Portal
            </button>

          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden" style={{ background: bg }}>
        <div className="pt-20 pb-0 flex justify-center relative z-10">
          <div className="inline-flex items-center gap-2 text-primary text-xs px-4 py-2 rounded-full font-mono"
            style={{ background: '#199a8e10', border: '1px solid #199a8e33' }}>
            <span className="w-1.5 h-1.5 bg-primary rounded-full" />
            Powered by Aptos Blockchain + IPFS
          </div>
        </div>

        <div className="absolute inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse 80% 40% at 50% 0%, #199a8e18, transparent)' }} />

        <div className="relative max-w-6xl mx-auto px-6 w-full pb-20">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-start">

            <div className="pt-16">
              <h1 className="text-5xl md:text-6xl font-bold leading-tight mb-6 tracking-tight"
                style={{ color: heading }}>
                Your Health Records,<br />
                <span className="text-primary">Truly Yours</span>
              </h1>
              <p className="text-lg mb-10 leading-relaxed max-w-md" style={{ color: subtext }}>
                MediNex gives patients complete ownership of medical data using end-to-end
                encryption, decentralized storage, and blockchain access control.
              </p>
              <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs font-mono" style={{ color: subtext }}>
                {['AES-256-GCM', 'X25519 ECDH', 'PBKDF2 · 150k iter', 'Aptos Testnet'].map((t, i) => (
                  <span key={t} className="flex items-center gap-2">
                    {i > 0 && <span style={{ color: '#199a8e40' }}>·</span>}
                    {t}
                  </span>
                ))}
              </div>
            </div>

            <div className="pt-16 flex flex-col gap-4">
              <div className="rounded-2xl p-6 transition-colors duration-500"
                style={{ background: surface, border: `1px solid ${border}`, boxShadow: '0 4px 24px rgba(0,0,0,0.06)' }}>
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: '#199a8e15' }}>
                    <Stethoscope size={20} className="text-primary" />
                  </div>
                  <div className="font-bold text-lg" style={{ color: heading }}>Doctor Portal</div>
                </div>
                <p className="text-sm mb-5 leading-relaxed" style={{ color: subtext }}>
                  Access your verified doctor account to view patient reports, manage access requests, and sign medical documents on-chain.
                </p>
                <button onClick={() => nav('/auth')}
                  className="btn-primary px-6 py-2 rounded-lg text-sm flex items-center justify-center gap-2 mx-auto"
                  style={{ width: '60%' }}>
                  <Stethoscope size={14} /> Open Doctor Portal <ArrowRight size={13} />
                </button>
              </div>

              <div className="rounded-2xl p-6 transition-colors duration-500"
                style={{ background: surface, border: `1px solid ${border}`, boxShadow: '0 4px 24px rgba(0,0,0,0.06)' }}>
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: '#199a8e15' }}>
                    <Download size={20} className="text-primary" />
                  </div>
                  <div className="font-bold text-lg" style={{ color: heading }}>Patient App</div>
                </div>
                <p className="text-sm mb-5 leading-relaxed" style={{ color: subtext }}>
                  Download the MediNex Patient App to securely manage and share your encrypted medical records anytime, anywhere.
                </p>
                  <button
                    onClick={() => {
                      const a = document.createElement('a');
                      a.href = 'https://github.com/Ashutosh-NITH/patient-app/releases/download/v1.0.0/patient.apk';
                      a.download = 'MediNex.apk';
                      a.click();
                    }}
                    className="px-6 py-2 rounded-lg text-sm flex items-center justify-center gap-2 mx-auto transition-colors"
                    style={{ border: '1.5px solid #199a8e', color: '#199a8e', background: 'transparent', width: '60%' }}>
                    <Download size={14} /> Download Patient App
                  </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <div className="py-16 shadow-[0_4px_30px_-10px_rgba(0,0,0,0.20)] relative z-10 transition-colors duration-500"
        style={{ background: surface }}>
        <div className="max-w-4xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {[['256-bit','AES Encryption'],['150K','PBKDF2 Iterations'],['0','Central Servers'],['100%','Patient Owned']].map(([v,l]) => (
            <div key={l}>
              <div className="text-3xl font-bold text-primary mb-1">{v}</div>
              <div className="text-sm font-medium" style={{ color: subtext }}>{l}</div>
            </div>
          ))}
        </div>
      </div>

      {/* How it works */}
      <section className="py-24 px-6 transition-colors duration-500" style={{ background: bg }}>
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-xs text-primary font-mono mb-3 tracking-widest">HOW IT WORKS</p>
            <h2 className="text-4xl font-bold mb-3" style={{ color: heading }}>Cryptography you can trust</h2>
            <p style={{ color: subtext }}>Every step verifiable. Every key stays on your device.</p>
          </div>
          <div className="grid md:grid-cols-4 gap-5">
            {[
              ['01','Patient Uploads',  'File encrypted on device, stored on IPFS. CID registered on Aptos.'],
              ['02','Doctor Requests',  'Doctor sends crypto public key on-chain to request access.'],
              ['03','Patient Grants',   'Patient re-encrypts AES key for doctor using X25519 ECDH.'],
              ['04','Doctor Opens',     'Doctor decrypts their AES key and reads the file in browser.'],
            ].map(([n, title, desc]) => (
              <div key={n} className="rounded-3xl p-8 flex flex-col gap-3 transition-colors duration-500"
                style={{ background: surface, border: `1px solid ${border}` }}>
                <div className="text-5xl font-extrabold mb-3" style={{ color: '#199a8e40' }}>{n}</div>
                <div className="font-bold text-xl mb-2 text-[#1a9988]">{title}</div>
                <div className="text-sm leading-relaxed" style={{ color: subtext }}>{desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-24 px-6 shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.20)] transition-colors duration-500"
        style={{ background: surface }}>
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-xs text-primary font-mono mb-3 tracking-widest font-bold">FEATURES</p>
            <h2 className="text-4xl font-bold text-[#1a9988]">Built for security-first healthcare</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              [Lock,        'AES-256-GCM Encrypted',     'Every report encrypted on device. Only authorized parties can read it.'],
              [Shield,      'Blockchain Access Control',  'Permissions on Aptos — immutable, transparent, tamper-proof.'],
              [Globe,       'IPFS Decentralized Storage', 'Files on IPFS. No central server, no single point of failure.'],
              [Key,         'Self-Sovereign Keys',        'Your X25519 keypair derived from your mnemonic. Nobody else holds them.'],
              [Stethoscope, 'Verified Doctors Only',      'Every doctor verified against State Medical Council records.'],
              [Activity,    'Full Audit Trail',           'Every access request and grant recorded on-chain forever.'],
            ].map(([Icon, title, desc]: any) => (
              <div key={title} className="rounded-3xl p-8 transition-all duration-500"
                style={{ backgroundColor: card, border: `1px solid ${border}` }}>
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-6" style={{ background: '#199a8e15' }}>
                  <Icon size={22} className="text-primary" />
                </div>
                <div className="font-bold text-xl mb-3" style={{ color: darkMode ? '#5eead4' : '#0a4f45' }}>{title}</div>
                <div className="text-sm leading-relaxed" style={{ color: subtext }}>{desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-6 transition-colors duration-500" style={{ background: bg }}>
        <div className="max-w-2xl mx-auto text-center rounded-3xl p-12 transition-colors duration-500"
          style={{ background: surface, border: '1px solid #199a8e33', boxShadow: '0 20px 40px rgba(0,0,0,0.06)' }}>
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-6" style={{ background: '#199a8e15' }}>
            <Stethoscope size={26} className="text-primary" />
          </div>
          <h2 className="text-3xl font-bold mb-4" style={{ color: heading }}>Are you a verified doctor?</h2>
          <p className="mb-8 max-w-md mx-auto" style={{ color: subtext }}>
            Your identity is verified against the State Medical Council registry before access is granted.
          </p>
          <button onClick={() => nav('/auth')}
            className="btn-primary px-10 py-4 rounded-2xl text-base flex items-center gap-3 mx-auto shadow-lg shadow-primary/20 hover:scale-105 transition-transform">
            Enter Doctor Portal <ArrowRight size={16} />
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-6 transition-colors duration-500"
        style={{ background: surface, borderTop: `1px solid ${border}` }}>
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-sm"
          style={{ color: subtext }}>
          <div className="flex items-center gap-2 font-bold">
            <div className="w-6 h-6 rounded-md bg-primary flex items-center justify-center">
              <Activity size={12} className="text-white" />
            </div>
            <span style={{ color: heading }}>Medi</span>
            <span className="text-primary">Nex</span>
          </div>
          <span>Aptos · IPFS · AES-256-GCM · X25519</span>
          <a href="https://github.com/Ashutosh-NITH/medinex-contracts" target="_blank"
            className="hover:text-primary transition-colors">
            Smart Contracts →
          </a>
        </div>
      </footer>

    </div>
  )
}