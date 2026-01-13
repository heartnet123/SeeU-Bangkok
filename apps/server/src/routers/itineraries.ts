import { Hono } from 'hono'
import { z } from 'zod'
import { zValidator } from '@hono/zod-validator'
import { authMiddleware } from '../middleware/auth'
import { supabase } from '../lib/supabase'
import { slugToName } from '../lib/slug-utils'

const itineraries = new Hono()

const stopInput = z.object({
  slug: z.string().min(1),
  suggested_time_min: z.number().int().positive().optional(),
  notes: z.string().optional().default(''),
})

const createSchema = z.object({
  title: z.string().min(1),
  stops: z.array(stopInput).min(1).max(10),
})

// List current user's itineraries with stops
itineraries.get('/', authMiddleware, async (c) => {
  const user = c.get('user')
  try {
    // Fetch itineraries
    const { data: trips, error } = await supabase
      .from('itineraries')
      .select('id, title, total_minutes, total_distance_km, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) throw error

    if (!trips || trips.length === 0) return c.json({ success: true, data: [] })

    // Fetch stops for all itineraries in one go
    const ids = trips.map((t) => t.id)
    const { data: stops, error: stopErr } = await supabase
      .from('itinerary_stops')
      .select('id, itinerary_id, position, suggested_time_min, distance_from_prev_km, notes, place_id')
      .in('itinerary_id', ids)
      .order('position', { ascending: true })

    if (stopErr) throw stopErr

    const placeIds = Array.from(new Set((stops || []).map((s) => s.place_id).filter(Boolean)))
    const { data: places, error: placeErr } = placeIds.length
      ? await supabase.from('bangkok_unseen').select('id, name, lat, lng, tags').in('id', placeIds)
      : { data: [], error: null as any }
    if (placeErr) throw placeErr
    const placeMap = new Map((places || []).map((p) => [p.id, p]))

    const byTrip: Record<string, any[]> = {}
    for (const s of stops || []) {
      const place = placeMap.get(s.place_id as any) as any || {}
      byTrip[s.itinerary_id] ||= []
      byTrip[s.itinerary_id].push({
        id: s.id,
        position: s.position,
        suggested_time_min: s.suggested_time_min,
        distance_from_prev_km: s.distance_from_prev_km,
        notes: s.notes || '',
        place: {
          id: place.id,
          name: place.name,
          lat: place.lat,
          lng: place.lng,
          tags: Array.isArray(place.tags) ? place.tags : [],
        },
      })
    }

    const data = trips.map((t) => ({
      ...t,
      stops: byTrip[t.id] || [],
    }))

    return c.json({ success: true, data })
  } catch (e: any) {
    return c.json({ success: false, error: e?.message || 'Failed to list itineraries' }, 500)
  }
})

// Create an itinerary from slugs
itineraries.post('/', authMiddleware, zValidator('json', createSchema), async (c) => {
  const user = c.get('user')
  const { title, stops } = c.req.valid('json')
  try {
    // Resolve slugs to place IDs
    const resolved: { place_id: string; position: number; suggested_time_min?: number; notes?: string }[] = []
    let pos = 1
    for (const s of stops) {
      const name = slugToName(s.slug)
      // exact match by ilike name; fallback to fuzzy
      let { data: place, error } = await supabase
        .from('bangkok_unseen')
        .select('id, name')
        .ilike('name', name)
        .single()
      if (error && (error as any).code === 'PGRST116') {
        const fuzzy = `%${name.replace(/\s+/g, '%')}%`
        const { data: p2, error: e2 } = await supabase
          .from('bangkok_unseen')
          .select('id, name')
          .ilike('name', fuzzy)
          .limit(1)
          .single()
        if (e2 || !p2) throw new Error(`Place not found for slug: ${s.slug}`)
        place = p2
      } else if (error || !place) {
        throw new Error(`Place not found for slug: ${s.slug}`)
      }
      resolved.push({ place_id: place.id, position: pos++, suggested_time_min: s.suggested_time_min, notes: s.notes })
    }

    // Insert itinerary
    const { data: trip, error: insErr } = await supabase
      .from('itineraries')
      .insert({ user_id: user.id, title, context: null })
      .select('id, title, created_at')
      .single()
    if (insErr) throw insErr

    // Insert stops
    const payload = resolved.map((r) => ({ ...r, itinerary_id: trip.id }))
    const { error: stopErr } = await supabase
      .from('itinerary_stops')
      .insert(payload)
    if (stopErr) throw stopErr

    return c.json({ success: true, data: trip })
  } catch (e: any) {
    return c.json({ success: false, error: e?.message || 'Failed to create itinerary' }, 500)
  }
})

// Update an itinerary (title and stops)
itineraries.put('/:id', authMiddleware, zValidator('json', createSchema), async (c) => {
  const user = c.get('user')
  const itineraryId = c.req.param('id')
  const { title, stops } = c.req.valid('json')
  try {
    // Verify ownership
    const { data: existing, error: checkErr } = await supabase
      .from('itineraries')
      .select('user_id')
      .eq('id', itineraryId)
      .single()
    if (checkErr || !existing) {
      return c.json({ success: false, error: 'Itinerary not found' }, 404)
    }
    if (existing.user_id !== user.id) {
      return c.json({ success: false, error: 'Unauthorized' }, 403)
    }

    // Resolve slugs to place IDs
    const resolved: { place_id: string; position: number; suggested_time_min?: number; notes?: string }[] = []
    let pos = 1
    for (const s of stops) {
      const name = slugToName(s.slug)
      let { data: place, error } = await supabase
        .from('bangkok_unseen')
        .select('id, name')
        .ilike('name', name)
        .single()
      if (error && (error as any).code === 'PGRST116') {
        const fuzzy = `%${name.replace(/\s+/g, '%')}%`
        const { data: p2, error: e2 } = await supabase
          .from('bangkok_unseen')
          .select('id, name')
          .ilike('name', fuzzy)
          .limit(1)
          .single()
        if (e2 || !p2) throw new Error(`Place not found for slug: ${s.slug}`)
        place = p2
      } else if (error || !place) {
        throw new Error(`Place not found for slug: ${s.slug}`)
      }
      resolved.push({ place_id: place.id, position: pos++, suggested_time_min: s.suggested_time_min, notes: s.notes })
    }

    // Update itinerary
    const { error: updateErr } = await supabase
      .from('itineraries')
      .update({ title })
      .eq('id', itineraryId)
    if (updateErr) throw updateErr

    // Delete existing stops
    const { error: delErr } = await supabase
      .from('itinerary_stops')
      .delete()
      .eq('itinerary_id', itineraryId)
    if (delErr) throw delErr

    // Insert new stops
    const payload = resolved.map((r) => ({ ...r, itinerary_id: itineraryId }))
    const { error: stopErr } = await supabase
      .from('itinerary_stops')
      .insert(payload)
    if (stopErr) throw stopErr

    return c.json({ success: true, data: { id: itineraryId, title } })
  } catch (e: any) {
    return c.json({ success: false, error: e?.message || 'Failed to update itinerary' }, 500)
  }
})

// Delete an itinerary
itineraries.delete('/:id', authMiddleware, async (c) => {
  const user = c.get('user')
  const itineraryId = c.req.param('id')
  try {
    // Verify ownership
    const { data: existing, error: checkErr } = await supabase
      .from('itineraries')
      .select('user_id')
      .eq('id', itineraryId)
      .single()
    if (checkErr || !existing) {
      return c.json({ success: false, error: 'Itinerary not found' }, 404)
    }
    if (existing.user_id !== user.id) {
      return c.json({ success: false, error: 'Unauthorized' }, 403)
    }

    // Delete stops first (cascade)
    const { error: delStopsErr } = await supabase
      .from('itinerary_stops')
      .delete()
      .eq('itinerary_id', itineraryId)
    if (delStopsErr) throw delStopsErr

    // Delete itinerary
    const { error: delErr } = await supabase
      .from('itineraries')
      .delete()
      .eq('id', itineraryId)
    if (delErr) throw delErr

    return c.json({ success: true, data: { id: itineraryId } })
  } catch (e: any) {
    return c.json({ success: false, error: e?.message || 'Failed to delete itinerary' }, 500)
  }
})

export default itineraries
