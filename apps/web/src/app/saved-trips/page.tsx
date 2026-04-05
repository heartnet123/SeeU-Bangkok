"use client"

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/auth-context'
import { Clock3, ListChecks, Edit, Trash2, Plus, Search, ArrowRight, MapPinned, CalendarDays } from 'lucide-react'
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

  const activeTripStops = activeTrip?.stops?.length || 0

  const formatTripDate = (value?: string, detailed = false) => {
    if (!value) return detailed ? t("common.noCreationDate") : '—'
    return new Date(value).toLocaleString(undefined, detailed ? undefined : { dateStyle: 'medium' })
  }

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
      <div className="mx-auto max-w-4xl space-y-4 p-6 text-black">
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
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <h1 className="text-3xl font-medium tracking-tight sm:text-4xl">{t("savedTrips.pageTitle")}</h1>
              <p className="mt-2 max-w-xl text-sm leading-6 text-slate-500 sm:text-base">{t("savedTrips.pageSubtitle")}</p>
            </div>

            <div className="flex w-full flex-col gap-3 sm:flex-row lg:max-w-xl">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t("savedTrips.searchPlaceholder")}
                  className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <Button
                onClick={() => setIsNewTripDialogOpen(true)}
                className="h-11 w-full bg-blue-600 px-4 text-white hover:bg-blue-700 sm:w-auto sm:min-w-44"
              >
                <Plus className="mr-2 h-4 w-4" />
                {t("savedTrips.newTrip")}
              </Button>
            </div>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:hidden">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{t("savedTrips.tabAll")}</p>
              <p className="mt-2 text-xl font-medium text-slate-900">{filteredTrips.length}</p>
              <p className="text-xs text-slate-500">{t("savedTrips.tripsCount", { count: String(filteredTrips.length) })}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{t("common.stops")}</p>
              <p className="mt-2 text-xl font-medium text-slate-900">{totalStops}</p>
              <p className="text-xs text-slate-500">{t("savedTrips.totalStops", { count: String(totalStops) })}</p>
            </div>
          </div>

          <div className="mt-6 overflow-x-auto border-b border-slate-100">
            <div className="flex min-w-max items-center gap-5 pr-4 text-sm">
              {tabs.map((tab) => {
                const selected = activeTab === tab.id
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`relative whitespace-nowrap pb-3 transition ${selected ? 'text-slate-900' : 'text-slate-400 hover:text-slate-700'}`}
                  >
                    {tab.label}
                    {selected && <span className="absolute bottom-0 left-0 h-0.5 w-full rounded-full bg-slate-900" />}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6 sm:py-8 xl:grid-cols-[minmax(0,1fr)_360px] xl:gap-8">
        <section className="space-y-3">
          <div className="hidden items-center justify-between px-1 text-xs uppercase tracking-wide text-slate-500 lg:flex">
            <span>{t("savedTrips.tripsCount", { count: String(filteredTrips.length) })}</span>
            <span>{t("savedTrips.totalStops", { count: String(totalStops) })}</span>
          </div>

          {error && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-600">{error}</div>}

          {busy ? (
            <div className="rounded-3xl border border-slate-200 bg-white px-5 py-8 text-sm text-slate-500 shadow-sm">
              {t("common.loading")}
            </div>
          ) : filteredTrips.length === 0 ? (
            <div className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8">
              <p className="text-sm leading-6 text-slate-600">{t("savedTrips.noTrips")}</p>
              <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <Link href="/map">
                  <Button className="w-full sm:w-auto">{t("savedTrips.openPlanner")}</Button>
                </Link>
                <Link href="/places">
                  <Button variant="outline" className="w-full sm:w-auto">{t("savedTrips.browsePlaces")}</Button>
                </Link>
              </div>
            </div>
          ) : (
            filteredTrips.map((trip) => {
              const isActive = activeTrip?.id === trip.id
              const stopCount = trip.stops?.length || 0

              return (
                <button
                  key={trip.id}
                  onClick={() => setActiveTripId(trip.id)}
                  className={`w-full rounded-3xl border px-4 py-4 text-left transition sm:px-5 ${
                    isActive
                      ? 'border-blue-200 bg-white shadow-sm ring-1 ring-blue-50'
                      : 'border-slate-200/80 bg-white hover:border-slate-300 hover:bg-slate-50/80'
                  }`}
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.2em] text-slate-500">
                          {t("common.saved")}
                        </span>
                        <span className="inline-flex items-center gap-1 text-xs text-slate-500 sm:hidden">
                          <CalendarDays className="h-3.5 w-3.5" />
                          {formatTripDate(trip.created_at)}
                        </span>
                      </div>

                      <p className={`mt-3 truncate text-base font-medium sm:text-lg ${isActive ? 'text-blue-700' : 'text-slate-900'}`}>{trip.title}</p>

                      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-500 sm:text-sm">
                        <span className="inline-flex items-center gap-1.5">
                          <ListChecks className="h-3.5 w-3.5" />
                          {stopCount} {t("common.stops")}
                        </span>
                        {typeof trip.total_minutes === 'number' && (
                          <span className="inline-flex items-center gap-1.5">
                            <Clock3 className="h-3.5 w-3.5" />
                            {trip.total_minutes} {t("common.min")}
                          </span>
                        )}
                        {typeof trip.total_distance_km === 'number' && (
                          <span className="inline-flex items-center gap-1.5">
                            <MapPinned className="h-3.5 w-3.5" />
                            {trip.total_distance_km} {t("common.km")}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-3 lg:justify-end">
                      <div className="hidden text-xs text-slate-500 sm:flex sm:items-center sm:gap-1.5">
                        <CalendarDays className="h-3.5 w-3.5" />
                        {formatTripDate(trip.created_at)}
                      </div>
                      <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${isActive ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-600'}`}>
                        {isActive ? t("savedTrips.viewDetail") : t("savedTrips.stopsPreview")}
                        <ArrowRight className="h-3.5 w-3.5" />
                      </span>
                    </div>
                  </div>
                </button>
              )
            })
          )}
        </section>

        {activeTrip && (
          <aside className="xl:block">
            <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm xl:sticky xl:top-20">
              <div className="bg-gradient-to-br from-slate-800 via-slate-700 to-slate-600 p-5 text-white sm:p-6">
                <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
                  <span className="rounded-full border border-white/25 bg-white/15 px-2.5 py-1">{activeTripStops} {t("common.stops")}</span>
                  {typeof activeTrip.total_distance_km === 'number' && (
                    <span className="rounded-full border border-white/15 bg-white/10 px-2.5 py-1">{activeTrip.total_distance_km} {t("common.km")}</span>
                  )}
                </div>
                <h3 className="text-xl font-medium tracking-tight sm:text-2xl">{activeTrip.title}</h3>
                <p className="mt-2 text-sm text-white/80">{formatTripDate(activeTrip.created_at, true)}</p>
              </div>

              <div className="space-y-5 p-5 sm:p-6">
                <div>
                  <h4 className="mb-3 text-xs font-medium uppercase tracking-[0.2em] text-slate-400">{t("savedTrips.stopsPreview")}</h4>
                  <ol className="space-y-2.5 text-sm text-slate-600">
                    {activeTrip.stops?.slice(0, 5).map((stop, idx) => (
                      <li key={stop.id} className="flex items-start gap-3">
                        <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-medium text-slate-500">
                          {idx + 1}
                        </span>
                        <span className="min-w-0 text-slate-800">{stop.place?.name || t("savedTrips.untitledStop")}</span>
                      </li>
                    ))}
                    {activeTripStops > 5 && (
                      <li className="pl-9 text-xs text-slate-400">{t("savedTrips.moreStops", { count: String(activeTripStops - 5) })}</li>
                    )}
                  </ol>
                </div>

                <div className="space-y-2.5">
                  <Button className="w-full bg-blue-700 text-white hover:bg-blue-800" onClick={() => handleViewDetail(activeTrip)}>
                    {t("savedTrips.viewDetail")}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>

                  <div className="grid gap-2 sm:grid-cols-2">
                    <Button className="w-full bg-gray-100 text-black hover:bg-gray-200" onClick={() => handleEditTrip(activeTrip)}>
                      <Edit className="mr-2 h-4 w-4" />
                      {t("savedTrips.edit")}
                    </Button>
                    <Button
                      className="w-full bg-red-700 text-white hover:bg-red-800"
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

                <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 text-sm text-slate-500">
                  <p className="mb-1.5 font-medium text-slate-700">{t("savedTrips.tipTitle")}</p>
                  <p className="leading-6">{t("savedTrips.tipDesc")}</p>
                </div>
              </div>
            </div>
          </aside>
        )}
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
