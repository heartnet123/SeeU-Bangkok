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
import { useTranslation } from '@/contexts/language-context'

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
  const { t } = useTranslation()
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
    setActiveTripId((prev) => (prev && trips.some((trip) => trip.id === prev) ? prev : trips[0].id))
  }, [trips])

  const totalStops = useMemo(() => trips.reduce((acc, trip) => acc + (trip.stops?.length || 0), 0), [trips])

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
    if (!confirm(t("savedTrips.deleteConfirm"))) return
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
      toast.success(t("savedTrips.deleteSuccess"))
      await fetchTrips()
    } catch (e: any) {
      toast.error(`${t("savedTrips.deleteError")}: ${e?.message || 'Unknown error'}`)
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
        <h1 className="text-2xl font-semibold">{t("nav.savedTrips")}</h1>
        <p className="text-gray-600">{t("savedTrips.signInPrompt")}</p>
        <Link href="/profile">
          <Button className="bg-blue-700 hover:bg-blue-800">{t("savedTrips.goToProfile")}</Button>
        </Link>
      </div>
    )
  }

  const tabs = [
    { id: 'all' as const, label: t("savedTrips.tabAll") },
    { id: 'recent' as const, label: t("savedTrips.tabRecent") },
    { id: 'short' as const, label: t("savedTrips.tabShort") },
    { id: 'long' as const, label: t("savedTrips.tabLong") },
  ]

  return (
    <div className="min-h-[calc(100vh-64px)] bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200/80 bg-white">
        <div className="mx-auto max-w-7xl px-6 py-8">
          <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div>
              <h1 className="text-3xl font-medium tracking-tight">{t("savedTrips.pageTitle")}</h1>
              <p className="mt-1 text-sm text-slate-500">{t("savedTrips.pageSubtitle")}</p>
            </div>

            <div className="flex w-full flex-col items-stretch gap-3 sm:flex-row md:w-auto">
              <div className="relative w-full sm:w-72">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t("savedTrips.searchPlaceholder")}
                  className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <Button
                onClick={() => setIsNewTripDialogOpen(true)}
                className="h-10 px-4 text-white bg-blue-600 hover:bg-blue-700"
              >
                <Plus className="mr-2 h-4 w-4" />
                {t("savedTrips.newTrip")}
              </Button>
            </div>
          </div>

          <div className="mt-7 flex flex-wrap items-center gap-4 border-b border-slate-100 text-sm">
            {tabs.map((tab) => {
              const selected = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
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
            <span>{t("savedTrips.tripsCount", { count: String(filteredTrips.length) })}</span>
            <span>{t("savedTrips.totalStops", { count: String(totalStops) })}</span>
          </div>

          {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600">{error}</div>}

          {filteredTrips.length === 0 && !busy ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-6">
              <p className="text-sm text-slate-600">{t("savedTrips.noTrips")}</p>
              <div className="mt-4 flex flex-wrap gap-3">
                <Link href="/map">
                  <Button>{t("savedTrips.openPlanner")}</Button>
                </Link>
                <Link href="/places">
                  <Button variant="outline">{t("savedTrips.browsePlaces")}</Button>
                </Link>
              </div>
            </div>
          ) : (
            filteredTrips.map((trip) => {
              const isActive = activeTrip?.id === trip.id
              return (
                <button
                  key={trip.id}
                  onClick={() => setActiveTripId(trip.id)}
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
                        {trip.stops?.length || 0} {t("common.stops")}
                      </span>
                      {typeof trip.total_minutes === 'number' && (
                        <span className="inline-flex items-center gap-1">
                          <Clock3 className="h-3.5 w-3.5" />
                          {trip.total_minutes} {t("common.min")}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="hidden sm:block sm:col-span-2">
                    <span className="inline-flex rounded border border-slate-200 bg-slate-100 px-2 py-0.5 text-[10px] uppercase tracking-wider text-slate-600">
                      {t("common.saved")}
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
                  <span className="rounded border border-white/30 bg-white/20 px-2 py-0.5">{activeTrip.stops?.length || 0} {t("common.stops")}</span>
                  {typeof activeTrip.total_distance_km === 'number' && <span>{activeTrip.total_distance_km} {t("common.km")}</span>}
                </div>
                <h3 className="text-lg font-medium tracking-tight">{activeTrip.title}</h3>
                <p className="mt-1 text-xs text-white/80">
                  {activeTrip.created_at ? new Date(activeTrip.created_at).toLocaleString() : t("common.noCreationDate")}
                </p>
              </div>

              <div className="space-y-5 p-5">
                <div>
                  <h4 className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">{t("savedTrips.stopsPreview")}</h4>
                  <ol className="space-y-1.5 text-sm text-slate-600">
                    {activeTrip.stops?.slice(0, 5).map((stop, idx) => (
                      <li key={stop.id} className="truncate">
                        <span className="mr-1 text-slate-400">{idx + 1}.</span>
                        <span className="text-slate-800">{stop.place?.name || t("savedTrips.untitledStop")}</span>
                      </li>
                    ))}
                    {(activeTrip.stops?.length || 0) > 5 && (
                      <li className="text-xs text-slate-400">{t("savedTrips.moreStops", { count: String((activeTrip.stops?.length || 0) - 5) })}</li>
                    )}
                  </ol>
                </div>

                <div className="space-y-2">
                  <Button className="w-full bg-blue-700 text-white hover:bg-blue-800" onClick={() => handleViewDetail(activeTrip)}>
                    {t("savedTrips.viewDetail")}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>

                  <div className="flex gap-2">
                    <Button className="flex-1 bg-gray-100 text-black hover:bg-gray-200" onClick={() => handleEditTrip(activeTrip)}>
                      <Edit className="mr-2 h-4 w-4" />
                      {t("savedTrips.edit")}
                    </Button>
                    <Button
                      className="flex-1 bg-red-700 text-white hover:bg-red-800"
                      onClick={() => handleDelete(activeTrip.id)}
                      disabled={deletingTripId === activeTrip.id}
                    >
                      {deletingTripId === activeTrip.id ? (
                        <>
                          <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                          {t("savedTrips.deleting")}
                        </>
                      ) : (
                        <>
                          <Trash2 className="mr-2 h-4 w-4" />
                          {t("savedTrips.delete")}
                        </>
                      )}
                    </Button>
                  </div>
                </div>

                <div className="rounded-lg border border-slate-100 bg-slate-50 p-3 text-xs text-slate-500">
                  <p className="mb-1 font-medium text-slate-600">{t("savedTrips.tipTitle")}</p>
                  <p>{t("savedTrips.tipDesc")}</p>
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
