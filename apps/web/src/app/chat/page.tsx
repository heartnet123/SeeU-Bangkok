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
  | { type: 'tools'; data: any }
  | { type: 'context'; data: any }

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

  const start = useCallback(async (payload: any, endpoint: 'chat' | 'agent' | 'agent/v2' = 'agent/v2') => {
    if (isStreaming) stop()
    setEvents([])
    setStreaming(true)
    const controller = new AbortController()
    controllerRef.current = controller

    try {
      const serverUrl = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000'
      const res = await fetch(`${serverUrl}/api/${endpoint}`, {
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

      const parseChunk = (chunk: string) => {
        const lines = chunk.split(/\r?\n/).filter((line) => line.length > 0)
        let event: string | null = null
        const data: string[] = []
        for (const line of lines) {
          if (line.startsWith('event:')) event = line.slice(6).trim()
          if (line.startsWith('data:')) data.push(line.slice(5).trim())
        }
        const joined = data.join('\n')
        if (!event) return

        switch (event) {
          case 'start':
            console.log('[Agent v2] Started:', joined)
            break
          case 'agent':
            try {
              const payload = JSON.parse(joined)
              setEvents((prev) => [...prev, { type: 'status', text: `Agent: ${payload.agent}` }])
            } catch {}
            break
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
            } catch {
              setEvents((prev) => [...prev, { type: 'error', text: 'Bad suggestions payload' }])
            }
            break
          case 'itinerary':
            try {
              const payload = JSON.parse(joined)
              setEvents((prev) => [...prev, { type: 'itinerary', data: payload }])
            } catch {
              setEvents((prev) => [...prev, { type: 'error', text: 'Bad itinerary payload' }])
            }
            break
          case 'tools':
            try {
              const payload = JSON.parse(joined)
              setEvents((prev) => [...prev, { type: 'tools', data: payload }])
            } catch {
              setEvents((prev) => [...prev, { type: 'error', text: 'Bad tools payload' }])
            }
            break
          case 'context':
            try {
              const payload = JSON.parse(joined)
              setEvents((prev) => [...prev, { type: 'context', data: payload }])
            } catch {
              setEvents((prev) => [...prev, { type: 'error', text: 'Bad context payload' }])
            }
            break
          case 'error':
            setEvents((prev) => [...prev, { type: 'error', text: joined }])
            break
          case 'done':
            setEvents((prev) => [...prev, { type: 'done' }])
            setStreaming(false)
            break
          // Ignore keepalive pings and unknown events
          default:
            break
        }
      }

      const flush = () => {
        const chunks = buffer.split(/\r?\n\r?\n/)
        buffer = chunks.pop() || ''
        for (const chunk of chunks) {
          parseChunk(chunk)
        }
      }

      // Read loop
      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        flush()
      }
      // Flush any remaining bytes from the decoder
      buffer += decoder.decode()
      flush()
      // Parse any remaining buffer content (prevents partial transfer data loss)
      if (buffer.trim().length > 0) {
        parseChunk(buffer)
        buffer = ''
      }
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
  const [useAgent, setUseAgent] = useState(false)
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

  const toolsUsed = useMemo(() => {
    const ev = [...events].reverse().find((e) => e.type === 'tools') as any
    return ev?.data?.tools || []
  }, [events])

  const contextInfo = useMemo(() => {
    const ev = [...events].reverse().find((e) => e.type === 'context') as any
    return ev?.data || null
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
    start(payload, useAgent ? 'agent/v2' : 'chat')
  }, [input, coords, forceNoMatch, useAgent, start])

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
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-black">Trip Planner Test</h1>
        {/* <div className="flex items-center gap-2">
          <label className="text-sm text-gray-700 font-medium">Mode:</label>
          <Button
            variant={useAgent ? 'outline' : 'default'}
            size="sm"
            onClick={() => setUseAgent(false)}
          >
            Classic Chat
          </Button>
          <Button
            variant={useAgent ? 'default' : 'outline'}
            size="sm"
            onClick={() => setUseAgent(true)}
          >
            🤖 RAG Agent
          </Button>
        </div> */}
      </div>

      {useAgent && (
        <div className="p-3 rounded-md bg-blue-50 border border-blue-200 text-sm text-blue-800">
          <strong>RAG Agent v2 Mode:</strong> Uses multi-agent supervisor with vector search, specialized researcher/planner/critic agents, and memory management.
        </div>
      )}

      <div className="flex gap-2 items-center flex-wrap text-black">
        <Input
          className='border-2 border-indigo-500 flex-1'
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !isStreaming && handleSend()}
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
        <div className="text-sm text-gray-600">📍 Location: {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}</div>
      )}

      {statusText && (
        <div className="text-sm text-blue-600">⏳ Status: {statusText}</div>
      )}

      {/* RAG Agent specific info */}
      {useAgent && toolsUsed.length > 0 && (
        <div className="p-3 rounded-md bg-purple-50 border border-purple-200">
          <div className="text-sm font-medium text-purple-900 mb-1">🛠️ Tools Used:</div>
          <div className="text-sm text-purple-700">
            {toolsUsed.map((t: any, i: number) => (
              <span key={i} className="inline-block mr-2 px-2 py-0.5 bg-purple-100 rounded">
                {t.tool}
              </span>
            ))}
          </div>
        </div>
      )}

      {useAgent && contextInfo && (
        <div className="p-3 rounded-md bg-green-50 border border-green-200">
          <div className="text-sm font-medium text-green-900 mb-1">📚 Retrieved Context:</div>
          <div className="text-sm text-green-700">
            {contextInfo.documents} documents retrieved
            {contextInfo.top_docs && contextInfo.top_docs.length > 0 && (
              <div className="mt-1 text-xs">
                Top matches: {contextInfo.top_docs.map((d: any) => d.name).join(', ')}
              </div>
            )}
          </div>
        </div>
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
                        slug: s.slug,
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
