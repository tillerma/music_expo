import { User } from '../types';
import { users } from './mockData';

export interface UserMapPosition {
  user: User;
  x: number; // -100 to 100 (left to right)
  y: number; // -100 to 100 (bottom to top)
  songToday: {
    songTitle: string;
    artist: string;
    genre: string;
  };
}

export const userMapPositions: UserMapPosition[] = [
  {
    user: users[1], // Maya Rodriguez
    x: -65,
    y: 45,
    songToday: {
      songTitle: 'Seventeen',
      artist: 'Sharon Van Etten',
      genre: 'Indie Folk',
    },
  },
  {
    user: users[2], // Jordan Kim
    x: -50,
    y: 30,
    songToday: {
      songTitle: 'Re: Stacks',
      artist: 'Bon Iver',
      genre: 'Indie Folk',
    },
  },
  {
    user: users[3], // Sam Taylor
    x: 60,
    y: -40,
    songToday: {
      songTitle: 'Midnight City',
      artist: 'M83',
      genre: 'Synth Pop',
    },
  },
  {
    user: users[0], // Current User
    x: -30,
    y: 15,
    songToday: {
      songTitle: 'Holocene',
      artist: 'Bon Iver',
      genre: 'Indie Folk',
    },
  },
  // Additional users for more variety
  {
    user: {
      id: 'user-5',
      username: 'jazzlover',
      displayName: 'Nina Simone Fan',
      bio: 'jazz is life',
      avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx3b21hbiUyMHBvcnRyYWl0JTIwc21pbGV8ZW58MXx8fHwxNzcwODU5MjgyfDA&ixlib=rb-4.1.0&q=80&w=1080',
      followers: 145,
      following: 89,
    },
    x: -20,
    y: -65,
    songToday: {
      songTitle: 'Blue in Green',
      artist: 'Miles Davis',
      genre: 'Jazz',
    },
  },
  {
    user: {
      id: 'user-6',
      username: 'synthwave99',
      displayName: 'Retro Future',
      bio: 'living in 1984',
      avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtYW4lMjBwb3J0cmFpdCUyMGNhc3VhbHxlbnwxfHx8fDE3NzA4NTkyODJ8MA&ixlib=rb-4.1.0&q=80&w=1080',
      followers: 298,
      following: 156,
    },
    x: 75,
    y: -55,
    songToday: {
      songTitle: 'Outro',
      artist: 'M83',
      genre: 'Synth Pop',
    },
  },
  {
    user: {
      id: 'user-7',
      username: 'bedroom_pop',
      displayName: 'Lola Martinez',
      bio: 'soft sounds for soft souls',
      avatarUrl: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx3b21hbiUyMHBvcnRyYWl0JTIweW91bmd8ZW58MXx8fHwxNzcwODU5MjgzfDA&ixlib=rb-4.1.0&q=80&w=1080',
      followers: 423,
      following: 302,
    },
    x: -75,
    y: 60,
    songToday: {
      songTitle: 'Apocalypse',
      artist: 'Cigarettes After Sex',
      genre: 'Dream Pop',
    },
  },
  {
    user: {
      id: 'user-8',
      username: 'techno_head',
      displayName: 'Marcus Berlin',
      bio: '4/4 forever',
      avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtYW4lMjBwb3J0cmFpdCUyMGJlYXJkfGVufDF8fHx8MTc3MDg1OTI4M3ww&ixlib=rb-4.1.0&q=80&w=1080',
      followers: 567,
      following: 234,
    },
    x: 85,
    y: 20,
    songToday: {
      songTitle: 'Windowlicker',
      artist: 'Aphex Twin',
      genre: 'Electronic',
    },
  },
];
