"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/auth-context'
import { nameToSlug } from '@/lib/slug-utils'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'

type ChatEvent =
  | { type: 'message'; text: string }
  | { type: 'status'; text: string }
  | { type: 'suggestions'; data: any }
  | { type: 'itinerary'; data: any }
  | { type: 'error'; text: string }
  | { type: 'done' }

interface PlaceItem {
  id: string
  name: string
  slug: string
  lat?: number
  lng?: number
  tags?: string[]
  price?: number
  maps_url?: string
}

function useSSEStream() {
  const [events, setEvents] = useState<ChatEvent[]>([])
  const [isStreaming, setStreaming] = useState(false)
  const controllerRef = useRef<AbortController | null>(null)

  const stop = useCallback(() => {
    controllerRef.current?.abort()
    controllerRef.current = null
    setStreaming(false)
  }, [])

  const start = useCallback(async (payload: any) => {
    if (isStreaming) stop()
    setEvents([])
    setStreaming(true)
    const controller = new AbortController()
    controllerRef.current = controller

    try {
      const serverUrl = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000'
      const res = await fetch(`${serverUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      })

      if (!res.ok || !res.body) {
        setEvents((prev) => [...prev, { type: 'error', text: `Request failed (${res.status})` }])
        setStreaming(false)
        return
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder('utf-8')
      let buffer = ''

      const flush = () => {
        const chunks = buffer.split('\n\n')
        buffer = chunks.pop() || ''
        for (const chunk of chunks) {
          const lines = chunk.split(/\n|\r\n?/).filter(Boolean)
          let event: string | null = null
          let data: string[] = []
          for (const line of lines) {
            if (line.startsWith('event:')) event = line.slice(6).trim()
            if (line.startsWith('data:')) data.push(line.slice(5).trim())
          }
          const joined = data.join('\n')
          if (!event) continue
          switch (event) {
            case 'message':
              setEvents((prev) => [...prev, { type: 'message', text: joined }])
              break
            case 'status':
              setEvents((prev) => [...prev, { type: 'status', text: joined }])
              break
            case 'suggestions':
              try {
                const payload = JSON.parse(joined)
                setEvents((prev) => [...prev, { type: 'suggestions', data: payload }])
              } catch (e) {
                setEvents((prev) => [...prev, { type: 'error', text: 'Bad suggestions payload' }])
              }
              break
            case 'itinerary':
              try {
                const payload = JSON.parse(joined)
                setEvents((prev) => [...prev, { type: 'itinerary', data: payload }])
              } catch (e) {
                setEvents((prev) => [...prev, { type: 'error', text: 'Bad itinerary payload' }])
              }
              break
            case 'error':
              setEvents((prev) => [...prev, { type: 'error', text: joined }])
              break
            case 'done':
              setEvents((prev) => [...prev, { type: 'done' }])
              setStreaming(false)
              break
          }
        }
      }

      // Read loop
      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        flush()
      }
      // Final flush
      buffer += decoder.decode()
      flush()
    } catch (e: any) {
      if (e?.name !== 'AbortError') {
        setEvents((prev) => [...prev, { type: 'error', text: e?.message || 'Stream error' }])
      }
    } finally {
      setStreaming(false)
    }
  }, [isStreaming, stop])

  return { events, isStreaming, start, stop }
}

export default function ChatTestPage() {
  const [input, setInput] = useState('Suggest a half-day temple tour near me under ฿200')
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [forceNoMatch, setForceNoMatch] = useState(false)
  const { events, isStreaming, start, stop } = useSSEStream()
  const { session } = useAuth()

  const suggestions = useMemo<PlaceItem[]>(() => {
    const ev = [...events].reverse().find((e) => e.type === 'suggestions') as any
    return ev?.data?.places || []
  }, [events])

  const itinerary = useMemo<any>(() => {
    const ev = [...events].reverse().find((e) => e.type === 'itinerary') as any
    return ev?.data || null
  }, [events])

  const statusText = useMemo(() => {
    const ev = [...events].reverse().find((e) => e.type === 'status') as any
    return ev?.text || ''
  }, [events])

  const handleSend = useCallback(() => {
    const payload: any = {
      messages: [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: input },
      ],
    }
    if (coords) payload.userLocation = coords
    if (forceNoMatch) payload.force_no_match = true
    start(payload)
  }, [input, coords, start])

  const handleLocate = useCallback(() => {
    if (!navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude })
      },
      () => {
        // ignore errors silently
      },
      { enableHighAccuracy: true, maximumAge: 30_000, timeout: 10_000 }
    )
  }, [])

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-semibold text-black">Trip Planner Tester</h1>

      <div className="flex gap-2 items-center flex-wrap text-black">
        <Input
          className='border-2 border-indigo-500'
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask for places or a plan..."
        />
        <Button onClick={handleSend} disabled={isStreaming}>Send</Button>
        {isStreaming ? (
          <Button variant="outline" onClick={stop}>Stop</Button>
        ) : (
          <Button variant="outline" onClick={handleLocate}>Use my location</Button>
        )}
      </div>

      {coords && (
        <div className="text-sm text-gray-600">Location: {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}</div>
      )}

      {statusText && (
        <div className="text-sm text-blue-600">Status: {statusText}</div>
      )}

      {/* Streamed assistant messages */}
      <div className="space-y-2">
        {events.filter((e) => e.type === 'message').map((e, i) => (
          <div key={i} className="p-3 rounded-md bg-gray-100 text-gray-800">{(e as any).text}</div>
        ))}
      </div>

      {/* Suggestions */}
      {suggestions.length > 0 && (
        <div className="space-y-2 text-black">
          <h2 className="text-lg font-medium">Suggestions</h2>
          <ul className="grid md:grid-cols-2 gap-3">
            {suggestions.map((p) => (
              <li key={p.slug} className="p-3 rounded-md border">
                <div className="font-semibold">{p.name}</div>
                <div className="text-xs text-gray-600">{p.slug}</div>
                {/* {p.maps_url && (
                  <a className="text-blue-600 text-sm" href={p.maps_url} target="_blank" rel="noreferrer">Open in Maps</a>
                )} */}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Itinerary */}
      {itinerary && (
        <div className="space-y-2 text-black">
          <h2 className="text-lg font-medium">แผนเที่ยว Planner</h2>
          <div className="p-3 rounded-md border">
            <div className="font-semibold mb-2">{itinerary.title}</div>
            <ol className="list-decimal pl-5 space-y-1">
              {itinerary.stops?.map((s: any, idx: number) => (
                <li key={idx}>
                  <span className="font-medium">{s.name}</span>
                  {typeof s.distance_from_prev_km === 'number' && (
                    <span className="text-gray-600 ml-2">(+{s.distance_from_prev_km} km)</span>
                  )}
                  <div className="text-sm text-gray-600">{s.suggested_time_min} min</div>
                  {s.notes && <div className="text-sm text-gray-500">{s.notes}</div>}
                </li>
              ))}
            </ol>
            <div className="pt-3">
              <Button
                disabled={!session?.access_token}
                onClick={async () => {
                  if (!session?.access_token) return
                  try {
                    const serverUrl = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000'
                    const payload = {
                      title: itinerary.title || 'My Trip',
                      stops: (itinerary.stops || []).map((s: any) => ({
                        slug: s.slug || nameToSlug(s.name || ''),
                        suggested_time_min: s.suggested_time_min,
                        notes: s.notes || '',
                      })),
                    }
                    const res = await fetch(`${serverUrl}/api/itineraries`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
                      body: JSON.stringify(payload),
                    })
                    const ct = res.headers.get('content-type') || ''
                    const j = ct.includes('application/json') ? await res.json() : { success: false, error: (await res.text()) || 'Bad response' }
                    if (!res.ok || !j.success) throw new Error(j.error || 'Failed to save itinerary')
                    alert('Itinerary saved! Check Saved Trips')
                  } catch (e: any) {
                    alert(e?.message || 'Failed to save itinerary')
                  }
                }}
              >
                Save This Plan
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Errors */}
      {events.filter((e) => e.type === 'error').length > 0 && (
        <div className="text-red-600 text-sm">
          {events.filter((e) => e.type === 'error').map((e, i) => (
            <div key={i}>Error: {(e as any).text}</div>
          ))}
        </div>
      )}
    </div>
  )
}
