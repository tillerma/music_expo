import { User, SongPost, DailyEmojiSet, Playlist, PlaylistSong, AlgorithmicRec, FollowRequest } from '../types';
import { getAppCurrentUser } from './authUser';
import { allUsers as initialUsers } from './allUsers';

export const currentUser: User = getAppCurrentUser();

export const users: User[] = [
  currentUser,
  {
    id: 'user-2',
    username: 'sonicsoul',
    displayName: 'Maya Rodriguez',
    bio: 'curator of forgotten melodies',
    avatarUrl: 'https://images.unsplash.com/photo-1557315360-6a350ab4eccd?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx5b3VuZyUyMHdvbWFuJTIwaGVhZHBob25lc3xlbnwxfHx8fDE3NzA4NTkyNzd8MA&ixlib=rb-4.1.0&q=80&w=1080',
    followers: 512,
    following: 203,
  },
  {
    id: 'user-3',
    username: 'rhythmwright',
    displayName: 'Jordan Kim',
    bio: 'listening is a practice',
    avatarUrl: 'https://images.unsplash.com/photo-1665832102556-ba212924f541?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtYW4lMjB3aXRoJTIwYmVhcmQlMjBjYXN1YWx8ZW58MXx8fHwxNzcwODU5Mjc3fDA&ixlib=rb-4.1.0&q=80&w=1080',
    followers: 389,
    following: 421,
  },
  {
    id: 'user-4',
    username: 'echoesandwaves',
    displayName: 'Sam Taylor',
    bio: 'chasing frequencies in the dark',
    avatarUrl: 'https://images.unsplash.com/photo-1590305173565-f789a8dd6be7?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwZXJzb24lMjBnbGFzc2VzJTIwcG9ydHJhaXR8ZW58MXx8fHwxNzcwODU5Mjc4fDA&ixlib=rb-4.1.0&q=80&w=1080',
    followers: 678,
    following: 145,
  },
];

export const dailyEmojiSets: DailyEmojiSet[] = [
  {
    date: '2026-02-12',
    emojis: ['🫂', '🌫️', '🔥', '🕊️', '😵‍💫'],
  },
  {
    date: '2026-02-11',
    emojis: ['🌧️', '✨', '🌊', '🦋', '🎭'],
  },
  {
    date: '2026-02-10',
    emojis: ['🌙', '⚡', '🌸', '🔮', '🎪'],
  },
];

