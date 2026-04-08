import { Aptos, AptosConfig, Network, Account } from '@aptos-labs/ts-sdk'

const CONTRACT = import.meta.env.VITE_CONTRACT_ADDRESS as string
const aptos = new Aptos(new AptosConfig({ network: Network.TESTNET }))

export function getAccount(mnemonic: string): Account {
  return Account.fromDerivationPath({ path: "m/44'/637'/0'/0'/0'", mnemonic })
}

async function view(fn: string, args: any[]): Promise<any[]> {
  return aptos.view({
    payload: { function: fn as any, typeArguments: [], functionArguments: args }
  })
}

export async function estimateGasFee(
  account: Account,
  fn: string,
  args: any[]
): Promise<{ gasUsed: number; gasUnitPrice: number; networkFeeApt: number }> {
  try {
    const txn = await aptos.transaction.build.simple({
      sender: account.accountAddress,
      data: { function: fn as any, typeArguments: [], functionArguments: args }
    })
    const [simResult] = await aptos.transaction.simulate.simple({
      signerPublicKey: account.publicKey,
      transaction: txn,
      options: { estimateGasUnitPrice: true, estimateMaxGasAmount: true }
    })
    const gasUsed = Number(simResult.gas_used ?? 0)
    const gasUnitPrice = Number(simResult.gas_unit_price ?? 100)
    return { gasUsed, gasUnitPrice, networkFeeApt: (gasUsed * gasUnitPrice) / 1e8 }
  } catch {
    return { gasUsed: 0, gasUnitPrice: 100, networkFeeApt: 0.000002 }
  }
}

// ── Global confirmation gate ───────────────────────────────────────────────
// Components set this to show a dialog; submit() awaits the user's decision.
type ConfirmFn = (fee: { functionName: string; gasUsed: number; gasUnitPrice: number; networkFeeApt: number }) => Promise<boolean>
let _requestConfirm: ConfirmFn | null = null

export function registerConfirmHandler(fn: ConfirmFn) {
  _requestConfirm = fn
}

// ── Core submit — builds, estimates, confirms, then submits ───────────────
async function submit(account: Account, fn: string, args: any[]): Promise<void> {
  const txn = await aptos.transaction.build.simple({
    sender: account.accountAddress,
    data: { function: fn as any, typeArguments: [], functionArguments: args }
  })

  // Estimate gas
  const fee = await estimateGasFee(account, fn, args)

  // Ask user if a confirm handler is registered
  if (_requestConfirm) {
    const confirmed = await _requestConfirm({ functionName: fn, ...fee })
    if (!confirmed) throw new Error('Transaction cancelled by user')
  }

  const res = await aptos.signAndSubmitTransaction({ signer: account, transaction: txn })
  await aptos.waitForTransaction({ transactionHash: res.hash })
}

const F = (name: string) => `${CONTRACT}::${name}`

// ── All exports unchanged ─────────────────────────────────────────────────
export async function isNmrOnChain(nmr: string): Promise<boolean> {
  if (!CONTRACT) throw new Error('CONTRACT address not configured in .env')
  try {
    const r = await view(F('DoctorRegistryContract::isNMRIDRegister'), [CONTRACT, nmr])
    return !!r[0]
  } catch (e: any) {
    const msg = e?.message || ''
    if (msg.includes('ABORTED') || msg.includes('abort_code') || msg.includes('execution failed')) return false
    throw e
  }
}

export const isDoctorRegistered  = (a: string) => view(F('DoctorRegistryContract::isDoctorRegistered'), [a]).then(r => !!r[0]).catch(() => false)
export const isPatientRegistered = (a: string) => view(F('PatientRegistryContract::isPatientRegistered'), [a]).then(r => !!r[0]).catch(() => false)
export const getPatientData      = (a: string) => view(F('PatientRegistryContract::getPatientData'), [a]).catch(() => [])
export const getAllReportsID      = (a: string) => view(F('PatientReportsContract::getAllReportsID'), [a]).then(r => (r[0] as string[]).map(Number)).catch(() => [] as number[])
export const getReportById       = (id: number) => view(F('PatientReportsContract::getReportbyID'), [id.toString()]).then(r => ({ patientAddress: r[0] as string, id: Number(r[1]), cid: r[2] as string, uploadedAt: Number(r[3]) })).catch(() => null)
export const getDoctorGranted    = (a: string) => view(F('ReportAccessContract::getDoctorGrantedReports'), [a]).then(r => (r[0] as string[]).map(Number)).catch(() => [] as number[])
export const getEncryptedKey     = (doc: string, id: number) => view(F('ReportAccessContract::getEncryptedKey'), [doc, id.toString()]).then(r => r[0] as string).catch(() => null)
export const getSignatures       = (reportId: number) => view(F('ReportSignatureContract::getSignatures'), [reportId.toString(), CONTRACT]).then(r => (r[0] as any[]) || []).catch(() => [])
export const isReportSigned      = (reportId: number) => view(F('ReportSignatureContract::isReportSigned'), [reportId.toString(), CONTRACT]).then(r => !!r[0]).catch(() => false)
export const isSignedByDoctor    = (reportId: number, doctorAddress: string) => view(F('ReportSignatureContract::isSignedByDoctor'), [reportId.toString(), doctorAddress, CONTRACT]).then(r => !!r[0]).catch(() => false)
export const getPendingSignatureRequests = (doctorAddress: string) => view(F('ReportSignatureContract::getPendingRequestsForDoctor'), [doctorAddress, CONTRACT]).then(r => (r[0] as any[]) || []).catch(() => [])

export const initDoctorStore    = (acc: Account) => submit(acc, F('ReportAccessContract::initDoctorAccessStore'), []).catch(() => {})
export const requestAccess      = (acc: Account, patient: string, id: number, pubkey: string) => submit(acc, F('ReportAccessContract::requestAccess'), [patient, id.toString(), pubkey])
export const registerDoctor     = (acc: Account, nmrId: string, council: string, regYear: string, qualYear: string, regNum: number, owner: string) => submit(acc, F('DoctorRegistryContract::registerDoctor'), [regNum, nmrId, council, regYear, qualYear, '', owner])
export const signReport         = (acc: Account, reportId: number, reportCid: string, signature: string, doctorPubkey: string) => submit(acc, F('ReportSignatureContract::signReport'), [reportId.toString(), reportCid, signature, doctorPubkey, CONTRACT])
export const declineSignature   = (acc: Account, reportId: number, patientAddress: string) => submit(acc, F('ReportSignatureContract::declineSignature'), [reportId.toString(), patientAddress, CONTRACT])
export const requestSignature   = (acc: Account, doctorAddress: string, reportId: number) => submit(acc, F('ReportSignatureContract::requestSignature'), [doctorAddress, reportId.toString(), CONTRACT])