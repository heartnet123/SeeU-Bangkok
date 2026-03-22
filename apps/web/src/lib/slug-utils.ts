/**
 * Utility functions for converting between place names and URL-friendly slugs
 */

/**
 * Convert a place name to a URL-friendly slug
 * Preserves Thai characters to match server-side behaviour.
 * Example: "Wat Pho" -> "wat-pho"
 * Example: "วัดพระแก้ว" -> "วัดพระแก้ว"
 */
export function nameToSlug(name: string): string {
  let slug = name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\u0E00-\u0E7F\w-]/g, '') // Keep Thai, alphanumeric, hyphens
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  if (!slug) {
    slug = 'place-' + Math.random().toString(36).substring(2, 7);
  }
  return slug;
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
 * Accepts Thai characters, alphanumeric, and hyphens.
 */
export function isValidSlug(slug: string): boolean {
  const slugPattern = /^[\u0E00-\u0E7F\w]+(-[\u0E00-\u0E7F\w]+)*$/;
  return slugPattern.test(slug);
}