export const songPosts: SongPost[] = [
  {
    id: 'post-1',
    userId: 'user-2',
    user: users[1],
    spotifyUrl: 'https://open.spotify.com/track/example',
    albumArt: 'https://images.unsplash.com/photo-1616663395403-2e0052b8e595?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxhbGJ1bSUyMGNvdmVyJTIwdmlueWx8ZW58MXx8fHwxNzcwODEwMjE3fDA&ixlib=rb-4.1.0&q=80&w=1080',
    songTitle: 'Seventeen',
    artist: 'Sharon Van Etten',
    caption: 'Still devastating after all these years. The way her voice breaks on "I used to be seventeen" hits different every time.',
    date: '2026-02-12',
    reactions: [
      { emoji: '😢', userId: 'user-3', userName: 'alexjones' },
      { emoji: '🌧️', userId: 'user-4', userName: 'sammy_m' },
    ],
    comments: [
      {
        id: 'comment-1',
        userId: 'user-3',
        user: users[2],
        caption: 'This whole album is a masterpiece. Have you heard her live version from NPR Tiny Desk?',
        song: {
          songTitle: 'Every Time the Sun Comes Up',
          artist: 'Sharon Van Etten',
          albumArt: 'https://images.unsplash.com/photo-1616663395403-2e0052b8e595?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxhbGJ1bSUyMGNvdmVyJTIwdmlueWx8ZW58MXx8fHwxNzcwODEwMjE3fDA&ixlib=rb-4.1.0&q=80&w=1080',
          spotifyUrl: 'https://open.spotify.com/track/example',
        },
        timestamp: '2026-02-12T10:30:00Z',
      },
      {
        id: 'comment-2',
        userId: 'user-4',
        user: users[3],
        caption: 'Perfect rainy day song',
        timestamp: '2026-02-12T11:15:00Z',
      },
    ],
  },
  {
    id: 'post-2',
    userId: 'user-3',
    user: users[2],
    spotifyUrl: 'https://open.spotify.com/track/example',
    albumArt: 'https://images.unsplash.com/photo-1587731556938-38755b4803a6?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxpbmRpZSUyMG11c2ljJTIwYWxidW18ZW58MXx8fHwxNzcwODU5Mjc4fDA&ixlib=rb-4.1.0&q=80&w=1080',
    songTitle: 'Re: Stacks',
    artist: 'Bon Iver',
    caption: 'The final track. Sometimes you need to sit with the quiet parts.',
    date: '2026-02-12',
    reactions: [
      { emoji: '🌲', userId: 'user-2', userName: 'sarahlikes' },
    ],
    comments: [],
  },
  {
    id: 'post-3',
    userId: 'user-4',
    user: users[3],
    spotifyUrl: 'https://open.spotify.com/track/example',
    albumArt: 'https://images.unsplash.com/photo-1551288449-085e5252e44e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxlbGVjdHJvbmljJTIwbXVzaWMlMjBhcnR3b3JrfGVufDF8fHx8MTc3MDg1OTI3OXww&ixlib=rb-4.1.0&q=80&w=1080',
    songTitle: 'Midnight City',
    artist: 'M83',
    caption: 'Driving through the city at 2am with this on repeat. No thoughts, just synths.',
    date: '2026-02-12',
    reactions: [
      { emoji: '✨', userId: 'user-2', userName: 'sarahlikes' },
      { emoji: '🌃', userId: 'user-3', userName: 'alexjones' },
    ],
    comments: [
      {
        id: 'comment-3',
        userId: 'user-2',
        user: users[1],
        caption: 'The sax solo!!! Absolute chills',
        timestamp: '2026-02-12T14:20:00Z',
      },
    ],
  },
];

// Generate calendar data for current user
export const generateCalendarPosts = (): SongPost[] => {
  const posts: SongPost[] = [];
  const albumArts = [
    'https://images.unsplash.com/photo-1616663395403-2e0052b8e595?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxhbGJ1bSUyMGNvdmVyJTIwdmlueWx8ZW58MXx8fHwxNzcwODEwMjE3fDA&ixlib=rb-4.1.0&q=80&w=1080',
    'https://images.unsplash.com/photo-1587731556938-38755b4803a6?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxpbmRpZSUyMG11c2ljJTIwYWxidW18ZW58MXx8fHwxNzcwODU5Mjc4fDA&ixlib=rb-4.1.0&q=80&w=1080',
    'https://images.unsplash.com/photo-1551288449-085e5252e44e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxlbGVjdHJvbmljJTIwbXVzaWMlMjBhcnR3b3JrfGVufDF8fHx8MTc3MDg1OTI3OXww&ixlib=rb-4.1.0&q=80&w=1080',
    'https://images.unsplash.com/photo-1681148773098-1460911e25a4?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxqYXp6JTIwbXVzaWMlMjByZWNvcmR8ZW58MXx8fHwxNzcwODU5MjgwfDA&ixlib=rb-4.1.0&q=80&w=1080',
  ];

  const songs = [
    { title: 'Holocene', artist: 'Bon Iver' },
    { title: 'New Year', artist: 'Beach House' },
    { title: 'Lua', artist: 'Bright Eyes' },
    { title: 'Myth', artist: 'Beach House' },
    { title: 'The Night Josh Tillman...', artist: 'Father John Misty' },
    { title: 'Pink + White', artist: 'Frank Ocean' },
    { title: 'Apocalypse', artist: 'Cigarettes After Sex' },
    { title: 'Motion Sickness', artist: 'Phoebe Bridgers' },
  ];

  const captions = [
    'soundtrack to an ending',
    'feel this one in your chest',
    'perfect for golden hour',
    'reminds me of someone I used to know',
    'can\'t stop replaying this',
    'when words aren\'t enough',
    'heard this and had to share',
    'for quiet moments',
  ];

  // Generate posts for the last 30 days
  for (let i = 0; i < 25; i++) {
    const date = new Date('2026-02-12');
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];

    const song = songs[i % songs.length];
    posts.push({
      id: `calendar-post-${i}`,
      userId: currentUser.id,
      user: currentUser,
      date: dateStr,
      spotifyUrl: `https://open.spotify.com/track/example-${i}`,
      caption: captions[i % captions.length],
      albumArt: albumArts[i % albumArts.length],
      songTitle: song.title,
      artist: song.artist,
      reactions: [],
      comments: [],
    });
  }

  return posts;
};

