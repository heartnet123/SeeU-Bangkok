import { Hono } from 'hono'
import { z } from 'zod'
import { zValidator } from '@hono/zod-validator'
import { toolsAuthMiddleware } from '../middleware/internal'
import { build_route, map_suggest_viewport, nearby_places, search_places } from '../lib/tools'

const tools = new Hono()

// Protect all tools endpoints with internal token
tools.use('/*', toolsAuthMiddleware)

const latLngSchema = z.object({ lat: z.number(), lng: z.number() })

tools.post(
  '/search_places',
  // internal only
  zValidator(
    'json',
    z.object({
      query: z.string().optional(),
      location: latLngSchema.optional(),
      radius_km: z.number().positive().max(50).optional(),
      categories: z.array(z.string()).optional(),
      limit: z.number().int().positive().max(50).optional(),
    }),
  ),
  async (c) => {
    const params = c.req.valid('json')
    const data = await search_places(params)
    return c.json({ success: true, data })
  },
)

tools.post(
  '/nearby_places',
  // internal only
  zValidator(
    'json',
    z.object({ location: latLngSchema, radius_km: z.number().positive().max(50).optional(), limit: z.number().int().positive().max(50).optional() }),
  ),
  async (c) => {
    const params = c.req.valid('json')
    const data = await nearby_places(params)
    return c.json({ success: true, data })
  },
)

tools.post(
  '/build_route',
  // internal only
  zValidator(
    'json',
    z.object({
      places: z.array(
        z.object({
          id: z.string(),
          name: z.string(),
          slug: z.string(),
          lat: z.number().optional(),
          lng: z.number().optional(),
          tags: z.array(z.string()).optional(),
          price: z.number().optional(),
          image_url: z.string().optional(),
        }),
      ),
      origin: latLngSchema.optional(),
      mode: z.enum(['walk', 'bike', 'public', 'car', 'grab']).optional(),
    }),
  ),
  async (c) => {
    const params = c.req.valid('json')
    const data = await build_route(params as any)
    return c.json({ success: true, data })
  },
)

tools.post(
  '/map_suggest_viewport',
  // internal only
  zValidator(
    'json',
    z.object({
      places: z.array(
        z.object({ lat: z.number().optional(), lng: z.number().optional(), slug: z.string(), name: z.string() }),
      ),
    }),
  ),
  async (c) => {
    const { places } = c.req.valid('json')
    const data = map_suggest_viewport(places as any)
    return c.json({ success: true, data })
  },
)

tools.get('/health', (c) => c.json({ status: 'ok', service: 'tools' }))

export default tools
