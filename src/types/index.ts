export interface User {
  id: string;
  username: string;
  displayName: string;
  bio: string;
  avatarUrl: string;
  followers: number;
  following: number;
  followedByCurrentUser?: boolean;
}

export interface FollowRequest {
  id: string;
  fromUser: User;
  toUserId: string;
  status: 'pending' | 'accepted' | 'rejected';
  timestamp: string;
}

export interface Reaction {
  emoji: string;
  userId: string;
  userName: string;
}

export interface Comment {
  id: string;
  userId: string;
  user: User;
  caption: string;
  song?: {
    songTitle: string;
    artist: string;
    albumArt: string;
    spotifyUrl: string;
  };
  timestamp: string;
}

export interface SongPost {
  id: string;
  userId: string;
  user: User;
  spotifyUrl: string;
  albumArt: string;
  songTitle: string;
  artist: string;
  caption: string;
  date: string;
  reactions: Reaction[];
  comments: Comment[];
}

export interface DailyEmojiSet {
  date: string;
  emojis: string[];
}

export interface Playlist {
  id: string;
  name: string;
  emoji?: string;
  songs: PlaylistSong[];
}

export interface PlaylistSong {
  id: string;
  spotifyUrl: string;
  albumArt: string;
  songTitle: string;
  artist: string;
  addedDate: string;
}

export interface AlgorithmicRec {
  id: string;
  songTitle: string;
  artist: string;
  albumArt: string;
  spotifyUrl: string;
  reason: string;
  popularity: number;
  isIndependent: boolean;
  language: string;
}

// Spotify Types
export interface SpotifyUser {
  id: string;
  display_name: string;
  email: string;
  images: { url: string }[];
}

export interface SpotifyPlaylist {
  id: string;
  name: string;
  images: { url: string }[];
  tracks: { total: number };
}

export interface SpotifyTrack {
  id: string;
  name: string;
  artists: { name: string }[];
  album: { name: string; images: { url: string }[] };
  duration_ms: number;
}