export const playlists: Playlist[] = [
  {
    id: 'playlist-master',
    name: 'All Songs',
    songs: [
      {
        id: 'song-master-1',
        spotifyUrl: 'https://open.spotify.com/track/example',
        albumArt: 'https://images.unsplash.com/photo-1616663395403-2e0052b8e595?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxhbGJ1bSUyMGNvdmVyJTIwdmlueWx8ZW58MXx8fHwxNzcwODEwMjE3fDA&ixlib=rb-4.1.0&q=80&w=1080',
        songTitle: 'Seventeen',
        artist: 'Sharon Van Etten',
        addedDate: '2026-02-12',
      },
      {
        id: 'song-master-2',
        spotifyUrl: 'https://open.spotify.com/track/example',
        albumArt: 'https://images.unsplash.com/photo-1587731556938-38755b4803a6?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxpbmRpZSUyMG11c2ljJTIwYWxidW18ZW58MXx8fHwxNzcwODU5Mjc4fDA&ixlib=rb-4.1.0&q=80&w=1080',
        songTitle: 'Re: Stacks',
        artist: 'Bon Iver',
        addedDate: '2026-02-12',
      },
      {
        id: 'song-master-3',
        spotifyUrl: 'https://open.spotify.com/track/example',
        albumArt: 'https://images.unsplash.com/photo-1551288449-085e5252e44e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxlbGVjdHJvbmljJTIwbXVzaWMlMjBhcnR3b3JrfGVufDF8fHx8MTc3MDg1OTI3OXww&ixlib=rb-4.1.0&q=80&w=1080',
        songTitle: 'Midnight City',
        artist: 'M83',
        addedDate: '2026-02-12',
      },
      {
        id: 'song-master-4',
        spotifyUrl: 'https://open.spotify.com/track/example',
        albumArt: 'https://images.unsplash.com/photo-1681148773098-1460911e25a4?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxqYXp6JTIwbXVzaWMlMjByZWNvcmR8ZW58MXx8fHwxNzcwODU5MjgwfDA&ixlib=rb-4.1.0&q=80&w=1080',
        songTitle: 'Blue in Green',
        artist: 'Miles Davis',
        addedDate: '2026-02-11',
      },
    ],
  },
  {
    id: 'playlist-1',
    name: 'Listen Later',
    songs: [
      {
        id: 'song-1',
        spotifyUrl: 'https://open.spotify.com/track/example',
        albumArt: 'https://images.unsplash.com/photo-1616663395403-2e0052b8e595?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxhbGJ1bSUyMGNvdmVyJTIwdmlueWx8ZW58MXx8fHwxNzcwODEwMjE3fDA&ixlib=rb-4.1.0&q=80&w=1080',
        songTitle: 'Seventeen',
        artist: 'Sharon Van Etten',
        addedDate: '2026-02-12',
      },
      {
        id: 'song-2',
        spotifyUrl: 'https://open.spotify.com/track/example',
        albumArt: 'https://images.unsplash.com/photo-1587731556938-38755b4803a6?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxpbmRpZSUyMG11c2ljJTIwYWxidW18ZW58MXx8fHwxNzcwODU5Mjc4fDA&ixlib=rb-4.1.0&q=80&w=1080',
        songTitle: 'Re: Stacks',
        artist: 'Bon Iver',
        addedDate: '2026-02-12',
      },
    ],
  },
  {
    id: 'playlist-2',
    name: 'Rainy Songs',
    emoji: '🌧️',
    songs: [
      {
        id: 'song-3',
        spotifyUrl: 'https://open.spotify.com/track/example',
        albumArt: 'https://images.unsplash.com/photo-1681148773098-1460911e25a4?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxqYXp6JTIwbXVzaWMlMjByZWNvcmR8ZW58MXx8fHwxNzcwODU5MjgwfDA&ixlib=rb-4.1.0&q=80&w=1080',
        songTitle: 'Blue in Green',
        artist: 'Miles Davis',
        addedDate: '2026-02-11',
      },
    ],
  },
  {
    id: 'playlist-3',
    name: 'Hype',
    emoji: '🔥',
    songs: [
      {
        id: 'song-4',
        spotifyUrl: 'https://open.spotify.com/track/example',
        albumArt: 'https://images.unsplash.com/photo-1551288449-085e5252e44e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxlbGVjdHJvbmljJTIwbXVzaWMlMjBhcnR3b3JrfGVufDF8fHx8MTc3MDg1OTI3OXww&ixlib=rb-4.1.0&q=80&w=1080',
        songTitle: 'Midnight City',
        artist: 'M83',
        addedDate: '2026-02-12',
      },
    ],
  },
];

