'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import type { User, Session, AuthError } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'

export interface OnboardingPreferences {
  vibes: string[]
  travelStyle: string
  pace: number
  transit: string[]
  culinary: string[]
  boundaries: string[]
}

interface UserProfile {
  user_id: string
  nick_name: string
  avatar_url?: string
  birth_year?: number
  travel_style?: string[]
  mobility?: 'walk' | 'bike' | 'public' | 'grab'
  budget_per_day?: number
  languages?: string[]
  onboarding_completed?: boolean
  onboarding_completed_at?: string
  onboarding_skipped_at?: string
  onboarding_preferences?: OnboardingPreferences
  updated_at: string
}

interface AuthContextType {
  user: User | null
  session: Session | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error: AuthError | null }>
  signUp: (email: string, password: string, metadata?: { display_name?: string }) => Promise<{ error: AuthError | null }>
  signOut: () => Promise<{ error: AuthError | null }>
  resetPassword: (email: string) => Promise<{ error: AuthError | null }>
  getProfile: () => Promise<{ profile: UserProfile | null; error: any | null }>
  updateProfile: (updates: { nick_name?: string; avatar_url?: string; birth_year?: number; travel_style?: string[]; mobility?: 'walk' | 'bike' | 'public' | 'grab'; budget_per_day?: number; languages?: string[] }) => Promise<{ profile: UserProfile | null; error: any | null }>
  getOnboardingStatus: () => Promise<{ completed: boolean; skipped: boolean; error: string | null }>
  saveOnboarding: (payload: OnboardingPreferences, options?: { skipped?: boolean }) => Promise<{ completed: boolean; error: string | null }>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [profileCache, setProfileCache] = useState<UserProfile | null>(null)
  const supabase = createClient()

  useEffect(() => {
    // Get initial session
    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      setSession(session)
      setUser(session?.user ?? null)
      setLoading(false)
    }

    getSession()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session)
        setUser(session?.user ?? null)
        setLoading(false)
      }
    )

    return () => subscription.unsubscribe()
  }, [supabase.auth])

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    return { error }
  }

  const signUp = async (email: string, password: string, metadata?: { display_name?: string }) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: metadata,
      },
    })
    return { error }
  }

  const signOut = async () => {
    const { error } = await supabase.auth.signOut()
    return { error }
  }

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    })
    return { error }
  }

  const getProfile = async () => {
    if (!session?.access_token) {
      return { profile: null, error: 'No session' }
    }

    // Return cached profile if available
    if (profileCache) {
      return { profile: profileCache, error: null }
    }

    try {
      const response = await fetch('http://localhost:3000/api/auth/me', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        const errorData = await response.json()
        return { profile: null, error: errorData.error || 'Failed to fetch profile' }
      }

      const data = await response.json()
      const profile = data.user?.profile || null
      setProfileCache(profile)
      return { profile, error: null }
    } catch (error) {
      return { profile: null, error: 'Network error' }
    }
  }

  const updateProfile = async (updates: { nick_name?: string; avatar_url?: string; birth_year?: number; travel_style?: string[]; mobility?: 'walk' | 'bike' | 'public' | 'grab'; budget_per_day?: number; languages?: string[] }) => {
    if (!session?.access_token) {
      return { profile: null, error: 'No session' }
    }

    try {
      const response = await fetch('http://localhost:3000/api/auth/profile', {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updates),
      })

      if (!response.ok) {
        const errorData = await response.json()
        return { profile: null, error: errorData.error || 'Failed to update profile' }
      }

      const data = await response.json()
      const updatedProfile = data.profile
      setProfileCache(updatedProfile) // Update cache immediately
      return { profile: updatedProfile, error: null }
    } catch (error) {
      return { profile: null, error: 'Network error' }
    }
  }

  const getOnboardingStatus = async () => {
    if (!session?.access_token) {
      return { completed: false, skipped: false, error: 'No session' }
    }

    try {
      const response = await fetch('http://localhost:3000/api/auth/onboarding', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        const errorData = await response.json()
        return { completed: false, skipped: false, error: errorData.error || 'Failed to fetch onboarding status' }
      }

      const data = await response.json()
      return {
        completed: Boolean(data?.onboarding?.completed),
        skipped: Boolean(data?.onboarding?.skipped_at),
        error: null,
      }
    } catch (error) {
      return { completed: false, skipped: false, error: 'Network error' }
    }
  }

  const saveOnboarding = async (payload: OnboardingPreferences, options?: { skipped?: boolean }) => {
    if (!session?.access_token) {
      return { completed: false, error: 'No session' }
    }

    try {
      const requestBody = {
        ...payload,
        skipped: Boolean(options?.skipped),
      }

      const response = await fetch('http://localhost:3000/api/auth/onboarding', {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      })

      if (!response.ok) {
        const errorData = await response.json()

        return { completed: false, error: errorData?.error || 'Failed to save onboarding' }
      }

      await response.json()

      await refreshProfile()
      return { completed: true, error: null }
    } catch (error) {
      return { completed: false, error: 'Network error' }
    }
  }

  const refreshProfile = async () => {
    setProfileCache(null) // Clear cache to force fresh fetch
    if (session?.access_token) {
      await getProfile() // This will fetch fresh data and update cache
    }
  }

  // Clear profile cache when user signs out
  useEffect(() => {
    if (!user) {
      setProfileCache(null)
    }
  }, [user])

  const value = {
    user,
    session,
    loading,
    signIn,
    signUp,
    signOut,
    resetPassword,
    getProfile,
    updateProfile,
    getOnboardingStatus,
    saveOnboarding,
    refreshProfile,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
