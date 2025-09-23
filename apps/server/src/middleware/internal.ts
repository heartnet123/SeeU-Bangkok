import { createMiddleware } from 'hono/factory'
import { HTTPException } from 'hono/http-exception'

// Require Authorization: Bearer <TOOLS_API_KEY>
export const toolsAuthMiddleware = createMiddleware(async (c, next) => {
  const required = process.env.TOOLS_API_KEY
  if (!required) {
    throw new HTTPException(503, { message: 'TOOLS_API_KEY not configured' })
  }

  const auth = c.req.header('Authorization')
  if (!auth || !auth.startsWith('Bearer ')) {
    throw new HTTPException(401, { message: 'Missing authorization header' })
  }
  const token = auth.substring(7)
  if (token !== required) {
    throw new HTTPException(403, { message: 'Invalid tools token' })
  }

  await next()
})

