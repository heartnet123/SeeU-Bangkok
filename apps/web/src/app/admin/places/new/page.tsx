"use client"

import { useMemo, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'

type PlacePayload = {
  name: string
  slug?: string
  area?: string
  description?: string
  tags?: string[]
  lat: number
  lng: number
  address?: string
  price?: number | null
  image_url?: string
  is_published?: boolean
  embedding?: number[]
  compute_embedding?: boolean
}

function slugify(s: string) {
  return s
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[\u0300-\u036f]/g, '')      // remove diacritics
    .replace(/[^a-z0-9\s-]/g, '')        // keep a-z0-9 space dash
    .replace(/\s+/g, ' ')               // collapse spaces
    .trim()
    .replace(/\s/g, '-')                // space -> dash
}

export default function AdminNewPlacePage() {
  const [form, setForm] = useState<Partial<PlacePayload>>({ name: '', is_published: true })
  const [tagsText, setTagsText] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [slugTouched, setSlugTouched] = useState(false)

  const serverUrl = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000'

  const update = (k: keyof PlacePayload, v: any) => setForm((f) => ({ ...f, [k]: v }))

  // auto-generate slug from name
  const autoSlug = useMemo(() => slugify(form.name || ''), [form.name])
  const effectiveSlug = slugTouched ? (form.slug || '') : autoSlug

  const latNum = form.lat != null ? Number(form.lat) : NaN
  const lngNum = form.lng != null ? Number(form.lng) : NaN
  const priceNum = form.price != null && form.price !== '' ? Number(form.price) : null

  const latValid = Number.isFinite(latNum) && latNum >= -90 && latNum <= 90
  const lngValid = Number.isFinite(lngNum) && lngNum >= -180 && lngNum <= 180
  const priceValid = priceNum === null || (Number.isInteger(priceNum) && priceNum >= 0)

  const canSubmit =
    !!form.name &&
    latValid &&
    lngValid &&
    priceValid &&
    !busy

  const handleSubmit = async () => {
    setError(null)
    setBusy(true)
    setResult(null)
    try {
      const payload: PlacePayload = {
        name: (form.name || '').trim(),
        slug: (effectiveSlug || undefined),
        area: (form.area || undefined)?.trim() || undefined,
        description: (form.description || undefined)?.trim() || undefined,
        tags: tagsText
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        lat: Number(latNum),
        lng: Number(lngNum),
        address: 'Bangkok, Thailand',
        price: priceNum === null ? null : Number(priceNum),
        image_url: (form.image_url || undefined)?.trim() || undefined,
        is_published: form.is_published ?? false,
        compute_embedding: true,
      }

      const res = await fetch(`${serverUrl}/api/admin/places`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      
      const contentType = res.headers.get('content-type') || ''
      const j = contentType.includes('application/json')
        ? await res.json()
        : { success: false, error: (await res.text()) || 'Unexpected response from server' }
        
      if (!res.ok || !j.success) throw new Error(j.error || 'Insert failed')
      
      setResult(j.data)
      // reset form
      setForm({ name: '', is_published: true })
      setTagsText('')
      setSlugTouched(false)
    } catch (e: any) {
      setError(e?.message || 'Insert error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6 text-black bg-gray-200/60 border-2 border-gray-300 rounded-lg shadow-md mt-10">
      <h1 className="text-2xl font-semibold">Admin: New Place</h1>

      <div className="grid gap-4">
        {/* Name & Slug */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="mb-1 block text-black">Name *</Label>
            <Input
              value={form.name || ''}
              onChange={(e) => update('name', e.target.value)}
              placeholder="Wat Pho"
              className="text-black"
            />
          </div>
          {/* <div>
            <Label className="mb-1 block text-black">Slug (auto)</Label>
            <Input
              value={slugTouched ? (form.slug || '') : autoSlug}
              onChange={(e) => {
                setSlugTouched(true)
                update('slug', e.target.value)
              }}
              placeholder="wat-pho"
              className="text-black"
            />
            <p className="text-xs text-gray-500 mt-1">* แก้ได้; เว้นว่างจะใช้ auto-slug</p>
          </div> */}
        </div>

        {/* Area */}
        <div>
          <Label className="mb-1 block text-black">Area</Label>
          <Input
            value={form.area || ''}
            onChange={(e) => update('area', e.target.value)}
            placeholder="Talat Noi / Ari / ... "
            className="text-black"
          />
        </div>

        {/* Description */}
        <div>
          <Label className="mb-1 block text-black">Description</Label>
          <Textarea
            value={form.description || ''}
            onChange={(e) => update('description', e.target.value)}
            rows={5}
            placeholder="Write a short description"
            className="text-black border-gray-400 dark:border-gray-700"
          />
        </div>

        {/* Lat/Lng */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="mb-1 block text-black">Latitude *</Label>
            <Input
              type="number"
              step="any"
              value={form.lat ?? ''}
              onChange={(e) => update('lat', e.target.value)}
              placeholder="13.746"
              className="text-black"
            />
            {!latValid && <p className="text-xs text-red-600 mt-1">ต้องอยู่ระหว่าง -90 ถึง 90</p>}
          </div>
          <div>
            <Label className="mb-1 block text-black">Longitude *</Label>
            <Input
              type="number"
              step="any"
              value={form.lng ?? ''}
              onChange={(e) => update('lng', e.target.value)}
              placeholder="100.535"
              className="text-black"
            />
            {!lngValid && <p className="text-xs text-red-600 mt-1">ต้องอยู่ระหว่าง -180 ถึง 180</p>}
          </div>
        </div>

        {/* Address */}
        {/* <div>
          <Label className="mb-1 block text-black">Address</Label>
          <Input
            value={form.address || ''}
            onChange={(e) => update('address', e.target.value)}
            placeholder="Bangkok, Thailand"
            className="text-black"
          />
        </div> */}

        {/* Price & Image */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="mb-1 block text-black">Price (THB)</Label>
            <Input
              type="number"
              step="1"
              min="0"
              value={form.price ?? ''}
              onChange={(e) => update('price', e.target.value)}
              placeholder="200"
              className="text-black"
            />
            {!priceValid && <p className="text-xs text-red-600 mt-1">ต้องเป็นจำนวนเต็ม ≥ 0 หรือเว้นว่าง</p>}
          </div>
          <div>
            <Label className="mb-1 block text-black">Image URL</Label>
            <Input
              value={form.image_url || ''}
              onChange={(e) => update('image_url', e.target.value)}
              placeholder="https://..."
              className="text-black"
            />
          </div>
        </div>

        {/* Tags */}
        <div>
          <Label className="mb-1 block text-black">Tags (comma separated)</Label>
          <Input
            value={tagsText}
            onChange={(e) => setTagsText(e.target.value)}
            placeholder="temple, history, culture"
            className="text-black"
          />
        </div>
        
        {/* Actions */}
        <div className="flex gap-3 items-center">
          <Button onClick={handleSubmit} disabled={!canSubmit} className='bg-blue-600 hover:bg-blue-700 text-white'>
            Add place
          </Button>
          {busy && <div className="text-sm text-gray-600">Working...</div>}
        </div>

        {error && <div className="text-sm text-red-600">{error}</div>}
        {result && (
          <pre className="text-xs bg-gray-50 p-3 rounded-md border overflow-auto max-h-64 text-black">
            {JSON.stringify(result, null, 2)}
          </pre>
        )}
      </div>
    </div>
  )
}