export const algorithmicRecs: AlgorithmicRec[] = [
  {
    id: 'rec-1',
    songTitle: 'Fourth of July',
    artist: 'Sufjan Stevens',
    albumArt: 'https://images.unsplash.com/photo-1616663395403-2e0052b8e595?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxhbGJ1bSUyMGNvdmVyJTIwdmlueWx8ZW58MXx8fHwxNzcwODEwMjE3fDA&ixlib=rb-4.1.0&q=80&w=1080',
    spotifyUrl: 'https://open.spotify.com/track/example',
    reason: 'Similar to Bon Iver',
    popularity: 72,
    isIndependent: false,
    language: 'English',
  },
  {
    id: 'rec-2',
    songTitle: 'Je te laisserai des mots',
    artist: 'Patrick Watson',
    albumArt: 'https://images.unsplash.com/photo-1587731556938-38755b4803a6?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxpbmRpZSUyMG11c2ljJTIwYWxidW18ZW58MXx8fHwxNzcwODU5Mjc4fDA&ixlib=rb-4.1.0&q=80&w=1080',
    spotifyUrl: 'https://open.spotify.com/track/example',
    reason: 'Low popularity, non-English',
    popularity: 34,
    isIndependent: true,
    language: 'French',
  },
  {
    id: 'rec-3',
    songTitle: 'Outro',
    artist: 'M83',
    albumArt: 'https://images.unsplash.com/photo-1551288449-085e5252e44e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxlbGVjdHJvbmljJTIwbXVzaWMlMjBhcnR3b3JrfGVufDF8fHx8MTc3MDg1OTI3OXww&ixlib=rb-4.1.0&q=80&w=1080',
    spotifyUrl: 'https://open.spotify.com/track/example',
    reason: 'Related to Midnight City',
    popularity: 65,
    isIndependent: false,
    language: 'English',
  },
  {
    id: 'rec-4',
    songTitle: 'Suki',
    artist: 'Kina Grannis',
    albumArt: 'https://images.unsplash.com/photo-1681148773098-1460911e25a4?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxqYXp6JTIwbXVzaWMlMjByZWNvcmR8ZW58MXx8fHwxNzcwODU5MjgwfDA&ixlib=rb-4.1.0&q=80&w=1080',
    spotifyUrl: 'https://open.spotify.com/track/example',
    reason: 'Independent artist, outside top genres',
    popularity: 28,
    isIndependent: true,
    language: 'English',
  },
];

// Follow requests sent to current user
export const initialFollowRequests: FollowRequest[] = [
  {
    id: 'request-1',
    fromUser: users[1],
    toUserId: currentUser.id,
    status: 'pending',
    timestamp: '2026-02-12T08:00:00Z',
  },
  {
    id: 'request-2',
    fromUser: users[2],
    toUserId: currentUser.id,
    status: 'pending',
    timestamp: '2026-02-11T15:30:00Z',
  },
];