export interface DoctorSession {
  walletAddress: string
  nmrId: string
  cryptoPrivateKey: string
  cryptoPublicKey: string
  mnemonic: string
  name: string
  council: string
  speciality: string
  regYear: string
  qualifyYear: string
}

export interface ReportMeta {
  id: number
  cid: string
  patientAddress: string
  uploadedAt: number
}

export interface GrantedReport {
  reportId: number
  patientAddress: string
  encryptedAesKey: string
  cid: string
  patientCryptoPubkey: string
}