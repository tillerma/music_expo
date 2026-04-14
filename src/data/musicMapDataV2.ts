/**
 * musicMapDataV2.ts
 *
 * Tag-based music map data layer.
 * Each post becomes its own map point (not grouped by user).
 *
 * Algorithm:
 *   1. Fetch ALL posts + songs from Supabase.
 *   2. For songs with no track tags, call artist.getTopTags as fallback.
 *   3. Build a vocabulary of the top 50 most-common tags.
 *   4. Represent each post as a tag-count vector.
 *   5a. ≥ 4 posts → UMAP-2D   5b. 2–3 posts → PCA-2D   5c. 1 post → origin
 *   6. Also expose allTags (sorted by count) for the axis view dropdowns.
 */

import { useState, useEffect } from 'react';
import { UMAP } from 'umap-js';
import { supabase } from '../lib/supabase';
import { getArtistTopTags, isNoisy } from '../api/lastfm';
import { getDeezerFeatures, normalizeDeezerFeatures, DeezerFeatures } from '../api/deezer';

// ─── Types ────────────────────────────────────────────────────────────────────

export type Tag = { name: string; count: number };

export type MapUser = {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
};

/** One dot on the map = one user (their most recent post) */
export type MapPoint = {
  id: string;         // post id
  user: MapUser;
  songTitle: string;
  artist: string;
  albumArt: string | null;
  spotifyUrl: string | null;
  caption: string;
  tags: Tag[];        // track tags, or artist tags if track had none
  postedAt: string;
  postDate: string;   // YYYY-MM-DD
  x: number;         // cluster coordinate (UMAP/PCA)
  y: number;
};

export type MapLoadState =
  | { status: 'loading' }
  | { status: 'ready'; points: MapPoint[]; allTags: Tag[]; algorithm: 'umap' | 'pca' | 'trivial' }
  | { status: 'error'; message: string };

// ─── PCA-2D ───────────────────────────────────────────────────────────────────

function computePCA2D(X: number[][]): [number, number][] {
  const n = X.length;
  if (n === 1) return [[0, 0]];
  const d = X[0].length;

  const means = Array.from({ length: d }, (_, j) =>
    X.reduce((s, r) => s + r[j], 0) / n,
  );
  const stds = Array.from({ length: d }, (_, j) => {
    const v = X.reduce((s, r) => s + (r[j] - means[j]) ** 2, 0) / n;
    return Math.sqrt(v) || 1;
  });
  const Xs = X.map(row => row.map((v, j) => (v - means[j]) / stds[j]));

  const cov: number[][] = Array.from({ length: d }, (_, i) =>
    Array.from({ length: d }, (_, j) =>
      Xs.reduce((s, r) => s + r[i] * r[j], 0) / (n - 1 || 1),
    ),
  );

  const deflated = cov.map(row => [...row]);
  const pcs: number[][] = [];

  for (let k = 0; k < 2; k++) {
    let v = Array.from({ length: d }, (_, i) => Math.sin(i * 13.7 + k * 7.3));
    let norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
    v = v.map(x => x / norm);

    for (let iter = 0; iter < 300; iter++) {
      const nv = Array<number>(d).fill(0);
      for (let i = 0; i < d; i++)
        for (let j = 0; j < d; j++)
          nv[i] += deflated[i][j] * v[j];
      norm = Math.sqrt(nv.reduce((s, x) => s + x * x, 0)) || 1;
      v = nv.map(x => x / norm);
    }
    pcs.push(v);

    const Mv = deflated.map(row => row.reduce((s, m, j) => s + m * v[j], 0));
    const eigenval = v.reduce((s, vi, i) => s + vi * Mv[i], 0);
    for (let i = 0; i < d; i++)
      for (let j = 0; j < d; j++)
        deflated[i][j] -= eigenval * v[i] * v[j];
  }

  const [pc1, pc2] = pcs;
  return Xs.map(row => [
    row.reduce((s, v, i) => s + v * pc1[i], 0),
    row.reduce((s, v, i) => s + v * pc2[i], 0),
  ]);
}

// ─── UMAP-2D ──────────────────────────────────────────────────────────────────

