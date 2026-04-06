"use client"

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

type PlacePayload = {
  name?: string
  description?: string
  name_th?: string
  description_th?: string
  tags?: string[]
  lat?: number
  lng?: number
  address?: string
  price?: number
  image_url?: string
  embedding?: number[]
  compute_embedding?: boolean
}

interface Place {
  id: string
  name: string
  description: string
  name_th?: string
  description_th?: string
  tags: string[]
  lat: number
  lng: number
  address: string
  price: number
  image_url: string
}

export default function AdminEditPlacePage() {
  const params = useParams()
  const router = useRouter()
  const placeId = params?.id as string
  
  const [form, setForm] = useState<PlacePayload>({})
  const [tagsText, setTagsText] = useState('')
  const [embedding, setEmbedding] = useState<number[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [originalPlace, setOriginalPlace] = useState<Place | null>(null)

  const update = (k: keyof PlacePayload, v: any) => setForm((f) => ({ ...f, [k]: v }))

  const getAuthHeaders = async () => {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()

    return {
      'Authorization': `Bearer ${session?.access_token ?? ''}`,
    }
  }

  const fetchPlace = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const serverUrl = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000'
      const res = await fetch(`${serverUrl}/api/admin/places/${placeId}`, {
        headers: {
          ...(await getAuthHeaders()),
        },
      })
      
      const contentType = res.headers.get('content-type') || ''
      const data = contentType.includes('application/json') ? await res.json() : { success: false, error: (await res.text()) || 'Unexpected response from server' }
      
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to fetch place')
      }
      
      const place = data.data
      setOriginalPlace(place)
      setForm({
        name: place.name,
        description: place.description,
        name_th: place.name_th || '',
        description_th: place.description_th || '',
        lat: place.lat,
        lng: place.lng,
        address: place.address,
        price: place.price,
        image_url: place.image_url
      })
      setTagsText(Array.isArray(place.tags) ? place.tags.join(', ') : '')
    } catch (e: any) {
      setError(e?.message || 'Failed to load place')
    } finally {
      setLoading(false)
    }
  }

  const handleGenerateEmbedding = async () => {
    setError(null)
    setBusy(true)
    setResult(null)
    try {
      const text = `${form.name || ''}\n\n${form.description || ''}`.trim()
      const serverUrl = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000'
      const res = await fetch(`${serverUrl}/api/admin/embedding`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(await getAuthHeaders()),
        },
        body: JSON.stringify({ text }),
      })
      const contentType = res.headers.get('content-type') || ''
      const j = contentType.includes('application/json') ? await res.json() : { success: false, error: (await res.text()) || 'Unexpected response from server' }
      if (!res.ok || !j.success) throw new Error(j.error || 'Failed to generate embedding')
      setEmbedding(j.embedding)
    } catch (e: any) {
      setError(e?.message || 'Embedding error')
    } finally {
      setBusy(false)
    }
  }

  const handleSubmit = async () => {
    setError(null)
    setBusy(true)
    setResult(null)
    try {
      const payload: PlacePayload = {
        ...form,
        tags: tagsText
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        embedding: embedding || undefined,
        compute_embedding: !embedding, // if no embedding, compute on server
      }
      
      // Only include fields that have actually changed
      const changedPayload: PlacePayload = {}
      
      if (form.name !== originalPlace?.name) changedPayload.name = form.name
      if (form.description !== originalPlace?.description) changedPayload.description = form.description
      if (form.name_th !== (originalPlace?.name_th || '')) changedPayload.name_th = form.name_th
      if (form.description_th !== (originalPlace?.description_th || '')) changedPayload.description_th = form.description_th
      if (form.address !== originalPlace?.address) changedPayload.address = form.address
      if (form.image_url !== originalPlace?.image_url) changedPayload.image_url = form.image_url
      
      if (form.lat !== originalPlace?.lat) changedPayload.lat = form.lat ? Number(form.lat) : undefined
      if (form.lng !== originalPlace?.lng) changedPayload.lng = form.lng ? Number(form.lng) : undefined
      if (form.price !== originalPlace?.price) changedPayload.price = form.price ? Number(form.price) : undefined
      
      const newTags = tagsText.split(',').map(s => s.trim()).filter(Boolean)
      const originalTags = originalPlace?.tags || []
      if (JSON.stringify(newTags) !== JSON.stringify(originalTags)) {
        changedPayload.tags = newTags
      }
      
      if (embedding) {
        changedPayload.embedding = embedding
      } else if (changedPayload.name || changedPayload.description) {
        changedPayload.compute_embedding = true
      }
      
      // If no changes, show message
      if (Object.keys(changedPayload).length === 0) {
        setError('No changes detected')
        return
      }

      const serverUrl = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000'
      const res = await fetch(`${serverUrl}/api/admin/places/${placeId}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          ...(await getAuthHeaders()),
        },
        body: JSON.stringify(changedPayload),
      })
      
      const contentType = res.headers.get('content-type') || ''
      const j = contentType.includes('application/json') ? await res.json() : { success: false, error: (await res.text()) || 'Unexpected response from server' }
      if (!res.ok || !j.success) throw new Error(j.error || 'Update failed')
      
      setResult(j.data)
      alert('Place updated successfully!')
      router.push('/admin/places')
    } catch (e: any) {
      setError(e?.message || 'Update error')
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    if (placeId) {
      fetchPlace()
    }
  }, [placeId])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading place...</p>
        </div>
      </div>
    )
  }

  if (error && !originalPlace) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md">
          <p className="text-red-600 mb-4">{error}</p>
          <div className="space-x-3">
            <Button onClick={fetchPlace} className="bg-blue-600 hover:bg-blue-700">
              Try Again
            </Button>
            <Link href="/admin/places">
              <Button variant="outline">
                Back to Places
              </Button>
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Link href="/admin/places">
            <Button variant="outline" size="sm" className="flex items-center gap-2">
              <ArrowLeft className="w-4 h-4" />
              Back to Places
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Edit Place</h1>
            <p className="text-gray-600 mt-1">Update place information</p>
          </div>
        </div>

        {originalPlace && (
          <div className="bg-white rounded-lg shadow-sm p-6 space-y-6">
            <div className="grid gap-4">
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-700">Name (EN)</label>
                <Input 
                  value={form.name || ''} 
                  onChange={(e) => update('name', e.target.value)} 
                  placeholder="Wat Pho" 
                  className="" 
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-700">Description (EN)</label>
                <Textarea 
                  value={form.description || ''} 
                  onChange={(e) => update('description', e.target.value)} 
                  rows={5} 
                  placeholder="Write a short description" 
                  className="" 
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-700">ชื่อภาษาไทย (name_th)</label>
                <Input 
                  value={form.name_th || ''} 
                  onChange={(e) => update('name_th', e.target.value)} 
                  placeholder="วัดโพธิ์" 
                  className="" 
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-700">คำอธิบายภาษาไทย (description_th)</label>
                <Textarea 
                  value={form.description_th || ''} 
                  onChange={(e) => update('description_th', e.target.value)} 
                  rows={5} 
                  placeholder="คำอธิบายภาษาไทย" 
                  className="" 
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1 text-gray-700">Latitude</label>
                  <Input 
                    value={form.lat ?? ''} 
                    onChange={(e) => update('lat', e.target.value)} 
                    placeholder="13.746" 
                    type="number" 
                    step="any"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 text-gray-700">Longitude</label>
                  <Input 
                    value={form.lng ?? ''} 
                    onChange={(e) => update('lng', e.target.value)} 
                    placeholder="100.535" 
                    type="number" 
                    step="any"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-700">Address</label>
                <Input 
                  value={form.address || ''} 
                  onChange={(e) => update('address', e.target.value)} 
                  placeholder="Bangkok, Thailand" 
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1 text-gray-700">Price (THB)</label>
                  <Input 
                    value={form.price ?? ''} 
                    onChange={(e) => update('price', e.target.value)} 
                    placeholder="200" 
                    type="number" 
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 text-gray-700">Image URL</label>
                  <Input 
                    value={form.image_url || ''} 
                    onChange={(e) => update('image_url', e.target.value)} 
                    placeholder="https://..." 
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-700">Tags (comma separated)</label>
                <Input 
                  value={tagsText} 
                  onChange={(e) => setTagsText(e.target.value)} 
                  placeholder="temple, history, culture" 
                />
              </div>

              <div className="flex items-center gap-3">
                <Button 
                  onClick={handleGenerateEmbedding} 
                  disabled={busy || !form.name}
                  variant="outline"
                >
                  Generate New Embedding
                </Button>
                <div className="text-sm text-gray-600">
                  {embedding ? `New embedding: ${embedding.length} dims` : 'Will use existing or compute automatically'}
                </div>
              </div>

              <div className="flex gap-3 pt-4 border-t">
                <Button 
                  onClick={handleSubmit} 
                  disabled={busy || !form.name}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {busy ? 'Updating...' : 'Update Place'}
                </Button>
                <Link href="/admin/places">
                  <Button variant="outline" disabled={busy}>
                    Cancel
                  </Button>
                </Link>
              </div>

              {error && <div className="text-sm text-red-600 bg-red-50 p-3 rounded">{error}</div>}
              {result && (
                <div className="bg-green-50 p-3 rounded">
                  <p className="text-green-800 text-sm font-medium mb-2">Update successful!</p>
                  <pre className="text-xs text-gray-600 overflow-auto max-h-32">
                    {JSON.stringify(result, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
