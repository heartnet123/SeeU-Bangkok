import { Hono } from 'hono'
import { z } from 'zod'
import { zValidator } from '@hono/zod-validator'
import { optionalAuthMiddleware } from '../middleware/auth'
import { supabase } from '../lib/supabase'
import { nameToSlug } from '../lib/slug-utils'
import { streamSSE } from 'hono/streaming'
import { openaiGenerateText, openaiEmbed } from '../lib/openai'

const chat = new Hono()

// Zod schema for incoming chat payload
const messageSchema = z.object({
  role: z.enum(['system', 'user', 'assistant', 'tool']),
  content: z.string().min(1),
})

const chatSchema = z.object({
  messages: z.array(messageSchema).min(1),
  userLocation: z
    .object({ lat: z.number(), lng: z.number() })
    .optional(),
  profile: z.unknown().optional(),
  force_no_match: z.boolean().optional(),
})

const itineraryStopSchema = z.object({
  slug: z.string(),
  name: z.string(),
  suggested_time_min: z.number().int().positive().max(600),
  notes: z.string().optional().default(''),
})

const itinerarySchema = z.object({
  title: z.string(),
  stops: z.array(itineraryStopSchema).min(2).max(6),
})

// Simple helpers
function toMapsUrl(lat?: number | null, lng?: number | null) {
  if (typeof lat === 'number' && typeof lng === 'number') {
    return `https://www.google.com/maps?q=${lat},${lng}`
  }
  return ''
}

function extractKeywords(text: string): string[] {
  const stop = new Set([
    'the', 'a', 'an', 'in', 'on', 'at', 'near', 'me', 'my', 'to', 'for', 'and', 'or', 'under', 'over', 'with', 'please',
  ])
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((t) => t && !stop.has(t))
    .slice(0, 5)
}

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLng = ((b.lng - a.lng) * Math.PI) / 180
  const lat1 = (a.lat * Math.PI) / 180
  const lat2 = (b.lat * Math.PI) / 180
  const h =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2)
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h))
  return R * c
}

function extractJsonCandidate(text: string): any | null {
  try {
    const fence = text.match(/```json\s*([\s\S]*?)```/i) || text.match(/```\s*([\s\S]*?)```/)
    const inner = fence ? fence[1] : text
    return JSON.parse(inner.trim())
  } catch {
    // Try to find first { ... }
    const start = text.indexOf('{')
    const end = text.lastIndexOf('}')
    if (start !== -1 && end !== -1 && end > start) {
      try {
        return JSON.parse(text.slice(start, end + 1))
      } catch {}
    }
  }
  return null
}

