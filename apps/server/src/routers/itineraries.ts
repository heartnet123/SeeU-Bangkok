import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { authMiddleware } from '../middleware/auth';
import { supabase } from '../lib/supabase';
import { slugToName } from '../lib/slug-utils';

const itineraries = new Hono();
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const stopInput = z.union([
	z.object({
		place_id: z.string().min(1),
		slug: z.string().optional(),
		suggested_time_min: z.number().int().positive().optional(),
		notes: z.string().optional().default(''),
		distance_from_prev_km: z.number().nonnegative().optional(),
	}),
	z.object({
		slug: z.string().min(1),
		suggested_time_min: z.number().int().positive().optional(),
		notes: z.string().optional().default(''),
		distance_from_prev_km: z.number().nonnegative().optional(),
	}),
]);

const createSchema = z.object({
	title: z.string().min(1),
	stops: z.array(stopInput).min(1).max(10),
	total_minutes: z.number().int().nonnegative().optional(),
	total_distance_km: z.number().nonnegative().optional(),
	context: z.record(z.string(), z.unknown()).nullable().optional(),
});

type StopInput = z.infer<typeof stopInput>;

function isUuid(value: string): boolean {
	return UUID_PATTERN.test(value);
}

function getStopSlug(stop: StopInput): string | null {
	if ('slug' in stop && typeof stop.slug === 'string' && stop.slug.length > 0) {
		return stop.slug;
	}

	if ('place_id' in stop && stop.place_id && !isUuid(stop.place_id)) {
		return stop.place_id;
	}

	return null;
}

async function resolveStop(
	stop: StopInput,
	position: number
): Promise<{
	place_id: string;
	position: number;
	suggested_time_min?: number;
	notes?: string;
	distance_from_prev_km?: number;
}> {
	if ('place_id' in stop && stop.place_id) {
		if (isUuid(stop.place_id)) {
			return {
				place_id: stop.place_id,
				position,
				suggested_time_min: stop.suggested_time_min,
				notes: stop.notes,
				distance_from_prev_km: stop.distance_from_prev_km,
			};
		}

		const inferredSlug = getStopSlug(stop);
		if (!inferredSlug) {
			console.warn('[itineraries.resolveStop] Non-UUID place_id received; likely slug leaked into place_id', {
				position,
				place_id: stop.place_id,
				slug: 'slug' in stop ? stop.slug : undefined,
			});
			throw new Error('Invalid place_id. Expected UUID or a resolvable stop slug.');
		}

		console.warn('[itineraries.resolveStop] Non-UUID place_id received; resolving via slug fallback', {
			position,
			place_id: stop.place_id,
			slug: inferredSlug,
		});
	}

	const resolvedSlug = getStopSlug(stop);

	if (!resolvedSlug) {
		throw new Error('Stop slug is required when place_id is not provided');
	}

	console.info('[itineraries.resolveStop] Resolving stop slug to UUID place id', {
		position,
		slug: resolvedSlug,
	});

	const name = slugToName(resolvedSlug);
	let { data: place, error } = await supabase
		.from('bangkok_unseen')
		.select('id, name')
		.ilike('name', name)
		.single();

	if (error && (error as any).code === 'PGRST116') {
		const fuzzy = `%${name.replace(/\s+/g, '%')}%`;
		const { data: fallbackPlace, error: fallbackError } = await supabase
			.from('bangkok_unseen')
			.select('id, name')
			.ilike('name', fuzzy)
			.limit(1)
			.single();
		if (fallbackError || !fallbackPlace) {
			throw new Error(`Place not found for slug: ${resolvedSlug}`);
		}
		place = fallbackPlace;
	} else if (error || !place) {
		throw new Error(`Place not found for slug: ${resolvedSlug}`);
	}

	return {
		place_id: place.id,
		position,
		suggested_time_min: stop.suggested_time_min,
		notes: stop.notes,
		distance_from_prev_km: stop.distance_from_prev_km,
	};
}

