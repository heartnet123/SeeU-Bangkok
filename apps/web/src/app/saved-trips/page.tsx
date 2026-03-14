"use client"

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/auth-context'
import { Clock3, ListChecks, Edit, Trash2, Plus, Search, ArrowRight } from 'lucide-react'
import { toast } from 'sonner'
import { NewTripDialog } from '@/components/trips/new-trip-dialog'
import { EditTripDialog } from '@/components/trips/edit-trip-dialog'

type Stop = {
  id: string
  position: number
  suggested_time_min?: number
  distance_from_prev_km?: number
  notes?: string
  place: { id: string; name: string; lat?: number; lng?: number; tags?: string[] }
}

type Trip = {
  id: string
  title: string
  created_at?: string
  total_minutes?: number
  total_distance_km?: number
  stops: Stop[]
}

export default function SavedTripsPage() {
  const { session, loading } = useAuth()
  const router = useRouter()
  const [trips, setTrips] = useState<Trip[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editingTrip, setEditingTrip] = useState<Trip | null>(null)
  const [deletingTripId, setDeletingTripId] = useState<string | null>(null)
  const [isNewTripDialogOpen, setIsNewTripDialogOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<'all' | 'recent' | 'short' | 'long'>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [activeTripId, setActiveTripId] = useState<string | null>(null)

  const serverUrl = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000'
  const isAuthed = !!session?.access_token

  const fetchTrips = async () => {
    if (!session?.access_token) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`${serverUrl}/api/itineraries`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      const contentType = res.headers.get('content-type') || ''
      const j = contentType.includes('application/json')
        ? await res.json()
        : { success: false, error: (await res.text()) || 'Bad response' }
      if (!res.ok || !j.success) throw new Error(j.error || 'Failed to load trips')
      setTrips(j.data || [])
    } catch (e: any) {
      setError(e?.message || 'Failed to load trips')
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    if (isAuthed) fetchTrips()
  }, [isAuthed])

  useEffect(() => {
    if (!trips.length) {
      setActiveTripId(null)
      return
    }

    setActiveTripId((prev) => (prev && trips.some((t) => t.id === prev) ? prev : trips[0].id))
  }, [trips])

  const totalStops = useMemo(() => trips.reduce((acc, t) => acc + (t.stops?.length || 0), 0), [trips])

  const filteredTrips = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()

    const searched = !q
      ? trips
      : trips.filter((trip) => {
          const inTitle = trip.title.toLowerCase().includes(q)
          const inStops = trip.stops?.some((s) => s.place?.name?.toLowerCase().includes(q))
          return inTitle || inStops
        })

    if (activeTab === 'all') return searched
    if (activeTab === 'recent') {
      return [...searched].sort((a, b) => {
        const ad = a.created_at ? new Date(a.created_at).getTime() : 0
        const bd = b.created_at ? new Date(b.created_at).getTime() : 0
        return bd - ad
      })
    }
    if (activeTab === 'short') return searched.filter((trip) => (trip.stops?.length || 0) <= 3)
    return searched.filter((trip) => (trip.stops?.length || 0) > 3)
  }, [trips, searchQuery, activeTab])

  const activeTrip = useMemo(() => {
    const found = filteredTrips.find((trip) => trip.id === activeTripId)
    return found || filteredTrips[0] || null
  }, [filteredTrips, activeTripId])

  const handleEditTrip = (trip: Trip) => {
    setEditingTrip(trip)
  }

  const handleDelete = async (tripId: string) => {
    if (!session?.access_token) return
    if (!confirm('Are you sure you want to delete this trip?')) return
    setDeletingTripId(tripId)
    try {
      const res = await fetch(`${serverUrl}/api/itineraries/${tripId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      })
      const contentType = res.headers.get('content-type') || ''
      const json = contentType.includes('application/json')
        ? await res.json()
        : { success: false, error: (await res.text()) || 'Bad response' }
      if (!res.ok || !json.success) throw new Error(json.error || 'Failed to delete trip')
      toast.success('Trip deleted successfully')
      await fetchTrips()
    } catch (e: any) {
      toast.error(`Failed to delete trip: ${e?.message || 'Unknown error'}`)
    } finally {
      setDeletingTripId(null)
    }
  }

  const handleViewDetail = (trip: Trip) => {
    router.push(`/saved-trips/${trip.id}`)
  }

  if (!isAuthed && !loading) {
    return (
      <div className="max-w-4xl mx-auto p-6 space-y-4 text-black">
        <h1 className="text-2xl font-semibold">Saved Trips</h1>
        <p className="text-gray-600">Please sign in to view your saved trips.</p>
        <Link href="/profile">
          <Button className="bg-blue-700 hover:bg-blue-800">Go to Profile</Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="min-h-[calc(100vh-64px)] bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200/80 bg-white">
        <div className="mx-auto max-w-7xl px-6 py-8">
          <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div>
              <h1 className="text-3xl font-medium tracking-tight">Your Library</h1>
              <p className="mt-1 text-sm text-slate-500">Manage your saved trips and revisit your route ideas.</p>
            </div>

            <div className="flex w-full flex-col items-stretch gap-3 sm:flex-row md:w-auto">
              <div className="relative w-full sm:w-72">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search trips or stops..."
                  className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <Button
                onClick={() => setIsNewTripDialogOpen(true)}
                className="h-10 bg-slate-900 px-4 text-white hover:bg-slate-800"
              >
                <Plus className="mr-2 h-4 w-4" />
                New Trip
              </Button>
            </div>
          </div>

          <div className="mt-7 flex flex-wrap items-center gap-4 border-b border-slate-100 text-sm">
            {[
              { id: 'all', label: 'All' },
              { id: 'recent', label: 'Recent' },
              { id: 'short', label: 'Short Trips' },
              { id: 'long', label: 'Long Trips' },
            ].map((tab) => {
              const selected = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as 'all' | 'recent' | 'short' | 'long')}
                  className={`relative pb-3 transition ${selected ? 'text-slate-900' : 'text-slate-400 hover:text-slate-700'}`}
                >
                  {tab.label}
                  {selected && <span className="absolute bottom-0 left-0 h-0.5 w-full rounded-full bg-slate-900" />}
                </button>
              )
            })}
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-7xl gap-8 px-6 py-8 lg:grid-cols-[1fr_360px]">
        <section className="space-y-2">
          <div className="mb-2 flex items-center justify-between px-1 text-xs uppercase tracking-wide text-slate-500">
            <span>{filteredTrips.length} Trips</span>
            <span>{totalStops} total stops</span>
          </div>

          {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600">{error}</div>}

          {filteredTrips.length === 0 && !busy ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-6">
              <p className="text-sm text-slate-600">No trips found. Create one from the Trip Planner or browse places.</p>
              <div className="mt-4 flex flex-wrap gap-3">
                <Link href="/map">
                  <Button>Open Trip Planner</Button>
                </Link>
                <Link href="/places">
                  <Button variant="outline">Browse Places</Button>
                </Link>
              </div>
            </div>
          ) : (
            filteredTrips.map((trip) => {
              const isActive = activeTrip?.id === trip.id
              return (
                <button
                  key={trip.id}
                  onClick={() => router.push(`/saved-trips/${trip.id}`)}
                  className={`grid w-full grid-cols-12 items-center gap-4 rounded-xl border px-4 py-4 text-left transition ${
                    isActive
                      ? 'border-blue-200 bg-white shadow-sm ring-1 ring-blue-50'
                      : 'border-transparent hover:border-slate-200 hover:bg-slate-100/70'
                  }`}
                >
                  <div className="col-span-12 sm:col-span-7">
                    <p className={`truncate text-base font-medium ${isActive ? 'text-blue-600' : 'text-slate-900'}`}>{trip.title}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      <span className="inline-flex items-center gap-1">
                        <ListChecks className="h-3.5 w-3.5" />
                        {trip.stops?.length || 0} stops
                      </span>
                      {typeof trip.total_minutes === 'number' && (
                        <span className="inline-flex items-center gap-1">
                          <Clock3 className="h-3.5 w-3.5" />
                          {trip.total_minutes} min
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="hidden sm:block sm:col-span-2">
                    <span className="inline-flex rounded border border-slate-200 bg-slate-100 px-2 py-0.5 text-[10px] uppercase tracking-wider text-slate-600">
                      Saved
                    </span>
                  </div>

                  <div className="hidden justify-end text-xs text-slate-500 sm:flex sm:col-span-3">
                    {trip.created_at ? new Date(trip.created_at).toLocaleDateString() : '—'}
                  </div>
                </button>
              )
            })
          )}
        </section>

        <aside className="hidden lg:block">
          {activeTrip && (
            <div className="sticky top-20 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="bg-gradient-to-br from-slate-800 to-slate-600 p-5 text-white">
                <div className="mb-2 flex items-center gap-2 text-xs">
                  <span className="rounded border border-white/30 bg-white/20 px-2 py-0.5">{activeTrip.stops?.length || 0} Stops</span>
                  {typeof activeTrip.total_distance_km === 'number' && <span>{activeTrip.total_distance_km} km</span>}
                </div>
                <h3 className="text-lg font-medium tracking-tight">{activeTrip.title}</h3>
                <p className="mt-1 text-xs text-white/80">
                  {activeTrip.created_at ? new Date(activeTrip.created_at).toLocaleString() : 'No creation date'}
                </p>
              </div>

              <div className="space-y-5 p-5">
                <div>
                  <h4 className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">Stops Preview</h4>
                  <ol className="space-y-1.5 text-sm text-slate-600">
                    {activeTrip.stops?.slice(0, 5).map((stop, idx) => (
                      <li key={stop.id} className="truncate">
                        <span className="mr-1 text-slate-400">{idx + 1}.</span>
                        <span className="text-slate-800">{stop.place?.name || 'Untitled stop'}</span>
                      </li>
                    ))}
                    {(activeTrip.stops?.length || 0) > 5 && (
                      <li className="text-xs text-slate-400">+{(activeTrip.stops?.length || 0) - 5} more stops</li>
                    )}
                  </ol>
                </div>

                <div className="space-y-2">
                  <Button className="w-full bg-blue-600 text-white hover:bg-blue-700" onClick={() => handleViewDetail(activeTrip)}>
                    View Detail
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>

                  <div className="flex gap-2">
                    <Button variant="outline" className="flex-1" onClick={() => handleEditTrip(activeTrip)}>
                      <Edit className="mr-2 h-4 w-4" />
                      Edit
                    </Button>
                    <Button
                      variant="destructive"
                      className="flex-1"
                      onClick={() => handleDelete(activeTrip.id)}
                      disabled={deletingTripId === activeTrip.id}
                    >
                      {deletingTripId === activeTrip.id ? (
                        <>
                          <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                          Deleting...
                        </>
                      ) : (
                        <>
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </>
                      )}
                    </Button>
                  </div>
                </div>

                <div className="rounded-lg border border-slate-100 bg-slate-50 p-3 text-xs text-slate-500">
                  <p className="mb-1 font-medium text-slate-600">Tip</p>
                  <p>Use search to quickly find trips by stop name and open them from the panel.</p>
                </div>
              </div>
            </div>
          )}
        </aside>
      </main>

      <EditTripDialog
        isOpen={editingTrip !== null}
        onClose={() => setEditingTrip(null)}
        onSuccess={fetchTrips}
        trip={editingTrip}
        serverUrl={serverUrl}
        sessionToken={session?.access_token || ''}
      />

      <NewTripDialog
        isOpen={isNewTripDialogOpen}
        onClose={() => setIsNewTripDialogOpen(false)}
        onSuccess={fetchTrips}
        serverUrl={serverUrl}
        sessionToken={session?.access_token || ''}
      />
    </div>
  )
}