// POST /api/chat - SSE streaming endpoint
chat.post('/', optionalAuthMiddleware, zValidator('json', chatSchema), async (c) => {
  const body = c.req.valid('json')
  const user = c.get('user')

  return streamSSE(c, async (stream) => {
    // Immediately open the stream with a small preamble for fast start
    await stream.writeSSE({ event: 'open', data: JSON.stringify({ success: true }) })

    const lastUserMsg = [...body.messages].reverse().find((m) => m.role === 'user')
    const content = lastUserMsg?.content?.trim() || ''

    // Announce that we are processing
    await stream.writeSSE({ event: 'status', data: 'processing' })

    // Naive tool selection: nearby if user has location and asks for nearby/around
    // Add simple Thai keyword support as well
    const isThai = /[\u0E00-\u0E7F]/.test(content)
    const wantsNearby = /(\b(near|nearby|around|close)\b|ใกล้|แถว|ละแวก|ใกล้ๆ)/i.test(content)
    const wantsPlan = /(\b(plan|itinerary|route|tour|half\s*day|day\s*trip)\b|แผน|ทริป|ทัวร์|ตารางเที่ยว|ครึ่งวัน|หนึ่งวัน)/i.test(content)
    const keywords = extractKeywords(content)

    try {
      // Forced no-match mode via env, query, or body flag
      const envForce = (process.env.CHAT_ALWAYS_NO_MATCH || '').toLowerCase()
      const queryForce = c.req.query('force_no_match')
      const shouldForceNoMatch =
        envForce === 'true' || envForce === '1' || queryForce === '1' || body.force_no_match === true

      if (shouldForceNoMatch) {
        await stream.writeSSE({ event: 'message', data: 'I could not find matching places.' })
        await stream.writeSSE({ event: 'suggestions', data: JSON.stringify({ places: [], count: 0, user: user?.id || null }) })
        await stream.writeSSE({ event: 'done', data: 'ok' })
        return
      }

      let results: any[] = []
      let vectorResults: any[] = []

      // 0) Vector retrieval (hybrid). Best-effort; ignore failures gracefully
      try {
        const queryText = content
        if (queryText && queryText.length >= 3) {
          const qEmbedding = await openaiEmbed(queryText)
          const topK = Number(process.env.CHAT_VECTOR_TOP_K || 10)
          const shallow = keywords.join(' ') || null
          const { data: vecData, error: vecErr } = await supabase
            .rpc('match_places', { query_embedding: qEmbedding as any, match_count: topK, search: shallow })
          if (!vecErr && Array.isArray(vecData)) {
            vectorResults = vecData
          }
        }
      } catch (e) {
        // no-op: vector search unavailable/misconfigured
      }

      // 1) Nearby by bounding box when requested
      if (wantsNearby && body.userLocation) {
        const latRange = 0.045
        const lngRange = 0.045

        const { data, error } = await supabase
          .from('bangkok_unseen')
          .select('*')
          .gte('lat', body.userLocation.lat - latRange)
          .lte('lat', body.userLocation.lat + latRange)
          .gte('lng', body.userLocation.lng - lngRange)
          .lte('lng', body.userLocation.lng + lngRange)
          .order('name')
          .limit(10)
        if (error) throw error
        results = data || []

        if (!results.length) {
          await stream.writeSSE({ event: 'status', data: 'no-nearby; falling back to text search' })
        }
      }

      // 2) Text search over keywords (name OR description per keyword)
      if (!results.length) {
        const kws = keywords.length ? keywords : extractKeywords(content)
        if (kws.length) {
          const orExp = kws
            .flatMap((kw) => [
              `name.ilike.%${kw}%`,
              `description.ilike.%${kw}%`,
            ])
            .join(',')

          const { data, error } = await supabase
            .from('bangkok_unseen')
            .select('*')
            .or(orExp)
            .order('name')
            .limit(10)
          if (error) throw error
          results = data || []
        }
      }

      // 3) Final fallback: show some popular defaults
      if (!results.length) {
        const { data, error } = await supabase
          .from('bangkok_unseen')
          .select('*')
          .order('name')
          .limit(5)
        if (error) throw error
        results = data || []
      }

      // Merge vector + other retrieval (dedupe by id, prioritize vector order)
      try {
        const byId = new Map<string, any>()
        for (const p of vectorResults) byId.set(p.id, p)
        for (const p of results) if (!byId.has(p.id)) byId.set(p.id, p)
        results = Array.from(byId.values())
      } catch {}

      // Clean and ground to DB-backed places only
      const places = results.map((p) => ({
        id: p.id,
        name: p.name || 'Unknown Place',
        slug: nameToSlug(p.name || 'unknown-place'),
        lat: typeof p.lat === 'number' ? p.lat : undefined,
        lng: typeof p.lng === 'number' ? p.lng : undefined,
        tags: Array.isArray(p.tags) ? p.tags : [],
        price: typeof p.price === 'number' ? p.price : undefined,
        maps_url: toMapsUrl(p.lat, p.lng),
      }))

      // Stream a human-readable assistant message (show names and adapt language)
      if (places.length > 0) {
        const names = places.slice(0, 5).map((p) => p.name).join(', ')
        const msg = isThai
          ? `พบสถานที่${body.userLocation ? 'ใกล้คุณ' : ''}จำนวน ${places.length} แห่ง: ${names}${places.length > 5 ? ' และอื่นๆ' : ''}`
          : `Found ${places.length} place(s)${body.userLocation ? ' near you' : ''}: ${names}${places.length > 5 ? ' and more' : ''}`
        await stream.writeSSE({ event: 'message', data: msg })
      } else {
        await stream.writeSSE({ event: 'message', data: isThai ? 'ไม่พบสถานที่ที่ตรงกับคำค้นหา' : 'I could not find matching places.' })
      }

      // Stream structured suggestions payload
      await stream.writeSSE({
        event: 'suggestions',
        data: JSON.stringify({ places, count: places.length, user: user?.id || null }),
      })

      // If the user asked for a plan, call Hugging Face to draft one, grounded to known places
      if (wantsPlan && places.length > 0) {
        await stream.writeSSE({ event: 'status', data: 'planning' })

        const allowed = places
          .map((p) => ({ slug: p.slug, name: p.name, lat: p.lat, lng: p.lng, tags: p.tags, price: p.price }))
          .slice(0, 10)

        let systemPrompt = (process.env.CHAT_SYSTEM_PROMPT && process.env.CHAT_SYSTEM_PROMPT.trim())
          ? process.env.CHAT_SYSTEM_PROMPT
          : `You are TripPlannerAI, an expert travel assistant.\n- Use only the provided candidate places (DB-backed). Do not invent.\n- Output JSON only, no markdown or extra text.`
        if (isThai) {
          systemPrompt += `\n- Respond in Thai (ภาษาไทย).`
        }

        const userPrompt = `Create a simple plan using ONLY these places (max 6 stops):\n` +
          JSON.stringify({ candidates: allowed, userLocation: body.userLocation || null, query: content }) +
          `\n\nReturn JSON exactly in this shape (values filled, no comments):` +
          ` {"title": "Half-day Temple Tour", "stops": [{"slug": "wat-pho", "name": "Wat Pho", "suggested_time_min": 60, "notes": "Short walk to next"}]}`

        // Validate and sanitize the plan; fallback to a naive plan if invalid
        const bySlug = new Map(places.map((p) => [p.slug, p]))
        const unique = (arr: any[]) => Array.from(new Set(arr))

        const fallbackPlan = () => {
          const picks = places.slice(0, Math.min(4, places.length))
          return {
            title: 'Suggested Half-day Plan',
            stops: picks.map((p) => ({ slug: p.slug, name: p.name, suggested_time_min: 45, notes: '' })),
          }
        }

        let plan: any | null = null
        try {
          const text = await openaiGenerateText(userPrompt, { system: systemPrompt, max_completion_tokens: 400, temperature: 1, retries: 2, timeout_ms: 25000 })
          plan = extractJsonCandidate(text)
        } catch (e: any) {
          // Fallback to heuristic plan if LLM unavailable
          console.warn('HF API failed for plan generation:', e.message)
          await stream.writeSSE({ event: 'status', data: 'planning-fallback' })
          // Create a simple fallback plan
          plan = fallbackPlan()
        }

        let safePlan: z.infer<typeof itinerarySchema>
        try {
          const parsed = itinerarySchema.parse(plan)
          // Filter to only known slugs and ensure uniqueness and order
          const filteredStops = parsed.stops.filter((s) => bySlug.has(s.slug))
          const deduped = unique(filteredStops.map((s) => s.slug)).map((slug) => filteredStops.find((s) => s.slug === slug)!)
          safePlan = itinerarySchema.parse({ title: parsed.title, stops: deduped })
        } catch {
          safePlan = fallbackPlan()
        }

        // Enrich with distances
        let prev: { lat?: number; lng?: number } | null = null
        const enrichedStops = safePlan.stops.map((s, idx) => {
          const p = bySlug.get(s.slug)!
          let distance_from_prev_km: number | undefined
          if (prev && typeof prev.lat === 'number' && typeof prev.lng === 'number' && typeof p.lat === 'number' && typeof p.lng === 'number') {
            distance_from_prev_km = Math.round(haversineKm({ lat: prev.lat, lng: prev.lng }, { lat: p.lat!, lng: p.lng! }) * 10) / 10
          }
          prev = { lat: p.lat, lng: p.lng }
          return { ...s, distance_from_prev_km }
        })

        const itinerary = { title: safePlan.title, stops: enrichedStops }
        await stream.writeSSE({ event: 'itinerary', data: JSON.stringify(itinerary) })
      }

      // End of stream
      await stream.writeSSE({ event: 'done', data: 'ok' })
    } catch (err: any) {
      const message = err?.message || 'Chat processing failed'
      await stream.writeSSE({ event: 'error', data: message })
    } finally {
      stream.close()
    }
  })
})

// Lightweight health check (non-SSE)
chat.get('/health', (c) => c.json({ status: 'ok', service: 'chat' }))

export default chat
