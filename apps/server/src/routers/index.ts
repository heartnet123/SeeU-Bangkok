import { Hono } from 'hono'
import auth from './auth'
import places from './places'
import tools from './tools'
import admin from './admin'
import itineraries from './itineraries'
import agentV2 from './agent-v2'
import sessions from './sessions'

const appRouter = new Hono()

appRouter.route('/auth', auth)
appRouter.route('/places', places)
appRouter.route('/agent/v2', agentV2)
appRouter.route('/tools', tools)
appRouter.route('/admin', admin)
appRouter.route('/itineraries', itineraries)
appRouter.route('/sessions', sessions)

// Health check
appRouter.get('/', (c) => {
  return c.json({ message: 'TripPlanner API is running', status: 'ok' })
})

export { appRouter }
export type AppRouter = typeof appRouter
