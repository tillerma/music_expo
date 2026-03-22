"""
scheduler.py
Lyra Music Map — background job scheduler.

Runs generate_music_map.py on a schedule and writes results to your database.
This is what replaces manually running the script from your terminal.

HOW TO RUN
==========

Local dev (keep running in a separate terminal tab):
    python scheduler.py --env dev --interval 60

Production (as a long-running process on your server):
    python scheduler.py --env prod --interval 300

As a systemd service (recommended for VPS/Linux servers):
    See lyra-map-worker.service below — copy to /etc/systemd/system/

On Railway / Render / Fly.io:
    Add a second "worker" service that runs: python scheduler.py --env prod
    These platforms keep it alive and restart it if it crashes.

On Vercel / Netlify (serverless — no long-running processes):
    Use a cron job instead — see the cron section at the bottom of this file.

WHAT IT DOES
============
Every `interval` seconds:
  1. Reads all user posts from the database (or JSON file in dev mode)
  2. Runs the PCA → UMAP pipeline on their averaged feature vectors
  3. Writes the new x,y coordinates back to the database
  4. Your API endpoint (GET /api/music-map) reads from that DB table
  5. The frontend re-fetches every 5 minutes and animates to new positions

NO frontend redeploy is needed. The map updates silently in the background.
"""

import argparse
import logging
import time
import json
import traceback
from datetime import datetime
from pathlib import Path

import numpy as np

# ── Logging ──────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s  %(levelname)-8s  %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S',
)
log = logging.getLogger('lyra.map')

# ── Import the pipeline from generate_music_map.py ───────────────────────────
# Both files live in the same directory (e.g. server/ or scripts/)
import sys
sys.path.insert(0, str(Path(__file__).parent))

from generate_music_map import (
    run_pipeline,
    normalise_for_lookup,
    nearest_song,
    SONG_LIBRARY,
    SONG_FEATURES_RAW,
    FEATURE_COLS,
)


# ─── Data sources ─────────────────────────────────────────────────────────────

def fetch_posts_from_db() -> list[dict]:
    """
    PRODUCTION: Query your database for all user posts.

    Replace this with your actual DB query. The returned list should look like:
    [
      {
        "user_id":   "uuid-or-string",
        "features":  { "danceability": 0.8, "energy": 0.6, ... },  # from Spotify API
        "songTitle": "God's Plan",
        "artist":    "Drake",
        "caption":   "this one goes hard",
        "postedAt":  "2024-03-15T14:23:00Z",
      },
      ...
    ]

    Each user can have multiple posts. The pipeline will average them.
    """
    # ── Supabase example ──────────────────────────────────────────────────────
    # from supabase import create_client
    # supabase = create_client(os.environ['SUPABASE_URL'], os.environ['SUPABASE_KEY'])
    # rows = supabase.table('posts').select(
    #     'user_id, song_title, artist, caption, posted_at, '
    #     'feat_danceability, feat_energy, feat_valence, feat_acousticness, '
    #     'feat_instrumentalness, feat_liveness, feat_speechiness, feat_tempo, feat_loudness'
    # ).execute().data
    # return [{
    #     'user_id':   r['user_id'],
    #     'songTitle': r['song_title'],
    #     'artist':    r['artist'],
    #     'caption':   r['caption'],
    #     'postedAt':  r['posted_at'],
    #     'features': {
    #         'danceability':     r['feat_danceability'],
    #         'energy':           r['feat_energy'],
    #         'valence':          r['feat_valence'],
    #         'acousticness':     r['feat_acousticness'],
    #         'instrumentalness': r['feat_instrumentalness'],
    #         'liveness':         r['feat_liveness'],
    #         'speechiness':      r['feat_speechiness'],
    #         'tempo':            r['feat_tempo'],
    #         'loudness':         r['feat_loudness'],
    #     },
    # } for r in rows]

    raise NotImplementedError("Replace this with your real DB query")


def fetch_posts_from_json(json_path: str) -> list[dict]:
    """DEV: Read posts from the existing generatedMusicMap.json (mock data)."""
    with open(json_path) as f:
        raw = json.load(f)
    # Expand each entry into POSTS_PER_USER fake posts (we only stored today's)
    posts = []
    for entry in raw:
        posts.append({
            'user_id':   entry['userId'],
            'songTitle': entry['songToday']['songTitle'],
            'artist':    entry['songToday']['artist'],
            'caption':   entry['songToday'].get('caption', ''),
            'postedAt':  entry['songToday'].get('postedAt', datetime.utcnow().isoformat()),
            'features':  entry['songToday']['features'],
        })
    return posts


