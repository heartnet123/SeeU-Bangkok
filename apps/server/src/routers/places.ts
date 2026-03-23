import { Hono } from 'hono'
import { supabase } from '../lib/supabase'
import { nameToSlug, slugToName } from '../lib/slug-utils'
import { optionalAuthMiddleware } from '../middleware/auth'
import {
	applyPlaceFilters,
	cleanPlaceRecord,
	parsePlaceListQuery,
} from './places-query'
import {
	rerankPlacesByPersonalization,
} from '../agent/personalization'
import { resolvePlacePersonalizationDefaults } from './places-personalization'

const places = new Hono()
places.use('*', optionalAuthMiddleware)

interface Place {
  id: string;
  name: string;
  description: string;
  tags: string[];
  lat: number;
  lng: number;
  address: string;
  price: number;
  image_url: string;
  embedding?: any;
}

// GET /places - Get all places with optional search and pagination
places.get('/', async (c) => {
  try {
    const user = c.get('user')
    const placeQuery = parsePlaceListQuery(c.req.query())
    const personalizationDefaults = await resolvePlacePersonalizationDefaults(user?.id)

    let query = supabase
      .from('bangkok_unseen')
      .select('*')
      .order('name')

    let countQuery = supabase
      .from('bangkok_unseen')
      .select('*', { count: 'exact', head: true })

    if (placeQuery.searchTerm) {
      const searchExpr = `name.ilike.%${placeQuery.searchTerm}%,description.ilike.%${placeQuery.searchTerm}%`
      query = query.or(searchExpr)
      countQuery = countQuery.or(searchExpr)
    }

    if (placeQuery.categories.length > 0) {
      query = query.overlaps('tags', placeQuery.categories)
      countQuery = countQuery.overlaps('tags', placeQuery.categories)
    }

    query = query.range(placeQuery.offset, placeQuery.offset + placeQuery.limit - 1)

    const { data, error } = await query
    
    if (error) {
      console.error('Error fetching places:', error)
      return c.json({ 
        success: false, 
        message: 'Failed to fetch places',
        data: [],
        error: error.message 
      }, 500)
    }
    
    const { count: totalCount, error: countError } = await countQuery
    if (countError) {
      console.error('Error counting places:', countError)
      return c.json({
        success: false,
        message: 'Failed to fetch places',
        data: [],
        error: countError.message
      }, 500)
    }
    
    const cleanData = rerankPlacesByPersonalization(
      applyPlaceFilters((data || []).map(cleanPlaceRecord), placeQuery),
      personalizationDefaults,
    )
    
    return c.json({
      success: true,
      data: cleanData,
      pagination: {
        limit: placeQuery.limit,
        offset: placeQuery.offset,
        count: cleanData.length,
        total: totalCount || 0
      }
    })
  } catch (error) {
    console.error('Server error:', error)
    return c.json({ 
      success: false, 
      message: 'Internal server error',
      data: [],
      error: error instanceof Error ? error.message : 'Unknown error'
    }, 500)
  }
})

