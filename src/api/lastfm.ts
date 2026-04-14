const API_KEY = import.meta.env.VITE_LASTFM_API_KEY as string;
const BASE = 'https://ws.audioscrobbler.com/2.0/';

// ─── Noise filtering ──────────────────────────────────────────────────────────

/**
 * Exact-match blacklist for non-musical / subjective tags.
 * Lower-cased and trimmed before lookup.
 */
const TAG_BLACKLIST = new Set([
  // Subjective / personal
  'seen live', 'favorite', 'favourite', 'love', 'awesome', 'great', 'good',
  'best', 'cool', 'amazing', 'beautiful', 'nice', 'my favorite', 'my favourite',
  'amazing music', 'loved', 'amazing song', 'owned', 'must hear', 'essential',

  // Collection management
  'albums i own', 'under 2000 listeners', 'check in', 'spotify',
  'buy', 'download', 'youtube', 'bandcamp', 'soundcloud', 'apple music',
  'recently added', 'heard on', 'playlist', 'stream', 'top tracks',

  // Nationality / demographic (not musical descriptors)
  'all', 'american', 'british', 'canadian', 'australian', 'european',
  'female vocalists', 'male vocalists', 'singer-songwriter',
  'bands i have seen live', 'artists i have seen live',

  // Year tags (noise without semantic value in a small corpus)
  '2020', '2021', '2022', '2023', '2024', '2025',
  '60s', '70s', '80s', '90s', '00s', '10s', '20s',
  'classic', 'retro', 'old school',
]);

/**
 * Regex patterns that identify radio station tags or other structural noise.
 * Applied after lowercasing.
 *
 * Matches:
 *   - Frequency numbers: "91.7", "104.3"
 *   - "fm" or "am" as standalone word
 *   - Common US public-radio callsigns: wsum, kcrw, wnyc, kexp, …
 *   - Generic "radio" anywhere in tag
 */
const NOISE_REGEXES: RegExp[] = [
  /\b\d{2,3}\.\d\b/,                        // frequency: 91.7 / 104.3
  /\b(?:fm|am)\b/,                           // standalone "fm" or "am"
  /\bradio\b/,                               // "radio" anywhere
  /\bstation\b/,                             // "station" anywhere
  /\b(?:wsum|kcrw|wnyc|kexp|wfmu|kpfa|kqed|wbez|wfuv|wamu|kzsc)\b/, // US callsigns
];

export function isNoisy(tag: string): boolean {
  if (TAG_BLACKLIST.has(tag)) return true;
  return NOISE_REGEXES.some(re => re.test(tag));
}

// ─── Tag normalization ────────────────────────────────────────────────────────

/**
 * Coerce raw tag text to a canonical, lower-case, space-separated form.
 * This runs BEFORE the unifyTag lookup.
 */
function normalizeTag(raw: string): string {
  return raw
    .toLowerCase()
    .trim()
    .replace(/[_–—]/g, ' ')    // underscores + dashes → space
    .replace(/\s+/g, ' ');     // collapse runs of whitespace
}

/**
 * Merge semantically equivalent tags into a single canonical label.
 * The map is applied after normalizeTag(), so all keys must be lower-case.
 *
 * Conventions:
 *   - Hyphenated compound genres stay hyphenated: "post-hardcore", "lo-fi"
 *   - Genre roots without qualifiers where the qualifier adds nothing: "rock n roll" → "rock"
 *   - R&B kept as "r&b" (common industry spelling)
 */
