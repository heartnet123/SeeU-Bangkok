'use client'

import { useAuth } from '@/contexts/auth-context'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { Loader2 } from 'lucide-react'

interface ProtectedRouteProps {
  children: React.ReactNode
  fallback?: React.ReactNode
  requireAuth?: boolean
}

export function ProtectedRoute({ 
  children, 
  fallback,
  requireAuth = true 
}: ProtectedRouteProps) {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading) {
      if (requireAuth && !user) {
        router.push('/auth/login')
      } else if (!requireAuth && user) {
        router.push('/')
      }
    }
  }, [user, loading, requireAuth, router])

  if (loading) {
    return fallback || (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  if (requireAuth && !user) {
    return fallback || null
  }

  if (!requireAuth && user) {
    return fallback || null
  }

  return <>{children}</>
}

// Hook for protecting pages without wrapper component
export function useProtectedRoute(requireAuth: boolean = true) {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading) {
      if (requireAuth && !user) {
        router.push('/auth/login')
      } else if (!requireAuth && user) {
        router.push('/')
      }
    }
  }, [user, loading, requireAuth, router])

  return { user, loading, isAuthorized: requireAuth ? !!user : !user }
}