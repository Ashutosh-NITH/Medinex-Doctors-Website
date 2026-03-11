import { useNavigate } from 'react-router-dom'
import { Shield, Lock, Globe, Key, ArrowRight, Download, Stethoscope, Activity } from 'lucide-react'

export default function LandingPage() {
  const nav = useNavigate()

  return (
    <div className="min-h-screen" style={{ background: '#0a0a0a' }}>

      {/* Navbar */}
      <nav style={{ borderBottom: '1px solid #1a1a1a', background: '#0a0a0aee', backdropFilter: 'blur(12px)' }}
        className="fixed top-0 inset-x-0 z-50">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-lg">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Activity size={15} className="text-white" />
            </div>
            Medi<span className="text-primary">Nex</span>
          </div>
          <button onClick={() => nav('/auth')}
            className="btn-primary px-5 py-2 rounded-xl text-sm flex items-center gap-2">
            <Stethoscope size={14} /> Doctor Portal
          </button>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-36 pb-24 px-6 text-center relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse 80% 40% at 50% 0%, #199a8e18, transparent)' }} />
        <div className="relative max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 text-primary text-xs px-4 py-2 rounded-full font-mono mb-8"
            style={{ background: '#199a8e10', border: '1px solid #199a8e33' }}>
            <span className="w-1.5 h-1.5 bg-primary rounded-full" />
            Powered by Aptos Blockchain + IPFS
          </div>
          <h1 className="text-5xl md:text-7xl font-bold leading-tight mb-6 tracking-tight">
            Your Health Records,<br />
            <span className="text-primary">Truly Yours</span>
          </h1>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto mb-12 leading-relaxed">
            MediNex gives patients complete ownership of medical data using end-to-end
            encryption, decentralized storage, and blockchain access control.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button onClick={() => nav('/auth')}
              className="btn-primary px-8 py-4 rounded-2xl text-base flex items-center justify-center gap-3">
              <Stethoscope size={18} /> Doctor Portal <ArrowRight size={16} />
            </button>
            <button className="btn-outline px-8 py-4 rounded-2xl text-base flex items-center justify-center gap-3">
              <Download size={18} /> Download Patient App
            </button>
          </div>
          <div className="mt-12 flex flex-wrap justify-center gap-6 text-xs text-gray-600 font-mono">
            {['AES-256-GCM', 'X25519 ECDH', 'PBKDF2 · 150k iter', 'Aptos Testnet'].map(t => <span key={t}>{t}</span>)}
          </div>
        </div>
      </section>

      {/* Stats */}
      <div style={{ borderTop: '1px solid #1a1a1a', borderBottom: '1px solid #1a1a1a', background: '#0d0d0d' }}
        className="py-10">
        <div className="max-w-4xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {[['256-bit','AES Encryption'],['150K','PBKDF2 Iterations'],['0','Central Servers'],['100%','Patient Owned']].map(([v,l]) => (
            <div key={l}>
              <div className="text-3xl font-bold text-primary mb-1">{v}</div>
              <div className="text-sm text-gray-500">{l}</div>
            </div>
          ))}
        </div>
      </div>

      {/* How it works */}
      <section className="py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-xs text-primary font-mono mb-3 tracking-widest">HOW IT WORKS</p>
            <h2 className="text-4xl font-bold mb-3">Cryptography you can trust</h2>
            <p className="text-gray-400">Every step verifiable. Every key stays on your device.</p>
          </div>
          <div className="grid md:grid-cols-4 gap-5">
            {[
              ['01','Patient Uploads',  'File encrypted on device, stored on IPFS. CID registered on Aptos.'],
              ['02','Doctor Requests',  'Doctor sends crypto public key on-chain to request access.'],
              ['03','Patient Grants',   'Patient re-encrypts AES key for doctor using X25519 ECDH.'],
              ['04','Doctor Opens',     'Doctor decrypts their AES key and reads the file in browser.'],
            ].map(([n,title,desc]) => (
              <div key={n} className="card rounded-2xl p-6">
                <div className="text-4xl font-bold mb-4" style={{ color: '#199a8e25' }}>{n}</div>
                <div className="font-semibold mb-2">{title}</div>
                <div className="text-gray-500 text-sm leading-relaxed">{desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-24 px-6" style={{ background: '#0d0d0d', borderTop: '1px solid #1a1a1a', borderBottom: '1px solid #1a1a1a' }}>
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-xs text-primary font-mono mb-3 tracking-widest">FEATURES</p>
            <h2 className="text-4xl font-bold">Built for security-first healthcare</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-5">
            {[
              [Lock,       'AES-256-GCM Encrypted',      'Every report encrypted on device. Only authorized parties can read it.'],
              [Shield,     'Blockchain Access Control',   'Permissions on Aptos — immutable, transparent, tamper-proof.'],
              [Globe,      'IPFS Decentralized Storage',  'Files on IPFS. No central server, no single point of failure.'],
              [Key,        'Self-Sovereign Keys',         'Your X25519 keypair derived from your mnemonic. Nobody else holds them.'],
              [Stethoscope,'Verified Doctors Only',       'Every doctor verified against State Medical Council records.'],
              [Activity,   'Full Audit Trail',            'Every access request and grant recorded on-chain forever.'],
            ].map(([Icon, title, desc]: any) => (
              <div key={title} className="card rounded-2xl p-6">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4"
                  style={{ background: '#199a8e15' }}>
                  <Icon size={18} className="text-primary" />
                </div>
                <div className="font-semibold mb-2">{title}</div>
                <div className="text-gray-500 text-sm leading-relaxed">{desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-6">
        <div className="max-w-2xl mx-auto text-center card rounded-3xl p-12"
          style={{ borderColor: '#199a8e33', boxShadow: '0 0 40px #199a8e12' }}>
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-6"
            style={{ background: '#199a8e15' }}>
            <Stethoscope size={26} className="text-primary" />
          </div>
          <h2 className="text-3xl font-bold mb-4">Are you a verified doctor?</h2>
          <p className="text-gray-400 mb-8">
            Your identity is verified against the State Medical Council registry before access is granted.
          </p>
          <button onClick={() => nav('/auth')}
            className="btn-primary px-10 py-4 rounded-2xl text-base flex items-center gap-3 mx-auto">
            Enter Doctor Portal <ArrowRight size={16} />
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ borderTop: '1px solid #1a1a1a' }} className="py-8 px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-gray-600">
          <div className="flex items-center gap-2 font-bold">
            <div className="w-6 h-6 rounded-md bg-primary flex items-center justify-center">
              <Activity size={12} className="text-white" />
            </div>
            Medi<span className="text-primary">Nex</span>
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