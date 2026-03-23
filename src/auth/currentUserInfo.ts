import { User } from '../types';

// ******* TODO: FILL username WITH SPOTIFY API INFO *******
// ******* TODO: POPULATE OTHER FIELDS FROM SUPABASE QUERY USING username *******

export const currentUser: User = {
  id: 'user-1',
  username: 'ishanid', // ONLY this field will be from spotify api
  displayName: 'Ishani Das',
  bio: 'hii',
  avatarUrl: 'https://media.licdn.com/dms/image/v2/D4E03AQFYw95QGARgUQ/profile-displayphoto-shrink_200_200/B4EZZJPyMbG0AY-/0/1744985597494?e=2147483647&v=beta&t=NFMU-8Bjl-StR8gCeLQ9GQj7skGhsemq_VbQxAkOOi0',
  followers: 0,
  following: 0,
};