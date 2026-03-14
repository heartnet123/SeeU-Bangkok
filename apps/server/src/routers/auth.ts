import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { authMiddleware } from '../middleware/auth'
import { supabase, supabaseAuth } from '../lib/supabase'
import { LongTermMemory } from '../agent/memory/longterm'

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
  onboarding_completed: z.boolean().optional(),
  onboarding_completed_at: z.string().optional(),
  onboarding_skipped_at: z.string().optional(),
  onboarding_preferences: z.any().optional(),
})

const onboardingSchema = z.object({
  vibes: z.array(z.string()).default([]),
  travelStyle: z.string().optional().default(''),
  pace: z.number().int().min(0).max(100).default(50),
  transit: z.array(z.string()).default([]),
  culinary: z.array(z.string()).default([]),
  boundaries: z.array(z.string()).default([]),
  skipped: z.boolean().default(false),
})

// Auth routes (these handle authentication via Supabase client-side)
// Get current user profile
auth.get('/me', authMiddleware, async (c) => {
  const user = c.get('user')
  
  try {
    // Fetch additional user profile data
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

auth.get('/onboarding', authMiddleware, async (c) => {
  const user = c.get('user')

  try {
    const { data: profile, error } = await supabase
      .from('user_profiles')
      .select('onboarding_completed,onboarding_completed_at,onboarding_skipped_at,onboarding_preferences')
      .eq('user_id', user.id)
      .maybeSingle()

    if (error) {
      if (error.code === 'PGRST101') {
        return c.json({ error: 'Profile table not set up. Please run the database setup first.' }, 400)
      }

      console.error('Database error in /onboarding endpoint:', error)
      return c.json({ error: 'Failed to fetch onboarding' }, 500)
    }

    const onboarding = {
      completed: profile?.onboarding_completed ?? false,
      completed_at: profile?.onboarding_completed_at ?? null,
      skipped_at: profile?.onboarding_skipped_at ?? null,
      preferences: profile?.onboarding_preferences ?? null,
    }

    if (!profile) {
      try {
        const mem = await LongTermMemory.getPreference(user.id, 'onboarding_status')
        const memPrefs = await LongTermMemory.getPreference(user.id, 'onboarding_preferences')
        if (mem) {
          onboarding.completed = Boolean(mem?.completed)
          onboarding.completed_at = mem?.completedAt || null
          onboarding.skipped_at = mem?.skippedAt || null
        }
        if (memPrefs) {
          onboarding.preferences = memPrefs
        }
      } catch (error) {
        console.error('Failed to fetch onboarding from agent_memory:', error)
      }
    }

    return c.json({ onboarding })
  } catch (error) {
    console.error('Unexpected error in GET /onboarding endpoint:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

auth.put('/onboarding', authMiddleware, zValidator('json', onboardingSchema), async (c) => {
  const user = c.get('user')
  const onboardingData = c.req.valid('json')

  try {
    const now = new Date().toISOString()
    const skipped = Boolean(onboardingData.skipped)
    const { data, error } = await supabase
      .from('user_profiles')
      .upsert({
        user_id: user.id,
        onboarding_completed: !skipped,
        onboarding_completed_at: skipped ? null : now,
        onboarding_skipped_at: skipped ? now : null,
        onboarding_preferences: {
          vibes: onboardingData.vibes,
          travelStyle: onboardingData.travelStyle,
          pace: onboardingData.pace,
          transit: onboardingData.transit,
          culinary: onboardingData.culinary,
          boundaries: onboardingData.boundaries,
        },
        updated_at: now,
      })
      .select('onboarding_completed,onboarding_completed_at,onboarding_skipped_at,onboarding_preferences')
      .single()

    if (error) {
      if (error.code === 'PGRST101') {
        return c.json({ error: 'Profile table not set up. Please run the database setup first.' }, 400)
      }

      console.error('Database error in PUT /onboarding endpoint:', error)
      return c.json({ error: 'Failed to save onboarding' }, 500)
    }

    const onboardingPayload = {
      completed: data?.onboarding_completed ?? !skipped,
      completed_at: data?.onboarding_completed_at ?? (skipped ? null : now),
      skipped_at: data?.onboarding_skipped_at ?? (skipped ? now : null),
      preferences: data?.onboarding_preferences ?? null,
    }

    try {
      await LongTermMemory.setPreferences(user.id, {
        onboarding_status: {
          completed: onboardingPayload.completed,
          completedAt: onboardingPayload.completed_at,
          skippedAt: onboardingPayload.skipped_at,
        },
        onboarding_preferences: onboardingPayload.preferences,
      })
    } catch (error) {
      console.error('Failed to save onboarding to agent_memory:', error)
    }

    return c.json({ onboarding: onboardingPayload })
  } catch (error) {
    console.error('Unexpected error in PUT /onboarding endpoint:', error)
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