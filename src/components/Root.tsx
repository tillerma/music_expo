import { Outlet, Link, useLocation } from 'react-router';
import { Home, Compass, Music, User } from 'lucide-react';

export function Root() {
  const location = useLocation();

  const isMusicMap = location.pathname.startsWith('/explore');

  const navItems = [
    { path: '/', icon: Home, label: 'Feed' },
    { path: '/explore', icon: Compass, label: 'Music Map' },
    { path: '/playlists', icon: Music, label: 'Playlists' },
    { path: '/profile/musiclover', icon: User, label: 'Profile' },
  ];

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  return (
    <div
      className={`bg-white text-black ${
        isMusicMap ? 'h-screen overflow-hidden' : 'min-h-screen'
      }`}
    >
      {/* CONTENT */}
      <div
        className={`max-w-2xl mx-auto ${
          isMusicMap ? 'h-full flex flex-col' : 'pb-20'
        }`}
      >
        <Outlet />
      </div>

      {/* NAVBAR */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t-4 border-black h-16">
        <div className="max-w-2xl mx-auto flex justify-around items-center h-full px-4">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path);

            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex flex-col items-center gap-1 ${
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
    </div>
  );
}