const TAG_UNIFY_MAP: Record<string, string> = {
  // ── Rock ──────────────────────────────────────────────────────────────────
  'rock n roll':        'rock',
  'rock and roll':      'rock',
  'rock & roll':        'rock',
  'alternative rock':   'alternative',
  'alt rock':           'alternative',
  'alt-rock':           'alternative',
  'indie rock':         'indie rock',
  'indie music':        'indie',
  'indie pop':          'indie pop',
  'classic rock':       'classic rock',
  'hard rock':          'hard rock',
  'progressive rock':   'prog rock',
  'prog rock':          'prog rock',
  'psychedelic rock':   'psychedelic',
  'psychedelia':        'psychedelic',

  // ── Punk / Post-hardcore ──────────────────────────────────────────────────
  'punk rock':          'punk',
  'post hardcore':      'post-hardcore',
  'post-hardcore':      'post-hardcore',
  'emo':                'emo',
  'screamo':            'screamo',
  'hardcore punk':      'hardcore',
  'hardcore':           'hardcore',

  // ── Metal ─────────────────────────────────────────────────────────────────
  'heavy metal':        'heavy metal',
  'death metal':        'death metal',
  'black metal':        'black metal',
  'doom metal':         'doom metal',
  'thrash metal':       'thrash metal',
  'metalcore':          'metalcore',

  // ── R&B / Soul ────────────────────────────────────────────────────────────
  'rnb':                'r&b',
  'r&b':                'r&b',
  'r & b':              'r&b',
  'rhythm and blues':   'r&b',
  'rhythm & blues':     'r&b',
  'neo soul':           'neo soul',
  'soul music':         'soul',

  // ── Hip-hop ───────────────────────────────────────────────────────────────
  'hip hop':            'hip-hop',
  'hip-hop':            'hip-hop',
  'hiphop':             'hip-hop',
  'rap music':          'rap',
  'trap music':         'trap',

  // ── Electronic / Dance ────────────────────────────────────────────────────
  'electronica':        'electronic',
  'electronic music':   'electronic',
  'electro':            'electronic',
  'electronic pop':     'electropop',
  'synth pop':          'synth-pop',
  'synthpop':           'synth-pop',
  'synth-pop':          'synth-pop',
  'house music':        'house',
  'deep house':         'deep house',
  'techno music':       'techno',
  'drum and bass':      'drum and bass',
  'drum & bass':        'drum and bass',
  'dnb':                'drum and bass',
  'dubstep':            'dubstep',
  'edm':                'electronic',
  'dance music':        'dance',
  'ambient music':      'ambient',
  'chillwave':          'chillwave',

  // ── Lo-fi ─────────────────────────────────────────────────────────────────
  'lo fi':              'lo-fi',
  'lo-fi':              'lo-fi',
  'lofi':               'lo-fi',
  'lo fi hip hop':      'lo-fi hip-hop',
  'lofi hip hop':       'lo-fi hip-hop',

  // ── Jazz ─────────────────────────────────────────────────────────────────
  'jazz music':         'jazz',
  'smooth jazz':        'smooth jazz',
  'jazz fusion':        'jazz fusion',

  // ── Folk / Country ────────────────────────────────────────────────────────
  'folk music':         'folk',
  'folk rock':          'folk rock',
  'country music':      'country',
  'americana':          'americana',
  'bluegrass':          'bluegrass',

  // ── Pop ───────────────────────────────────────────────────────────────────
  'pop music':          'pop',
  'dream pop':          'dream pop',
  'art pop':            'art pop',
  'baroque pop':        'baroque pop',
  'chamber pop':        'chamber pop',

  // ── Classical / Orchestral ────────────────────────────────────────────────
  'classical music':    'classical',
  'orchestral':         'orchestral',
  'contemporary classical': 'contemporary classical',

  // ── Mood / Texture ────────────────────────────────────────────────────────
  'chill out':          'chill',
  'chillout':           'chill',
  'chillax':            'chill',
  'mellow':             'chill',
  'experimental music': 'experimental',
  'avant garde':        'avant-garde',
  'avant-garde':        'avant-garde',
  'instrumental music': 'instrumental',
};

function unifyTag(tag: string): string {
  return TAG_UNIFY_MAP[tag] ?? tag;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export interface LastFmTag {
  name: string;
  count: number;
}

/**
 * Shared post-processing pipeline applied to both track and artist tag lists:
 *   1. Normalize (lower-case, collapse whitespace)
 *   2. Unify (canonical label)
 *   3. Filter noise (blacklist + regex)
 *   4. Deduplicate (keep highest-count entry per canonical name)
 *   5. Sort by count descending, return top 10
 */
function processTags(
  raw: Array<{ name: string; count: string | number }>,
): LastFmTag[] {
  const seen = new Map<string, number>();

  for (const t of raw) {
    const normalized = normalizeTag(String(t.name));
    const unified    = unifyTag(normalized);
    const count      = Number(t.count);

    if (count < 5)            continue;   // too rare — unreliable signal
    if (unified.length <= 1)  continue;   // single-char junk
    if (isNoisy(unified))     continue;   // radio, subjective, collection noise

    // Deduplicate: keep the highest count for a given canonical tag
    seen.set(unified, Math.max(seen.get(unified) ?? 0, count));
  }

  return [...seen.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
}

export async function getArtistTopTags(artist: string): Promise<LastFmTag[]> {
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

  return processTags(data?.toptags?.tag ?? []);
}

export async function getTrackTopTags(artist: string, track: string): Promise<LastFmTag[]> {
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

  return processTags(data?.toptags?.tag ?? []);
}
