import { motion } from "motion/react";
import { Route, Clock, Navigation, Check, Save, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { TripDraft } from "./types";

interface ItineraryPreviewProps {
	itinerary: TripDraft;
	onSave?: () => void;
	onPreview?: () => void;
	onDismiss?: () => void;
	isSaving?: boolean;
	isSaved?: boolean;
}

export function ItineraryPreview({
	itinerary,
	onSave,
	onPreview,
	onDismiss,
	isSaving,
	isSaved,
}: ItineraryPreviewProps) {
	const stops = itinerary.stops;
	const totalKm = itinerary.total_distance_km;
	const totalMin = itinerary.total_minutes;

	return (
		<div className="rounded-xl border border-border bg-card overflow-hidden">
			<div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-muted/30">
				<Route className="h-4 w-4 text-primary shrink-0" />
				<span className="font-semibold text-foreground text-sm flex-1 min-w-0 truncate">
					{itinerary.title}
				</span>
				<div className="flex items-center gap-3 text-[10px] text-muted-foreground shrink-0">
					{totalKm !== undefined && <span>{totalKm} km</span>}
					{totalMin !== undefined && (
						<span>{Math.floor(totalMin / 60)}h {totalMin % 60}m</span>
					)}
				</div>
			</div>

			<div className="px-4 py-3 space-y-0">
				{stops.map((stop, index) => (
					<motion.div
						key={stop.slug || index}
						className="flex gap-3"
						initial={{ opacity: 0, x: -8 }}
						animate={{ opacity: 1, x: 0 }}
						transition={{ delay: 0.06 * index }}
					>
						<div className="flex flex-col items-center">
							<div className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-[10px] flex items-center justify-center font-bold shrink-0 z-10">
								{index + 1}
							</div>
							{index < stops.length - 1 && (
								<div className="w-px flex-1 bg-border my-1 min-h-[12px]" />
							)}
						</div>

						<div className="flex-1 min-w-0 pb-3">
							<div className="font-medium text-foreground text-sm leading-snug">
								{stop.name}
							</div>
							<div className="flex items-center gap-3 text-[10px] text-muted-foreground mt-0.5">
								<span className="flex items-center gap-1">
									<Clock className="h-3 w-3" />
									{stop.suggested_time_min} min
								</span>
								{stop.distance_from_prev_km > 0 && (
									<span className="flex items-center gap-1">
										<Navigation className="h-3 w-3" />
										{stop.distance_from_prev_km} km from prev
									</span>
								)}
							</div>
							{Boolean(stop.notes) && (
								<p className="text-[10px] text-muted-foreground mt-1 italic leading-relaxed">
									{stop.notes}
								</p>
							)}
						</div>
					</motion.div>
				))}
			</div>

			{(onSave || onDismiss) && (
				<div className="px-4 py-3 border-t border-border bg-muted/20 flex gap-2">
					{isSaved ? (
						<div className="flex-1 flex items-center justify-center gap-2 text-emerald-600 text-xs font-medium py-1">
							<Check className="h-3.5 w-3.5" />
							Saved to My Trips
						</div>
					) : (
						<>
							{onSave && (
								<Button
									size="sm"
									onClick={onSave}
									disabled={isSaving}
									className="flex-1 h-9 text-xs"
								>
									{isSaving ? (
										<>
											<Loader2 className="h-3.5 w-3.5 animate-spin mr-2" />
											Saving...
										</>
									) : (
										<>
											<Save className="h-3.5 w-3.5 mr-2" />
											Save to My Trips
										</>
									)}
								</Button>
							)}
							{onPreview && (
								<Button
									size="sm"
									variant="outline"
									onClick={onPreview}
									className="flex-1 h-9 text-xs"
								>
									<Navigation className="h-3.5 w-3.5 mr-2" />
									Preview on Map
								</Button>
							)}
							{onDismiss && (
								<Button
									size="sm"
									variant="ghost"
									onClick={onDismiss}
									className="h-9 text-xs px-4 text-muted-foreground hover:text-foreground"
								>
									Ignore
								</Button>
							)}
						</>
					)}
				</div>
			)}
		</div>
	);
}
