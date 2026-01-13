"use client"

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useAuth } from '@/contexts/auth-context'
import { MapPin, Clock, ListChecks, Edit, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'

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

type EditStop = {
  slug: string
  suggested_time_min: number
  notes: string
}

export default function SavedTripsPage() {
  const { session, loading } = useAuth()
  const [trips, setTrips] = useState<Trip[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editingTrip, setEditingTrip] = useState<Trip | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editStops, setEditStops] = useState<EditStop[]>([])
  const [isSaving, setIsSaving] = useState(false)
  const [deletingTripId, setDeletingTripId] = useState<string | null>(null)

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

  const handleEdit = (trip: Trip) => {
    setEditingTrip(trip)
    setEditTitle(trip.title)
    setEditStops(
      trip.stops.map((s) => ({
        slug: s.place?.name || '', // Use name as slug for resolution
        suggested_time_min: s.suggested_time_min || 60,
        notes: s.notes || '',
      }))
    )
  }

  const handleSaveEdit = async () => {
    if (!editingTrip || !session?.access_token) return
    setIsSaving(true)
    try {
      const res = await fetch(`${serverUrl}/api/itineraries/${editingTrip.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          title: editTitle,
          stops: editStops,
        }),
      })
      const contentType = res.headers.get('content-type') || ''
      const json = contentType.includes('application/json') ? await res.json() : { success: false, error: (await res.text()) || 'Bad response' }
      if (!res.ok || !json.success) throw new Error(json.error || 'Failed to update trip')
      toast.success('Trip updated successfully')
      await fetchTrips()
      setEditingTrip(null)
    } catch (e: any) {
      toast.error(`Failed to update trip: ${e?.message || 'Unknown error'}`)
    } finally {
      setIsSaving(false)
    }
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
      const json = contentType.includes('application/json') ? await res.json() : { success: false, error: (await res.text()) || 'Bad response' }
      if (!res.ok || !json.success) throw new Error(json.error || 'Failed to delete trip')
      toast.success('Trip deleted successfully')
      await fetchTrips()
    } catch (e: any) {
      toast.error(`Failed to delete trip: ${e?.message || 'Unknown error'}`)
    } finally {
      setDeletingTripId(null)
    }
  }

  const updateStopTime = (index: number, value: number) => {
    const updated = [...editStops]
    updated[index].suggested_time_min = value
    setEditStops(updated)
  }

  const updateStopNotes = (index: number, value: string) => {
    const updated = [...editStops]
    updated[index].notes = value
    setEditStops(updated)
  }

  const moveStopUp = (index: number) => {
    if (index === 0) return
    const updated = [...editStops]
    const temp = updated[index - 1]
    updated[index - 1] = updated[index]
    updated[index] = temp
    setEditStops(updated)
  }

  const moveStopDown = (index: number) => {
    if (index === editStops.length - 1) return
    const updated = [...editStops]
    const temp = updated[index + 1]
    updated[index + 1] = updated[index]
    updated[index] = temp
    setEditStops(updated)
  }

  const removeStop = (index: number) => {
    const updated = editStops.filter((_, i) => i !== index)
    setEditStops(updated)
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
                <Button variant="outline" onClick={() => handleEdit(t)}>
                  <Edit className="w-4 h-4 mr-2" /> Edit
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => handleDelete(t.id)}
                  disabled={deletingTripId === t.id}
                >
                  {deletingTripId === t.id ? (
                    <>
                      <div className="w-4 h-4 mr-2 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4 mr-2" /> Delete
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
       </div>

      {/* Edit Modal */}
      {editingTrip && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between border-b pb-4">
                <h2 className="text-xl font-semibold">Edit Trip</h2>
                <Button variant="ghost" size="icon" onClick={() => setEditingTrip(null)}>
                  <X className="w-5 h-5" />
                </Button>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Trip Title</label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., Weekend Temple Tour"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Stops</label>
                <div className="space-y-3">
                  {editStops.map((stop, index) => (
                    <div key={index} className="flex gap-2 items-start p-3 border rounded-md bg-gray-50">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center text-sm font-medium">
                        {index + 1}
                      </div>
                      <div className="flex-1 space-y-2">
                        <div className="font-medium text-black">{stop.slug}</div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-xs text-gray-600">Suggested Time (min)</label>
                            <input
                              type="number"
                              min="1"
                              value={stop.suggested_time_min}
                              onChange={(e) => updateStopTime(index, parseInt(e.target.value) || 1)}
                              className="w-full px-2 py-1 border rounded text-sm"
                            />
                          </div>
                          <div>
                            <label className="text-xs text-gray-600">Notes</label>
                            <input
                              type="text"
                              value={stop.notes}
                              onChange={(e) => updateStopNotes(index, e.target.value)}
                              className="w-full px-2 py-1 border rounded text-sm"
                              placeholder="Add notes..."
                            />
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col gap-1">
                        <button
                          onClick={() => moveStopUp(index)}
                          disabled={index === 0}
                          className="p-1 hover:bg-gray-200 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                          title="Move up"
                        >
                          ↑
                        </button>
                        <button
                          onClick={() => moveStopDown(index)}
                          disabled={index === editStops.length - 1}
                          className="p-1 hover:bg-gray-200 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                          title="Move down"
                        >
                          ↓
                        </button>
                        <button
                          onClick={() => removeStop(index)}
                          className="p-1 hover:bg-red-100 text-red-600 rounded"
                          title="Remove stop"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-3 pt-4 border-t">
                <Button variant="outline" onClick={() => setEditingTrip(null)} className="flex-1">
                  Cancel
                </Button>
                <Button
                  onClick={handleSaveEdit}
                  disabled={isSaving}
                  className="flex-1"
                >
                  {isSaving ? (
                    <>
                      <div className="w-4 h-4 mr-2 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Saving...
                    </>
                  ) : (
                    'Save Changes'
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