# ─── Output writers ───────────────────────────────────────────────────────────

def write_positions_to_db(positions: list[dict]) -> None:
    """
    PRODUCTION: Write computed x,y coordinates to your database.

    Your API endpoint reads from this table to serve the frontend.

    Schema suggestion (Supabase / Postgres):
        CREATE TABLE map_positions (
            user_id     TEXT PRIMARY KEY,
            x           FLOAT,
            y           FLOAT,
            song_title  TEXT,
            artist      TEXT,
            caption     TEXT,
            features    JSONB,
            computed_at TIMESTAMPTZ DEFAULT NOW()
        );
    """
    # ── Supabase example ──────────────────────────────────────────────────────
    # from supabase import create_client
    # supabase = create_client(os.environ['SUPABASE_URL'], os.environ['SUPABASE_KEY'])
    # supabase.table('map_positions').upsert(positions, on_conflict='user_id').execute()

    raise NotImplementedError("Replace this with your real DB write")


def write_positions_to_json(positions: list[dict], out_path: str) -> None:
    """DEV: Overwrite the JSON file (Vite picks up the change via HMR)."""
    with open(out_path, 'w') as f:
        json.dump(positions, f, indent=2)


# ─── Core recompute logic ─────────────────────────────────────────────────────

def recompute(posts: list[dict]) -> list[dict]:
    """
    Given raw posts, run the full pipeline and return position dicts.
    This is environment-agnostic — same code for dev and prod.
    """
    if not posts:
        log.warning("No posts found — skipping recompute")
        return []

    # Group posts by user and compute mean feature vector
    from collections import defaultdict
    import pandas as pd
    from sklearn.preprocessing import StandardScaler

    df = pd.json_normalize(posts, sep='_')

    # Accept features as either nested dict (features.energy) or flat (feat_energy)
    feat_cols_nested = [f'features_{c}' for c in FEATURE_COLS]
    feat_cols_flat   = [f'feat_{c}'     for c in FEATURE_COLS]

    if feat_cols_nested[0] in df.columns:
        df = df.rename(columns={f'features_{c}': c for c in FEATURE_COLS})
    elif feat_cols_flat[0] in df.columns:
        df = df.rename(columns={f'feat_{c}': c for c in FEATURE_COLS})
    else:
        raise ValueError(f"Can't find feature columns. Got: {list(df.columns)}")

    user_vectors = df.groupby('user_id')[FEATURE_COLS].mean()
    n_users = len(user_vectors)
    log.info(f"  {n_users} users, {len(posts)} posts")

    # Run PCA → UMAP pipeline
    vectors_np = user_vectors.values
    coords, diag = run_pipeline(vectors_np)

    log.info(f"  Algorithm: {diag['algorithm']}")
    log.info(f"  PCA dims:  {diag['pca_components_used']} "
             f"({diag['variance_explained']*100:.1f}% variance explained)")

    # Assign today's song (most recent post per user)
    norm_library = normalise_for_lookup(SONG_FEATURES_RAW)

    # Sort posts by postedAt so [-1] is genuinely most recent
    posts_sorted = sorted(posts, key=lambda p: p.get('postedAt', ''))
    latest_post = {}
    for p in posts_sorted:
        latest_post[p['user_id']] = p  # keeps overwriting with later posts

    used_idxs: set[int] = set()
    output = []

    for i, user_id in enumerate(user_vectors.index):
        post = latest_post.get(user_id, {})
        raw_features = np.array([post.get('features', {}).get(c, 0.0) for c in FEATURE_COLS])
        norm_features = normalise_for_lookup(raw_features.reshape(1, -1))[0]

        # Nearest unused song
        diffs = norm_library - norm_features
        dists = np.sqrt((diffs ** 2).sum(axis=1))
        ranked = np.argsort(dists).tolist()

        song_idx = ranked[0]
        for candidate in ranked:
            if candidate not in used_idxs:
                song_idx = candidate
                break
        used_idxs.add(song_idx)
        song = SONG_LIBRARY[song_idx]

        output.append({
            'userId':    user_id,
            'x':         round(float(coords[i][0]), 4),
            'y':         round(float(coords[i][1]), 4),
            'computedAt': datetime.utcnow().isoformat(),
            'songToday': {
                'user_id':   user_id,
                'songTitle': post.get('songTitle') or song[0],
                'artist':    post.get('artist')    or song[1],
                'caption':   post.get('caption', ''),
                'postedAt':  post.get('postedAt', datetime.utcnow().isoformat()),
                'features':  {c: round(float(raw_features[j]), 6)
                               for j, c in enumerate(FEATURE_COLS)},
            },
        })

    return output


