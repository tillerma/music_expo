export interface GenreSong {
  id: string;
  songTitle: string;
  artist: string;
  albumArt: string;
  spotifyUrl: string;
}

export interface GenreCategory {
  id: string;
  name: string;
  color: string;
  songs: GenreSong[];
}

export const genreCategories: GenreCategory[] = [
  {
    id: 'indie',
    name: 'INDIE / ALTERNATIVE',
    color: 'from-purple-400 to-pink-400',
    songs: [
      {
        id: 'indie-1',
        songTitle: 'Seventeen',
        artist: 'Sharon Van Etten',
        albumArt: 'https://images.unsplash.com/photo-1616663395403-2e0052b8e595?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxhbGJ1bSUyMGNvdmVyJTIwdmlueWx8ZW58MXx8fHwxNzcwODEwMjE3fDA&ixlib=rb-4.1.0&q=80&w=1080',
        spotifyUrl: 'https://open.spotify.com/track/example1',
      },
      {
        id: 'indie-2',
        songTitle: 'Re: Stacks',
        artist: 'Bon Iver',
        albumArt: 'https://images.unsplash.com/photo-1587731556938-38755b4803a6?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxpbmRpZSUyMG11c2ljJTIwYWxidW18ZW58MXx8fHwxNzcwODU5Mjc4fDA&ixlib=rb-4.1.0&q=80&w=1080',
        spotifyUrl: 'https://open.spotify.com/track/example2',
      },
      {
        id: 'indie-3',
        songTitle: 'Motion Sickness',
        artist: 'Phoebe Bridgers',
        albumArt: 'https://images.unsplash.com/photo-1616663395403-2e0052b8e595?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxhbGJ1bSUyMGNvdmVyJTIwdmlueWx8ZW58MXx8fHwxNzcwODEwMjE3fDA&ixlib=rb-4.1.0&q=80&w=1080',
        spotifyUrl: 'https://open.spotify.com/track/example3',
      },
    ],
  },
  {
    id: 'electronic',
    name: 'ELECTRONIC / SYNTH',
    color: 'from-blue-400 to-cyan-400',
    songs: [
      {
        id: 'electronic-1',
        songTitle: 'Midnight City',
        artist: 'M83',
        albumArt: 'https://images.unsplash.com/photo-1551288449-085e5252e44e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxlbGVjdHJvbmljJTIwbXVzaWMlMjBhcnR3b3JrfGVufDF8fHx8MTc3MDg1OTI3OXww&ixlib=rb-4.1.0&q=80&w=1080',
        spotifyUrl: 'https://open.spotify.com/track/example4',
      },
      {
        id: 'electronic-2',
        songTitle: 'Outro',
        artist: 'M83',
        albumArt: 'https://images.unsplash.com/photo-1551288449-085e5252e44e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxlbGVjdHJvbmljJTIwbXVzaWMlMjBhcnR3b3JrfGVufDF8fHx8MTc3MDg1OTI3OXww&ixlib=rb-4.1.0&q=80&w=1080',
        spotifyUrl: 'https://open.spotify.com/track/example5',
      },
    ],
  },
  {
    id: 'jazz',
    name: 'JAZZ / BLUES',
    color: 'from-yellow-400 to-orange-400',
    songs: [
      {
        id: 'jazz-1',
        songTitle: 'Blue in Green',
        artist: 'Miles Davis',
        albumArt: 'https://images.unsplash.com/photo-1681148773098-1460911e25a4?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxqYXp6JTIwbXVzaWMlMjByZWNvcmR8ZW58MXx8fHwxNzcwODU5MjgwfDA&ixlib=rb-4.1.0&q=80&w=1080',
        spotifyUrl: 'https://open.spotify.com/track/example6',
      },
      {
        id: 'jazz-2',
        songTitle: 'So What',
        artist: 'Miles Davis',
        albumArt: 'https://images.unsplash.com/photo-1681148773098-1460911e25a4?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxqYXp6JTIwbXVzaWMlMjByZWNvcmR8ZW58MXx8fHwxNzcwODU5MjgwfDA&ixlib=rb-4.1.0&q=80&w=1080',
        spotifyUrl: 'https://open.spotify.com/track/example7',
      },
    ],
  },
  {
    id: 'bedroom-pop',
    name: 'BEDROOM POP / LO-FI',
    color: 'from-green-400 to-teal-400',
    songs: [
      {
        id: 'bedroom-1',
        songTitle: 'Apocalypse',
        artist: 'Cigarettes After Sex',
        albumArt: 'https://images.unsplash.com/photo-1587731556938-38755b4803a6?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxpbmRpZSUyMG11c2ljJTIwYWxidW18ZW58MXx8fHwxNzcwODU5Mjc4fDA&ixlib=rb-4.1.0&q=80&w=1080',
        spotifyUrl: 'https://open.spotify.com/track/example8',
      },
      {
        id: 'bedroom-2',
        songTitle: 'Pink + White',
        artist: 'Frank Ocean',
        albumArt: 'https://images.unsplash.com/photo-1616663395403-2e0052b8e595?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxhbGJ1bSUyMGNvdmVyJTIwdmlueWx8ZW58MXx8fHwxNzcwODEwMjE3fDA&ixlib=rb-4.1.0&q=80&w=1080',
        spotifyUrl: 'https://open.spotify.com/track/example9',
      },
    ],
  },
];
