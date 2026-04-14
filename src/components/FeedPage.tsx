import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router';
import { UserAvatar } from './UserAvatar';
import { isLoggedIn, logout } from '../utils/spotifyAuth';
import { toLocalDateString, formatLocalDateFromYMD } from '../utils/date';
import { currentUser } from '../auth/currentUserInfo';
// import { currentUser } from '../data/mockData';
import { SongPost, Comment } from '../types';
import { ChevronDown, ChevronUp, MessageCircle, ExternalLink, Trash2, Flag } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { searchTracks } from '../api/spotify';
import { getTrackTopTags, LastFmTag } from '../api/lastfm';

export const HARDCODED_EMOJIS = ['🔥', '🪩', '💔', '✨', '🌙'];

interface TrackResult {
  id: string;
  name: string;
  artists: Array<{ name: string }>;
  album: { images: Array<{ url: string }> };
  external_urls: { spotify: string };
}

interface SongPostComponentProps {
  post: SongPost;
  onReaction: (postId: string, emoji: string) => void;
  onAddComment: (postId: string, comment: Comment) => void;
  onDeleteComment: (commentId: string) => void;
}

export function FeedPage() {
  const [posts, setPosts] = useState<SongPost[]>([]);
  const [showNewPost, setShowNewPost] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [selectedTrack, setSelectedTrack] = useState<any | null>(null);
  const [pendingTags, setPendingTags] = useState<LastFmTag[]>([]);
  const [featuresStatus, setFeaturesStatus] = useState<'idle' | 'loading' | 'ok' | 'failed'>('idle');

  useEffect(() => {

    fetchPosts();

    if (!searchQuery || searchQuery.trim().length < 3) {
      setSearchResults([]);
      setSearchError(null);
      return;
    }

    setIsSearching(true);
    setSearchError(null);
    const handler = setTimeout(async () => {
      try {
        const res = await searchTracks(searchQuery);
        setSearchResults(res.tracks.items || []);
      } catch (err: any) {
        setSearchError(err?.message || 'Search failed');
      } finally {
        setIsSearching(false);
      }
    }, 400);

    return () => clearTimeout(handler);
  }, [searchQuery]);
  const [showWelcome, setShowWelcome] = useState(() => localStorage.getItem('lyra_show_welcome') === 'true');
  const [caption, setCaption] = useState('');
  const [isPosting, setIsPosting] = useState(false);

  // search state
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function fetchPosts() {
      const { data, error } = await supabase
      .from('posts')
      .select(`
        *,
        profiles!posts_user_id_fkey (
          id,
          username,
          display_name,
          bio,
          avatar_url,
          followers,
          following
        ),
        songs!posts_song_id_fkey (
          id,
          spotify_url,
          song_title,
          artist,
          album_art,
          tags
        ),
        reactions (
          id,
          emoji,
          user_id,
          user_name
        ),
        comments (
          id,
          user_id,
          caption,
          song_title,
          artist,
          album_art,
          spotify_url,
          timestamp,
          profiles!comments_user_id_fkey (
            id, username, display_name, avatar_url
          )
        )
      `)
      .order('created_at', { ascending: false });

      // console.log('SUPABASE DATA:', data);

      if (error) {
        console.error('Error fetching posts:', error);
        return;
      }

      const mappedPosts: SongPost[] = (data || []).map((post: any) => ({
        id: post.id,
        userId: post.user_id,
        user: {
          id: post.profiles?.id ?? post.user_id,
          username: post.profiles?.username ?? post.user_id,
          displayName: post.profiles?.display_name ?? post.user_id,
          bio: post.profiles?.bio ?? '',
          avatarUrl: post.profiles?.avatar_url ?? '',
          followers: post.profiles?.followers ?? 0,
          following: post.profiles?.following ?? 0,
        },
        spotifyUrl: post.spotify_url ?? '',
        albumArt: post.album_art ?? 'https://placehold.co/200x200',
        songTitle: post.song_title ?? 'Unknown Song',
        artist: post.artist ?? 'Unknown Artist',
        caption: post.caption ?? '',
        date: post.post_date ?? '',
        createdAt: post.created_at ?? '',
        reactions: (post.reactions || []).map((reaction: any) => ({
          emoji: reaction.emoji,
          userId: reaction.user_id,
          userName: reaction.user_name,
        })),
        comments: (post.comments || []).map((comment: any) => ({
          id: comment.id,
          userId: comment.user_id,
          user: {
            id: comment.profiles?.id ?? comment.user_id,
            username: comment.profiles?.username ?? comment.user_id,
            displayName: comment.profiles?.display_name ?? comment.profiles?.username ?? comment.user_id,
            bio: '',
            avatarUrl: comment.profiles?.avatar_url ?? '',
            followers: 0,
            following: 0,
          },
          caption: comment.caption,
          timestamp: comment.timestamp,
          song: comment.song_title
            ? {
                songTitle: comment.song_title,
                artist: comment.artist ?? '',
                albumArt: comment.album_art ?? 'https://placehold.co/100x100',
                spotifyUrl: comment.spotify_url ?? '',
              }
            : undefined,
        })),
      }));

      setPosts(mappedPosts);
    }


  async function getOrCreateSong({
    spotifyUrl,
    songTitle,
    artist,
    albumArt,
    tags,
  }: {
    spotifyUrl: string;
    songTitle: string;
    artist: string;
    albumArt: string;
    tags?: LastFmTag[];
  }) {
    const trimmedUrl = spotifyUrl.trim();

    const { data: existingSong, error: existingSongError } = await supabase
      .from('songs')
      .select('id, tags')
      .eq('spotify_url', trimmedUrl)
      .maybeSingle();

    if (existingSongError) {
      console.error('Error checking existing song:', existingSongError);
      throw existingSongError;
    }

    if (existingSong?.id) {
      // Backfill tags if the song exists but has none
      if (!existingSong.tags && tags && tags.length > 0) {
        console.log('[Last.fm] Backfilling tags for existing song:', existingSong.id, tags);
        await supabase.from('songs').update({ tags }).eq('id', existingSong.id);
      }
      return existingSong.id;
    }

    const newSongId = crypto.randomUUID();

    console.log('[Last.fm] Inserting new song with tags:', newSongId, tags);
    const { error: insertSongError } = await supabase
      .from('songs')
      .insert({
        id: newSongId,
        spotify_url: trimmedUrl,
        song_title: songTitle,
        artist: artist,
        album_art: albumArt,
        tags: tags && tags.length > 0 ? tags : null,
      });

    if (insertSongError) {
      console.error('Error inserting song:', insertSongError);
      throw insertSongError;
    }

    return newSongId;
  }

  function handleSearchChange(e: React.ChangeEvent<HTMLInputElement>) {
    const query = e.target.value;
    setSearchQuery(query);
    setSelectedTrack(null);

    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    searchDebounceRef.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const result = await searchTracks(query);
        setSearchResults(result.tracks.items.slice(0, 8) as TrackResult[]);
      } catch (err) {
        console.error('Search failed:', err);
      } finally {
        setIsSearching(false);
      }
    }, 400);
  }

  function handleSelectTrack(track: TrackResult) {
    setSelectedTrack(track);
    setSearchQuery(`${track.name} — ${track.artists[0]?.name ?? ''}`);
    setSearchResults([]);
    // Fetch audio features immediately in the background
    setFeaturesStatus('loading');
    setPendingTags([]);
    const artist = track.artists[0]?.name ?? '';
    console.log('[Last.fm] Fetching tags for:', artist, '—', track.name);
    getTrackTopTags(artist, track.name).then(tags => {
      console.log('[Last.fm] Tags received:', tags);
      setPendingTags(tags);
      setFeaturesStatus(tags.length > 0 ? 'ok' : 'failed');
    }).catch((err: unknown) => {
      console.warn('[Last.fm] Failed to fetch tags:', err);
      setFeaturesStatus('failed');
    });
  }

  function handleCloseModal() {
    setShowNewPost(false);
    setSearchQuery('');
    setSearchResults([]);
    setSelectedTrack(null);
    setPendingTags([]);
    setFeaturesStatus('idle');
    setCaption('');
  }

  async function handleCreatePost() {
    if (!selectedTrack || !caption.trim()) return;

    try {
      setIsPosting(true);

      const spotifyUrl = selectedTrack.external_urls.spotify;
      const songTitle = selectedTrack.name;
      const artist = selectedTrack.artists.map((a: { name: string }) => a.name).join(', ');
      const albumArt = selectedTrack.album.images[0]?.url ?? 'https://placehold.co/200x200';

      const songId = await getOrCreateSong({
        spotifyUrl,
        songTitle,
        artist,
        albumArt,
        tags: pendingTags,
      });

      const newPost = {
        id: crypto.randomUUID(),
        user_id: currentUser.id,
        song_id: songId,
        spotify_url: spotifyUrl,
        song_title: songTitle,
        artist,
        album_art: albumArt,
        caption: caption.trim(),
        post_date: toLocalDateString(), // new Date().toISOString().split('T')[0],
        created_at: new Date().toISOString(),
      };

      const { error } = await supabase.from('posts').insert(newPost);

      if (error) {
        console.error('Error creating post:', error);
        return;
      }

      handleCloseModal();
      await fetchPosts();
    } catch (err) {
      console.error('handleCreatePost failed:', err);
    } finally {
      setIsPosting(false);
    }
  }

  const handleReaction = async (postId: string, emoji: string) => {
    const existingPost = posts.find((p) => p.id === postId);
    const existingReaction = existingPost?.reactions.find(
      (r) => r.userId === currentUser.id
    );

    if (existingReaction) {
      // Delete existing reaction (same emoji = toggle off, different = swap)
      const { error: delError } = await supabase
        .from('reactions')
        .delete()
        .eq('post_id', postId)
        .eq('user_id', currentUser.id);

      if (delError) {
        console.error('Error deleting reaction:', delError);
        return;
      }

      // If swapping to a different emoji, insert the new one
      if (existingReaction.emoji !== emoji) {
        const { error: insError } = await supabase.from('reactions').insert({
          id: crypto.randomUUID(),
          post_id: postId,
          emoji,
          user_id: currentUser.id,
          user_name: currentUser.username,
        });
        if (insError) {
          console.error('Error swapping reaction:', insError);
          return;
        }
      }
    } else {
      const { error } = await supabase.from('reactions').insert({
        id: crypto.randomUUID(),
        post_id: postId,
        emoji,
        user_id: currentUser.id,
        user_name: currentUser.username,
      });

      if (error) {
        console.error('Error adding reaction:', error);
        return;
      }
    }

    await fetchPosts();
  };

  const handleAddComment = async (postId: string, comment: Comment) => {
    const { error } = await supabase.from('comments').insert({
      id: comment.id,
      post_id: postId,
      user_id: comment.userId,
      caption: comment.caption,
      song_title: comment.song?.songTitle ?? null,
      artist: comment.song?.artist ?? null,
      album_art: comment.song?.albumArt ?? null,
      spotify_url: comment.song?.spotifyUrl ?? null,
      timestamp: comment.timestamp,
    });

    if (error) {
      console.error('Error adding comment:', error);
      return;
    }

    await fetchPosts();
  };

  const handleDeleteComment = async (commentId: string) => {
    // Optimistic update — remove from UI immediately
    setPosts(prev => prev.map(p => ({
      ...p,
      comments: p.comments.filter(c => c.id !== commentId),
    })));
    // Best-effort DB delete (may be blocked by RLS if no Supabase auth session)
    await supabase.from('comments').delete().eq('id', commentId);
  };

  // const today = new Date();
  // const todayStr = today.toISOString().split('T')[0];
  // const hasPostedToday = posts.some(p => p.userId === currentUser.id && p.date === todayStr);
  const todayStr = toLocalDateString();
  const hasPostedToday = posts.some(
    p => p.userId === currentUser.id && p.date === todayStr
  );
  // const formattedDate = today.toLocaleDateString('en-US', {
  //   month: 'long',
  //   day: 'numeric',
  //   year: 'numeric',
  // });
  const formattedDate = formatLocalDateFromYMD(todayStr);

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="sticky top-0 bg-white border-b-4 border-black z-10">
        <div className="px-4 py-4 flex justify-between items-center relative">
          <div className="flex items-center gap-3">
            {/* Show Log out when there's an active Spotify session */}
            {/**/}
            <AuthButton />
            <div>
              <h1 className="text-xl font-bold">Today's Songs</h1>
              <p className="text-sm text-gray-600">{formattedDate}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowWelcome(true)}
              title="App info"
              className="w-8 h-8 flex items-center justify-center border-2 border-black font-bold text-sm hover:bg-gray-100 transition-colors shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
            >
              ⓘ
            </button>
            <button
              onClick={() => !hasPostedToday && setShowNewPost(true)}
              disabled={hasPostedToday}
              className="bg-gradient-to-r from-purple-500 to-pink-500 text-white px-4 py-2 border-2 border-black font-bold hover:translate-x-0.5 hover:translate-y-0.5 transition-transform shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] disabled:opacity-50 disabled:cursor-not-allowed disabled:translate-x-0 disabled:translate-y-0"
            >
              {hasPostedToday ? '✓ POSTED TODAY' : '+ POST'}
            </button>
          </div>
        </div>
        
        {/* Today's Emoji Set */}
      </div>

      {/* New Post Modal */}
      {showNewPost && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white border-4 border-black p-6 w-full max-w-md shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
            <h2 className="text-xl font-bold mb-4">SHARE TODAY'S SONG</h2>
            {/* Spotify search: type to search tracks and pick one to auto-fill the URL */}
            <div className="mb-3">
              <input
                type="search"
                placeholder="Search for a song"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-yellow-100 border-2 border-black px-4 py-2 focus:outline-none focus:border-purple-500"
              />

              {isSearching && <p className="mt-2 text-sm text-gray-600">Searching…</p>}
              {searchError && <p className="mt-2 text-sm text-red-600">{searchError}</p>}

              {searchResults.length > 0 && (
                <ul className="mt-2 max-h-48 overflow-auto bg-white border-2 border-black">
                  {searchResults.map((t) => (
                    <li
                      key={t.id}
                      className="flex items-center gap-3 p-2 hover:bg-gray-100 cursor-pointer"
                      onClick={() => handleSelectTrack(t)}
                    >
                      <img src={t.album.images?.[0]?.url} alt={t.name} className="w-12 h-12 object-cover border-2 border-black" />
                      <div className="flex-1 min-w-0">
                        <p className="font-bold truncate">{t.name}</p>
                        <p className="text-xs text-gray-600 truncate">{t.artists.map((a:any)=>a.name).join(', ')}</p>
                      </div>
                      <div className="text-xs text-gray-500">{Math.floor(t.duration_ms/1000)}s</div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <textarea
              placeholder="Caption (max 140 characters)"
              maxLength={140}
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              className="w-full bg-yellow-100 border-2 border-black px-4 py-2 mb-4 focus:outline-none focus:border-purple-500 resize-none h-24"
            />
            {/* Preview of selected track (if any) */}
            {selectedTrack && (
              <div className="mb-3 p-2 bg-gradient-to-r from-green-100 to-blue-100 border-2 border-black flex items-center gap-3">
                <img src={selectedTrack.album.images?.[0]?.url} alt={selectedTrack.name} className="w-12 h-12 object-cover border-2 border-black" />
                <div className="flex-1 min-w-0">
                  <p className="font-bold truncate">{selectedTrack.name}</p>
                  <p className="text-xs text-gray-600 truncate">{selectedTrack.artists.map((a:any)=>a.name).join(', ')}</p>
                  <p className="text-xs mt-0.5">
                    {featuresStatus === 'loading' && <span className="text-gray-400">fetching tags from Last.fm…</span>}
                    {featuresStatus === 'ok'      && <span className="text-green-600 font-bold">✓ {pendingTags.length} tags ready</span>}
                    {featuresStatus === 'failed'  && <span className="text-red-500">⚠ no tags found (map may not show this song)</span>}
                  </p>
                </div>
                <a
                  href={`https://open.spotify.com/track/${selectedTrack.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="self-center p-2 bg-green-500 hover:bg-green-600 border-2 border-black text-white"
                >
                  Open
                </a>
              </div>
            )}
            <div className="flex gap-2">
              <button
                onClick={handleCloseModal}
                className="flex-1 bg-gray-200 border-2 border-black px-4 py-2 font-bold hover:bg-gray-300 transition-colors"
              >
                CANCEL
              </button>
              <button
                onClick={handleCreatePost}
                disabled={isPosting || !selectedTrack || !caption.trim()}
                className="flex-1 bg-gradient-to-r from-purple-500 to-pink-500 text-white border-2 border-black px-4 py-2 font-bold hover:translate-x-0.5 hover:translate-y-0.5 transition-transform disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isPosting ? 'POSTING...' : 'POST'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Feed — grouped by date with divider bars */}
      <div>
        {(() => {
          const elements: React.ReactNode[] = [];
          let lastDate = '';
          for (const post of posts) {
            const date = post.date || (post.createdAt || '').slice(0, 10);
            if (date !== lastDate) {
              lastDate = date;
              elements.push(
                <div
                  key={`date-${date}`}
                  className="sticky top-[73px] z-[5] bg-gray-100 border-y-2 border-gray-300 px-4 py-1.5"
                >
                  <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                    {date ? formatLocalDateFromYMD(date) : 'Unknown date'}
                  </span>
                </div>
              );
            }
            elements.push(
              <div key={post.id} className="border-b-2 border-gray-200">
                <SongPostComponent
                  post={post}
                  onReaction={handleReaction}
                  onAddComment={handleAddComment}
                  onDeleteComment={handleDeleteComment}
                />
              </div>
            );
          }
          return elements;
        })()}
      </div>

      {posts.length === 0 && (
        <div className="text-center py-16 text-gray-500">
          <p>No songs posted yet today.</p>
          <p className="text-sm mt-2">Be the first to share!</p>
        </div>
      )}

      {/* Welcome modal for new users */}
      {showWelcome && (
        <WelcomeModal onClose={() => setShowWelcome(false)} />
      )}

      {/* Floating contact button */}
      <a
        href="mailto:tillerma@umich.edu,ishanid@umich.edu,eshanair@umich.edu?subject=LYRA%20Support"
        style={{ position: 'fixed', bottom: '80px', right: '16px', zIndex: 9999 }}
        className="bg-gradient-to-r from-purple-500 to-pink-500 text-white border-2 border-black px-3 py-2 text-xs font-bold shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:translate-x-0.5 hover:translate-y-0.5 transition-transform"
      >
        ? CONTACT
      </a>
    </div>
  );
}

function WelcomeModal({ onClose }: { onClose: () => void }) {
  const CONTACT_HREF = 'mailto:tillerma@umich.edu,ishanid@umich.edu,eshanair@umich.edu?subject=LYRA%20Support';

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      {/* flex-col: header + footer are pinned, only middle scrolls */}
      <div className="bg-white border-4 border-black w-full max-w-md shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] flex flex-col" style={{ maxHeight: '78vh' }}>

        {/* Pinned header */}
        <div className="bg-gradient-to-r from-purple-500 to-pink-500 flex flex-col items-center px-6 py-4 border-b-4 border-black flex-shrink-0 p-1">
          <h2 className="text-xl font-bold text-white">WELCOME TO LYRA</h2>
          <p className="text-white/80 font-bold text-xs mt-0.5">Here's everything you need to know to get started.</p>
        </div>

        {/* Scrollable content */}
        <div className="overflow-y-auto flex-1 px-6 divide-y-2 divide-gray-200 p-2">

          <div className="py-4">
            <h3 className="font-bold text-sm mb-2">🎵 What is LYRA?</h3>
            <p className="text-xs text-gray-600 leading-relaxed">LYRA is a social music diary. Every day you share one song that's on your mind and discover what the people around you are listening to!</p>
          </div>

          <div className="py-4">
            <h3 className="font-bold text-sm mb-2">🗺 Pages you can access</h3>
            <ul className="space-y-2">
              <li className="flex gap-3">
                <span className="font-bold text-black text-xs min-w-[80px]">Feed</span>
                <span className="text-xs text-gray-600 leading-relaxed">Today's posts from everyone. React with the daily emoji palette or leave a comment.</span>
              </li>
              <li className="flex gap-3">
                <span className="font-bold text-black text-xs min-w-[80px]">Music Map</span>
                <span className="text-xs text-gray-600 leading-relaxed">Songs plotted by mood and energy. Explore what's trending today.</span>
              </li>
              <li className="flex gap-3">
                <span className="font-bold text-black text-xs min-w-[80px]">Playlists</span>
                <span className="text-xs text-gray-600 leading-relaxed">Curated playlists built from the community's posts and reactions.</span>
              </li>
              <li className="flex gap-3">
                <span className="font-bold text-black text-xs min-w-[80px]">Profile</span>
                <span className="text-xs text-gray-600 leading-relaxed">Your listening calendar — every song you've posted, by date.</span>
              </li>
            </ul>
          </div>

          <div className="py-4">
            <h3 className="font-bold text-sm mb-2">📅 Posting once a day</h3>
            <p className="text-xs text-gray-600 leading-relaxed">You get <span className="font-bold text-black">one post per day</span>. Hit <span className="font-bold text-black">+ POST</span>, search Spotify for a song, write a caption, and submit. Once posted the button shows <span className="font-bold text-black">✓ POSTED TODAY</span>.</p>
          </div>

          <div className="py-4">
            <h3 className="font-bold text-sm mb-2">💬 Types of comments</h3>
            <p className="text-xs text-gray-600 leading-relaxed mb-1.5">Tap the comments toggle on any post, then hit <span className="font-bold text-black">+ ADD COMMENT</span>. You can leave:</p>
            <ul className="space-y-1 text-xs text-gray-600 ml-2">
              <li>• A <span className="font-bold text-black">text reply</span></li>
              <li>• A <span className="font-bold text-black">song reply</span> — attach a Spotify track</li>
              <li>• Or <span className="font-bold text-black">both</span> together</li>
            </ul>
          </div>

          <div className="py-4">
            <h3 className="font-bold text-sm mb-2">🛠 Running into problems?</h3>
            <p className="text-xs text-gray-600 leading-relaxed mb-2">Use the <span className="font-bold text-black">CONTACT</span> button in the bottom-right corner to email the LYRA team.</p>
            <a
              href={CONTACT_HREF}
              className="inline-block bg-gradient-to-r from-purple-500 to-pink-500 text-white border-2 border-black px-3 py-1.5 text-xs font-bold shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-0.5 hover:translate-y-0.5 transition-transform"
            >
              CONTACT DEVELOPERS
            </a>
          </div>

        </div>

        {/* Pinned footer — always visible */}
        <div className="px-6 py-4 border-t-4 border-black flex-shrink-0 p-4">
          <button
            onClick={onClose}
            className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white border-2 border-black px-4 py-3 font-bold hover:translate-x-0.5 hover:translate-y-0.5 transition-transform shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]"
          >
            LET'S GO →
          </button>
        </div>

      </div>
    </div>
  );
}

function AuthButton() {
  const navigate = useNavigate();
  const [loggedIn, setLoggedIn] = useState(() => isLoggedIn());

  useEffect(() => {
    // Re-check on mount in case auth state changed elsewhere
    setLoggedIn(isLoggedIn());
  }, []);

  const handleLogout = () => {
    logout();
    setLoggedIn(false);
    navigate('/login');
  };

  if (loggedIn) {
    return (
      <button
        onClick={handleLogout}
        className="inline-block mr-2 bg-white border-2 border-black px-3 py-1 font-bold text-sm hover:bg-gray-100"
      >
        Log out
      </button>
    );
  }

  return (
    <Link
      to="/login"
      className="inline-block mr-2 bg-white border-2 border-black px-3 py-1 font-bold text-sm hover:bg-gray-100"
    >
      Log in
    </Link>
  );
}

function SongPostComponent({ post, onReaction, onAddComment, onDeleteComment }: SongPostComponentProps) {
  const [showReactions, setShowReactions] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [showAddComment, setShowAddComment] = useState(false);
  const [hoveredEmoji, setHoveredEmoji] = useState<string | null>(null);
  const [showReport, setShowReport] = useState(false);

  const userReaction = post.reactions.find(r => r.userId === currentUser.id);

  // Group reactions by emoji — only show emojis with at least 1 reaction
  const reactionGroups = HARDCODED_EMOJIS.map(emoji => {
    const reactors = post.reactions.filter(r => r.emoji === emoji);
    return { emoji, count: reactors.length, recentUsers: reactors.slice(-5).map(r => r.userName) };
  }).filter(g => g.count > 0);

  return (
    <div className="px-4 py-6 bg-white">
      {/* User Info */}
      <div className="flex items-center gap-3 mb-4">
        <UserAvatar
          avatarUrl={post.user.avatarUrl}
          displayName={post.user.displayName}
          username={post.user.username}
          size={40}
          className="border-2 border-black"
        />
        <div className="flex-1">
          <p className="font-bold">{post.user.displayName}</p>
          <Link to={`/profile/${post.user.username}`} className="text-sm text-gray-600">@{post.user.username}</Link>
        </div>
        {post.createdAt && (
          <span className="text-xs text-gray-500 font-medium self-start">
            {new Date(post.createdAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
          </span>
        )}
      </div>

      {/* Album Art & Song Info */}
      <div className="flex gap-4 mb-3">
        <img
          src={post.albumArt}
          alt={post.songTitle}
          className="w-24 h-24 border-2 border-black object-cover shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
        />
        <div className="flex flex-col justify-center">
          <p className="font-bold">{post.songTitle}</p>
          <p className="text-sm text-gray-600">{post.artist}</p>
          <a
            href={post.spotifyUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-blue-600 hover:text-blue-800 mt-2 font-bold underline"
          >
            OPEN IN SPOTIFY
          </a>
        </div>
      </div>

      {/* Caption */}
      <p className="text-black mb-4">{post.caption}</p>

      {/* Reaction counts */}
      <div className="flex items-center gap-2 flex-wrap mb-3">
        {reactionGroups.map(({ emoji, count, recentUsers }) => {
          const isMyReaction = userReaction?.emoji === emoji;
          return (
            <div key={emoji} className="relative">
              <button
                onClick={() => onReaction(post.id, emoji)}
                onMouseEnter={() => setHoveredEmoji(emoji)}
                onMouseLeave={() => setHoveredEmoji(null)}
                className={`bg-gradient-to-r from-yellow-300 to-pink-300 border-2 border-black px-3 py-1 text-sm flex items-center gap-1 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] ${
                  isMyReaction ? 'ring-2 ring-blue-500 ring-offset-1' : ''
                }`}
              >
                <span>{emoji}</span>
                <span className="text-black font-bold">{count}</span>
              </button>

              {/* Hover tooltip — names only, horizontal comma-separated */}
              {hoveredEmoji === emoji && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-20 pointer-events-none flex flex-col items-center">
                  <div className="bg-white border-2 border-black px-3 py-2 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] whitespace-nowrap text-center">
                    <span className="text-xs font-bold text-black">
                      {recentUsers
                        .filter(n => n && String(n).trim())
                        .slice()
                        .reverse()
                        .map(n => `@${n}`)
                        .join(', ')}
                    </span>
                    {count > 5 && (
                      <span className="text-xs text-gray-500 ml-1">+{count - 5} more</span>
                    )}
                  </div>
                  <div className="w-0 h-0 border-l-[7px] border-r-[7px] border-t-[7px] border-l-transparent border-r-transparent border-t-black" />
                </div>
              )}
            </div>
          );
        })}

        {/* + always visible */}
        <button
          onClick={() => setShowReactions(!showReactions)}
          className="px-3 py-1 text-sm border-2 border-black font-bold bg-white hover:bg-gray-100 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
        >
          +
        </button>
      </div>

      {/* Emoji Picker */}
      {showReactions && (
        <div className="mt-3 flex gap-2 p-3 bg-gradient-to-r from-blue-100 to-purple-100 border-2 border-black mb-3">
          {HARDCODED_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              onClick={() => {
                onReaction(post.id, emoji);
                setShowReactions(false);
              }}
              className={`w-10 h-10 border-2 flex items-center justify-center text-xl transition-all ${
                userReaction?.emoji === emoji
                  ? 'border-blue-500 bg-blue-100'
                  : 'border-transparent hover:border-black hover:bg-white'
              }`}
            >
              {emoji}
            </button>
          ))}
        </div>
      )}

      {/* Report button */}
      <div className="flex justify-end mb-2">
        <button
          onClick={() => setShowReport(true)}
          className="flex items-center gap-1 text-xs text-gray-400 hover:text-red-500 transition-colors"
        >
          <Flag className="w-3 h-3" />
          <span>REPORT</span>
        </button>
      </div>

      {showReport && (
        <ReportModal type="post" targetId={post.id} onClose={() => setShowReport(false)} />
      )}

      {/* Comments Section */}
      <div className="border-t-2 border-gray-300 pt-3">
        <button
          onClick={() => setShowComments(!showComments)}
          className="flex items-center gap-2 text-sm font-bold text-gray-700 hover:text-black transition-colors"
        >
          <MessageCircle className="w-4 h-4" />
          <span>{post.comments.length} {post.comments.length === 1 ? 'COMMENT' : 'COMMENTS'}</span>
          {showComments ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        {showComments && (
          <div className="mt-4 space-y-4">
            {/* Add Comment Button */}
            <button
              onClick={() => setShowAddComment(!showAddComment)}
              className="w-full bg-gradient-to-r from-green-400 to-blue-400 text-white px-4 py-2 border-2 border-black font-bold hover:translate-x-0.5 hover:translate-y-0.5 transition-transform shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]"
            >
              + ADD COMMENT
            </button>

            {showAddComment && (
              <AddCommentForm
                postId={post.id}
                onAddComment={onAddComment}
                onCancel={() => setShowAddComment(false)}
              />
            )}

            {/* Comments List */}
            {post.comments.map((comment) => (
              <CommentComponent
                key={comment.id}
                comment={comment}
                onDelete={comment.userId === currentUser.id ? () => onDeleteComment(comment.id) : undefined}
              />
            ))}

            {post.comments.length === 0 && !showAddComment && (
              <p className="text-sm text-gray-500 text-center py-4">No comments yet</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

interface CommentComponentProps {
  comment: Comment;
  onDelete?: () => void;
}

function CommentComponent({ comment, onDelete }: CommentComponentProps) {
  const [showReport, setShowReport] = useState(false);
  return (
    <div className="flex gap-3 p-3 bg-gradient-to-r from-blue-50 to-purple-50 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
      {/* Avatar */}
      <UserAvatar
        avatarUrl={comment.user.avatarUrl}
        displayName={comment.user.displayName}
        username={comment.user.username}
        size={32}
        className="border-2 border-black flex-shrink-0 mt-0.5"
      />

      {/* Body */}
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 mb-1">
          <span className="font-bold text-sm text-black leading-none">{comment.user.displayName}</span>
          <Link to={`/profile/${comment.user.username}`} className="text-xs text-gray-500 hover:underline">
            @{comment.user.username}
          </Link>
        </div>

        {comment.song && (
          <div className="mb-2 bg-white border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
            <div className="flex items-center gap-0">
              <img
                src={comment.song.albumArt}
                alt={comment.song.songTitle}
                className="w-14 h-14 border-r-2 border-black object-cover flex-shrink-0"
              />
              <div className="flex-1 min-w-0 px-3 py-2">
                <p className="text-xs font-bold truncate text-black">{comment.song.songTitle}</p>
                <p className="text-xs text-gray-600 truncate">{comment.song.artist}</p>
              </div>
              {comment.song.spotifyUrl && (
                <a
                  href={comment.song.spotifyUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-10 h-14 bg-green-500 hover:bg-green-600 border-l-2 border-black flex items-center justify-center flex-shrink-0 transition-colors"
                  title="Open in Spotify"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-white" />
                </a>
              )}
            </div>
          </div>
        )}

        {comment.caption && <p className="text-sm text-black">{comment.caption}</p>}
      </div>

      {/* Actions: delete (own) + report */}
      <div className="flex flex-col gap-1 flex-shrink-0 self-start">
        {onDelete && (
          <button
            onClick={onDelete}
            className="w-8 h-8 border-2 border-black bg-white hover:bg-red-50 transition-colors shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] flex items-center justify-center"
            title="Delete comment"
          >
            <Trash2 className="w-3.5 h-3.5 text-black" />
          </button>
        )}
        <button
          onClick={() => setShowReport(true)}
          className="w-8 h-8 border-2 border-black bg-white hover:bg-red-50 transition-colors shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] flex items-center justify-center"
          title="Report comment"
        >
          <Flag className="w-3.5 h-3.5 text-gray-400" />
        </button>
      </div>

      {showReport && (
        <ReportModal type="comment" targetId={comment.id} onClose={() => setShowReport(false)} />
      )}
    </div>
  );
}

function ReportModal({ type, targetId, onClose }: { type: 'post' | 'comment'; targetId: string; onClose: () => void }) {
  const [message, setMessage] = useState('');

  const handleSubmit = () => {
    if (!message.trim()) return;
    const to = 'tillerma@umich.edu,ishanid@umich.edu,eshanair@umich.edu';
    const subject = 'LYRA REPORTED POST';
    const body = `Reported by: @${currentUser.username}\nType: ${type}\nID: ${targetId}\n\nReason:\n${message.trim()}`;
    window.location.href = `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white border-4 border-black p-6 w-full max-w-md shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-xl font-bold mb-1">REPORT {type.toUpperCase()}</h2>
        <p className="text-sm text-gray-600 mb-4">Describe why you're reporting this {type}.</p>
        <textarea
          placeholder="Describe the issue... (max 500 characters)"
          maxLength={500}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className="w-full bg-yellow-100 border-2 border-black px-4 py-2 mb-4 resize-none h-32 focus:outline-none focus:border-red-500"
        />
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 bg-gray-200 border-2 border-black px-4 py-2 font-bold hover:bg-gray-300 transition-colors">
            CANCEL
          </button>
          <button
            onClick={handleSubmit}
            disabled={!message.trim()}
            className="flex-1 bg-red-500 text-white border-2 border-black px-4 py-2 font-bold hover:translate-x-0.5 hover:translate-y-0.5 transition-transform disabled:opacity-50 disabled:cursor-not-allowed"
          >
            SUBMIT REPORT
          </button>
        </div>
      </div>
    </div>
  );
}

interface AddCommentFormProps {
  postId: string;
  onAddComment: (postId: string, comment: Comment) => void;
  onCancel: () => void;
}

function AddCommentForm({ postId, onAddComment, onCancel }: AddCommentFormProps) {
  const [caption, setCaption] = useState('');
  const [includeSong, setIncludeSong] = useState(false);
  const [songUrl, setSongUrl] = useState('');
  const [songTitle, setSongTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [albumArt, setAlbumArt] = useState('');
  const [searchQueryC, setSearchQueryC] = useState('');
  const [searchResultsC, setSearchResultsC] = useState<any[]>([]);
  const [isSearchingC, setIsSearchingC] = useState(false);
  const [searchErrorC, setSearchErrorC] = useState<string | null>(null);
  const [selectedTrackC, setSelectedTrackC] = useState<any | null>(null);

  useEffect(() => {
    if (!searchQueryC || searchQueryC.trim().length < 3) {
      setSearchResultsC([]);
      setSearchErrorC(null);
      return;
    }

    setIsSearchingC(true);
    setSearchErrorC(null);
    const handler = setTimeout(async () => {
      try {
        const res = await searchTracks(searchQueryC);
        setSearchResultsC(res.tracks.items || []);
      } catch (err: any) {
        setSearchErrorC(err?.message || 'Search failed');
      } finally {
        setIsSearchingC(false);
      }
    }, 400);

    return () => clearTimeout(handler);
  }, [searchQueryC]);

  const handleSubmit = () => {
    const hasSong = includeSong && songTitle && artist;
    if (!caption.trim() && !hasSong) return;

    const newComment: Comment = {
      id: crypto.randomUUID(),
      userId: currentUser.id,
      user: currentUser,
      caption: caption.trim(),
      timestamp: new Date().toISOString(),
    };

    if (hasSong) {
      newComment.song = {
        songTitle,
        artist,
        albumArt: albumArt || 'https://placehold.co/100x100',
        spotifyUrl: songUrl || '',
      };
    }

    onAddComment(postId, newComment);
    setCaption('');
    setIncludeSong(false);
    setSongUrl('');
    setSongTitle('');
    setArtist('');
  setAlbumArt('');
  setSearchQueryC('');
  setSearchResultsC([]);
  setSelectedTrackC(null);
    onCancel();
  };

  return (
    <div className="bg-white border-4 border-black p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
      <h3 className="text-sm font-bold mb-3">NEW COMMENT</h3>
      
      <textarea
        placeholder="Your comment (max 140 characters)"
        maxLength={140}
        value={caption}
        onChange={(e) => setCaption(e.target.value)}
        className="w-full bg-yellow-100 border-2 border-black px-3 py-2 mb-3 focus:outline-none focus:border-purple-500 resize-none h-20 text-sm"
      />

      <label className="flex items-center gap-2 mb-3 cursor-pointer">
        <input
          type="checkbox"
          checked={includeSong}
          onChange={(e) => setIncludeSong(e.target.checked)}
          className="w-4 h-4"
        />
        <span className="text-sm font-bold">Include a song</span>
      </label>

      {includeSong && (
        <div className="space-y-2 mb-3 p-3 bg-blue-50 border-2 border-black">
          {!selectedTrackC ? (
            <>
              <input
                type="search"
                placeholder="Search for a song"
                value={searchQueryC}
                onChange={(e) => setSearchQueryC(e.target.value)}
                className="w-full bg-white border-2 border-black px-3 py-2 focus:outline-none focus:border-purple-500 text-sm"
              />

              {isSearchingC && <p className="mt-2 text-sm text-gray-600">Searching…</p>}
              {searchErrorC && <p className="mt-2 text-sm text-red-600">{searchErrorC}</p>}

              {searchResultsC.length > 0 && (
                <ul className="mt-2 max-h-40 overflow-auto bg-white border-2 border-black">
                  {searchResultsC.map((t) => (
                    <li
                      key={t.id}
                      className="flex items-center gap-3 p-2 hover:bg-gray-100 cursor-pointer"
                      onClick={() => {
                        const spotifyUrl = `https://open.spotify.com/track/${t.id}`;
                        setSelectedTrackC(t);
                        setSongTitle(t.name);
                        setArtist(t.artists.map((a:any)=>a.name).join(', '));
                        setSongUrl(spotifyUrl);
                        setAlbumArt(t.album.images?.[0]?.url || '');
                        setSearchResultsC([]);
                        setSearchQueryC(`${t.name} — ${t.artists[0].name}`);
                      }}
                    >
                      <img src={t.album.images?.[0]?.url} alt={t.name} className="w-12 h-12 object-cover border-2 border-black" />
                      <div className="flex-1 min-w-0">
                        <p className="font-bold truncate">{t.name}</p>
                        <p className="text-xs text-gray-600 truncate">{t.artists.map((a:any)=>a.name).join(', ')}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              <div className="text-xs text-gray-600">Or enter details manually below.</div>
              <input
                type="text"
                placeholder="Song title"
                value={songTitle}
                onChange={(e) => setSongTitle(e.target.value)}
                className="w-full bg-white border-2 border-black px-3 py-2 focus:outline-none focus:border-purple-500 text-sm"
              />
              <input
                type="text"
                placeholder="Artist"
                value={artist}
                onChange={(e) => setArtist(e.target.value)}
                className="w-full bg-white border-2 border-black px-3 py-2 focus:outline-none focus:border-purple-500 text-sm"
              />
              <input
                type="text"
                placeholder="Spotify URL (optional)"
                value={songUrl}
                onChange={(e) => setSongUrl(e.target.value)}
                className="w-full bg-white border-2 border-black px-3 py-2 focus:outline-none focus:border-purple-500 text-sm"
              />
            </>
          ) : (
            <div className="flex items-center gap-3">
              <img src={selectedTrackC.album.images?.[0]?.url} alt={selectedTrackC.name} className="w-12 h-12 object-cover border-2 border-black" />
              <div className="flex-1 min-w-0">
                <p className="font-bold truncate">{selectedTrackC.name}</p>
                <p className="text-xs text-gray-600 truncate">{selectedTrackC.artists.map((a:any)=>a.name).join(', ')}</p>
              </div>
              <button
                className="text-xs underline"
                onClick={() => {
                  setSelectedTrackC(null);
                  setSongTitle('');
                  setArtist('');
                  setSongUrl('');
                  setAlbumArt('');
                  setSearchQueryC('');
                }}
              >
                Remove
              </button>
            </div>
          )}
        </div>
      )}

      <div className="flex gap-2">
        <button
          onClick={onCancel}
          className="flex-1 bg-gray-200 border-2 border-black px-4 py-2 font-bold hover:bg-gray-300 transition-colors text-sm"
        >
          CANCEL
        </button>
        <button
          onClick={handleSubmit}
          disabled={!caption.trim() && !(includeSong && songTitle && artist)}
          className="flex-1 bg-gradient-to-r from-purple-500 to-pink-500 text-white border-2 border-black px-4 py-2 font-bold hover:translate-x-0.5 hover:translate-y-0.5 transition-transform disabled:opacity-50 disabled:cursor-not-allowed text-sm"
        >
          POST
        </button>
      </div>
    </div>
  );
}