# ─── Scheduler loop ───────────────────────────────────────────────────────────

def run_loop(env: str, interval: int, json_path: str) -> None:
    log.info(f"Lyra map worker starting  env={env}  interval={interval}s")

    while True:
        start = time.monotonic()
        log.info("─── Recompute cycle starting ───")

        try:
            # 1. Fetch posts
            if env == 'dev':
                posts = fetch_posts_from_json(json_path)
            else:
                posts = fetch_posts_from_db()

            # 2. Run pipeline
            positions = recompute(posts)

            # 3. Write output
            if env == 'dev':
                write_positions_to_json(positions, json_path)
                log.info(f"  Written to {json_path}")
            else:
                write_positions_to_db(positions)
                log.info(f"  Written {len(positions)} positions to DB")

            elapsed = time.monotonic() - start
            log.info(f"  Done in {elapsed:.1f}s  (next run in {interval}s)")

        except NotImplementedError as e:
            log.error(f"  Not implemented: {e}")
            log.error("  → Replace the stub functions with real DB calls")
            break

        except Exception:
            log.error("  Pipeline failed:")
            traceback.print_exc()
            log.info(f"  Retrying in {interval}s")

        time.sleep(interval)


# ─── CLI ──────────────────────────────────────────────────────────────────────

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Lyra music map background worker')
    parser.add_argument('--env',      default='dev',  choices=['dev', 'prod'])
    parser.add_argument('--interval', default=300,    type=int,
                        help='Seconds between recomputes (default 300 = 5 min)')
    parser.add_argument('--json',     default='src/data/generatedMusicMap.json',
                        help='Path to JSON file (dev mode only)')
    args = parser.parse_args()

    run_loop(args.env, args.interval, args.json)


# ─────────────────────────────────────────────────────────────────────────────
# CRON ALTERNATIVE (Vercel / Netlify / serverless)
# ─────────────────────────────────────────────────────────────────────────────
#
# If your frontend is on a serverless platform with no long-running processes,
# use a cron endpoint instead of this scheduler.
#
# 1. Create an API route:  POST /api/recompute-map
#
#    import { recomputeMap } from '@/lib/mapPipeline';  // port this logic to TS
#    export async function POST(req) {
#      const secret = req.headers.get('x-cron-secret');
#      if (secret !== process.env.CRON_SECRET) return new Response('Unauthorized', { status: 401 });
#      await recomputeMap();
#      return new Response('OK');
#    }
#
# 2. Call it on a schedule using:
#    - Vercel Cron Jobs (vercel.json):
#        { "crons": [{ "path": "/api/recompute-map", "schedule": "*/5 * * * *" }] }
#    - GitHub Actions (every 5 min):
#        on: schedule: - cron: '*/5 * * * *'
#    - Uptime robot / cron-job.org (free, pings a URL on schedule)
#
# ─────────────────────────────────────────────────────────────────────────────
# SYSTEMD SERVICE (VPS / Linux server)
# ─────────────────────────────────────────────────────────────────────────────
#
# Save as /etc/systemd/system/lyra-map-worker.service
#
# [Unit]
# Description=Lyra Music Map Worker
# After=network.target
#
# [Service]
# User=ubuntu
# WorkingDirectory=/home/ubuntu/lyra/server
# ExecStart=/home/ubuntu/lyra/.venv/bin/python scheduler.py --env prod --interval 300
# Restart=always
# RestartSec=10
# StandardOutput=journal
# StandardError=journal
#
# [Install]
# WantedBy=multi-user.target
#
# Then:
#   sudo systemctl daemon-reload
#   sudo systemctl enable lyra-map-worker
#   sudo systemctl start lyra-map-worker
#   sudo journalctl -u lyra-map-worker -f    # watch logs