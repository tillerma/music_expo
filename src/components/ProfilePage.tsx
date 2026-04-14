import { useState, useEffect, useRef } from 'react';
import { UserAvatar } from './UserAvatar';
import { currentUser } from '../auth/currentUserInfo';
import { /*currentUser, */generateCalendarPosts } from '../data/mockData';
import { SongPost } from '../types';
import { ChevronLeft, ChevronRight, Pencil, Menu, X, Search, Bell, Plus } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useParams, Link } from 'react-router-dom';
import { toLocalDateString, formatLocalDateFromYMD } from '../utils/date';
import { searchTracks } from '../api/spotify';
import { getTrackTopTags, LastFmTag } from '../api/lastfm';

// Vivid rainbow colours that cycle across the user list
const RAINBOW = [
  '#ef4444', '#f97316', '#eab308', '#16a34a',
  '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899',
  '#7c3aed', '#10b981', '#f59e0b', '#0ea5e9',
];

type UserEntry = { id: string; username: string; display_name: string | null; avatar_url: string | null };

function UserDirectoryPanel({ onClose }: { onClose: () => void }) {
  const [users, setUsers] = useState<UserEntry[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url')
      .order('display_name', { ascending: true })
      .then(({ data }) => { setUsers(data ?? []); setLoading(false); });
    setTimeout(() => inputRef.current?.focus(), 150);
  }, []);

  const filtered = query.trim()
    ? users.filter(u =>
        (u.display_name ?? u.username).toLowerCase().includes(query.toLowerCase()) ||
        u.username.toLowerCase().includes(query.toLowerCase())
      )
    : users;

  return (
    <>
      {/* Backdrop — below nav (z-40 < nav z-50) */}
      <div
        className="fixed inset-0 bg-black/40 z-30"
        onClick={onClose}
      />
      {/* Panel — below nav so nav stays on top */}
      <div className="fixed top-0 left-0 bottom-0 w-72 max-w-[85vw] bg-white border-r-4 border-black z-40 flex flex-col shadow-[6px_0px_0px_0px_rgba(0,0,0,1)]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b-4 border-black bg-gradient-to-r from-purple-200 to-pink-200 flex-shrink-0">
          <div className="flex items-center gap-2">
            <Menu className="w-5 h-5" />
            <span className="font-black text-sm tracking-widest uppercase">Everyone</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-black/10 active:bg-black/20 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search */}
        <div className="px-3 py-2 border-b-2 border-black flex-shrink-0">
          <div className="flex items-center gap-2 border-2 border-black px-2 py-1 bg-yellow-50">
            <Search className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
            <input
              ref={inputRef}
              type="text"
              placeholder="Search..."
              value={query}
              onChange={e => setQuery(e.target.value)}
              className="flex-1 text-sm font-medium bg-transparent focus:outline-none"
            />
            {query && (
              <button onClick={() => setQuery('')} className="text-gray-400 hover:text-black">
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-24 gap-2">
              <div className="w-4 h-4 border-4 border-black border-t-transparent rounded-full animate-spin" />
              <span className="text-xs font-bold">Loading…</span>
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-xs text-gray-400 font-bold text-center py-8">No users found</p>
          ) : (
            filtered.map((user, i) => (
              <Link
                key={user.id}
                to={`/profile/${user.username}`}
                onClick={onClose}
                className="flex items-center gap-3 px-4 py-2.5 border-b border-gray-100 hover:bg-gray-50 active:bg-gray-100 transition-colors"
              >
                <UserAvatar
                  avatarUrl={user.avatar_url}
                  displayName={user.display_name ?? undefined}
                  username={user.username}
                  size={36}
                  className="border-2 border-black flex-shrink-0"
                />
                <div className="min-w-0">
                  <p
                    className="font-black text-sm leading-tight truncate"
                    style={{ color: RAINBOW[i % RAINBOW.length] }}
                  >
                    {user.display_name || user.username}
                  </p>
                  <p className="text-[10px] text-gray-400 font-medium truncate">@{user.username}</p>
                </div>
              </Link>
            ))
          )}
        </div>
      </div>
    </>
  );
}

// ─── Notifications panel ──────────────────────────────────────────────────────

