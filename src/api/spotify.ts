import { spotifyFetch } from '../utils/spotifyAuth';
import type { SpotifyTrack } from '../types';

// Only public / non-user-scoped endpoints are available with Client Credentials.

export const searchTracks = (query: string) =>
  spotifyFetch(
    `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track`,
  ).then(r => r.json() as Promise<{ tracks: { items: SpotifyTrack[] } }>);
