import { Hono } from 'hono'
import { authMiddleware } from '../middleware/auth'
import { SessionMemory } from '../agent/memory/session'

const sessions = new Hono()

// GET /api/sessions - List all sessions for authenticated user
sessions.get('/', authMiddleware, async (c) => {
  const user = c.get('user')

  try {
    const userSessions = await SessionMemory.getUserSessions(user.id, { limit: 50 })
    return c.json({
      success: true,
      sessions: userSessions.map((s) => ({
        id: s.id,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
        metadata: s.metadata,
      })),
    })
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500)
  }
})

// GET /api/sessions/:id/messages - Get messages for a session
sessions.get('/:id/messages', authMiddleware, async (c) => {
  const user = c.get('user')
  const sessionId = c.req.param('id')

  try {
    // Verify session belongs to user
    const session = await SessionMemory.getSession(sessionId)
    if (!session) {
      return c.json({ success: false, error: 'Session not found' }, 404)
    }
    if (session.userId !== user.id) {
      return c.json({ success: false, error: 'Forbidden' }, 403)
    }

    const messages = await SessionMemory.getMessages(sessionId)
    return c.json({
      success: true,
      messages: messages.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        createdAt: m.createdAt,
      })),
    })
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500)
  }
})

// DELETE /api/sessions/:id - Delete a session
sessions.delete('/:id', authMiddleware, async (c) => {
  const user = c.get('user')
  const sessionId = c.req.param('id')

  try {
    // Verify session belongs to user
    const session = await SessionMemory.getSession(sessionId)
    if (!session) {
      return c.json({ success: false, error: 'Session not found' }, 404)
    }
    if (session.userId !== user.id) {
      return c.json({ success: false, error: 'Forbidden' }, 403)
    }

    await SessionMemory.deleteSession(sessionId)
    return c.json({ success: true })
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500)
  }
})

export default sessions
