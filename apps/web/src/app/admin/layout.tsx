import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

/**
 * Admin Layout — Server Component guard (Defense in Depth Layer 2).
 * Acts as a fallback if the middleware check is ever bypassed.
 * Redirects non-admin users before any admin page renders.
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Not authenticated → send to login
  if (!user) {
    redirect('/login')
  }

  // Authenticated but not admin → send to home
  if (user.role !== 'admin') {
    redirect('/?error=unauthorized')
  }

  return <>{children}</>
}
