import { useSession, signOut } from '@/lib/auth-client'
import { useNavigate } from 'react-router-dom'
import { useCallback } from 'react'

export function useAuth() {
  const { data: session, isPending } = useSession()
  const navigate = useNavigate()

  const logout = useCallback(async () => {
    await signOut()
    navigate('/login')
  }, [navigate])

  return {
    user: session?.user ?? null,
    session: session?.session ?? null,
    isLoading: isPending,
    isAuthenticated: !!session?.user,
    logout,
  }
}
