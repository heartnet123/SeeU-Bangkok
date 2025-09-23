import { Hono } from 'hono'
import auth from './auth'
import places from './places'
import chat from './chat'
import tools from './tools'
import admin from './admin'
import itineraries from './itineraries'

const appRouter = new Hono()

// Mount auth routes
appRouter.route('/auth', auth)

// Mount places routes
appRouter.route('/places', places)

// Mount chat routes
appRouter.route('/chat', chat)

// Mount tools routes
appRouter.route('/tools', tools)

// Mount admin routes (token-protected)
appRouter.route('/admin', admin)

// Mount itineraries routes
appRouter.route('/itineraries', itineraries)

// Health check
appRouter.get('/', (c) => {
  return c.json({ message: 'TripPlanner API is running', status: 'ok' })
})

export { appRouter }
export type AppRouter = typeof appRouter