function computeUMAP2D(X: number[][]): [number, number][] {
  const n = X.length;
  // More neighbours = more global structure captured; clamp generously
  const nNeighbors = Math.max(3, Math.min(n - 1, Math.ceil(n * 0.6)));

  const umap = new UMAP({
    nComponents: 2,
    nNeighbors,
    minDist: 0.05,   // tight intra-cluster packing
    spread: 2.0,     // wide inter-cluster gaps
    nEpochs: 400,
  });

  const embedding = umap.fit(X);
  return embedding.map(([x, y]) => [x, y] as [number, number]);
}

// ─── Layout helpers ───────────────────────────────────────────────────────────

/**
 * Normalize coords so the widest axis spans [-targetHalf, targetHalf].
 * Smaller target = clusters stay visually compact.
 */
function normalizeCoords(coords: [number, number][], targetHalf = 4): [number, number][] {
  if (coords.length <= 1) return coords.map(() => [0, 0] as [number, number]);
  const xs = coords.map(c => c[0]), ys = coords.map(c => c[1]);
  const span = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys), 0.001);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
  const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
  return coords.map(([x, y]) => [(x - cx) / span * (targetHalf * 2), (y - cy) / span * (targetHalf * 2)]);
}

/**
 * Iterative push-apart: if two points are closer than minDist,
 * push them equally apart along their connecting vector.
 */
export function resolveCollisions(
  coords: [number, number][],
  minDist = 1.1,
  iterations = 120,
): [number, number][] {
  const pos = coords.map(c => [c[0], c[1]] as [number, number]);
  const n = pos.length;
  for (let iter = 0; iter < iterations; iter++) {
    let moved = false;
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const dx = pos[j][0] - pos[i][0];
        const dy = pos[j][1] - pos[i][1];
        const d = Math.hypot(dx, dy);
        if (d < minDist) {
          moved = true;
          const push = (minDist - d) / 2 + 0.001;
          if (d < 0.001) {
            const angle = j * 2.399; // golden angle spread for coincident points
            pos[i][0] -= Math.cos(angle) * push;
            pos[i][1] -= Math.sin(angle) * push;
            pos[j][0] += Math.cos(angle) * push;
            pos[j][1] += Math.sin(angle) * push;
          } else {
            const nx = dx / d, ny = dy / d;
            pos[i][0] -= nx * push;
            pos[i][1] -= ny * push;
            pos[j][0] += nx * push;
            pos[j][1] += ny * push;
          }
        }
      }
    }
    if (!moved) break;
  }
  return pos;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildVocab(allTagArrays: Tag[][], topN = 50): string[] {
  const freq = new Map<string, number>();
  for (const tags of allTagArrays) {
    for (const t of tags) {
      if (isNoisy(t.name)) continue;
      freq.set(t.name, (freq.get(t.name) ?? 0) + t.count);
    }
  }
  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([name]) => name);
}

