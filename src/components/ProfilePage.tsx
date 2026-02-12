import { useState } from 'react';
import { currentUser, generateCalendarPosts } from '../data/mockData';
import { SongPost } from '../types';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export function ProfilePage() {
  const [selectedPost, setSelectedPost] = useState<SongPost | null>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date('2026-02-01'));
  const calendarPosts = generateCalendarPosts();

  const getPostForDate = (dateStr: string) => {
    return calendarPosts.find(p => p.date === dateStr);
  };

  const generateCalendarDays = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days = [];
    
    // Add empty cells for days before the month starts
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }
    
    // Add days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      const dateStr = date.toISOString().split('T')[0];
      const post = getPostForDate(dateStr);
      days.push({ day, dateStr, post });
    }
    
    return days;
  };

  const previousMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  const monthName = currentMonth.toLocaleString('default', { month: 'long', year: 'numeric' });
  const calendarDays = generateCalendarDays();

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="px-4 py-6 border-b-4 border-black bg-gradient-to-r from-pink-200 to-blue-200">
        <div className="flex items-center gap-4 mb-4">
          <img
            src={currentUser.avatarUrl}
            alt={currentUser.username}
            className="w-20 h-20 border-4 border-black object-cover shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
          />
          <div className="flex-1">
            <h1 className="text-xl font-bold">{currentUser.displayName}</h1>
            <p className="text-gray-700 font-medium">@{currentUser.username}</p>
          </div>
        </div>
        
        <p className="text-black mb-4">{currentUser.bio}</p>
        
        <div className="flex gap-6 text-sm">
          <div>
            <span className="font-bold">{currentUser.followers}</span>
            <span className="text-gray-700 ml-1">FOLLOWERS</span>
          </div>
          <div>
            <span className="font-bold">{currentUser.following}</span>
            <span className="text-gray-700 ml-1">FOLLOWING</span>
          </div>
        </div>
      </div>

      {/* Calendar View */}
      <div className="px-4 py-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">LISTENING HISTORY</h2>
          <div className="flex items-center gap-2 border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
            <button
              onClick={previousMonth}
              className="p-2 hover:bg-gray-100 transition-colors border-r-2 border-black"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <span className="text-sm font-bold min-w-[140px] text-center px-2">
              {monthName.toUpperCase()}
            </span>
            <button
              onClick={nextMonth}
              className="p-2 hover:bg-gray-100 transition-colors border-l-2 border-black"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7 gap-2 mb-2">
          {['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'].map(day => (
            <div key={day} className="text-center text-xs text-gray-600 py-2 font-bold">
              {day}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-2">
          {calendarDays.map((item, i) => {
            if (!item) {
              return <div key={`empty-${i}`} className="aspect-square" />;
            }
            
            const { day, post } = item;
            const isToday = item.dateStr === '2026-02-12';
            
            return (
              <button
                key={item.dateStr}
                onClick={() => post && setSelectedPost(post)}
                className={`aspect-square overflow-hidden border-2 border-black transition-all ${
                  post
                    ? 'hover:scale-105 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]'
                    : 'border-dashed border-gray-400'
                } ${isToday ? 'ring-4 ring-yellow-400' : ''}`}
              >
                {post ? (
                  <img
                    src={post.albumArt}
                    alt={post.songTitle}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-xs text-gray-400 font-bold">
                    {day}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected Post Modal */}
      {selectedPost && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedPost(null)}
        >
          <div
            className="bg-white border-4 border-black p-6 w-full max-w-md shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 mb-4 text-sm">
              <span className="font-bold text-black">{new Date(selectedPost.date).toLocaleDateString('default', {
                month: 'long',
                day: 'numeric',
                year: 'numeric'
              }).toUpperCase()}</span>
            </div>
            
            <div className="flex gap-4 mb-4">
              <img
                src={selectedPost.albumArt}
                alt={selectedPost.songTitle}
                className="w-32 h-32 border-2 border-black object-cover shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
              />
              <div className="flex flex-col justify-center">
                <p className="font-bold mb-1 text-black">{selectedPost.songTitle}</p>
                <p className="text-sm text-gray-600 mb-3 font-medium">{selectedPost.artist}</p>
                <a
                  href={selectedPost.spotifyUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-600 hover:text-blue-800 font-bold underline"
                >
                  OPEN IN SPOTIFY
                </a>
              </div>
            </div>
            
            <p className="text-black mb-4">{selectedPost.caption}</p>
            
            {selectedPost.reactions.length > 0 && (
              <div className="mb-4">
                <p className="text-xs text-gray-600 mb-2 font-bold">REACTIONS:</p>
                <div className="flex gap-2 flex-wrap">
                  {selectedPost.reactions.map((reaction, i) => (
                    <div
                      key={i}
                      className="bg-gradient-to-r from-yellow-300 to-pink-300 border-2 border-black px-3 py-1 text-sm shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                    >
                      {reaction.emoji}
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            <button
              onClick={() => setSelectedPost(null)}
              className="w-full bg-gray-200 border-2 border-black px-4 py-2 font-bold hover:bg-gray-300 transition-colors"
            >
              CLOSE
            </button>
          </div>
        </div>
      )}
    </div>
  );
}