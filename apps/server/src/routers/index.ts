import { Hono } from 'hono'
import auth from './auth'
import places from './places'
import chat from './chat'
import tools from './tools'
import admin from './admin'
import itineraries from './itineraries'
import agent from './agent'

const appRouter = new Hono()

appRouter.route('/auth', auth)
appRouter.route('/places', places)
appRouter.route('/chat', chat)
appRouter.route('/agent', agent)
appRouter.route('/tools', tools)
appRouter.route('/admin', admin)
appRouter.route('/itineraries', itineraries)

// Health check
appRouter.get('/', (c) => {
  return c.json({ message: 'TripPlanner API is running', status: 'ok' })
})

export { appRouter }
export type AppRouter = typeof appRouter
