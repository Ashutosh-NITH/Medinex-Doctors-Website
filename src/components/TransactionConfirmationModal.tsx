import { createRoot } from 'react-dom/client'

interface FeeInfo {
  functionName: string
  gasUsed: number
  gasUnitPrice: number
  networkFeeApt: number
}

interface Props extends FeeInfo {
  onConfirm: () => void
  onCancel: () => void
}

function friendlyName(functionId: string): string {
  const raw = functionId.split('::').pop() ?? functionId
  return raw.replace(/([A-Z])/g, ' $1').trim().replace(/^./, c => c.toUpperCase())
}

function Row({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px' }}>
      <span style={{ fontSize: 13, color: '#888' }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 500, fontFamily: mono ? 'monospace' : undefined }}>{value}</span>
    </div>
  )
}

function Modal({ functionName, gasUsed, gasUnitPrice, networkFeeApt, onConfirm, onCancel }: Props) {
  const simulated = gasUsed > 0

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onCancel() }}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '0 16px',
      }}
    >
      <div style={{
        background: 'var(--modal-bg, #fff)',
        borderRadius: 20, width: '100%', maxWidth: 420,
        padding: '24px 20px',
        color: 'var(--modal-text, #111)',
      }}>
        {/* Header */}
        <p style={{ fontSize: 11, letterSpacing: '0.08em', color: '#888', margin: '0 0 4px', textTransform: 'uppercase' }}>
          Confirm transaction
        </p>
        <h2 style={{ margin: '0 0 20px', fontSize: 20, fontWeight: 600 }}>
          {friendlyName(functionName)}
        </h2>

        {/* Details */}
        <div style={{ background: 'var(--modal-card, #f5f5f5)', borderRadius: 12, marginBottom: 12, overflow: 'hidden' }}>
          <Row label="Function" value={functionName.split('::').pop() ?? ''} mono />
          <div style={{ height: 1, background: 'rgba(0,0,0,0.06)' }} />
          <Row label="Network" value="Aptos Testnet" />
        </div>

        {/* Fee */}
        <div style={{ background: 'var(--modal-card, #f5f5f5)', borderRadius: 12, marginBottom: 24, overflow: 'hidden' }}>
          <Row label={simulated ? 'Gas used (simulated)' : 'Max gas units'} value={simulated ? gasUsed.toString() : '2000'} />
          <div style={{ height: 1, background: 'rgba(0,0,0,0.06)' }} />
          <Row label="Gas unit price" value={`${gasUnitPrice} octas`} />
          <div style={{ height: 1, background: 'rgba(0,0,0,0.06)' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px' }}>
            <span style={{ fontWeight: 600, fontSize: 14 }}>Network fee</span>
            <div style={{ textAlign: 'right' }}>
              <p style={{ margin: 0, fontWeight: 600, fontSize: 15, color: '#199a8e' }}>
                ~ {networkFeeApt.toFixed(8)} APT
              </p>
              <p style={{ margin: 0, fontSize: 11, color: '#888' }}>
                {simulated ? 'from simulation · actual may vary slightly' : 'estimation · simulation unavailable'}
              </p>
            </div>
          </div>
        </div>

        {/* Buttons */}
        <div style={{ display: 'flex', gap: 12 }}>
          <button
            onClick={onCancel}
            style={{
              flex: 1, padding: '13px 0', borderRadius: 12, border: '1px solid rgba(0,0,0,0.15)',
              background: 'transparent', cursor: 'pointer', fontSize: 14,
              color: 'var(--modal-text, #111)',
            }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            style={{
              flex: 2, padding: '13px 0', borderRadius: 12, border: 'none',
              background: '#199a8e', color: '#fff', fontWeight: 600,
              cursor: 'pointer', fontSize: 14,
            }}
          >
            Confirm & submit
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Promise-based imperative API — works outside React ────────────────────
export function confirmTransaction(fee: FeeInfo): Promise<boolean> {
  return new Promise(resolve => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)

    const cleanup = (result: boolean) => {
      root.unmount()
      container.remove()
      resolve(result)
    }

    root.render(
      <Modal
        {...fee}
        onConfirm={() => cleanup(true)}
        onCancel={() => cleanup(false)}
      />
    )
  })
}