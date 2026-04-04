"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, MapPin, Search } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { TripPlaceCandidate } from "@/lib/trip-stop-utils";

interface AddTripStopDialogProps {
	isOpen: boolean;
	onClose: () => void;
	onAddPlace: (place: TripPlaceCandidate) => void;
	serverUrl?: string;
}

export function AddTripStopDialog({
	isOpen,
	onClose,
	onAddPlace,
	serverUrl = "http://localhost:3000",
}: AddTripStopDialogProps) {
	const [searchQuery, setSearchQuery] = useState("");
	const [places, setPlaces] = useState<TripPlaceCandidate[]>([]);
	const [isLoading, setIsLoading] = useState(false);
	const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);

	useEffect(() => {
		if (!isOpen) {
			setSearchQuery("");
			setSelectedPlaceId(null);
			return;
		}

		if (places.length > 0) {
			return;
		}

		const fetchPlaces = async () => {
			setIsLoading(true);
			try {
				const response = await fetch(`${serverUrl}/api/places?limit=200`);
				if (!response.ok) {
					throw new Error("Failed to load places");
				}

				const data = await response.json();
				if (!data.success || !Array.isArray(data.data)) {
					throw new Error(data.error || "Failed to load places");
				}

				setPlaces(
					data.data.map((place: any) => ({
						id: place.id,
						name: place.name,
						slug: place.slug || place.id,
						lat: place.lat,
						lng: place.lng,
						tags: Array.isArray(place.tags) ? place.tags : [],
						description: place.description || "",
					}))
				);
			} catch (error) {
				console.error("Error loading places:", error);
				toast.error(
					error instanceof Error ? error.message : "Failed to load places"
				);
			} finally {
				setIsLoading(false);
			}
		};

		fetchPlaces();
	}, [isOpen, places.length, serverUrl]);

	const filteredPlaces = useMemo(() => {
		if (!searchQuery.trim()) {
			return places;
		}

		const query = searchQuery.trim().toLowerCase();
		return places.filter((place) => {
			return (
				place.name.toLowerCase().includes(query) ||
				place.slug.toLowerCase().includes(query) ||
				place.description?.toLowerCase().includes(query) ||
				place.tags?.some((tag) => tag.toLowerCase().includes(query))
			);
		});
	}, [places, searchQuery]);

	const selectedPlace =
		filteredPlaces.find((place) => place.id === selectedPlaceId) ||
		places.find((place) => place.id === selectedPlaceId) ||
		null;

	const handleSubmit = () => {
		if (!selectedPlace) {
			toast.error("Select a place first");
			return;
		}

		onAddPlace(selectedPlace);
		setSelectedPlaceId(null);
		setSearchQuery("");
		onClose();
	};

	return (
		<Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
			<DialogContent className="max-w-2xl gap-0 p-0 bg-white text-slate-900 shadow-2xl border border-slate-200">
				<DialogHeader className="border-b border-slate-200 px-6 py-4">
					<DialogTitle>Add place to trip</DialogTitle>
					<DialogDescription>
						Search existing places and append one to the selected trip.
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-4 px-6 py-4">
					<div className="relative">
						<Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
						<Input
							value={searchQuery}
							onChange={(event) => setSearchQuery(event.target.value)}
							placeholder="Search by place name or category"
							className="pl-9"
						/>
					</div>

					<div className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
						{isLoading ? (
							<div className="flex items-center justify-center py-12 text-sm text-slate-500">
								<Loader2 className="mr-2 h-4 w-4 animate-spin" />
								Loading places...
							</div>
						) : filteredPlaces.length === 0 ? (
							<div className="py-12 text-center text-sm text-slate-500">
								No places matched your search.
							</div>
						) : (
							filteredPlaces.map((place) => {
								const isSelected = place.id === selectedPlaceId;
								return (
									<button
										key={place.id}
										type="button"
										onClick={() => setSelectedPlaceId(place.id)}
										className={`w-full rounded-lg border p-3 text-left transition ${
											isSelected
												? "border-blue-500 bg-blue-50"
												: "border-slate-200 bg-white hover:border-slate-300"
										}`}
									>
										<div className="flex items-start justify-between gap-3">
											<div className="min-w-0 flex-1">
												<div className="font-medium text-slate-900">
													{place.name}
												</div>
												<div className="mt-1 flex items-center gap-1 text-xs text-slate-500">
													<MapPin className="h-3 w-3" />
													<span className="truncate">{place.slug}</span>
												</div>
												{place.tags && place.tags.length > 0 && (
													<div className="mt-2 flex flex-wrap gap-1">
														{place.tags.slice(0, 3).map((tag) => (
															<span
																key={tag}
																className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600"
															>
																{tag}
															</span>
														))}
													</div>
												)}
											</div>

											<div
												className={`mt-1 h-4 w-4 rounded-full border ${
													isSelected
														? "border-blue-600 bg-blue-600"
														: "border-slate-300"
												}`}
											/>
										</div>
									</button>
								);
							})
						)}
					</div>
				</div>

				<DialogFooter className="border-t px-6 py-4">
					<Button type="button" variant="outline" onClick={onClose}>
						Cancel
					</Button>
					<Button type="button" onClick={handleSubmit} disabled={!selectedPlace}>
						Add stop
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