/** All tags sorted by total count across all posts — used for axis dropdowns and filter chips */
function buildAllTagsSorted(allTagArrays: Tag[][]): Tag[] {
  const freq = new Map<string, number>();
  for (const tags of allTagArrays) {
    for (const t of tags) {
      if (isNoisy(t.name)) continue;
      freq.set(t.name, (freq.get(t.name) ?? 0) + t.count);
    }
  }
  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => ({ name, count }));
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useMusicMapV2(
  refreshIntervalMs = 5 * 60 * 1000,
): MapLoadState {
  const [state, setState] = useState<MapLoadState>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;

    async function fetchAndCompute() {
      try {
        // Fetch all posts newest-first so the first row per user = most recent
        const { data: posts, error } = await supabase
          .from('posts')
          .select(`
            id, user_id, caption, created_at, post_date,
            songs!posts_song_id_fkey (
              id, song_title, artist, album_art, spotify_url, tags
            ),
            profiles!posts_user_id_fkey (
              id, username, display_name, avatar_url
            )
          `)
          .order('created_at', { ascending: false });

        if (error) throw error;
        if (cancelled) return;

        if (!posts || posts.length === 0) {
          setState({ status: 'ready', points: [], allTags: [], algorithm: 'trivial' });
          return;
        }

        // ── Step 1: deduplicate to ONE post per user (most recent) ────────────
        type RawPost = {
          postId: string;
          user: MapUser;
          song: any;
          caption: string;
          createdAt: string;
          postDate: string;
          tags: Tag[];
        };

        const rawPosts: RawPost[] = [];
        const seenUsers = new Set<string>();
        const artistsToFetch = new Set<string>();

        for (const post of posts as any[]) {
          const uid = String(post.user_id ?? '');
          if (!uid || seenUsers.has(uid)) continue; // keep only most-recent post per user
          seenUsers.add(uid);

          const song = post.songs;
          if (!song) continue;

          const trackTags: Tag[] = Array.isArray(song.tags) && song.tags.length > 0
            ? (song.tags as Tag[])
            : [];

          rawPosts.push({
            postId: post.id,
            user: {
              id: uid,
              username: post.profiles?.username ?? `user_${uid.slice(0, 6)}`,
              displayName: post.profiles?.display_name ?? post.profiles?.username ?? 'Unknown',
              avatarUrl: post.profiles?.avatar_url ?? null,
            },
            song,
            caption: post.caption ?? '',
            createdAt: post.created_at ?? '',
            postDate: post.post_date ?? (post.created_at ?? '').slice(0, 10),
            tags: trackTags,
          });

          if (trackTags.length === 0 && song.artist) {
            artistsToFetch.add(song.artist);
          }
        }

        // ── Step 2: fetch artist tags in parallel for tagless songs ───────────
        const artistTagCache = new Map<string, Tag[]>();
        if (artistsToFetch.size > 0) {
          const timeout = (ms: number) => new Promise<never>((_, r) => setTimeout(() => r(new Error('timeout')), ms));
          const results = await Promise.allSettled(
            [...artistsToFetch].map(async artist => {
              const tags = await Promise.race([getArtistTopTags(artist), timeout(4000)]);
              return { artist, tags };
            }),
          );
          for (const r of results) {
            if (r.status === 'fulfilled') {
              artistTagCache.set(r.value.artist, r.value.tags);
            }
          }
        }

        // ── Step 3: resolve final tags for each user's post ──────────────────
        const resolvedPosts = rawPosts.map(p => ({
          ...p,
          tags: p.tags.length > 0
            ? p.tags
            : (artistTagCache.get(p.song.artist) ?? []),
        }));

        // Split into tagged (placed by UMAP/PCA) and untagged (placed at origin)
        const taggedPosts = resolvedPosts.filter(p => p.tags.length > 0);
        const untaggedPosts = resolvedPosts.filter(p => p.tags.length === 0);

        const allTagArrays = resolvedPosts.map(p => p.tags).filter(t => t.length > 0);
        const allTags = buildAllTagsSorted(allTagArrays);
        const vocab = buildVocab(allTagArrays, 50);

        // ── Step 3.5: fetch Deezer metadata in parallel (best-effort) ─────────
        // Keyed by "songTitle|artist" to deduplicate across posts sharing a song.
        const deezerCache = new Map<string, DeezerFeatures | null>();
        {
          const deezerTimeout = (ms: number) =>
            new Promise<never>((_, reject) => setTimeout(() => reject(new Error('deezer timeout')), ms));

          // Only fetch for tagged posts — untagged go to origin regardless.
          const uniqueSongs = [
            ...new Map(
              taggedPosts.map(p => [
                `${p.song.song_title ?? ''}|${p.song.artist ?? ''}`,
                { title: p.song.song_title ?? '', artist: p.song.artist ?? '' },
              ]),
            ).entries(),
          ];

          const deezerResults = await Promise.allSettled(
            uniqueSongs.map(async ([key, { title, artist }]) => {
              const features = await Promise.race([
                getDeezerFeatures(title, artist),
                deezerTimeout(5000),
              ]);
              return { key, features };
            }),
          );

          for (const r of deezerResults) {
            if (r.status === 'fulfilled') {
              deezerCache.set(r.value.key, r.value.features);
            }
          }
        }

        // ── Step 4: feature matrix (tagged users only) ────────────────────────
        //
        // Fusion strategy: equal-contribution L2 normalization
        //
        //   1. Tag sub-vector   → L2-normalize to unit length  (||tag|| = 1)
        //   2. Deezer sub-vector → L2-normalize to unit length  (||deezer|| = 1)
        //      If no Deezer data, stays [0,0,0] → contributes nothing (degrades
        //      gracefully to pure tag embedding for that post).
        //   3. Concatenate: combined ∈ ℝ^(vocab+3), ||combined|| ≤ sqrt(2)
        //   4. Final L2-normalize: each sub-space has equal geometric weight.
        //
        // This ensures neither source dominates purely by dimensionality count.

        let coords: [number, number][];
        let algorithm: 'umap' | 'pca' | 'trivial';

        if (taggedPosts.length === 0) {
          coords = [];
          algorithm = 'trivial';
        } else if (taggedPosts.length === 1) {
          coords = [[0, 0]];
          algorithm = 'trivial';
        } else {
          const featureMatrix = taggedPosts.map(p => {
            // ── Last.fm tag sub-vector → L2 unit vector ───────────────────────
            const tagRaw = vocab.map(v => {
              const t = p.tags.find(tag => tag.name === v);
              return t ? t.count : 0;
            });
            const tagNorm = Math.sqrt(tagRaw.reduce((s, v) => s + v * v, 0)) || 1;
            const tagUnit = tagRaw.map(v => v / tagNorm);   // ||tagUnit|| = 1

            // ── Deezer sub-vector → L2 unit vector (or zero if unavailable) ───
            const key = `${p.song.song_title ?? ''}|${p.song.artist ?? ''}`;
            const deezerFeat = deezerCache.get(key) ?? null;
            const deezerRaw  = normalizeDeezerFeatures(deezerFeat); // [dur, rank, bpm_flag]
            const deezerMag  = Math.sqrt(deezerRaw.reduce((s, v) => s + v * v, 0));
            // Only normalize when we actually have Deezer data; keep [0,0,0] as-is
            const deezerUnit = deezerMag > 0
              ? (deezerRaw.map(v => v / deezerMag) as [number, number, number])
              : deezerRaw;                                    // ||deezerUnit|| = 1 or 0

            // ── Fuse: concat → final L2-normalize ────────────────────────────
            const combined = [...tagUnit, ...deezerUnit];

            console.log('MERGED FEATURE VECTOR:', combined);

            const finalNorm = Math.sqrt(combined.reduce((s, v) => s + v * v, 0)) || 1;
            return combined.map(v => v / finalNorm);
          });

          if (taggedPosts.length >= 6) {
            try {
              coords = computeUMAP2D(featureMatrix);
              algorithm = 'umap';
            } catch {
              coords = computePCA2D(featureMatrix);
              algorithm = 'pca';
            }
          } else {
            coords = computePCA2D(featureMatrix);
            algorithm = 'pca';
          }

          coords = normalizeCoords(coords);
          coords = resolveCollisions(coords, 1.0, 60);
        }

        if (cancelled) return;

        // ── Step 5: assemble final points (one per user) ──────────────────────
        const taggedPoints: MapPoint[] = taggedPosts.map((p, i) => ({
          id: p.postId,
          user: p.user,
          songTitle: p.song.song_title ?? 'Unknown',
          artist: p.song.artist ?? 'Unknown',
          albumArt: p.song.album_art ?? null,
          spotifyUrl: p.song.spotify_url ?? null,
          caption: p.caption,
          tags: p.tags,
          postedAt: p.createdAt,
          postDate: p.postDate,
          x: coords[i]?.[0] ?? 0,
          y: coords[i]?.[1] ?? 0,
        }));

        const untaggedPoints: MapPoint[] = untaggedPosts.map((p, i) => {
          const angle = (i / Math.max(untaggedPosts.length, 1)) * Math.PI * 2;
          return {
            id: p.postId,
            user: p.user,
            songTitle: p.song.song_title ?? 'Unknown',
            artist: p.song.artist ?? 'Unknown',
            albumArt: p.song.album_art ?? null,
            spotifyUrl: p.song.spotify_url ?? null,
            caption: p.caption,
            tags: [],
            postedAt: p.createdAt,
            postDate: p.postDate,
            x: Math.cos(angle) * 0.5,
            y: Math.sin(angle) * 0.5,
          };
        });

        const points = [...taggedPoints, ...untaggedPoints];

        if (!cancelled) setState({ status: 'ready', points, allTags, algorithm });
      } catch (err) {
        console.error('[MusicMap] Error:', err);
        if (!cancelled) setState({ status: 'error', message: String(err) });
      }
    }

    fetchAndCompute();
    const interval = setInterval(fetchAndCompute, refreshIntervalMs);
    return () => { cancelled = true; clearInterval(interval); };
  }, [refreshIntervalMs]);

  return state;
}
