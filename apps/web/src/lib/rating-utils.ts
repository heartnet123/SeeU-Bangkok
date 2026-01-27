/**
 * Mock Rating Utility for Place Cards
 * 
 * Generates deterministic mock ratings for places based on their ID.
 * The same place ID will always return the same rating.
 */

/**
 * Generate a deterministic mock rating for a place based on its ID.
 * Uses a simple hash function to ensure the same ID always produces the same rating.
 * 
 * @param placeId - The unique identifier of the place
 * @returns A rating between 3.5 and 5.0 (one decimal place)
 */
export function generateMockRating(placeId: string): number {
  let hash = 0;
  for (let i = 0; i < placeId.length; i++) {
    hash = ((hash << 5) - hash) + placeId.charCodeAt(i);
    hash = hash & hash; // Convert to 32bit integer
  }
  // Map to 3.5 - 5.0 range (realistic ratings, no bad places)
  const normalized = Math.abs(hash % 100) / 100;
  return Math.round((3.5 + normalized * 1.5) * 10) / 10;
}

/**
 * Format a rating number for display.
 * 
 * @param rating - The rating to format
 * @returns A string with one decimal place (e.g., "4.2")
 */
export function formatRating(rating: number): string {
  return rating.toFixed(1);
}

/**
 * Get the number of full stars, half stars, and empty stars for a rating.
 * 
 * @param rating - The rating (0-5)
 * @returns An object with fullStars, halfStar (boolean), and emptyStars counts
 */
export function getRatingStars(rating: number): {
  fullStars: number;
  halfStar: boolean;
  emptyStars: number;
} {
  const clampedRating = Math.max(0, Math.min(5, rating));
  const fullStars = Math.floor(clampedRating);
  const hasHalfStar = clampedRating - fullStars >= 0.3 && clampedRating - fullStars < 0.8;
  const hasFullStar = clampedRating - fullStars >= 0.8;
  
  const actualFullStars = hasFullStar ? fullStars + 1 : fullStars;
  const halfStar = hasHalfStar;
  const emptyStars = 5 - actualFullStars - (halfStar ? 1 : 0);

  return {
    fullStars: actualFullStars,
    halfStar,
    emptyStars,
  };
}

/**
 * Generate a review count based on place ID (for display purposes).
 * 
 * @param placeId - The unique identifier of the place
 * @returns A review count between 10 and 500
 */
export function generateMockReviewCount(placeId: string): number {
  let hash = 0;
  for (let i = 0; i < placeId.length; i++) {
    hash = ((hash << 3) - hash) + placeId.charCodeAt(i);
    hash = hash & hash;
  }
  // Map to 10 - 500 range
  return 10 + Math.abs(hash % 490);
}
