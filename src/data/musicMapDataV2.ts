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
import { getArtistTopTags } from '../api/lastfm';

// ─── Types ────────────────────────────────────────────────────────────────────

export type Tag = { name: string; count: number };

export type MapUser = {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
};

/** One dot on the map = one post */
export type MapPoint = {
  id: string;         // post id
  user: MapUser;
  songTitle: string;
  artist: string;
  albumArt: string | null;
  caption: string;
  tags: Tag[];        // track tags, or artist tags if track had none
  postedAt: string;
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
      freq.set(t.name, (freq.get(t.name) ?? 0) + t.count);
    }
  }
  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([name]) => name);
}

/** All tags sorted by total count across all posts — used for axis dropdowns */
function buildAllTagsSorted(allTagArrays: Tag[][]): Tag[] {
  const freq = new Map<string, number>();
  for (const tags of allTagArrays) {
    for (const t of tags) {
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
        const { data: posts, error } = await supabase
          .from('posts')
          .select(`
            id, user_id, caption, created_at,
            songs!posts_song_id_fkey (
              id, song_title, artist, album_art, tags
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

        // ── Step 1: collect per-post data, identify posts needing artist tags ──
        type RawPost = {
          postId: string;
          user: MapUser;
          song: any;
          caption: string;
          createdAt: string;
          tags: Tag[];
        };

        const rawPosts: RawPost[] = [];
        const artistsToFetch = new Set<string>(); // artists where track has no tags

        for (const post of posts as any[]) {
          const song = post.songs;
          if (!song) continue;

          const trackTags: Tag[] = Array.isArray(song.tags) && song.tags.length > 0
            ? (song.tags as Tag[])
            : [];

          rawPosts.push({
            postId: post.id,
            user: {
              id: post.user_id,
              username: post.profiles?.username ?? `user_${post.user_id.slice(0, 6)}`,
              displayName: post.profiles?.display_name ?? post.profiles?.username ?? 'Unknown',
              avatarUrl: post.profiles?.avatar_url ?? null,
            },
            song,
            caption: post.caption ?? '',
            createdAt: post.created_at ?? '',
            tags: trackTags,
          });

          if (trackTags.length === 0 && song.artist) {
            artistsToFetch.add(song.artist);
          }
        }

        // ── Step 2: fetch artist tags in parallel for tagless songs ───────────
        const artistTagCache = new Map<string, Tag[]>();
        if (artistsToFetch.size > 0) {
          console.log(`[MusicMap] Fetching artist tags for ${artistsToFetch.size} artists...`);
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

        // ── Step 3: resolve final tags for each post ──────────────────────────
        const resolvedPosts = rawPosts.map(p => ({
          ...p,
          tags: p.tags.length > 0
            ? p.tags
            : (artistTagCache.get(p.song.artist) ?? []),
        }));

        // posts with tags (for PCA/UMAP) vs posts without (will still be shown, placed at origin)
        const taggedPosts = resolvedPosts.filter(p => p.tags.length > 0);
        const untaggedPosts = resolvedPosts.filter(p => p.tags.length === 0);

        console.log(`[MusicMap] ${resolvedPosts.length} posts total, ${taggedPosts.length} with tags`);

        const allTagArrays = resolvedPosts.map(p => p.tags).filter(t => t.length > 0);
        const allTags = buildAllTagsSorted(allTagArrays);
        const vocab = buildVocab(allTagArrays, 50);

        console.log(`[MusicMap] Top tags:`, vocab.slice(0, 8));

        // ── Step 4: feature matrix (tagged posts only) ────────────────────────
        let coords: [number, number][];
        let algorithm: 'umap' | 'pca' | 'trivial';

        if (taggedPosts.length === 0) {
          coords = [];
          algorithm = 'trivial';
        } else if (taggedPosts.length === 1) {
          coords = [[0, 0]];
          algorithm = 'trivial';
        } else {
          const raw = taggedPosts.map(p =>
            vocab.map(v => {
              const t = p.tags.find(t => t.name === v);
              return t ? t.count : 0;
            }),
          );
          // L2-normalise each row so UMAP uses cosine-like similarity.
          // Without this, songs with many high-count tags dominate; normalised
          // vectors spread out by tag *distribution*, revealing real clusters.
          const featureMatrix = raw.map(row => {
            const norm = Math.sqrt(row.reduce((s, v) => s + v * v, 0)) || 1;
            return row.map(v => v / norm);
          });

          if (taggedPosts.length >= 6) {
            try {
              console.log('[MusicMap] Running UMAP...');
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

          // Normalize to [-4, 4] to keep clusters visually compact.
          // minDist = 1.0 ≈ just enough to prevent dot overlap at fit-all scale.
          coords = normalizeCoords(coords);
          coords = resolveCollisions(coords, 1.0, 60);
        }

        if (cancelled) return;

        // ── Step 5: assemble final points ─────────────────────────────────────
        const taggedPoints: MapPoint[] = taggedPosts.map((p, i) => ({
          id: p.postId,
          user: p.user,
          songTitle: p.song.song_title ?? 'Unknown',
          artist: p.song.artist ?? 'Unknown',
          albumArt: p.song.album_art ?? null,
          caption: p.caption,
          tags: p.tags,
          postedAt: p.createdAt,
          x: coords[i]?.[0] ?? 0,
          y: coords[i]?.[1] ?? 0,
        }));

        // Untagged posts get scattered lightly around origin
        const untaggedPoints: MapPoint[] = untaggedPosts.map((p, i) => {
          const angle = (i / Math.max(untaggedPosts.length, 1)) * Math.PI * 2;
          return {
            id: p.postId,
            user: p.user,
            songTitle: p.song.song_title ?? 'Unknown',
            artist: p.song.artist ?? 'Unknown',
            albumArt: p.song.album_art ?? null,
            caption: p.caption,
            tags: [],
            postedAt: p.createdAt,
            x: Math.cos(angle) * 0.5,
            y: Math.sin(angle) * 0.5,
          };
        });

        const points = [...taggedPoints, ...untaggedPoints];

        console.log('[MusicMap] Done.', points.length, 'points,', algorithm);

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
