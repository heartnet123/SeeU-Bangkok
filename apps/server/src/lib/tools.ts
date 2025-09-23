import { supabase } from './supabase'
import { nameToSlug } from './slug-utils'

export type LatLng = { lat: number; lng: number }

export interface PlaceRow {
  id: string
  name: string
  description?: string | null
  tags?: string[] | null
  lat?: number | null
  lng?: number | null
  address?: string | null
  price?: number | null
  image_url?: string | null
}

export interface PlaceItem {
  id: string
  name: string
  slug: string
  lat?: number
  lng?: number
  tags: string[]
  price?: number
  image_url: string
}

export interface SearchPlacesParams {
  query?: string
  location?: LatLng
  radius_km?: number
  categories?: string[]
  limit?: number
}

export async function search_places(params: SearchPlacesParams): Promise<PlaceItem[]> {
  const { query, categories, limit = 10 } = params

  let q = supabase.from('bangkok_unseen').select('*').order('name').limit(limit)

  if (query && query.trim()) {
    const kw = query.trim()
    q = q.or(`name.ilike.%${kw}%,description.ilike.%${kw}%`)
  }

  if (categories && categories.length) {
    // Filter by tags containing any of the categories
    // Supabase array contains: .contains('tags', ['food']) matches array contains all provided, so for ANY we can OR conditions
    const orParts = categories.map((cat) => `tags.cs.{"${cat}"}`)
    q = q.or(orParts.join(','))
  }

  const { data, error } = await q
  if (error) throw error

  return (data || []).map(cleanPlace)
}

export interface NearbyPlacesParams {
  location: LatLng
  radius_km?: number // default ~5
  limit?: number
}

export async function nearby_places(params: NearbyPlacesParams): Promise<PlaceItem[]> {
  const { location, limit = 10 } = params
  const radius_km = params.radius_km ?? 5
  const latRange = radius_km / 111 // ~km per degree
  const lngRange = radius_km / (111 * Math.cos((location.lat * Math.PI) / 180) || 1)

  const { data, error } = await supabase
    .from('bangkok_unseen')
    .select('*')
    .gte('lat', location.lat - latRange)
    .lte('lat', location.lat + latRange)
    .gte('lng', location.lng - lngRange)
    .lte('lng', location.lng + lngRange)
    .order('name')
    .limit(limit)

  if (error) throw error
  return (data || []).map(cleanPlace)
}

export type TravelMode = 'walk' | 'bike' | 'public' | 'car' | 'grab'

export interface BuildRouteParams {
  places: PlaceItem[]
  origin?: LatLng
  mode?: TravelMode
}

export interface RouteLeg {
  from: string // slug
  to: string // slug
  distance_km: number
}

export interface BuiltRoute {
  order: string[] // slugs
  legs: RouteLeg[]
  total_km: number
}

export function build_route(params: BuildRouteParams): BuiltRoute {
  const { places, origin } = params
  const pts = places.filter((p) => isFiniteNum(p.lat) && isFiniteNum(p.lng))
  if (pts.length < 2) return { order: pts.map((p) => p.slug), legs: [], total_km: 0 }

  // Greedy nearest-neighbor from origin or first place
  const unvisited = new Set(pts.map((p) => p.slug))
  const bySlug = new Map(pts.map((p) => [p.slug, p]))

  let currentSlug: string
  if (origin) {
    // pick closest to origin
    currentSlug = pts
      .map((p) => ({ slug: p.slug, d: haversineKm(origin!, { lat: p.lat!, lng: p.lng! }) }))
      .sort((a, b) => a.d - b.d)[0].slug
  } else {
    currentSlug = pts[0].slug
  }

  const order: string[] = [currentSlug]
  unvisited.delete(currentSlug)
  const legs: RouteLeg[] = []

  while (unvisited.size) {
    const curr = bySlug.get(currentSlug)!
    let best: { slug: string; d: number } | null = null
    for (const s of unvisited) {
      const p = bySlug.get(s)!
      const d = haversineKm({ lat: curr.lat!, lng: curr.lng! }, { lat: p.lat!, lng: p.lng! })
      if (!best || d < best.d) best = { slug: s, d }
    }
    if (!best) break
    legs.push({ from: currentSlug, to: best.slug, distance_km: round1(best.d) })
    currentSlug = best.slug
    order.push(currentSlug)
    unvisited.delete(currentSlug)
  }

  const total_km = round1(legs.reduce((s, l) => s + l.distance_km, 0))
  return { order, legs, total_km }
}

export interface MapViewport {
  center: LatLng
  zoom: number
  bounds: { minLat: number; minLng: number; maxLat: number; maxLng: number }
}

export function map_suggest_viewport(places: PlaceItem[]): MapViewport {
  const pts = places.filter((p) => isFiniteNum(p.lat) && isFiniteNum(p.lng))
  if (!pts.length) return { center: { lat: 13.7563, lng: 100.5018 }, zoom: 11, bounds: { minLat: 13.5, minLng: 100.3, maxLat: 13.9, maxLng: 100.7 } }

  let minLat = Infinity, minLng = Infinity, maxLat = -Infinity, maxLng = -Infinity
  for (const p of pts) {
    minLat = Math.min(minLat, p.lat!)
    minLng = Math.min(minLng, p.lng!)
    maxLat = Math.max(maxLat, p.lat!)
    maxLng = Math.max(maxLng, p.lng!)
  }
  const center = { lat: (minLat + maxLat) / 2, lng: (minLng + maxLng) / 2 }
  const span = Math.max(maxLat - minLat, maxLng - minLng)
  const zoom = span <= 0.01 ? 15 : span <= 0.03 ? 14 : span <= 0.06 ? 13 : span <= 0.12 ? 12 : 11
  return { center, zoom, bounds: { minLat, minLng, maxLat, maxLng } }
}

// Helpers
function cleanPlace(p: PlaceRow): PlaceItem {
  return {
    id: p.id,
    name: p.name || 'Unknown Place',
    slug: nameToSlug(p.name || 'unknown-place'),
    lat: isFiniteNum(p.lat) ? (p.lat as number) : undefined,
    lng: isFiniteNum(p.lng) ? (p.lng as number) : undefined,
    tags: Array.isArray(p.tags) ? (p.tags as string[]) : [],
    price: typeof p.price === 'number' ? p.price : undefined,
    image_url: p.image_url || '',
  }
}

function isFiniteNum(n: any): n is number { return typeof n === 'number' && isFinite(n) }

export function haversineKm(a: LatLng, b: LatLng): number {
  const R = 6371
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLng = ((b.lng - a.lng) * Math.PI) / 180
  const lat1 = (a.lat * Math.PI) / 180
  const lat2 = (b.lat * Math.PI) / 180
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h))
  return R * c
}

function round1(n: number) { return Math.round(n * 10) / 10 }