itineraries.get('/', authMiddleware, async (c) => {
	const user = c.get('user');
	try {
		const { data: trips, error } = await supabase
			.from('itineraries')
			.select('id, title, total_minutes, total_distance_km, created_at')
			.eq('user_id', user.id)
			.order('created_at', { ascending: false });

		if (error) throw error;
		if (!trips || trips.length === 0) return c.json({ success: true, data: [] });

		const ids = trips.map((trip) => trip.id);
		const { data: stops, error: stopErr } = await supabase
			.from('itinerary_stops')
			.select('id, itinerary_id, position, suggested_time_min, distance_from_prev_km, notes, place_id')
			.in('itinerary_id', ids)
			.order('position', { ascending: true });
		if (stopErr) throw stopErr;

		const placeIds = Array.from(new Set((stops || []).map((stop) => stop.place_id).filter(Boolean)));
		const { data: places, error: placeErr } = placeIds.length
			? await supabase.from('bangkok_unseen').select('id, name, lat, lng, tags, image_url').in('id', placeIds)
			: { data: [], error: null as any };
		if (placeErr) throw placeErr;

		const placeMap = new Map((places || []).map((place) => [place.id, place]));
		const byTrip: Record<string, any[]> = {};

		for (const stop of stops || []) {
			const place = (placeMap.get(stop.place_id as any) as any) || {};
			byTrip[stop.itinerary_id] ||= [];
			byTrip[stop.itinerary_id].push({
				id: stop.id,
				position: stop.position,
				suggested_time_min: stop.suggested_time_min,
				distance_from_prev_km: stop.distance_from_prev_km,
				notes: stop.notes || '',
				place_id: stop.place_id,
				place: {
					id: place.id,
					name: place.name,
					lat: place.lat,
					lng: place.lng,
					tags: Array.isArray(place.tags) ? place.tags : [],
					image_url: place.image_url || '',
				},
			});
		}

		return c.json({
			success: true,
			data: trips.map((trip) => ({
				...trip,
				stops: byTrip[trip.id] || [],
			})),
		});
	} catch (e: any) {
		return c.json({ success: false, error: e?.message || 'Failed to list itineraries' }, 500);
	}
});

itineraries.get('/:id', authMiddleware, async (c) => {
	const user = c.get('user');
	const itineraryId = c.req.param('id');

	try {
		const { data: trip, error: tripErr } = await supabase
			.from('itineraries')
			.select('id, title, total_minutes, total_distance_km, created_at, user_id, context')
			.eq('id', itineraryId)
			.single();

		if (tripErr || !trip) {
			return c.json({ success: false, error: 'Itinerary not found' }, 404);
		}
		if (trip.user_id !== user.id) {
			return c.json({ success: false, error: 'Unauthorized' }, 403);
		}

		const { data: stops, error: stopErr } = await supabase
			.from('itinerary_stops')
			.select('id, itinerary_id, position, suggested_time_min, distance_from_prev_km, notes, place_id')
			.eq('itinerary_id', itineraryId)
			.order('position', { ascending: true });
		if (stopErr) throw stopErr;

		const placeIds = Array.from(new Set((stops || []).map((stop) => stop.place_id).filter(Boolean)));
		const { data: places, error: placeErr } = placeIds.length
			? await supabase.from('bangkok_unseen').select('id, name, lat, lng, tags, image_url').in('id', placeIds)
			: { data: [], error: null as any };
		if (placeErr) throw placeErr;

		const placeMap = new Map((places || []).map((place) => [place.id, place]));
		const mappedStops = (stops || []).map((stop) => {
			const place = (placeMap.get(stop.place_id as any) as any) || {};
			return {
				id: stop.id,
				position: stop.position,
				suggested_time_min: stop.suggested_time_min,
				distance_from_prev_km: stop.distance_from_prev_km,
				notes: stop.notes || '',
				place_id: stop.place_id,
				place: {
					id: place.id,
					name: place.name,
					lat: place.lat,
					lng: place.lng,
					tags: Array.isArray(place.tags) ? place.tags : [],
					image_url: place.image_url || '',
				},
			};
		});

		return c.json({
			success: true,
			data: {
				id: trip.id,
				title: trip.title,
				total_minutes: trip.total_minutes,
				total_distance_km: trip.total_distance_km,
				created_at: trip.created_at,
				context: trip.context,
				stops: mappedStops,
			},
		});
	} catch (e: any) {
		return c.json({ success: false, error: e?.message || 'Failed to get itinerary detail' }, 500);
	}
});

