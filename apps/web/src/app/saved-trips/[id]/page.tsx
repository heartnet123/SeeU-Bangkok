"use client"

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useParams } from 'next/navigation'
import { useAuth } from '@/contexts/auth-context'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Calendar, Clock3, MapPin, Navigation, Pencil, Share2 } from 'lucide-react'
import { toast } from 'sonner'

type Stop = {
  id: string
  position: number
  suggested_time_min?: number
  distance_from_prev_km?: number
  notes?: string
  place: { id: string; name: string; lat?: number; lng?: number; tags?: string[]; image_url?: string | null }
}

type Trip = {
  id: string
  title: string
  created_at?: string
  total_minutes?: number
  total_distance_km?: number
  stops: Stop[]
}

const formatClock = (totalMinutes: number) => {
  const h24 = Math.floor(totalMinutes / 60) % 24
  const m = totalMinutes % 60
  const suffix = h24 >= 12 ? 'PM' : 'AM'
  const h12 = h24 % 12 || 12
  return `${String(h12).padStart(2, '0')}:${String(m).padStart(2, '0')} ${suffix}`
}

const FALLBACK_PLACE_IMAGE = 'https://i.pinimg.com/736x/5d/60/bb/5d60bb1df532a1c181d55c54e0e19c66.jpg'

