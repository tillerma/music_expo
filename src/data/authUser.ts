import type { User } from '../types';
import { allUsers } from './allUsers';

/**
 * Returns the currently logged-in user's profile.
 *
 * Priority:
 *  1. Supabase profile cached in localStorage at login (app_current_user)
 *  2. ID stored from the old mock-data flow (app_current_user_id → allUsers lookup)
 *  3. Fallback to the first mock user so the app never crashes
 */
export function getAppCurrentUser(): User {
  try {
    const cached = window.localStorage.getItem('app_current_user');
    if (cached) {
      const data = JSON.parse(cached);
      return {
        id: data.id,
        username: data.username,
        displayName: data.display_name || data.username,
        bio: data.bio || '',
        avatarUrl: data.avatar_url || '',
        followers: data.followers ?? 0,
        following: data.following ?? 0,
      } as User;
    }

    const storedId = window.localStorage.getItem('app_current_user_id');
    if (storedId) {
      const found = allUsers.find(u => u.id === storedId || u.username === storedId);
      if (found) return found;
    }

    return allUsers[0];
  } catch {
    return allUsers[0];
  }
}

export function setAppCurrentUserId(id: string) {
  try {
    window.localStorage.setItem('app_current_user_id', id);
  } catch {
    // ignore in non-browser environments
  }
}
