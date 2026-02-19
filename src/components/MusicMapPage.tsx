import { useState } from 'react';
import { useNavigate } from 'react-router';
import { userMapPositions, UserMapPosition } from '../data/musicMapData';
import { allUsers } from '../data/allUsers';
import { currentUser } from '../data/mockData';
import { Menu, X, Search, Check, Square } from 'lucide-react';
import { User } from '../types';

export function MusicMapPage() {
  const navigate = useNavigate();
  const [selectedUser, setSelectedUser] = useState<UserMapPosition | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [followedUsers, setFollowedUsers] = useState<Set<string>>(
    new Set(allUsers.filter(u => u.followedByCurrentUser).map(u => u.id))
  );
  const [pendingRequests, setPendingRequests] = useState<Set<string>>(new Set());

  const handleUserClick = (userPos: UserMapPosition) => {
    setSelectedUser(userPos);
  };

  const handleVisitProfile = () => {
    if (selectedUser) {
      navigate(`/profile/${selectedUser.user.username}`);
      setSelectedUser(null);
    }
  };

  const handleToggleFollow = (userId: string) => {
    if (userId === currentUser.id) return; // Can't follow yourself
    
    const newFollowed = new Set(followedUsers);
    const newPending = new Set(pendingRequests);
    
    if (followedUsers.has(userId)) {
      // Unfollow
      newFollowed.delete(userId);
      setFollowedUsers(newFollowed);
    } else {
      // Send follow request
      newPending.add(userId);
      setPendingRequests(newPending);
      
      // Simulate request being sent (in real app, would be async)
      setTimeout(() => {
        newPending.delete(userId);
        newFollowed.add(userId);
        setPendingRequests(new Set(newPending));
        setFollowedUsers(new Set(newFollowed));
      }, 500);
    }
  };

  // Convert position from -100 to 100 range to percentage
  const convertToPercentage = (value: number) => {
    return ((value + 100) / 200) * 100;
  };

  // Filter users based on search
  const filteredUsers = allUsers.filter(user =>
    user.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.displayName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-white flex">
      {/* Side Menu */}
      <div
        className={`fixed left-0 top-0 bottom-0 bg-white border-r-4 border-black z-20 transition-all duration-300 overflow-y-auto ${
          menuOpen ? 'w-80' : 'w-0'
        }`}
      >
        {menuOpen && (
          <div className="p-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-bold text-lg">USERS</h2>
              <button
                onClick={() => setMenuOpen(false)}
                className="p-2 hover:bg-gray-100 border-2 border-black"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Search Bar */}
            <div className="mb-4 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                type="text"
                placeholder="Search users..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-yellow-100 border-2 border-black pl-10 pr-4 py-2 focus:outline-none focus:border-purple-500"
              />
            </div>

            {/* User List */}
            <div className="space-y-2">
              {filteredUsers.map((user) => {
                const isCurrentUser = user.id === currentUser.id;
                const isFollowed = followedUsers.has(user.id);
                const isPending = pendingRequests.has(user.id);

                return (
                  <div
                    key={user.id}
                    className="flex items-center gap-3 p-2 bg-gradient-to-r from-blue-50 to-purple-50 border-2 border-black hover:translate-x-0.5 hover:translate-y-0.5 transition-transform"
                  >
                    <img
                      src={user.avatarUrl}
                      alt={user.username}
                      className="w-10 h-10 border-2 border-black object-cover"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm truncate">
                        {user.displayName}
                        {isCurrentUser && <span className="text-purple-600"> (You)</span>}
                      </p>
                      <p className="text-xs text-gray-600 truncate">@{user.username}</p>
                    </div>
                    <button
                      onClick={() => handleToggleFollow(user.id)}
                      disabled={isCurrentUser || isPending}
                      className={`p-1.5 border-2 border-black transition-colors ${
                        isCurrentUser
                          ? 'bg-gray-200 cursor-not-allowed'
                          : isPending
                          ? 'bg-yellow-300 cursor-wait'
                          : isFollowed
                          ? 'bg-gradient-to-r from-green-400 to-blue-400 hover:from-green-500 hover:to-blue-500'
                          : 'bg-white hover:bg-gray-100'
                      }`}
                      title={
                        isCurrentUser
                          ? "That's you!"
                          : isPending
                          ? 'Sending request...'
                          : isFollowed
                          ? 'Following'
                          : 'Follow'
                      }
                    >
                      {isPending ? (
                        <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                      ) : isFollowed ? (
                        <Check className="w-4 h-4" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="flex-1">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b-4 border-black z-10">
          <div className="px-4 py-4 flex items-center gap-4">
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="p-2 bg-gradient-to-r from-purple-400 to-pink-400 border-2 border-black hover:translate-x-0.5 hover:translate-y-0.5 transition-transform"
            >
              <Menu className="w-5 h-5 text-white" />
            </button>
            <div>
              <h1 className="text-xl font-bold">MUSIC MAP</h1>
              <p className="text-sm text-gray-600">Users mapped by today's song similarity</p>
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="px-4 py-3 bg-gradient-to-r from-pink-100 to-blue-100 border-b-2 border-black">
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-gradient-to-r from-purple-400 to-pink-400 border border-black"></div>
              <span className="font-bold">MELLOW / EMOTIONAL</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-gradient-to-r from-blue-400 to-cyan-400 border border-black"></div>
              <span className="font-bold">ENERGETIC / UPBEAT</span>
            </div>
          </div>
          <p className="text-xs text-gray-700 mt-2 font-medium">
            Vertical axis: ACOUSTIC (bottom) ↔ ELECTRONIC (top)<br />
            Horizontal axis: MELLOW (left) ↔ ENERGETIC (right)
          </p>
        </div>

        {/* Map Container */}
        <div className="p-4">
          <div className="relative w-full aspect-square bg-gradient-to-br from-yellow-50 via-pink-50 to-blue-50 border-4 border-black">
            {/* Quadrant Lines */}
            <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-black opacity-30"></div>
            <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-black opacity-30"></div>

            {/* Quadrant Labels */}
            <div className="absolute top-2 left-2 text-xs font-bold text-gray-600 bg-white/80 px-2 py-1 border border-black">
              MELLOW<br/>ELECTRONIC
            </div>
            <div className="absolute top-2 right-2 text-xs font-bold text-gray-600 bg-white/80 px-2 py-1 border border-black text-right">
              ENERGETIC<br/>ELECTRONIC
            </div>
            <div className="absolute bottom-2 left-2 text-xs font-bold text-gray-600 bg-white/80 px-2 py-1 border border-black">
              MELLOW<br/>ACOUSTIC
            </div>
            <div className="absolute bottom-2 right-2 text-xs font-bold text-gray-600 bg-white/80 px-2 py-1 border border-black text-right">
              ENERGETIC<br/>ACOUSTIC
            </div>

            {/* User Positions */}
            {userMapPositions.map((userPos) => {
              const leftPercent = convertToPercentage(userPos.x);
              const bottomPercent = convertToPercentage(userPos.y);
              const isSelected = selectedUser?.user.id === userPos.user.id;
              const isCurrentUser = userPos.user.id === 'user-1';

              return (
                <button
                  key={userPos.user.id}
                  onClick={() => handleUserClick(userPos)}
                  className={`absolute transform -translate-x-1/2 -translate-y-1/2 transition-all ${
                    isSelected ? 'z-20 scale-125' : 'z-10 hover:scale-110'
                  }`}
                  style={{
                    left: `${leftPercent}%`,
                    bottom: `${bottomPercent}%`,
                  }}
                >
                  <div className={`relative ${isSelected ? 'ring-4 ring-yellow-400' : ''}`}>
                    {/* Rainbow border for current user */}
                    {isCurrentUser && (
                      <div className="absolute inset-0 -m-1 rounded-none animate-pulse">
                        <div className="absolute inset-0 bg-gradient-to-r from-red-500 via-yellow-500 to-green-500"></div>
                        <div className="absolute inset-0 bg-gradient-to-r from-green-500 via-blue-500 to-purple-500 animate-spin" style={{ animationDuration: '3s' }}></div>
                      </div>
                    )}
                    <img
                      src={userPos.user.avatarUrl}
                      alt={userPos.user.username}
                      className={`border-3 border-black object-cover shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] relative ${
                        isSelected ? 'w-16 h-16' : 'w-12 h-12'
                      } ${isCurrentUser ? 'ring-4 ring-offset-2 ring-purple-500' : ''}`}
                      style={isCurrentUser ? {
                        boxShadow: '0 0 0 3px rgba(255,255,255,1), 0 0 0 6px rgba(147,51,234,1), 0 0 20px rgba(147,51,234,0.5)'
                      } : undefined}
                    />
                    {isSelected && (
                      <div className="absolute -top-1 -right-1 w-4 h-4 bg-gradient-to-r from-purple-500 to-pink-500 border-2 border-black animate-pulse"></div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Map Instructions */}
          <div className="mt-4 p-3 bg-gradient-to-r from-blue-100 to-purple-100 border-2 border-black">
            <p className="text-xs font-bold text-black">
              💡 TAP A USER TO SEE THEIR TODAY'S SONG • 
              <span className="ml-2">🌈 RAINBOW BORDER = YOU</span>
            </p>
          </div>
        </div>
      </div>

      {/* Selected User Modal */}
      {selectedUser && (
        <div
          className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedUser(null)}
        >
          <div
            className="bg-white border-4 border-black p-6 w-full max-w-md shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* User Info */}
            <div className="flex items-center gap-4 mb-4 pb-4 border-b-2 border-black">
              <img
                src={selectedUser.user.avatarUrl}
                alt={selectedUser.user.username}
                className="w-16 h-16 border-2 border-black object-cover shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]"
              />
              <div className="flex-1">
                <h2 className="text-lg font-bold">{selectedUser.user.displayName}</h2>
                <p className="text-sm text-gray-600">@{selectedUser.user.username}</p>
                <p className="text-xs text-gray-600 mt-1">{selectedUser.user.bio}</p>
              </div>
            </div>

            {/* Today's Song */}
            <div className="mb-4">
              <p className="text-xs font-bold text-gray-600 mb-2">TODAY'S SONG:</p>
              <div className="bg-gradient-to-r from-blue-100 to-purple-100 border-2 border-black p-3">
                <p className="font-bold text-black">{selectedUser.songToday.songTitle}</p>
                <p className="text-sm text-gray-700">{selectedUser.songToday.artist}</p>
                <p className="text-xs text-gray-600 mt-1 font-medium">Genre: {selectedUser.songToday.genre}</p>
              </div>
            </div>

            {/* Position Info */}
            <div className="mb-4 p-3 bg-yellow-100 border-2 border-black">
              <p className="text-xs font-bold mb-1">MAP POSITION:</p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="font-bold">Energy: </span>
                  <span>{selectedUser.x > 0 ? 'Energetic' : 'Mellow'}</span>
                </div>
                <div>
                  <span className="font-bold">Sound: </span>
                  <span>{selectedUser.y > 0 ? 'Electronic' : 'Acoustic'}</span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <button
                onClick={() => setSelectedUser(null)}
                className="flex-1 bg-gray-200 border-2 border-black px-4 py-2 font-bold hover:bg-gray-300 transition-colors"
              >
                CLOSE
              </button>
              <button
                onClick={handleVisitProfile}
                className="flex-1 bg-gradient-to-r from-purple-500 to-pink-500 text-white border-2 border-black px-4 py-2 font-bold hover:translate-x-0.5 hover:translate-y-0.5 transition-transform"
              >
                VIEW PROFILE
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