type NotifItem = {
  id: string;
  type: 'comment' | 'reaction';
  timestamp: string;
  actorUsername: string;
  actorDisplayName: string;
  actorAvatarUrl: string | null;
  postId: string;
  postDate: string;
  songTitle: string;
  artist: string;
  albumArt: string | null;
  spotifyUrl: string;
  caption: string;
  emoji?: string;
  commentText?: string;
};

type PostClickInfo = {
  date: string;
  albumArt: string;
  songTitle: string;
  artist: string;
  spotifyUrl: string;
  caption: string;
};

function NotificationsPanel({
  currentUserId,
  onClose,
  onPostClick,
}: {
  currentUserId: string;
  onClose: () => void;
  onPostClick: (info: PostClickInfo) => void;
}) {
  const [notifs, setNotifs] = useState<NotifItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchNotifs() {
      // Always fetch notifications for the logged-in user only
      const { data: posts, error } = await supabase
        .from('posts')
        .select(`
          id, post_date, song_title, artist, album_art, spotify_url, caption,
          comments (
            id, user_id, caption, timestamp,
            profiles!comments_user_id_fkey (
              id, username, display_name, avatar_url
            )
          ),
          reactions (
            id, emoji, user_id, user_name
          )
        `)
        .eq('user_id', currentUserId)
        .order('created_at', { ascending: false });

      if (error || !posts) {
        setLoading(false);
        return;
      }

      const items: NotifItem[] = [];

      for (const post of posts as any[]) {
        const postBase = {
          postId: post.id,
          postDate: post.post_date ?? '',
          songTitle: post.song_title ?? 'Unknown',
          artist: post.artist ?? '',
          albumArt: post.album_art ?? null,
          spotifyUrl: post.spotify_url ?? '',
          caption: post.caption ?? '',
        };

        for (const c of post.comments ?? []) {
          if (c.user_id === currentUserId) continue; // skip own comments
          const prof = c.profiles ?? {};
          items.push({
            ...postBase,
            id: `comment-${c.id}`,
            type: 'comment',
            timestamp: c.timestamp ?? '',
            actorUsername: prof.username ?? c.user_id,
            actorDisplayName: prof.display_name ?? prof.username ?? c.user_id,
            actorAvatarUrl: prof.avatar_url ?? null,
            commentText: c.caption,
          });
        }

        for (const r of post.reactions ?? []) {
          if (r.user_id === currentUserId) continue; // skip own reactions
          items.push({
            ...postBase,
            id: `reaction-${r.id}`,
            type: 'reaction',
            timestamp: '',
            actorUsername: r.user_name ?? r.user_id,
            actorDisplayName: r.user_name ?? r.user_id,
            actorAvatarUrl: null,
            emoji: r.emoji,
          });
        }
      }

      items.sort((a, b) => (b.timestamp > a.timestamp ? 1 : -1));
      setNotifs(items);
      setLoading(false);
    }

    fetchNotifs();
  }, [currentUserId]);

  const fmtDate = (d: string) => {
    if (!d) return '';
    const [y, m, day] = d.split('-');
    return new Date(Number(y), Number(m) - 1, Number(day))
      .toLocaleDateString('default', { month: 'short', day: 'numeric' });
  };

  return (
    <>
      {/* Backdrop — clicking outside closes the panel */}
      <div className="fixed inset-0 bg-black/40 z-30" onClick={onClose} />

      <div className="fixed top-0 left-0 bottom-0 w-80 max-w-[90vw] bg-white border-r-4 border-black z-40 flex flex-col shadow-[6px_0px_0px_0px_rgba(0,0,0,1)]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b-4 border-black bg-gradient-to-r from-purple-200 to-pink-200 flex-shrink-0">
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5" />
            <span className="font-black text-sm tracking-widest uppercase">Notifications</span>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-black/10 active:bg-black/20 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-24 gap-2">
              <div className="w-4 h-4 border-4 border-black border-t-transparent rounded-full animate-spin" />
              <span className="text-xs font-bold">Loading…</span>
            </div>
          ) : notifs.length === 0 ? (
            <p className="text-xs text-gray-400 font-bold text-center py-8">No notifications yet</p>
          ) : (
            notifs.map(n => (
              <div key={n.id} className="flex gap-3 px-4 py-3 border-b border-gray-100 hover:bg-gray-50 transition-colors">
                {/* Actor avatar — links to their profile */}
                <Link to={`/profile/${n.actorUsername}`} onClick={onClose} className="flex-shrink-0">
                  <UserAvatar
                    avatarUrl={n.actorAvatarUrl}
                    displayName={n.actorDisplayName}
                    username={n.actorUsername}
                    size={36}
                    className="border-2 border-black"
                  />
                </Link>

                {/* Body */}
                <div className="flex-1 min-w-0">
                  {/* Who + action */}
                  <p className="text-xs leading-snug">
                    <Link
                      to={`/profile/${n.actorUsername}`}
                      onClick={onClose}
                      className="font-black hover:underline"
                    >
                      {n.actorDisplayName}
                    </Link>
                    {' '}
                    {n.type === 'comment' ? (
                      <span className="text-gray-600">commented on your post</span>
                    ) : (
                      <span className="text-gray-600">reacted {n.emoji} to your post</span>
                    )}
                  </p>

                  {/* Comment text preview */}
                  {n.type === 'comment' && n.commentText && (
                    <p className="text-xs text-gray-500 italic mt-0.5 truncate">"{n.commentText}"</p>
                  )}

                  {/* Song row — clicking opens the calendar post popup */}
                  <button
                    className="flex items-center gap-2 mt-1.5 w-full text-left hover:bg-gray-100 rounded transition-colors"
                    onClick={() => {
                      onPostClick({
                        date: n.postDate,
                        albumArt: n.albumArt ?? '',
                        songTitle: n.songTitle,
                        artist: n.artist,
                        spotifyUrl: n.spotifyUrl,
                        caption: n.caption,
                      });
                    }}
                  >
                    {n.albumArt && (
                      <img
                        src={n.albumArt}
                        alt={n.songTitle}
                        className="w-8 h-8 border border-black object-cover flex-shrink-0"
                      />
                    )}
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold truncate">{n.songTitle}</p>
                      <p className="text-[10px] text-gray-500 truncate">{n.artist} · {fmtDate(n.postDate)}</p>
                    </div>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}

export function ProfilePage() {
  const [selectedPost, setSelectedPost] = useState<SongPost | null>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  // const calendarPosts = generateCalendarPosts();
  const [calendarPosts, setCalendarPosts] = useState<SongPost[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [calendarRefreshKey, setCalendarRefreshKey] = useState(0);
  const { username } = useParams();
  const [profileUser, setProfileUser] = useState(null);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [showDirectory, setShowDirectory] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [editBio, setEditBio] = useState('');
  // const [editAvatarUrl, setEditAvatarUrl] = useState('');
  const [selectedAvatarFile, setSelectedAvatarFile] = useState<File | null>(null);
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const isOwnProfile = username === currentUser.username;

  // Log entry modal state
  const [logModalDate, setLogModalDate] = useState<string | null>(null);
  const [logSearchQuery, setLogSearchQuery] = useState('');
  const [logSearchResults, setLogSearchResults] = useState<any[]>([]);
  const [logIsSearching, setLogIsSearching] = useState(false);
  const [logSelectedTrack, setLogSelectedTrack] = useState<any | null>(null);
  const [logCaption, setLogCaption] = useState('');
  const [logIsPosting, setLogIsPosting] = useState(false);
  const [logPendingTags, setLogPendingTags] = useState<LastFmTag[]>([]);
  const [logFeaturesStatus, setLogFeaturesStatus] = useState<'idle' | 'loading' | 'ok' | 'failed'>('idle');
  const logSearchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

      const startOfMonthStr = toLocalDateString(startOfMonth); // startOfMonth.toISOString().split("T")[0];
      const startOfNextMonthStr = toLocalDateString(startOfNextMonth); // startOfNextMonth.toISOString().split("T")[0];

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
  }, [username, currentMonth, calendarRefreshKey]);

  // ── Log entry helpers ──────────────────────────────────────────────────────

  async function getOrCreateSong({
    spotifyUrl, songTitle, artist, albumArt, tags,
  }: { spotifyUrl: string; songTitle: string; artist: string; albumArt: string; tags?: LastFmTag[] }) {
    const trimmedUrl = spotifyUrl.trim();
    const { data: existingSong, error } = await supabase
      .from('songs').select('id, tags').eq('spotify_url', trimmedUrl).maybeSingle();
    if (error) throw error;
    if (existingSong?.id) {
      if (!existingSong.tags && tags && tags.length > 0) {
        await supabase.from('songs').update({ tags }).eq('id', existingSong.id);
      }
      return existingSong.id;
    }
    const newSongId = crypto.randomUUID();
    const { error: insertError } = await supabase.from('songs').insert({
      id: newSongId, spotify_url: trimmedUrl, song_title: songTitle,
      artist, album_art: albumArt, tags: tags && tags.length > 0 ? tags : null,
    });
    if (insertError) throw insertError;
    return newSongId;
  }

  function handleLogSearchChange(e: React.ChangeEvent<HTMLInputElement>) {
    const query = e.target.value;
    setLogSearchQuery(query);
    setLogSelectedTrack(null);
    if (logSearchDebounceRef.current) clearTimeout(logSearchDebounceRef.current);
    if (!query.trim()) { setLogSearchResults([]); return; }
    logSearchDebounceRef.current = setTimeout(async () => {
      setLogIsSearching(true);
      try {
        const result = await searchTracks(query);
        setLogSearchResults(result.tracks.items.slice(0, 8));
      } catch (err) {
        console.error('Log search failed:', err);
      } finally {
        setLogIsSearching(false);
      }
    }, 400);
  }

  function handleLogSelectTrack(track: any) {
    setLogSelectedTrack(track);
    setLogSearchQuery(`${track.name} — ${track.artists[0]?.name ?? ''}`);
    setLogSearchResults([]);
    setLogFeaturesStatus('loading');
    setLogPendingTags([]);
    getTrackTopTags(track.artists[0]?.name ?? '', track.name).then(tags => {
      setLogPendingTags(tags);
      setLogFeaturesStatus(tags.length > 0 ? 'ok' : 'failed');
    }).catch(() => setLogFeaturesStatus('failed'));
  }

  function handleCloseLogModal() {
    setLogModalDate(null);
    setLogSearchQuery('');
    setLogSearchResults([]);
    setLogSelectedTrack(null);
    setLogPendingTags([]);
    setLogFeaturesStatus('idle');
    setLogCaption('');
  }

  async function handleSaveLogEntry() {
    if (!logSelectedTrack || !logCaption.trim() || !logModalDate) return;
    setLogIsPosting(true);
    try {
      const spotifyUrl = logSelectedTrack.external_urls.spotify;
      const songTitle = logSelectedTrack.name;
      const artist = logSelectedTrack.artists.map((a: { name: string }) => a.name).join(', ');
      const albumArt = logSelectedTrack.album.images[0]?.url ?? 'https://placehold.co/200x200';
      const songId = await getOrCreateSong({ spotifyUrl, songTitle, artist, albumArt, tags: logPendingTags });
      const { error } = await supabase.from('posts').insert({
        id: crypto.randomUUID(),
        user_id: currentUser.id,
        song_id: songId,
        spotify_url: spotifyUrl,
        song_title: songTitle,
        artist,
        album_art: albumArt,
        caption: logCaption.trim(),
        post_date: logModalDate,
        created_at: new Date().toISOString(),
        is_log_entry: true,
      });
      if (error) { console.error('Error saving log entry:', error); return; }
      handleCloseLogModal();
      setCalendarRefreshKey(k => k + 1);
    } catch (err) {
      console.error('handleSaveLogEntry failed:', err);
    } finally {
      setLogIsPosting(false);
    }
  }

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
      const dateStr = toLocalDateString(date); // date.toISOString().split('T')[0];
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

  const handleSaveProfile = async () => {
    if (!profileUser) return;

    setIsSavingProfile(true);

    let avatarUrlToSave = profileUser.avatar_url ?? null;

    try {
      // 1. Upload new avatar if user selected one
      if (selectedAvatarFile) {
        const fileExt = selectedAvatarFile.name.split('.').pop();
        const filePath = `${profileUser.id}/avatar-${Date.now()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(filePath, selectedAvatarFile, {
            cacheControl: '3600',
            upsert: true,
            contentType: selectedAvatarFile.type,
          });

        if (uploadError) {
          throw uploadError;
        }

        const { data: publicUrlData } = supabase.storage
          .from('avatars')
          .getPublicUrl(filePath);

        avatarUrlToSave = publicUrlData.publicUrl;
      }

      // 2. Save profile row
      const { data, error } = await supabase
        .from('profiles')
        .update({
          bio: editBio,
          avatar_url: avatarUrlToSave,
        })
        .eq('id', profileUser.id)
        .select()
        .single();

      if (error) throw error;

      setProfileUser(data);
      setShowEditProfile(false);
    } catch (err) {
      console.error('Error saving profile:', err);
      alert('Could not save profile changes.');
    } finally {
      setIsSavingProfile(false);
    }
  };

  const monthName = currentMonth.toLocaleString('default', { month: 'long', year: 'numeric' });
  const calendarDays = generateCalendarDays();

  if (!profileUser) return <div>Loading...</div>;

  return (
    <div className="min-h-screen bg-white">
      {showDirectory && <UserDirectoryPanel onClose={() => setShowDirectory(false)} />}
      {showNotifications && isOwnProfile && (
        <NotificationsPanel
          currentUserId={currentUser.id}
          onClose={() => setShowNotifications(false)}
          onPostClick={(info) => {
            setSelectedPost({
              id: info.date,
              userId: currentUser.id,
              user: { id: '', username: '', displayName: '', bio: '', avatarUrl: '', followers: 0, following: 0 },
              date: info.date,
              albumArt: info.albumArt,
              songTitle: info.songTitle,
              artist: info.artist,
              spotifyUrl: info.spotifyUrl,
              caption: info.caption,
              reactions: [],
              comments: [],
            } as SongPost);
            setShowNotifications(false);
          }}
        />
      )}

      {/* Floating notifications button — only visible on own profile, above USERS button */}
      {isOwnProfile && (
        <button
          onClick={() => setShowNotifications(true)}
          style={{ position: 'fixed', bottom: '130px', left: '16px', zIndex: 9999 }}
          className="bg-gradient-to-r from-purple-500 to-pink-500 text-white border-2 border-black px-3 py-2 text-xs font-bold shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:translate-x-0.5 hover:translate-y-0.5 transition-transform flex items-center gap-1.5"
        >
          <Bell className="w-3.5 h-3.5" />
          NOTIFS
        </button>
      )}

      {/* Floating users button — bottom-left above nav, mirrors contact button */}
      <button
        onClick={() => setShowDirectory(true)}
        style={{ position: 'fixed', bottom: '80px', left: '16px', zIndex: 9999 }}
        className="bg-gradient-to-r from-purple-500 to-pink-500 text-white border-2 border-black px-3 py-2 text-xs font-bold shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:translate-x-0.5 hover:translate-y-0.5 transition-transform flex items-center gap-1.5"
      >
        <Menu className="w-3.5 h-3.5" />
        USERS
      </button>

      {/* Header */}
      <div className="px-4 py-6 border-b-4 border-black bg-gradient-to-r from-pink-200 to-blue-200">
        <div className="flex items-center gap-4 mb-4">
          <UserAvatar
            avatarUrl={(profileUser as any).avatar_url}
            displayName={(profileUser as any).display_name}
            username={(profileUser as any).username}
            size={80}
            className="border-4 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
          />
          <div className="flex-1">
            <h1 className="text-xl font-bold">{profileUser?.display_name}</h1>
            <p className="text-gray-700 font-medium">@{profileUser?.username}</p>
          </div>
          {isOwnProfile && (
            <button
              // onClick={() => {
              //   setEditBio(profileUser?.bio ?? '');
              //   setEditAvatarUrl(profileUser?.avatar_url ?? '');
              //   setShowEditProfile(true);
              // }}
              onClick={() => {
                setEditBio(profileUser?.bio ?? '');
                setSelectedAvatarFile(null);
                setAvatarPreviewUrl(profileUser?.avatar_url ?? '');
                setShowEditProfile(true);
              }}
              className="flex items-center gap-1 px-3 py-1 border-2 border-black bg-white font-bold text-sm hover:bg-gray-100 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
            >
              <Pencil className="w-3.5 h-3.5" />
              EDIT
            </button>
          )}
        </div>

        <p className="text-black mb-4">{profileUser?.bio}</p>
        
        {/* <div className="flex gap-6 text-sm">
          <div>
            <span className="font-bold">{profileUser?.followers}</span>
            <span className="text-gray-700 ml-1">FOLLOWERS</span>
          </div>
          <div>
            <span className="font-bold">{profileUser?.following}</span>
            <span className="text-gray-700 ml-1">FOLLOWING</span>
          </div>
        </div> */}
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
            const isToday = item.dateStr === toLocalDateString();
            const isPastDay = item.dateStr < toLocalDateString();
            const isLoggable = isOwnProfile && isPastDay && !post;

            return (
              <button
                key={item.dateStr}
                onClick={() => {
                  if (post) setSelectedPost(post);
                  else if (isLoggable) setLogModalDate(item.dateStr);
                }}
                className={`aspect-square overflow-hidden border-2 border-black transition-all ${
                  post
                    ? 'hover:scale-105 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]'
                    : isLoggable
                    ? 'border-dashed border-purple-300 hover:border-purple-500 hover:bg-purple-50 cursor-pointer'
                    : 'border-dashed border-gray-300 cursor-default'
                } ${isToday ? 'ring-4 ring-yellow-400' : ''}`}
              >
                {post ? (
                  <img
                    src={post.albumArt}
                    alt={post.songTitle}
                    className="w-full h-full object-cover"
                  />
                ) : isLoggable ? (
                  <div className="w-full h-full flex flex-col items-center justify-center gap-0.5">
                    <Plus className="w-3 h-3 text-purple-400" />
                    <span className="text-[10px] text-purple-400 font-bold">{day}</span>
                  </div>
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-xs text-gray-300 font-bold">
                    {day}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Log Entry Modal */}
      {logModalDate && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={handleCloseLogModal}>
          <div className="bg-white border-4 border-black p-6 w-full max-w-md shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]" onClick={e => e.stopPropagation()}>
            <h2 className="text-xl font-bold mb-1">LOG A SONG</h2>
            <p className="text-xs text-gray-500 mb-4 font-medium">{formatLocalDateFromYMD(logModalDate).toUpperCase()} · PRIVATE MEMORY</p>

            <div className="mb-3">
              <input
                type="search"
                placeholder="Search for a song"
                value={logSearchQuery}
                onChange={handleLogSearchChange}
                className="w-full bg-yellow-100 border-2 border-black px-4 py-2 focus:outline-none focus:border-purple-500"
              />
              {logIsSearching && <p className="mt-2 text-sm text-gray-500">Searching…</p>}
              {logSearchResults.length > 0 && (
                <ul className="mt-2 max-h-48 overflow-auto bg-white border-2 border-black">
                  {logSearchResults.map((t: any) => (
                    <li
                      key={t.id}
                      className="flex items-center gap-3 p-2 hover:bg-gray-100 cursor-pointer"
                      onClick={() => handleLogSelectTrack(t)}
                    >
                      <img src={t.album.images?.[0]?.url} alt={t.name} className="w-12 h-12 object-cover border-2 border-black" />
                      <div className="flex-1 min-w-0">
                        <p className="font-bold truncate">{t.name}</p>
                        <p className="text-xs text-gray-600 truncate">{t.artists.map((a: any) => a.name).join(', ')}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {logSelectedTrack && (
              <div className="mb-3 p-2 bg-gradient-to-r from-green-100 to-blue-100 border-2 border-black flex items-center gap-3">
                <img src={logSelectedTrack.album.images?.[0]?.url} alt={logSelectedTrack.name} className="w-12 h-12 object-cover border-2 border-black" />
                <div className="flex-1 min-w-0">
                  <p className="font-bold truncate">{logSelectedTrack.name}</p>
                  <p className="text-xs text-gray-600 truncate">{logSelectedTrack.artists.map((a: any) => a.name).join(', ')}</p>
                  <p className="text-xs mt-0.5">
                    {logFeaturesStatus === 'loading' && <span className="text-gray-400">fetching tags…</span>}
                    {logFeaturesStatus === 'ok' && <span className="text-green-600 font-bold">✓ tags ready</span>}
                    {logFeaturesStatus === 'failed' && <span className="text-gray-400">no tags found</span>}
                  </p>
                </div>
              </div>
            )}

            <textarea
              placeholder="What do you remember about this day? (max 140 chars)"
              maxLength={140}
              value={logCaption}
              onChange={e => setLogCaption(e.target.value)}
              className="w-full bg-yellow-100 border-2 border-black px-4 py-2 mb-4 focus:outline-none focus:border-purple-500 resize-none h-24"
            />

            <div className="flex gap-2">
              <button onClick={handleCloseLogModal} className="flex-1 bg-gray-200 border-2 border-black px-4 py-2 font-bold hover:bg-gray-300 transition-colors">
                CANCEL
              </button>
              <button
                onClick={handleSaveLogEntry}
                disabled={logIsPosting || !logSelectedTrack || !logCaption.trim()}
                className="flex-1 bg-gradient-to-r from-purple-500 to-pink-500 text-white border-2 border-black px-4 py-2 font-bold hover:translate-x-0.5 hover:translate-y-0.5 transition-transform disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {logIsPosting ? 'SAVING...' : 'SAVE TO LOG'}
              </button>
            </div>
          </div>
        </div>
      )}

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
              <span className="font-bold text-black">{formatLocalDateFromYMD(selectedPost.date).toUpperCase()}</span>
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

      {/* Edit Profile Modal */}
      {showEditProfile && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowEditProfile(false)}>
          <div className="bg-white border-4 border-black p-6 w-full max-w-md shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-xl font-bold mb-4">EDIT PROFILE</h2>

            {/* <label className="block text-sm font-bold mb-1">Profile Photo URL</label>
            <input
              type="text"
              value={editAvatarUrl}
              onChange={(e) => setEditAvatarUrl(e.target.value)}
              placeholder="https://..."
              className="w-full bg-yellow-100 border-2 border-black px-4 py-2 mb-3 focus:outline-none focus:border-purple-500"
            />
            {editAvatarUrl && (
              <img src={editAvatarUrl} alt="preview" className="w-20 h-20 border-2 border-black object-cover mb-4" />
            )} */}
            <label className="block text-sm font-bold mb-1">Profile Photo</label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0] ?? null;
                setSelectedAvatarFile(file);

                if (file) {
                  const localPreview = URL.createObjectURL(file);
                  setAvatarPreviewUrl(localPreview);
                }
              }}
              className="w-full bg-yellow-100 border-2 border-black px-4 py-2 mb-3"
            />

            {avatarPreviewUrl && (
              <img
                src={avatarPreviewUrl}
                alt="preview"
                className="w-20 h-20 border-2 border-black object-cover mb-4"
              />
            )}

            <label className="block text-sm font-bold mb-1">Bio</label>
            <textarea
              value={editBio}
              onChange={(e) => setEditBio(e.target.value)}
              maxLength={200}
              placeholder="Tell people about yourself..."
              className="w-full bg-yellow-100 border-2 border-black px-4 py-2 mb-4 resize-none h-24 focus:outline-none focus:border-purple-500"
            />

            <div className="flex gap-2">
              <button onClick={() => setShowEditProfile(false)} className="flex-1 bg-gray-200 border-2 border-black px-4 py-2 font-bold hover:bg-gray-300 transition-colors">
                CANCEL
              </button>
              <button
                onClick={handleSaveProfile}
                disabled={isSavingProfile}
                className="flex-1 bg-gradient-to-r from-purple-500 to-pink-500 text-white border-2 border-black px-4 py-2 font-bold hover:translate-x-0.5 hover:translate-y-0.5 transition-transform disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSavingProfile ? 'SAVING...' : 'SAVE'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}