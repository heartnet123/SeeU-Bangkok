import { createMiddleware } from 'hono/factory'
import { HTTPException } from 'hono/http-exception'
import { supabaseAuth } from '../lib/supabase'

export interface AuthenticatedRequest {
  user: {
    id: string
    email: string
    role?: string
    user_metadata?: any
  }
}

declare module 'hono' {
  interface ContextVariableMap {
    user: AuthenticatedRequest['user']
  }
}

export const authMiddleware = createMiddleware(async (c, next) => {
  const authHeader = c.req.header('Authorization')
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new HTTPException(401, { message: 'Missing or invalid authorization header' })
  }

  const token = authHeader.substring(7) // Remove 'Bearer ' prefix

  try {
    const { data: { user }, error } = await supabaseAuth.auth.getUser(token)
    
    if (error || !user) {
      throw new HTTPException(401, { message: 'Invalid or expired token' })
    }

    // Set user data in context
    c.set('user', {
      id: user.id,
      email: user.email!,
      role: user.role,
      user_metadata: user.user_metadata,
    })

    await next()
  } catch (error) {
    if (error instanceof HTTPException) {
      throw error
    }
    throw new HTTPException(401, { message: 'Authentication failed' })
  }
})

export const optionalAuthMiddleware = createMiddleware(async (c, next) => {
  const authHeader = c.req.header('Authorization')
  
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7)
    
    try {
      const { data: { user }, error } = await supabaseAuth.auth.getUser(token)
      
      if (!error && user) {
        c.set('user', {
          id: user.id,
          email: user.email!,
          role: user.role,
          user_metadata: user.user_metadata,
        })
      }
    } catch (error) {
      // Silently ignore errors for optional auth
    }
  }

  await next()
})