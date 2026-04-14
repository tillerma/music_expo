/**
 * deezer.ts
 *
 * Public Deezer API helpers — no OAuth required.
 *
 * Used by musicMapDataV2.ts to enrich song embeddings with:
 *   - bpm       (tempo)
 *   - duration  (track length in seconds)
 *   - rank      (Deezer popularity score)
 *
 * All functions handle missing fields and network errors gracefully so that
 * the existing Last.fm pipeline is never blocked.
 */

// In development, requests are proxied through Vite (/deezer-api → https://api.deezer.com)
// to avoid CORS restrictions. In production, replace with your own server-side proxy path.
// const DEEZER_BASE = 'https://api.deezer.com';
const DEEZER_BASE = '/deezer-api';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DeezerFeatures {
  id: string;
  title: string;
  artistName: string;
  /** Beats-per-minute, 0 when Deezer does not provide it */
  bpm: number;
  /** Track duration in seconds */
  duration: number;
  /** Deezer popularity rank (higher = more popular) */
  rank: number;
  /** URL to the 30-second preview MP3, null if unavailable */
  preview: string | null;
}

// ─── API helpers ──────────────────────────────────────────────────────────────

/**
 * Search Deezer for the best-matching track, then fetch its full details
 * (needed for bpm which is only on the /track/{id} endpoint).
 *
 * Returns null when:
 *   - No match is found
 *   - Any network call fails (CORS, timeout, non-200)
 */
export async function getDeezerFeatures(
  title: string,
  artist: string,
): Promise<DeezerFeatures | null> {
  try {
    // ── Step 1: search ───────────────────────────────────────────────────────
    const query = `track:"${title}" artist:"${artist}"`;
    const searchUrl = `${DEEZER_BASE}/search?q=${encodeURIComponent(query)}&limit=1`;

    const searchRes = await fetch(searchUrl);
    if (!searchRes.ok) return null;

    const searchData = await searchRes.json();
    const topResult = searchData?.data?.[0];
    if (!topResult) return null;

    // ── Step 2: full track details (for bpm field) ───────────────────────────
    const trackRes = await fetch(`${DEEZER_BASE}/track/${topResult.id}`);
    // If /track/{id} fails, fall back to the search result (no bpm in that case)
    const trackData = trackRes.ok ? await trackRes.json() : topResult;

    const features: DeezerFeatures = {
      id: String(trackData.id ?? topResult.id),
      title: String(trackData.title ?? topResult.title ?? title),
      artistName: String(trackData.artist?.name ?? topResult.artist?.name ?? artist),
      bpm: Math.max(0, Number(trackData.bpm) || 0),
      duration: Math.max(0, Number(trackData.duration ?? topResult.duration) || 0),
      rank: Math.max(0, Number(trackData.rank ?? topResult.rank) || 0),
      preview: (trackData.preview ?? topResult.preview) || null,
    };

    console.log('DEEZER TRACK:', {
      title: features.title,
      artist: features.artistName,
      id: features.id,
      bpm: features.bpm,
      duration: features.duration,
      rank: features.rank,
      preview: features.preview,
    });

    return features;
  } catch (err) {
    // Network errors (CORS, DNS, timeout) → silently degrade
    console.warn('[Deezer] fetch failed for', title, '—', artist, err);
    return null;
  }
}

// ─── Feature normalization ────────────────────────────────────────────────────

/**
 * Map DeezerFeatures to a fixed-length 3-element numeric vector:
 *
 *   [0] normalized_duration  — min(duration / 600, 1.0)
 *                              600 s = 10 minutes (practical ceiling)
 *   [1] log_rank             — log(1 + rank) / log(1 + 1,000,000)
 *                              log-scales Deezer's popularity score
 *   [2] bpm_availability_flag — 1.0 if bpm > 0, else 0.0
 *                              bpm = 0 means Deezer did not supply it;
 *                              treating 0 as a real tempo would corrupt the vector
 *
 * Rationale for bpm_flag instead of raw bpm:
 *   Deezer frequently returns bpm = 0 for tracks where tempo is unknown.
 *   Using raw bpm would cluster all "unknown-tempo" songs together for the
 *   wrong reason. The flag preserves the information that tempo IS known
 *   without encoding a misleading zero.
 *
 * Returns [0, 0, 0] for a null input so callers never have to branch.
 * Logs "FEATURE VECTOR (DEEZER):" for every non-null call.
 */
export function normalizeDeezerFeatures(
  f: DeezerFeatures | null,
): [number, number, number] {
  if (!f) return [0, 0, 0];

  const normalized_duration  = Math.min(f.duration / 600, 1.0);
  const log_rank             = f.rank > 0
    ? Math.log1p(f.rank) / Math.log1p(1_000_000)
    : 0;
  const bpm_availability_flag = f.bpm > 0 ? 1.0 : 0.0;

  const deezer_vector: [number, number, number] = [
    normalized_duration,
    log_rank,
    bpm_availability_flag,
  ];

  console.log('FEATURE VECTOR (DEEZER):', {
    title: f.title,
    artist: f.artistName,
    normalized_duration,
    log_rank,
    bpm_availability_flag,
    vector: deezer_vector,
  });

  return deezer_vector;
}
