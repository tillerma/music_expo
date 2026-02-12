export interface User {
  id: string;
  username: string;
  displayName: string;
  bio: string;
  avatarUrl: string;
  followers: number;
  following: number;
}

export interface SongPost {
  id: string;
  userId: string;
  user: User;
  date: string; // YYYY-MM-DD
  spotifyUrl: string;
  caption: string;
  albumArt: string;
  songTitle: string;
  artist: string;
  reactions: EmojiReaction[];
}

export interface EmojiReaction {
  emoji: string;
  userId: string;
  userName: string;
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
