'use client'

import { useAuth } from '@/contexts/auth-context'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { User, LogOut, Settings } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'
import { useEffect, useState } from 'react'

export function AuthButton() {
  const { user, signOut, loading, getProfile, refreshProfile } = useAuth()
  const [profile, setProfile] = useState<any>(null)
  const [profileLoading, setProfileLoading] = useState(false)

  // Load user profile to get nickname
  useEffect(() => {
    const loadProfile = async () => {
      if (user && !profileLoading) {
        setProfileLoading(true)
        const { profile: profileData } = await getProfile()
        setProfile(profileData)
        setProfileLoading(false)
      }
    }
    loadProfile()
  }, [user, getProfile])

  // Add a refresh interval to update profile periodically
  useEffect(() => {
    if (user) {
      const interval = setInterval(async () => {
        const { profile: profileData } = await getProfile()
        setProfile(profileData)
      }, 5000) // Refresh every 5 seconds when active

      return () => clearInterval(interval)
    }
  }, [user, getProfile])

  // Refresh profile when window gains focus
  useEffect(() => {
    const handleFocus = async () => {
      if (user) {
        const { profile: profileData } = await getProfile()
        setProfile(profileData)
      }
    }

    window.addEventListener('focus', handleFocus)
    return () => window.removeEventListener('focus', handleFocus)
  }, [user, getProfile])

  const handleSignOut = async () => {
    try {
      const { error } = await signOut()
      if (error) {
        toast.error(error.message)
      } else {
        toast.success('Signed out successfully')
      }
    } catch (error) {
      toast.error('An error occurred while signing out')
    }
  }

  if (loading) {
    return (
      <Button variant="ghost" disabled className="text-black">
        Loading...
      </Button>
    )
  }

  if (!user) {
    return (
      <div className="flex gap-2">
        <Link href="/auth/login">
          <Button variant="ghost" className="text-black hover:text-blue-600">Sign in</Button>
        </Link>
        <Link href="/auth/register">
          <Button className="bg-blue-600 hover:bg-blue-700 text-white">Sign up</Button>
        </Link>
      </div>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="flex items-center gap-2 text-black hover:text-blue-600">
          {profile?.avatar_url ? (
            <img 
              src={profile.avatar_url} 
              alt="Profile" 
              className="h-6 w-6 rounded-full object-cover border border-gray-200"
            />
          ) : (
            <User className="h-4 w-4" />
          )}
          {profile?.nick_name || user.user_metadata?.display_name || user.email}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 bg-white text-slate-950 border border-slate-200 shadow-lg">
        <DropdownMenuLabel className="flex items-center gap-2 rounded-md px-2 py-2 text-slate-950">
          {profile?.avatar_url ? (
            <img 
              src={profile.avatar_url} 
              alt="Profile" 
              className="h-8 w-8 rounded-full object-cover border border-gray-200"
            />
          ) : (
            <User className="h-6 w-6" />
          )}
          <div>
            <div className="font-medium text-slate-950">{profile?.nick_name || user.user_metadata?.display_name || 'User'}</div>
            <div className="text-xs text-slate-500">{user.email}</div>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-slate-200" />
        <DropdownMenuItem asChild className="text-slate-700 hover:bg-slate-100 focus:bg-blue-50 focus:text-slate-900">
          <Link href="/profile" className="flex items-center">
            <Settings className="mr-2 h-4 w-4 text-slate-700" />
            <span>Profile Settings</span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator className="bg-slate-200" />
        <DropdownMenuItem onClick={handleSignOut} className="text-slate-700 hover:bg-slate-100 focus:bg-blue-50 focus:text-slate-900">
          <LogOut className="mr-2 h-4 w-4 text-slate-700" />
          <span>Sign out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}