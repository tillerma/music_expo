import { Outlet, Link, useLocation, Navigate } from 'react-router';
import { Home, Compass, Music, User } from 'lucide-react';
import { isLoggedIn } from '../utils/spotifyAuth';

const PUBLIC_PATHS = ['/login', '/create-account'];
import { currentUser } from '../auth/currentUserInfo';

export function Root() {
  const location = useLocation();

  const navItems = [
    { path: '/', icon: Home, label: 'Feed' },
    { path: '/explore', icon: Compass, label: 'Music Map' },
    { path: '/playlists', icon: Music, label: 'Playlists' },
    { path: `/profile/${currentUser.username}`, icon: User, label: 'Profile' },
  ];

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  const loggedIn = isLoggedIn();
  const isPublic = PUBLIC_PATHS.some(p => location.pathname.startsWith(p));

  // Redirect unauthenticated users to login for any protected route
  if (!loggedIn && !isPublic) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className={location.pathname === '/login' ? 'min-h-screen bg-black text-white' : 'min-h-screen bg-white text-black'}>
      <div className="max-w-2xl mx-auto pb-20">
        <Outlet />
      </div>

      {/* Bottom nav only shown when logged in and not on auth pages */}
      {loggedIn && !isPublic && (
        <nav className="fixed bottom-0 left-0 right-0 bg-white border-t-4 border-black">
          <div className="max-w-2xl mx-auto flex justify-around items-center h-16 px-4">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.path);
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex flex-col items-center gap-1 transition-colors ${
                    active ? 'text-black' : 'text-gray-400'
                  }`}
                >
                  <Icon className="w-6 h-6" strokeWidth={active ? 2.5 : 2} />
                  <span className="text-xs font-medium">{item.label}</span>
                </Link>
              );
            })}
          </div>
        </nav>
      )}
    </div>
  );
}
