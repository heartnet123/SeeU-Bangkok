import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { authMiddleware } from '../middleware/auth'
import { supabase, supabaseAuth } from '../lib/supabase'

const auth = new Hono()

// Validation schemas
const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
})

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  display_name: z.string().optional(),
})

const resetPasswordSchema = z.object({
  email: z.string().email(),
})

const updateProfileSchema = z.object({
  nick_name: z.string().optional(),
  avatar_url: z.string().url().optional().or(z.literal('')),
  birth_year: z.number().int().min(1900).max(2010).optional(),
  travel_style: z.array(z.enum(['slow-life', 'budget', 'instagram', 'foodie', 'history'])).optional(),
  mobility: z.enum(['walk', 'bike', 'public', 'grab']).optional(),
  budget_per_day: z.number().int().positive().optional(),
  languages: z.array(z.string()).optional(),
})

// Auth routes (these handle authentication via Supabase client-side)
// These are more for verification and additional logic if needed

// Get current user profile
auth.get('/me', authMiddleware, async (c) => {
  const user = c.get('user')
  
  try {
    // Fetch additional user profile data if you have a user_profiles table
    const { data: profile, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('user_id', user.id)
      .single()

    // Handle various error cases gracefully
    if (error) {
      // PGRST116 = "not found" (user has no profile row)
      // PGRST101 = "table does not exist" (user_profiles table not created)
      if (error.code === 'PGRST116' || error.code === 'PGRST101') {
        // Table doesn't exist or user has no profile - return user data without profile
        return c.json({
          user: {
            id: user.id,
            email: user.email,
            ...user.user_metadata,
            profile: null,
          },
          message: error.code === 'PGRST101' ? 'Profile table not set up yet' : null
        })
      }
      
      // Other database errors
      console.error('Database error in /me endpoint:', error)
      return c.json({ error: 'Failed to fetch profile' }, 500)
    }

    return c.json({
      user: {
        id: user.id,
        email: user.email,
        ...user.user_metadata,
        profile: profile || null,
      },
    })
  } catch (error) {
    console.error('Unexpected error in /me endpoint:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

// Update user profile
auth.put('/profile', authMiddleware, zValidator('json', updateProfileSchema), async (c) => {
  const user = c.get('user')
  const profileData = c.req.valid('json')

  try {
    // Update or insert user profile
    const { data, error } = await supabase
      .from('user_profiles')
      .upsert({
        user_id: user.id,
        ...profileData,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (error) {
      // Handle table not existing
      if (error.code === 'PGRST101') {
        return c.json({ 
          error: 'Profile table not set up. Please run the database setup first.' 
        }, 400)
      }
      
      console.error('Database error in /profile endpoint:', error)
      return c.json({ error: 'Failed to update profile' }, 500)
    }

    return c.json({ profile: data })
  } catch (error) {
    console.error('Unexpected error in /profile endpoint:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

// Verify token endpoint (useful for frontend token validation)
auth.post('/verify', async (c) => {
  const authHeader = c.req.header('Authorization')
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'Missing authorization header' }, 401)
  }

  const token = authHeader.substring(7)

  try {
    const { data: { user }, error } = await supabaseAuth.auth.getUser(token)
    
    if (error || !user) {
      return c.json({ error: 'Invalid token' }, 401)
    }

    return c.json({ 
      valid: true, 
      user: {
        id: user.id,
        email: user.email,
        ...user.user_metadata,
      }
    })
  } catch (error) {
    return c.json({ error: 'Token verification failed' }, 401)
  }
})

// Health check for auth service
auth.get('/health', (c) => {
  return c.json({ status: 'ok', service: 'auth' })
})

export default auth