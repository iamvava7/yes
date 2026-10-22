// Formatting for listing details, shared by the tour page and the editor.

export const SQFT_PER_M2 = 10.7639;

export function formatPrice(listing) {
  if (listing?.price == null) return null;
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency', currency: listing.currency || 'EUR', maximumFractionDigits: 0,
    }).format(listing.price);
  } catch {
    return `${Math.round(listing.price).toLocaleString()} ${listing.currency ?? ''}`.trim();
  }
}

export function formatArea(m2) {
  return { m2: `${m2.toFixed(m2 < 100 ? 1 : 0)} m²`, ft2: `${Math.round(m2 * SQFT_PER_M2).toLocaleString()} ft²` };
}

export function plural(n, one, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`;
}

export const LISTING_STATUS = ['For sale', 'For rent', 'Under offer', 'Sold', 'Off market'];
