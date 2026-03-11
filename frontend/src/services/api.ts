import axios from 'axios'

const api = axios.create({ baseURL: '/api' })

export const authApi = {
  checkNmr:  (nmrId: string)               => api.post('/auth/check-nmr',  { nmrId }),
  sendOtp:   (nmrId: string)               => api.post('/auth/send-otp',   { nmrId }),
  verifyOtp: (nmrId: string, otp: string)  => api.post('/auth/verify-otp', { nmrId, otp }),
}