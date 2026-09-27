import { providerFetch } from './places.provider.js';

// Photos for places via Wikipedia (Wikimedia Commons images, free to use with attribution on the
// file page). Searching "<name> <country>" picks the right article for most destinations.

type WikiPages = { query?: { pages?: Record<string, { title: string; index?: number; thumbnail?: { source: string } }> } };

export async function findPlaceImage(name: string, context: string | null): Promise<string | null> {
  const params = new URLSearchParams({
    action: 'query',
    format: 'json',
    generator: 'search',
    gsrsearch: [name, context].filter(Boolean).join(' '),
    gsrlimit: '3',
    prop: 'pageimages',
    piprop: 'thumbnail',
    pithumbsize: '1200',
  });
  try {
    const response = await providerFetch(`https://en.wikipedia.org/w/api.php?${params}`);
    if (!response.ok) return null;
    const pages = Object.values(((await response.json()) as WikiPages).query?.pages ?? {});
    // Best-ranked search result that has a photo.
    const best = pages.sort((a, b) => (a.index ?? 99) - (b.index ?? 99)).find((page) => page.thumbnail?.source);
    const source = best?.thumbnail?.source;
    // Maps and flags make poor cover photos.
    if (!source || /(\.svg|flag|locator|map|coat_of_arms|emblem|seal)/i.test(source)) return null;
    return source.replace(/\?.*$/, '');
  } catch {
    return null;
  }
}