function getPlaceImageSrc(imageUrl?: string | null) {
  if (typeof imageUrl !== 'string') return FALLBACK_PLACE_IMAGE
  const trimmed = imageUrl.trim()
  if (!trimmed) return FALLBACK_PLACE_IMAGE
  if (!/^https?:\/\//i.test(trimmed)) return FALLBACK_PLACE_IMAGE
  return trimmed
}

export default function SavedTripDetailPage() {
  const { session, loading } = useAuth()
  const params = useParams<{ id: string }>()
  const [trip, setTrip] = useState<Trip | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const serverUrl = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000'
  const isAuthed = !!session?.access_token

  useEffect(() => {
    const loadTrip = async () => {
      if (!session?.access_token || !params?.id) return
      setBusy(true)
      setError(null)
      try {
        const res = await fetch(`${serverUrl}/api/itineraries/${params.id}`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        })

        const contentType = res.headers.get('content-type') || ''
        const json = contentType.includes('application/json')
          ? await res.json()
          : { success: false, error: (await res.text()) || 'Bad response' }

        if (!res.ok || !json.success) throw new Error(json.error || 'Failed to load itinerary')
        setTrip(json.data || null)
      } catch (e: any) {
        setError(e?.message || 'Failed to load itinerary')
      } finally {
        setBusy(false)
      }
    }

    if (isAuthed) loadTrip()
  }, [isAuthed, params?.id, serverUrl, session?.access_token])

  const timelineStops = useMemo(() => {
    if (!trip?.stops?.length) return []
    let running = 9 * 60

    return trip.stops.map((stop) => {
      const timeLabel = formatClock(running)
      running += stop.suggested_time_min || 60
      return { ...stop, timeLabel }
    })
  }, [trip])

  const createdDate = trip?.created_at ? new Date(trip.created_at) : null

  if (!isAuthed && !loading) {
    return (
      <div className="mx-auto max-w-4xl p-6 space-y-4 text-black">
        <h1 className="text-2xl font-semibold">Itinerary Detail</h1>
        <p className="text-gray-600">Please sign in to view your itinerary.</p>
        <Link href="/profile">
          <Button className="bg-blue-700 hover:bg-blue-800">Go to Profile</Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="min-h-[calc(100vh-64px)] bg-slate-50 text-slate-900">
      <header className="relative overflow-hidden border-b border-slate-200/70 bg-white pt-10 pb-10">
        <div className="absolute right-0 top-0 h-full w-full max-w-4xl opacity-30 pointer-events-none flex justify-end">
          <div className="h-80 w-80 translate-x-1/3 -translate-y-1/3 rounded-full bg-blue-100 blur-3xl" />
        </div>

        <div className="relative mx-auto max-w-7xl px-6">
          <div className="mb-4">
            <Link href="/saved-trips" className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900">
              <ArrowLeft className="h-4 w-4" />
              Back to saved trips
            </Link>
          </div>

          {busy ? (
            <div className="text-sm text-slate-500">Loading itinerary...</div>
          ) : error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600">{error}</div>
          ) : trip ? (
            <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
              <div className="max-w-2xl">
                <div className="mb-4 inline-flex items-center gap-2 rounded-md border border-slate-200 bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                  <Calendar className="h-3.5 w-3.5" />
                  {createdDate ? createdDate.toLocaleDateString() : 'No date available'}
                </div>
                <h1 className="mb-2 text-3xl md:text-4xl font-medium tracking-tight">{trip.title}</h1>
                <p className="text-sm text-slate-500">
                  {trip.stops?.length || 0} stops in this itinerary • {trip.total_minutes || 0} minutes planned
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Button className="h-9 text-xs bg-blue-600 hover:bg-blue-700" onClick={() => toast.message('Share action can be connected here')}>
                  <Share2 className="mr-1.5 h-4 w-4" />
                  Share
                </Button>
                <Link href="/map">
                  <Button className="h-9 bg-gray-100 text-xs text-black hover:bg-gray-200">
                    <Pencil className="mr-1.5 h-4 w-4" />
                    Edit in Planner
                  </Button>
                </Link>
              </div>
            </div>
          ) : null}
        </div>
      </header>

      {trip && (
        <main className="mx-auto flex max-w-7xl flex-col gap-10 px-6 py-10 lg:flex-row">
          <aside className="w-full shrink-0 lg:w-64">
            <div className="sticky top-24 space-y-7">
              <div>
                <h3 className="mb-4 text-xs font-medium uppercase tracking-wide text-slate-400">Timeline</h3>
                <div className="relative flex flex-col before:absolute before:inset-y-2 before:left-[11px] before:w-px before:bg-slate-200">
                  <div className="relative flex items-center gap-4 py-3 text-sm font-medium text-slate-900">
                    <span className="z-10 flex h-6 w-6 items-center justify-center rounded-full border border-blue-500 bg-white shadow-sm">
                      <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                    </span>
                    <span className="flex flex-col items-start">
                      <span>Day 1</span>
                      <span className="text-xs font-normal text-slate-400">
                        {createdDate ? createdDate.toLocaleDateString() : 'Flexible date'}
                      </span>
                    </span>
                  </div>
                </div>
              </div>

              <div className="overflow-hidden rounded-xl border border-slate-200/70 bg-white shadow-sm">
                <div className="relative flex h-32 items-center justify-center bg-slate-100">
                  <Button
                    variant="outline"
                    className="h-8 bg-white/90 text-xs"
                    onClick={() => {
                      const first = trip.stops?.[0]?.place
                      if (first?.lat != null && first?.lng != null) {
                        window.open(`https://www.google.com/maps?q=${first.lat},${first.lng}`, '_blank')
                        return
                      }
                      toast.error('No coordinates available for this itinerary.')
                    }}
                  >
                    <Navigation className="mr-1 h-3.5 w-3.5" />
                    View Map
                  </Button>
                </div>
                <div className="flex items-center justify-between bg-slate-50/60 px-3 py-2 text-xs text-slate-500">
                  <span>{trip.stops?.length || 0} locations</span>
                  <span>{trip.total_distance_km || 0} km total</span>
                </div>
              </div>
            </div>
          </aside>

          <section className="max-w-3xl flex-1">
            <div className="mb-8 flex items-center justify-between border-b border-slate-200 pb-4">
              <h2 className="text-lg font-medium tracking-tight text-slate-900">Schedule</h2>
            </div>

            <div className="relative">
              <div className="absolute left-[39px] top-4 bottom-4 w-px bg-slate-200" />

              <div className="space-y-8">
                {timelineStops.map((stop) => (
                  <div key={stop.id} className="group relative flex gap-6">
                    <div className="relative z-10 flex w-20 shrink-0 flex-col items-end pt-1">
                      <span className="bg-slate-50 py-1 text-xs font-medium tracking-tight text-slate-500">{stop.timeLabel}</span>
                      <div className="absolute right-[-28px] top-2 h-2 w-2 rounded-full border-2 border-slate-300 bg-white shadow-sm transition-colors group-hover:border-blue-500" />
                    </div>

                    <article className="flex flex-grow flex-col overflow-hidden rounded-xl border border-slate-200/60 bg-white shadow-sm transition-all duration-300 hover:border-slate-300 hover:shadow sm:flex-row">
                      <div className="relative aspect-[4/3] shrink-0 overflow-hidden bg-gradient-to-br from-blue-100 to-slate-200 sm:w-40 sm:aspect-auto">
                        <Image
                          src={getPlaceImageSrc(stop.place?.image_url)}
                          alt={stop.place?.name || `Stop ${stop.position}`}
                          fill
                          className="object-cover"
                          sizes="(max-width: 640px) 100vw, 160px"
                        />
                        <div className="absolute inset-0 bg-black/10" />
                        <div className="absolute left-2 top-2 rounded-md bg-black/50 px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-white">
                          Stop {stop.position}
                        </div>
                      </div>

                      <div className="flex flex-grow flex-col justify-center p-4 sm:p-5">
                        <div className="mb-2 inline-flex items-center gap-2">
                          <span className="text-[10px] font-medium uppercase tracking-wider text-slate-500">
                            {stop.place?.tags?.[0] || 'Stop'}
                          </span>
                        </div>

                        <h3 className="mb-1 text-base font-medium tracking-tight text-slate-900">{stop.place?.name || 'Untitled stop'}</h3>

                        <div className="mb-3 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                          <div className="flex items-center gap-1">
                            <MapPin className="h-3.5 w-3.5" />
                            {stop.place?.name || 'Unknown area'}
                          </div>
                          <div className="flex items-center gap-1">
                            <Clock3 className="h-3.5 w-3.5" />
                            {stop.suggested_time_min || 60} min
                          </div>
                          {/* {typeof stop.distance_from_prev_km === 'number' && <div>+{stop.distance_from_prev_km} km</div>} */}
                        </div>

                        <p className="text-xs leading-relaxed text-slate-500">
                          {stop.notes?.trim() ? stop.notes : 'No notes added for this stop yet.'}
                        </p>
                      </div>
                    </article>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </main>
      )}
    </div>
  )
}
