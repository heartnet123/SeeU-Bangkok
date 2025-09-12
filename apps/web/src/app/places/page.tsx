"use client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { 
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { MapPin, Camera } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { nameToSlug } from "@/lib/slug-utils";
import { createClient } from "@/lib/supabase/client";

interface Place {
  id: string;
  name: string;
  description: string;
  tags: string[];
  lat: number;
  lng: number;
  address: string;
  price: number;
  image_url: string;
  slug?: string;
}

export default function NeighborhoodsPage() {
  const [places, setPlaces] = useState<Place[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const placesPerPage = 6;
  const supabase = createClient();
  const router = useRouter();

  useEffect(() => {
    fetchPlaces();
  }, []);

  const fetchPlaces = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const { data, error } = await supabase
        .from('bangkok_unseen')
        .select('*')
        .order('name');

      if (error) {
        throw error;
      }

      // Ensure data has safe defaults
      const safeData = (data || []).map(place => ({
        ...place,
        image_url: place.image_url || '',
        tags: Array.isArray(place.tags) ? place.tags : [],
        description: place.description || 'No description available',
        price: typeof place.price === 'number' ? place.price : 0,
        slug: nameToSlug(place.name || 'unknown-place')
      }));

      setPlaces(safeData);
    } catch (err) {
      console.error('Error fetching places:', err);
      setError('Failed to load places. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  // Calculate pagination
  const totalPages = Math.ceil(places.length / placesPerPage);
  const startIndex = (currentPage - 1) * placesPerPage;
  const endIndex = startIndex + placesPerPage;
  const currentPlaces = places.slice(startIndex, endIndex);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    // Scroll to top of places section
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-700 mx-auto mb-4"></div>
          <p className="text-xl text-gray-600">Loading places...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-xl text-red-600 mb-4">{error}</p>
          <Button onClick={fetchPlaces} className="bg-blue-700 hover:bg-blue-800">
            Try Again
          </Button>
        </div>
      </div>
    );
  }
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Section */}
      {/* <section className="bg-gradient-to-r from-blue-700 to-blue-800 text-white py-24">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            Explore Bangkok's Hidden Gems
          </h1>
          <p className="text-xl text-blue-100 max-w-2xl mx-auto">
            Discover authentic local experiences, cultural treasures, and must-visit attractions in Bangkok
          </p>
        </div>
      </section> */}

      {/* Places Grid */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {currentPlaces.map((place) => (
              <Card 
                key={place.id} 
                className="group hover:shadow-xl transition-all duration-300 transform hover:-translate-y-2 cursor-pointer bg-gray-200"
                onClick={() => router.push(`/places/${place.slug}`)}
              >
                <CardContent className="p-0">
                    {/* Always show placeholder image */}
                    <div className="relative h-48 bg-gradient-to-br from-gray-200 to-gray-300 rounded-t-lg overflow-hidden flex items-center justify-center">
                      <div className="text-center text-gray-400">
                        <Camera className="w-12 h-12 mx-auto mb-2" />
                        <p className="text-xs">Image placeholder</p>
                      </div>
                      <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition-colors duration-300" />
                      <div className="absolute bottom-4 left-4 text-white">
                        <h3 className="text-xl font-semibold">{place.name}</h3>
                        {place.tags && place.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {place.tags.slice(0, 2).map((tag, index) => (
                              <span key={index} className="text-xs bg-white/20 px-2 py-1 rounded">
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  
                  {/* Content */}
                  <div className="p-6">
                    <p className="text-gray-600 mb-6 leading-relaxed">
                      {place.description}
                    </p>
                    
                    {/* Action Buttons */}
                    <div className="flex flex-col sm:flex-row gap-3">
                      <Link href={`/places/${place.slug}`} className="flex-1">
                        <Button className="bg-blue-700 hover:bg-blue-800 text-white w-full">
                          Explore More
                        </Button>
                      </Link>
                      <Button 
                        variant="outline" 
                        className="border-gray-300 text-gray-700 hover:bg-gray-50 flex items-center gap-2 flex-1"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (place.lat && place.lng) {
                            const url = `https://www.google.com/maps?q=${place.lat},${place.lng}`;
                            window.open(url, '_blank');
                          }
                        }}
                      >
                        <MapPin className="w-4 h-4" />
                        View on Map
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          
          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-12 flex justify-center">
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious 
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        if (currentPage > 1) {
                          handlePageChange(currentPage - 1);
                        }
                      }}
                      className={currentPage <= 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                    />
                  </PaginationItem>
                  
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
                    // Show first page, last page, current page, and pages around current page
                    const shouldShow = 
                      page === 1 || 
                      page === totalPages || 
                      (page >= currentPage - 1 && page <= currentPage + 1);
                    
                    if (!shouldShow) {
                      // Show ellipsis for gaps
                      if (page === currentPage - 2 || page === currentPage + 2) {
                        return (
                          <PaginationItem key={`ellipsis-${page}`}>
                            <PaginationEllipsis />
                          </PaginationItem>
                        );
                      }
                      return null;
                    }
                    
                    return (
                      <PaginationItem key={page}>
                        <PaginationLink
                          href="#"
                          onClick={(e) => {
                            e.preventDefault();
                            handlePageChange(page);
                          }}
                          isActive={currentPage === page}
                          className="cursor-pointer"
                        >
                          {page}
                        </PaginationLink>
                      </PaginationItem>
                    );
                  })}
                  
                  <PaginationItem>
                    <PaginationNext 
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        if (currentPage < totalPages) {
                          handlePageChange(currentPage + 1);
                        }
                      }}
                      className={currentPage >= totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          )}
        </div>
          
          {/* Places Count */}
          <div className="mt-8">
            <p className="text-gray-600 text-center">
              Showing {startIndex + 1}-{Math.min(endIndex, places.length)} of {places.length} places
            </p>
          </div>
      </section>

      {/* Call to Action */}
      {/* <section className="bg-blue-700 text-white py-16">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-3xl font-bold mb-4">
            Ready to Explore Bangkok?
          </h2>
          <p className="text-xl text-blue-100 mb-8">
            Get personalized recommendations and insider tips from our AI chatbot
          </p>
          <Button className="bg-white text-blue-700 hover:bg-gray-50 px-8 py-3 text-lg font-semibold">
            Start Planning Your Journey
          </Button>
        </div>
      </section> */}
    </div>
  );
}