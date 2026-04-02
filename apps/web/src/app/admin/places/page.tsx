"use client"

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Pencil, Trash2, Plus, Search, MapPin } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface Place {
  id: string
  name: string
  description: string
  tags: string[]
  lat: number
  lng: number
  address: string
  price: number
  image_url: string
}

interface PaginationInfo {
  limit: number
  offset: number
  count: number
  total: number
}

export default function AdminPlacesPage() {
  const [places, setPlaces] = useState<Place[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [pagination, setPagination] = useState<PaginationInfo>({ limit: 20, offset: 0, count: 0, total: 0 })
  const [deleteLoading, setDeleteLoading] = useState<string | null>(null)
  const router = useRouter()

  const fetchPlaces = async (searchTerm = '', page = 1) => {
    try {
      setLoading(true)
      setError(null)

      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()

      const limit = 20
      const offset = (page - 1) * limit
      const params = new URLSearchParams({
        limit: limit.toString(),
        offset: offset.toString()
      })
      
      if (searchTerm.trim()) {
        params.append('search', searchTerm.trim())
      }
      
      const serverUrl = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000'
      const res = await fetch(`${serverUrl}/api/admin/places?${params}`, {
        headers: {
          'Authorization': `Bearer ${session?.access_token ?? ''}`,
          'Content-Type': 'application/json',
        },
      })
      
      // Safely parse response, handling non-JSON errors gracefully
      const contentType = res.headers.get('content-type') || ''
      const data = contentType.includes('application/json')
        ? await res.json()
        : { success: false, error: (await res.text()) || 'Unexpected response from server' }
      
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to fetch places')
      }
      
      setPlaces(data.data || [])
      setPagination(data.pagination || { limit, offset, count: 0, total: 0 })
    } catch (e: any) {
      setError(e?.message || 'Failed to load places')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete "${name}"? This action cannot be undone.`)) {
      return
    }
    
    try {
      setDeleteLoading(id)

      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()

      const serverUrl = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000'
      const res = await fetch(`${serverUrl}/api/admin/places/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session?.access_token ?? ''}`,
        },
      })
      
      const contentType = res.headers.get('content-type') || ''
      const data = contentType.includes('application/json')
        ? await res.json()
        : { success: false, error: (await res.text()) || 'Unexpected response from server' }
      
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to delete place')
      }
      
      // Refresh the list
      fetchPlaces(search, currentPage)
      alert(`Place "${name}" has been deleted successfully.`)
    } catch (e: any) {
      alert(e?.message || 'Failed to delete place')
    } finally {
      setDeleteLoading(null)
    }
  }

  const handleSearch = () => {
    setCurrentPage(1)
    fetchPlaces(search, 1)
  }

  const handlePageChange = (page: number) => {
    setCurrentPage(page)
    fetchPlaces(search, page)
  }

  useEffect(() => {
    fetchPlaces()
  }, [])

  if (loading && places.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading places...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Admin: Places Management</h1>
            <p className="text-gray-600 mt-1">Manage all places in the database</p>
          </div>
          <Link href="/admin/places/new">
            <Button className="bg-blue-600 hover:bg-blue-700 flex items-center gap-2 text-white">
              <Plus className="w-4 h-4" />
              Add New Place
            </Button>
          </Link>
        </div>

        {/* Search */}
        <div className="flex gap-3 mb-6">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Search places by name or description..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="pl-10"
            />
          </div>
          <Button onClick={handleSearch} disabled={loading}>
            Search
          </Button>
        </div>

        {/* Results count */}
        <div className="mb-4 text-sm text-gray-600">
          Showing {pagination.offset + 1}-{pagination.offset + pagination.count} of {pagination.total} places
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-800">{error}</p>
            <Button 
              onClick={() => fetchPlaces(search, currentPage)} 
              className="mt-2 bg-red-600 hover:bg-red-700"
              size="sm"
            >
              Try Again
            </Button>
          </div>
        )}

        {/* Places Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {places.map((place) => (
            <Card key={place.id} className="hover:shadow-lg transition-shadow bg-white">
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start gap-2">
                  <CardTitle className="text-lg line-clamp-2 text-black">{place.name}</CardTitle>
                  <div className="flex gap-1 flex-shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => router.push(`/admin/places/${place.id}/edit`)}
                      className="p-2"
                    >
                      <Pencil className="w-3 h-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDelete(place.id, place.name)}
                      disabled={deleteLoading === place.id}
                      className="p-2 hover:bg-red-50 hover:border-red-200"
                    >
                      {deleteLoading === place.id ? (
                        <div className="w-3 h-3 animate-spin rounded-full border border-red-600 border-t-transparent" />
                      ) : (
                        <Trash2 className="w-3 h-3 text-red-600" />
                      )}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600 text-sm mb-3 line-clamp-3">
                  {place.description || 'No description available'}
                </p>
                
                {/* Tags */}
                {place.tags && place.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-3">
                    {place.tags.slice(0, 3).map((tag, index) => (
                      <Badge key={index} variant="secondary" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                    {place.tags.length > 3 && (
                      <Badge variant="outline" className="text-xs">
                        +{place.tags.length - 3} more
                      </Badge>
                    )}
                  </div>
                )}
                
                {/* Location & Price */}
                {/* <div className="space-y-1 text-xs text-gray-500">
                  {place.address && (
                    <div className="flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      <span className="truncate">{place.address}</span>
                    </div>
                  )}
                  {place.price > 0 && (
                    <div>Price: ฿{place.price}</div>
                  )}
                </div> */}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Pagination */}
        {pagination.total > pagination.limit && (
          <div className="flex justify-center items-center gap-2">
            <Button
              variant="outline"
              disabled={currentPage <= 1 || loading}
              onClick={() => handlePageChange(currentPage - 1)}
            >
              Previous
            </Button>
            
            <span className="px-4 py-2 text-sm text-gray-600">
              Page {currentPage} of {Math.ceil(pagination.total / pagination.limit)}
            </span>
            
            <Button
              variant="outline"
              disabled={pagination.offset + pagination.count >= pagination.total || loading}
              onClick={() => handlePageChange(currentPage + 1)}
            >
              Next
            </Button>
          </div>
        )}
        
        {places.length === 0 && !loading && (
          <div className="text-center py-12">
            <p className="text-gray-500 mb-4">
              {search ? 'No places found matching your search.' : 'No places found.'}
            </p>
            {search && (
              <Button 
                variant="outline" 
                onClick={() => { setSearch(''); fetchPlaces('', 1); setCurrentPage(1) }}
              >
                Clear Search
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
