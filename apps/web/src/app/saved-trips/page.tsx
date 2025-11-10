"use client"

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useAuth } from '@/contexts/auth-context'
import { MapPin, Clock, ListChecks } from 'lucide-react'

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
  const [trips, setTrips] = useState<Trip[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
      const j = contentType.includes('application/json') ? await res.json() : { success: false, error: (await res.text()) || 'Bad response' }
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

  const totalStops = useMemo(() => trips.reduce((acc, t) => acc + (t.stops?.length || 0), 0), [trips])

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
    <div className="max-w-5xl mx-auto p-6 space-y-6 text-black">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Saved Trips</h1>
        <div className="text-sm text-gray-600">{trips.length} Trips</div>
      </div>

      {error && (
        <div className="text-red-600 text-sm">{error}</div>
      )}

      {trips.length === 0 && !busy && (
        <Card className="bg-white">
          <CardContent className="p-6 space-y-3">
            <p className="text-gray-700">No trips yet. Create one from the Trip Planner or a Place page.</p>
            <div className="flex gap-3">
              <Link href="/map"><Button>Open Trip Planner</Button></Link>
              <Link href="/places"><Button variant="outline">Browse Places</Button></Link>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4">
        {trips.map((t) => (
          <Card key={t.id} className="bg-white">
            <CardContent className="p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-lg font-medium text-black">{t.title}</div>
                  <div className="text-xs text-gray-500">{t.created_at ? new Date(t.created_at).toLocaleString() : ''}</div>
                </div>
                <div className="text-sm text-gray-600 flex items-center gap-4">
                  {typeof t.total_minutes === 'number' && (
                    <span className="flex items-center gap-1"><Clock className="w-4 h-4" /> {t.total_minutes} min</span>
                  )}
                  {typeof t.total_distance_km === 'number' && (
                    <span className="flex items-center gap-1"><ListChecks className="w-4 h-4" /> {t.total_distance_km} km</span>
                  )}
                </div>
              </div>
              <ol className="list-decimal pl-6 space-y-1">
                {t.stops?.map((s) => (
                  <li key={s.id}>
                    <span className="font-medium text-black">{s.place?.name}</span>
                    {typeof s.distance_from_prev_km === 'number' && (
                      <span className="text-gray-600 ml-2">(+{s.distance_from_prev_km} km)</span>
                    )}
                    {typeof s.suggested_time_min === 'number' && (
                      <span className="text-gray-600 ml-2">{s.suggested_time_min} min</span>
                    )}
                    {s.notes && <span className="text-gray-500 ml-2">— {s.notes}</span>}
                  </li>
                ))}
              </ol>
              <div className="flex gap-3 pt-2">
                <Button className="bg-blue-500 hover:bg-blue-600 text-white border-blue-500" onClick={() => {
                  const first = t.stops?.[0]?.place
                  if (first?.lat && first?.lng) {
                    const url = `https://www.google.com/maps?q=${first.lat},${first.lng}`
                    window.open(url, '_blank')
                  }
                }}>
                  <MapPin className="w-4 h-4 mr-2 text-white" /> View On Map
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

