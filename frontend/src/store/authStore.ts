import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { DoctorSession } from '../types'

interface AuthStore {
  session: DoctorSession | null
  setSession: (s: DoctorSession) => void
  clearSession: () => void
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      session: null,
      setSession: (s) => set({ session: s }),
      clearSession: () => {
        set({ session: null })
        localStorage.removeItem('medinex-auth')
      },
    }),
    { name: 'medinex-auth' }
  )
)