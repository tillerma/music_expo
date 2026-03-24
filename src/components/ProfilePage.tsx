import { useState, useEffect } from 'react';
import { currentUser } from '../auth/currentUserInfo';
import { /*currentUser, */generateCalendarPosts, initialFollowRequests } from '../data/mockData';
import { SongPost, FollowRequest } from '../types';
import { ChevronLeft, ChevronRight, Bell, X, Check } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useParams } from 'react-router-dom';

export function ProfilePage() {
  const [selectedPost, setSelectedPost] = useState<SongPost | null>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [showNotifications, setShowNotifications] = useState(false);
  const [followRequests, setFollowRequests] = useState<FollowRequest[]>(initialFollowRequests);
  // const calendarPosts = generateCalendarPosts();
  const [calendarPosts, setCalendarPosts] = useState<SongPost[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const { username } = useParams();
  const [profileUser, setProfileUser] = useState(null);

  console.log(username);

  const getPostForDate = (dateStr: string) => {
    return calendarPosts.find(p => p.date === dateStr);
  };

  useEffect(() => {
    async function fetchData() {
      if (!username) return;

      // 🔹 Step 1: get the profile user
      const { data: userData, error: userError } = await supabase
        .from("profiles")
        .select("*")
        .eq("username", username)
        .single();

      if (userError || !userData) {
        console.error("Error fetching profile user:", userError);
        return;
      }

      setProfileUser(userData);

      // 🔹 Step 2: fetch posts for THAT user
      const startOfMonth = new Date(
        currentMonth.getFullYear(),
        currentMonth.getMonth(),
        1
      );
      const startOfNextMonth = new Date(
        currentMonth.getFullYear(),
        currentMonth.getMonth() + 1,
        1
      );

      const startOfMonthStr = startOfMonth.toISOString().split("T")[0];
      const startOfNextMonthStr = startOfNextMonth.toISOString().split("T")[0];

      const { data: postsData, error: postsError } = await supabase
        .from("posts")
        .select(`
          id,
          user_id,
          caption,
          post_date,
          created_at,
          song_title,
          artist,
          album_art,
          spotify_url
        `)
        .eq("user_id", userData.id) // 🔥 KEY CHANGE
        .gte("post_date", startOfMonthStr)
        .lt("post_date", startOfNextMonthStr)
        .order("post_date", { ascending: true });

      if (postsError) {
        console.error("Error fetching posts:", postsError);
        return;
      }

      const mappedPosts = (postsData ?? []).map((post) => ({
        id: post.id,
        date: post.post_date,
        caption: post.caption ?? "",
        songTitle: post.song_title ?? "",
        artist: post.artist ?? "",
        albumArt: post.album_art ?? "",
        spotifyUrl: post.spotify_url ?? "",
      }));

      setCalendarPosts(mappedPosts);
    }

    fetchData();
  }, [username, currentMonth]);

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

  const handleRejectRequest = (request: FollowRequest) => {
    setFollowRequests(followRequests.filter(r => r.id !== request.id));
  };

  const handleAcceptRequest = (request: FollowRequest) => {
    // Show follow back option
    const followBack = window.confirm(
      `${request.fromUser.displayName} is now following you! Would you like to follow them back?`
    );
    
    setFollowRequests(followRequests.filter(r => r.id !== request.id));
    
    if (followBack) {
      // In a real app, this would send a follow request
      console.log(`Following back ${request.fromUser.username}`);
    }
  };

  const monthName = currentMonth.toLocaleString('default', { month: 'long', year: 'numeric' });
  const calendarDays = generateCalendarDays();
  const pendingRequests = followRequests.filter(r => r.status === 'pending');

  if (!profileUser) return <div>Loading...</div>;

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="px-4 py-6 border-b-4 border-black bg-gradient-to-r from-pink-200 to-blue-200">
        <div className="flex items-center gap-4 mb-4">
          <img
            src={profileUser?.avatar_url}
            alt={profileUser?.username}
            className="w-20 h-20 border-4 border-black object-cover shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
          />
          <div className="flex-1">
            <h1 className="text-xl font-bold">{profileUser?.displayName}</h1>
            <p className="text-gray-700 font-medium">@{profileUser?.username}</p>
          </div>
        </div>
        
        <p className="text-black mb-4">{profileUser?.bio}</p>
        
        <div className="flex gap-6 text-sm">
          <div>
            <span className="font-bold">{profileUser?.followers}</span>
            <span className="text-gray-700 ml-1">FOLLOWERS</span>
          </div>
          <div>
            <span className="font-bold">{profileUser?.following}</span>
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
            
            {/* {selectedPost.reactions.length > 0 && (
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
            )} */}
            
            <button
              onClick={() => setSelectedPost(null)}
              className="w-full bg-gray-200 border-2 border-black px-4 py-2 font-bold hover:bg-gray-300 transition-colors"
            >
              CLOSE
            </button>
          </div>
        </div>
      )}

      {/* Notifications */}
      <button
        onClick={() => setShowNotifications(!showNotifications)}
        className="fixed top-4 right-4 z-50 p-3 bg-gradient-to-r from-purple-400 to-pink-400 border-2 border-black hover:translate-x-0.5 hover:translate-y-0.5 transition-transform shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]"
      >
        <Bell className="w-5 h-5 text-white" />
        {pendingRequests.length > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 border-2 border-black text-white text-xs font-bold flex items-center justify-center">
            {pendingRequests.length}
          </span>
        )}
      </button>

      {showNotifications && (
        <div className="fixed top-16 right-4 z-50 bg-white border-4 border-black p-4 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] max-w-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold">NOTIFICATIONS</h3>
            <button
              onClick={() => setShowNotifications(false)}
              className="p-1 hover:bg-gray-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {pendingRequests.length > 0 ? (
            pendingRequests.map((request, i) => (
              <div key={i} className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <img
                    src={request.fromUser.avatar_url}
                    alt={request.fromUser.username}
                    className="w-10 h-10 border-2 border-black object-cover shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
                  />
                  <div className="flex flex-col">
                    <p className="font-bold text-black">{request.fromUser.displayName}</p>
                    <p className="text-sm text-gray-600 font-medium">@{request.fromUser.username}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleRejectRequest(request)}
                    className="p-1 bg-gray-200 border-2 border-black text-sm font-bold hover:bg-gray-300 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleAcceptRequest(request)}
                    className="p-1 bg-green-200 border-2 border-black text-sm font-bold hover:bg-green-300 transition-colors"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          ) : (
            <p className="text-gray-600 text-sm">No new notifications</p>
          )}
        </div>
      )}
    </div>
  );
}