itineraries.post('/', authMiddleware, zValidator('json', createSchema), async (c) => {
	const user = c.get('user');
	const { title, stops, total_minutes, total_distance_km, context } = c.req.valid('json');

	try {
		const resolved: Array<Awaited<ReturnType<typeof resolveStop>>> = [];
		let pos = 1;
		for (const stop of stops) {
			resolved.push(await resolveStop(stop, pos++));
		}

		const { data: trip, error: insErr } = await supabase
			.from('itineraries')
			.insert({
				user_id: user.id,
				title,
				total_minutes,
				total_distance_km,
				context: context ?? null,
			})
			.select('id, title, created_at')
			.single();
		if (insErr) throw insErr;

		const payload = resolved.map((stop) => ({ ...stop, itinerary_id: trip.id }));
		const { error: stopErr } = await supabase.from('itinerary_stops').insert(payload);
		if (stopErr) throw stopErr;

		return c.json({ success: true, data: trip });
	} catch (e: any) {
		return c.json({ success: false, error: e?.message || 'Failed to create itinerary' }, 500);
	}
});

itineraries.put('/:id', authMiddleware, zValidator('json', createSchema), async (c) => {
	const user = c.get('user');
	const itineraryId = c.req.param('id');
	const { title, stops, total_minutes, total_distance_km, context } = c.req.valid('json');

	try {
		const { data: existing, error: checkErr } = await supabase
			.from('itineraries')
			.select('user_id')
			.eq('id', itineraryId)
			.single();
		if (checkErr || !existing) {
			return c.json({ success: false, error: 'Itinerary not found' }, 404);
		}
		if (existing.user_id !== user.id) {
			return c.json({ success: false, error: 'Unauthorized' }, 403);
		}

		const resolved: Array<Awaited<ReturnType<typeof resolveStop>>> = [];
		let pos = 1;
		for (const stop of stops) {
			resolved.push(await resolveStop(stop, pos++));
		}

		const { error: updateErr } = await supabase
			.from('itineraries')
			.update({ title, total_minutes, total_distance_km, context: context ?? null })
			.eq('id', itineraryId);
		if (updateErr) throw updateErr;

		const { error: delErr } = await supabase
			.from('itinerary_stops')
			.delete()
			.eq('itinerary_id', itineraryId);
		if (delErr) throw delErr;

		const payload = resolved.map((stop) => ({ ...stop, itinerary_id: itineraryId }));
		const { error: stopErr } = await supabase.from('itinerary_stops').insert(payload);
		if (stopErr) throw stopErr;

		return c.json({ success: true, data: { id: itineraryId, title } });
	} catch (e: any) {
		return c.json({ success: false, error: e?.message || 'Failed to update itinerary' }, 500);
	}
});

itineraries.delete('/:id', authMiddleware, async (c) => {
	const user = c.get('user');
	const itineraryId = c.req.param('id');
	try {
		const { data: existing, error: checkErr } = await supabase
			.from('itineraries')
			.select('user_id')
			.eq('id', itineraryId)
			.single();
		if (checkErr || !existing) {
			return c.json({ success: false, error: 'Itinerary not found' }, 404);
		}
		if (existing.user_id !== user.id) {
			return c.json({ success: false, error: 'Unauthorized' }, 403);
		}

		const { error: delStopsErr } = await supabase
			.from('itinerary_stops')
			.delete()
			.eq('itinerary_id', itineraryId);
		if (delStopsErr) throw delStopsErr;

		const { error: delErr } = await supabase
			.from('itineraries')
			.delete()
			.eq('id', itineraryId);
		if (delErr) throw delErr;

		return c.json({ success: true, data: { id: itineraryId } });
	} catch (e: any) {
		return c.json({ success: false, error: e?.message || 'Failed to delete itinerary' }, 500);
	}
});

export default itineraries;
