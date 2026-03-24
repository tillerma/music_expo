const API_KEY = import.meta.env.VITE_LASTFM_API_KEY as string;
const BASE = 'https://ws.audioscrobbler.com/2.0/';

// Non-genre/mood tags to discard
const TAG_BLACKLIST = new Set([
  'seen live', 'favorite', 'favourite', 'love', 'awesome', 'great', 'good',
  'best', 'cool', 'amazing', 'beautiful', 'classic', 'nice', 'my favorite',
  'my favourite', 'under 2000 listeners', 'spotify', 'albums i own',
  'check in', 'all', 'american', 'british', 'canadian', 'australian',
  'female vocalists', 'male vocalists', 'singer-songwriter',
]);

export interface LastFmTag {
  name: string;
  count: number;
}

// Normalize tags → VERY important for clustering
function normalizeTag(tag: string): string {
  return tag
    .toLowerCase()
    .trim()
    .replace(/-/g, ' ')          // hip-hop → hip hop
    .replace(/\s+/g, ' ')        // collapse spaces
}

// Optional: merge common duplicates
function unifyTag(tag: string): string {
  const map: Record<string, string> = {
    'hip hop': 'hip hop',
    'hiphop': 'hip hop',
    'r&b': 'rnb',
    'rnb': 'rnb',
    'lo fi': 'lofi',
    'lo-fi': 'lofi',
  };

  return map[tag] || tag;
}

export async function getArtistTopTags(
  artist: string,
): Promise<LastFmTag[]> {
  const url = new URL(BASE);
  url.searchParams.set('method', 'artist.gettoptags');
  url.searchParams.set('artist', artist);
  url.searchParams.set('api_key', API_KEY);
  url.searchParams.set('format', 'json');
  url.searchParams.set('autocorrect', '1');

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Last.fm HTTP ${res.status}`);

  const data = await res.json();

  if (data.error === 6) return [];
  if (data.error) throw new Error(`Last.fm error ${data.error}: ${data.message}`);

  const raw = (data?.toptags?.tag ?? []) as Array<{ name: string; count: string | number }>;

  return raw
    .map(t => {
      const normalized = normalizeTag(String(t.name));
      const unified = unifyTag(normalized);
      return { name: unified, count: Number(t.count) };
    })
    .filter(t =>
      t.count >= 5 &&
      t.name.length > 1 &&
      !TAG_BLACKLIST.has(t.name),
    )
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
}

export async function getTrackTopTags(
  artist: string,
  track: string,
): Promise<LastFmTag[]> {
  const url = new URL(BASE);
  url.searchParams.set('method', 'track.gettoptags');
  url.searchParams.set('artist', artist);
  url.searchParams.set('track', track);
  url.searchParams.set('api_key', API_KEY);
  url.searchParams.set('format', 'json');
  url.searchParams.set('autocorrect', '1');

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Last.fm HTTP ${res.status}`);

  const data = await res.json();

  if (data.error === 6) return [];
  if (data.error) throw new Error(`Last.fm error ${data.error}: ${data.message}`);

  const raw = (data?.toptags?.tag ?? []) as Array<{ name: string; count: string | number }>;

  return raw
    .map(t => {
      const normalized = normalizeTag(String(t.name));
      const unified = unifyTag(normalized);

      return {
        name: unified,
        count: Number(t.count),
      };
    })
    .filter(t =>
      t.count >= 5 &&
      t.name.length > 1 &&
      !TAG_BLACKLIST.has(t.name)
    )
    // sort just in case API order is weird
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
}