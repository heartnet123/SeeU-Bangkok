"use client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import Image from "next/image";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { MapPin, Search, Star, Bookmark, ArrowRight, Sparkles, Check, ChevronDown } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
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

export default function PlacesPage() {
  const [places, setPlaces] = useState<Place[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("All Gems");

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

  const filteredPlaces = useMemo(() => {
    let result = places;

    // Category filter
    if (selectedCategory !== "All Gems") {
      result = result.filter(place => {
        const placeTags = Array.isArray(place.tags) ? place.tags.map(t => t.toLowerCase()) : [];
        return placeTags.includes(selectedCategory.toLowerCase());
      });
    }

    // Search query filter
    const query = searchTerm.trim().toLowerCase();
    if (query) {
      result = result.filter((place) => {
        const combinedTags = Array.isArray(place.tags)
          ? place.tags.join(" ").toLowerCase()
          : "";

        return (
          place.name.toLowerCase().includes(query) ||
          place.description.toLowerCase().includes(query) ||
          place.address.toLowerCase().includes(query) ||
          combinedTags.includes(query)
        );
      });
    }

    return result;
  }, [places, searchTerm, selectedCategory]);

  // Calculate pagination
  const totalPages = Math.max(1, Math.ceil(filteredPlaces.length / placesPerPage));
  const startIndex = (currentPage - 1) * placesPerPage;
  const endIndex = startIndex + placesPerPage;
  const currentPlaces = filteredPlaces.slice(startIndex, endIndex);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    const element = document.getElementById('places-grid');
    if (element) {
      const y = element.getBoundingClientRect().top + window.scrollY - 30; // 30px breathing room
      window.scrollTo({ top: y, behavior: 'smooth' });
    }
  };

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const categories = ["All Gems", "Cafe & Roast", "Art & Culture", "Street Food", "Architecture", "Nature", "Nightlife"];

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-xl text-slate-600">Loading hidden gems...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-xl text-red-600 mb-4">{error}</p>
          <Button onClick={fetchPlaces} className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl">
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-50 text-slate-900 antialiased selection:bg-blue-100 selection:text-blue-900 min-h-screen flex flex-col font-sans">

      {/* Search/Hero Section */}
      <header className="relative overflow-hidden bg-white border-b border-blue-100/50 pt-16 pb-20">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full max-w-7xl pointer-events-none opacity-40">
          <div className="absolute top-[-10%] left-[-10%] w-[40%] aspect-square rounded-full bg-blue-50 blur-3xl"></div>
          <div className="absolute bottom-[-20%] right-[-10%] w-[50%] aspect-square rounded-full bg-sky-50 blur-3xl"></div>
        </div>

        <div className="relative max-w-3xl mx-auto px-6 text-center flex flex-col items-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-100 text-blue-600 text-xs font-medium mb-6">
            <Sparkles className="w-4 h-4" />
            Hidden Gems Discovery
          </div>

          <h1 className="text-4xl md:text-5xl font-semibold tracking-tight text-slate-900 mb-4">
            Uncover the <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-sky-500">unseen Bangkok.</span>
          </h1>
          <p className="text-base text-slate-500 mb-10 max-w-xl">
            Skip the tourist traps. Search for a vibe, category or area and find a personalized
            list of hidden alleys, secret cafes, and local favorites.
          </p>

          <div className="w-full relative group shadow-sm rounded-2xl">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-400 to-sky-300 rounded-2xl blur opacity-20 group-hover:opacity-30 transition-opacity duration-500"></div>
            <div className="relative flex items-center bg-white border border-blue-200 rounded-2xl overflow-hidden focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100 transition-all">
              <div className="pl-5 text-blue-400 flex items-center justify-center">
                <Search className="w-6 h-6" />
              </div>
              <input
                type="text"
                placeholder="E.g., A quiet riverside cafe followed by indie art galleries..."
                className="w-full py-4 pl-3 pr-4 text-base bg-transparent border-none focus:outline-none text-slate-800 placeholder:text-slate-400"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
              />
              <button className="mr-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-xl transition-colors shadow-sm flex items-center gap-2 whitespace-nowrap">
                Search
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="flex flex-wrap justify-center gap-2 mt-6">
            <span className="text-xs text-slate-400 mr-2 self-center">Try:</span>
            {["Local street food", "Vintage shopping", "Hidden temples"].map(prompt => (
              <button
                key={prompt}
                onClick={() => {
                  setSearchTerm(prompt);
                  setCurrentPage(1);
                }}
                className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-600 hover:border-blue-300 hover:bg-blue-50 transition-colors"
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow max-w-7xl mx-auto w-full px-6 py-12 flex flex-col lg:flex-row gap-10">

        {/* Sidebar Filters */}
        <aside className="w-full lg:w-64 flex-shrink-0 space-y-8">
          <div>
            <h3 className="text-sm font-semibold tracking-tight text-slate-900 mb-4">Categories</h3>
            <div className="space-y-2">
              {categories.map((cat) => {
                const isSelected = selectedCategory === cat;
                return (
                  <label key={cat} className="flex items-center gap-3 cursor-pointer group" onClick={() => {
                    setSelectedCategory(cat);
                    setCurrentPage(1);
                  }}>
                    <div className={`relative w-4 h-4 rounded border flex items-center justify-center transition-colors ${isSelected ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-300 bg-white group-hover:border-blue-400'}`}>
                      {isSelected && <Check className="w-3 h-3" />}
                    </div>
                    <span className={`text-sm transition-colors ${isSelected ? 'text-blue-700 font-medium' : 'text-slate-600 group-hover:text-slate-900'}`}>
                      {cat}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
          {/* 
          <div className="pt-6 border-t border-blue-100">
          </div> */}

          {/* Custom Slider Example (Decorative for filter) */}
          {/* <div className="pt-6 border-t border-blue-100">
            <h3 className="text-sm font-semibold tracking-tight text-slate-900 mb-4 flex justify-between">
              <span>Crowd Level</span>
              <span className="text-slate-400 font-normal">Low</span>
            </h3>
            <div className="relative w-full h-1.5 bg-slate-200 rounded-full mt-2">
              <div className="absolute top-0 left-0 h-full bg-blue-500 rounded-full w-1/3"></div>
              <div className="absolute top-1/2 left-1/3 -translate-y-1/2 -translate-x-1/2 w-4 h-4 bg-white border-2 border-blue-600 rounded-full shadow-sm cursor-grab"></div>
            </div>
            <div className="flex justify-between text-xs text-slate-400 mt-3">
              <span>Empty</span>
              <span>Bustling</span>
            </div>
          </div> */}
        </aside>

        {/* Places Grid */}
        <div id="places-grid" className="flex-grow">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold tracking-tight text-slate-900">Curated Gems</h2>
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <span>Sort by:</span>
              <button className="font-medium text-slate-900 flex items-center gap-1 hover:text-blue-600 transition-colors">
                Recommended
                <ChevronDown className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {currentPlaces.length === 0 ? (
              <div className="col-span-full rounded-2xl border border-dashed border-slate-300 bg-white/70 p-12 text-center text-slate-500">
                No places match your search yet. Try different keywords.
              </div>
            ) : (
              currentPlaces.map((place) => {
              const hasCoordinates =
                typeof place.lat === "number" && typeof place.lng === "number";
              const mapUrl = hasCoordinates
                ? `https://www.google.com/maps?q=${place.lat},${place.lng}`
                : null;

              return (
                <Card 
                  key={place.id} 
                  className="group hover:shadow-xl transition-all duration-300 transform hover:-translate-y-2 cursor-pointer bg-gray-200"
                  onClick={() => router.push(`/places/${place.slug}`)}
                >
                  <CardContent className="p-0 flex flex-col h-full">
                      {/* Always show placeholder image */}
                      <div className="relative h-48 bg-gradient-to-br from-gray-200 to-gray-300 overflow-hidden flex items-center justify-center">
                <Image
                    src={place.image_url || "https://i.pinimg.com/736x/5d/60/bb/5d60bb1df532a1c181d55c54e0e19c66.jpg"}
                    alt={place.name}
                    fill
                    className="object-cover transition-transform duration-300 group-hover:scale-105"
                />
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
                      <div className="px-6 py-5 flex flex-col flex-grow">
                        <p className="text-gray-600 mb-4 leading-relaxed flex-grow">
                          {place.description}
                        </p>
                        
                        {/* Action Buttons */}
                        <div className="flex flex-col sm:flex-row gap-3">
                          <Button
                            asChild
                            className="flex-1 w-full bg-blue-700 hover:bg-blue-800 text-white"
                          >
                            <Link
                              href={`/places/${place.slug}`}
                              onClick={(event) => event.stopPropagation()}
                            >
                              Explore More
                            </Link>
                          </Button>
                          <Button 
                            type="button"
                            variant="outline" 
                            className="flex-1 border-gray-300 text-gray-700 hover:bg-gray-50 flex items-center justify-center gap-2"
                            disabled={!hasCoordinates}
                            onClick={(event) => {
                              event.stopPropagation();
                              if (mapUrl) {
                                window.open(mapUrl, "_blank", "noopener,noreferrer");
                              }
                            }}
                          >
                            <MapPin className="w-4 h-4" />
                            View on Map
                          </Button>
                        </div>
                        <span className="flex-shrink-0 whitespace-nowrap">
                          {place.price > 0 ? "฿".repeat(Math.ceil(place.price / 300)) : "Free"}
                        </span>
                      </div>
                  </CardContent>
                </Card>
                );
              })
            )}
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
                      className={`${currentPage <= 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer hover:bg-slate-50 hover:text-blue-600 rounded-xl'}`}
                    />
                  </PaginationItem>

                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
                    const shouldShow =
                      page === 1 ||
                      page === totalPages ||
                      (page >= currentPage - 1 && page <= currentPage + 1);

                    if (!shouldShow) {
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
                          className={`cursor-pointer rounded-xl ${currentPage === page ? 'bg-blue-50 border-blue-200 text-blue-700' : 'hover:bg-slate-50 hover:border-blue-200 hover:text-blue-600'}`}
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
                      className={`${currentPage >= totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer hover:bg-slate-50 hover:text-blue-600 rounded-xl'}`}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
