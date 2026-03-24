import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'
import { login as apiLogin, register as apiRegister, setToken, getMe } from '../api/client'
import type { UserResponse } from '../types/api'

interface AuthContextType {
  user: UserResponse | null
  isLoading: boolean
  signIn: (username: string, password: string) => Promise<void>
  signUp: (username: string, email: string, password: string) => Promise<void>
  signOut: () => void
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserResponse | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const signIn = useCallback(async (username: string, password: string) => {
    setIsLoading(true)
    try {
      const { access_token } = await apiLogin(username, password)
      setToken(access_token)
      const me = await getMe()
      setUser(me)
    } finally {
      setIsLoading(false)
    }
  }, [])

  const signUp = useCallback(async (username: string, email: string, password: string) => {
    setIsLoading(true)
    try {
      await apiRegister(username, email, password)
      await signIn(username, password)
    } finally {
      setIsLoading(false)
    }
  }, [signIn])

  const signOut = useCallback(() => {
    setToken(null)
    setUser(null)
  }, [])

  return (
    <AuthContext.Provider value={{ user, isLoading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