// GET /places/:slug - Get a specific place by name slug
places.get('/:slug', async (c) => {
  try {
    const slug = c.req.param('slug')
    
    console.log(`[DEBUG] Searching for place with slug: "${slug}"`) // Debug log
    
    if (!slug) {
      return c.json({
        success: false,
        message: 'Place slug is required',
        data: null
      }, 400)
    }
    
    // Convert slug back to name for searching
    const searchName = slugToName(slug)
    console.log(`[DEBUG] Converted slug "${slug}" to search name: "${searchName}"`) // Debug log
    
    // Try exact match first
    let { data, error } = await supabase
      .from('bangkok_unseen')
      .select('*')
      .ilike('name', searchName)
      .single()
    
    console.log(`[DEBUG] Exact match result:`, { data: data?.name, error: error?.message }) // Debug log
    
    // If exact match fails, try fuzzy search
    if (error && error.code === 'PGRST116') {
      console.log(`[DEBUG] Exact match failed, trying fuzzy search...`) // Debug log
      const fuzzyPattern = `%${searchName.replace(/\s+/g, '%')}%`
      console.log(`[DEBUG] Fuzzy search pattern: "${fuzzyPattern}"`) // Debug log
      
      const { data: fuzzyData, error: fuzzyError } = await supabase
        .from('bangkok_unseen')
        .select('*')
        .ilike('name', fuzzyPattern)
        .limit(1)
        .single()
      
      console.log(`[DEBUG] Fuzzy search result:`, { data: fuzzyData?.name, error: fuzzyError?.message }) // Debug log
      
      if (fuzzyError) {
        // Try to get a list of similar names for debugging
        const { data: allPlaces } = await supabase
          .from('bangkok_unseen')
          .select('name')
          .limit(10)
        
        return c.json({
          success: false,
          message: `Place "${searchName}" not found`,
          data: null,
          debug: {
            searchedFor: searchName,
            slug: slug,
            availablePlaces: allPlaces?.map(p => ({ name: p.name, slug: nameToSlug(p.name) })) || []
          }
        }, 404)
      }
      
      data = fuzzyData
    } else if (error) {
      console.error('Error fetching place:', error)
      return c.json({
        success: false,
        message: 'Failed to fetch place',
        data: null,
        error: error.message
      }, 500)
    }
    
    console.log(`[DEBUG] Successfully found place: "${data.name}"`) // Debug log
    
    // Clean the data to ensure no problematic values
    const cleanData = {
      ...cleanPlaceRecord(data),
      address: data.address || '',
      description: data.description || '',
      slug: nameToSlug(data.name)
    }
    
    return c.json({
      success: true,
      data: cleanData
    })
  } catch (error) {
    console.error('Server error:', error)
    return c.json({
      success: false,
      message: 'Internal server error',
      data: null,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, 500)
  }
})

// GET /places/:slug/nearby - Get nearby places (within 5km radius)
places.get('/:slug/nearby', async (c) => {
  try {
    const slug = c.req.param('slug')
    const limit = parseInt(c.req.query('limit') || '5') || 5
    
    if (!slug) {
      return c.json({
        success: false,
        message: 'Place slug is required',
        data: []
      }, 400)
    }
    
    // Convert slug back to name for searching
    const searchName = slugToName(slug)
    
    // First get the current place coordinates
    let { data: currentPlace, error: currentError } = await supabase
      .from('bangkok_unseen')
      .select('lat, lng, name')
      .ilike('name', searchName)
      .single()
    
    // If exact match fails, try fuzzy search
    if (currentError && currentError.code === 'PGRST116') {
      const fuzzyPattern = `%${searchName.replace(/\s+/g, '%')}%`
      const { data: fuzzyData, error: fuzzyError } = await supabase
        .from('bangkok_unseen')
        .select('lat, lng, name')
        .ilike('name', fuzzyPattern)
        .limit(1)
        .single()
      
      if (fuzzyError || !fuzzyData) {
        return c.json({
          success: false,
          message: 'Place not found',
          data: []
        }, 404)
      }
      
      currentPlace = fuzzyData
    } else if (currentError || !currentPlace) {
      return c.json({
        success: false,
        message: 'Place not found',
        data: []
      }, 404)
    }
    
    // Find nearby places using a simple bounding box approach
    const latRange = 0.045 // Approximately 5km
    const lngRange = 0.045
    
    const { data, error } = await supabase
      .from('bangkok_unseen')
      .select('*')
      .neq('name', currentPlace.name) // Exclude the current place by name
      .gte('lat', currentPlace.lat - latRange)
      .lte('lat', currentPlace.lat + latRange)
      .gte('lng', currentPlace.lng - lngRange)
      .lte('lng', currentPlace.lng + lngRange)
      .limit(limit)
    
    if (error) {
      console.error('Error fetching nearby places:', error)
      return c.json({
        success: false,
        message: 'Failed to fetch nearby places',
        data: [],
        error: error.message
      }, 500)
    }
    
    // Clean the data and add slugs
    const cleanData = (data || []).map(place => ({
      ...place,
      image_url: place.image_url || '',
      tags: Array.isArray(place.tags) ? place.tags : [],
      name: place.name || 'Unknown Place',
      slug: nameToSlug(place.name || 'unknown-place')
    }))
    
    return c.json({
      success: true,
      data: cleanData
    })
  } catch (error) {
    console.error('Server error:', error)
    return c.json({
      success: false,
      message: 'Internal server error',
      data: [],
      error: error instanceof Error ? error.message : 'Unknown error'
    }, 500)
  }
})

export default places

