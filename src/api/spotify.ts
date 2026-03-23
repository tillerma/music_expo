import { spotifyFetch } from '../utils/spotifyAuth';
import type { SpotifyUser, SpotifyPlaylist, SpotifyTrack } from '../types';

export const getCurrentUser = () =>
  spotifyFetch('https://api.spotify.com/v1/me')
    .then(r => r.json() as Promise<SpotifyUser>);

export const getUserPlaylists = () =>
  spotifyFetch('https://api.spotify.com/v1/me/playlists')
    .then(r => r.json() as Promise<{ items: SpotifyPlaylist[] }>);

export const searchTracks = (query: string) =>
  spotifyFetch(`https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=20`)
    .then(r => r.json() as Promise<{ tracks: { items: SpotifyTrack[] } }>);

export const getTopTracks = () =>
  spotifyFetch('https://api.spotify.com/v1/me/top/tracks')
    .then(r => r.json() as Promise<{ items: SpotifyTrack[] }>);