import type { User } from '../types';
import { allUsers } from './allUsers';


export function getAppCurrentUser(): User {
  try {
    const stored = window.localStorage.getItem('app_current_user_id');
    if (stored) {
      const found = allUsers.find(u => u.id === stored || u.username === stored);
      if (found) return found;
    }

    const pending = sessionStorage.getItem('pending_spotify_profile');
    if (pending) {
      const sp = JSON.parse(pending) as any;
      return {
        id: sp.id,
        username: sp.id,
        displayName: sp.display_name || sp.id,
        bio: '',
        avatarUrl: sp.images && sp.images[0] ? sp.images[0].url : '',
        followers: 0,
        following: 0,
      } as User;
    }

    // Fallback to the first user in allUsers
    return allUsers[0];
  } catch (err) {
    // In non-browser contexts, localStorage may be unavailable — fallback
    return allUsers[0];
  }
}


export function setAppCurrentUserId(id: string) {
  try {
    window.localStorage.setItem('app_current_user_id', id);
  } catch (err) {
    // ignore
  }
}
