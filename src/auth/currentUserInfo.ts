import type { User } from '../types';
import { getAppCurrentUser } from '../data/authUser';

// Proxy so that every property access reflects whoever is currently logged in.
// Reading currentUser.username (or any other field) always pulls fresh data
// from localStorage, so the value stays correct across login/logout without
// requiring a page reload or re-import of this module.
export const currentUser = new Proxy({} as User, {
  get(_target, prop: string) {
    return getAppCurrentUser()[prop as keyof User];
  },
});
