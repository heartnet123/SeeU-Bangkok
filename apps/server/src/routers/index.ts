import { Hono } from 'hono'
import auth from './auth'
import places from './places'

const appRouter = new Hono()

// Mount auth routes
appRouter.route('/auth', auth)

// Mount places routes
appRouter.route('/places', places)

// Health check
appRouter.get('/', (c) => {
  return c.json({ message: 'MapChatBot API is running', status: 'ok' })
})

export { appRouter }
export type AppRouter = typeof appRouter
