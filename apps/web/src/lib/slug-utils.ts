/**
 * Utility functions for converting between place names and URL-friendly slugs
 */

/**
 * Convert a place name to a URL-friendly slug
 * Example: "Wat Pho" -> "wat-pho"
 */
export function nameToSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // Remove special characters except spaces and hyphens
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
    .replace(/^-|-$/g, ''); // Remove leading and trailing hyphens
}

/**
 * Convert a URL slug back to a searchable name format
 * Example: "wat-pho" -> "Wat Pho"
 */
export function slugToName(slug: string): string {
  return slug
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Create a case-insensitive search pattern for database queries
 * Example: "wat-pho" -> "Wat Pho" (for exact match) or "%wat%pho%" (for fuzzy match)
 */
export function slugToSearchPattern(slug: string, exact: boolean = true): string {
  const name = slugToName(slug);
  
  if (exact) {
    return name;
  }
  
  // For fuzzy search, create a pattern that matches variations
  return `%${name.replace(/\s+/g, '%')}%`;
}

/**
 * Validate if a slug is properly formatted
 */
export function isValidSlug(slug: string): boolean {
  // Check if slug contains only lowercase letters, numbers, and hyphens
  // Should not start or end with hyphen
  const slugPattern = /^[a-z0-9]+(-[a-z0-9]+)*$/;
  return slugPattern.test(slug);
}