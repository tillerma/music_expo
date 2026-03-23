import { useState, useEffect, useRef } from 'react';
import { songPosts as initialPosts, dailyEmojiSets, currentUser } from '../data/mockData';
import { SongPost, Comment, SpotifyTrack } from '../types';
import { ChevronDown, ChevronUp, MessageCircle, ExternalLink, Search, X, Loader2 } from 'lucide-react';
import { searchTracks, getAudioFeatures } from '../api/spotify';
import { isLoggedIn } from '../utils/spotifyAuth';

interface SongPostComponentProps {
  post: SongPost;
  emojiSet: string[];
  onReaction: (postId: string, emoji: string) => void;
  onAddComment: (postId: string, comment: Comment) => void;
}

// ─── Song search component ────────────────────────────────────────────────────

interface SelectedSong {
  id:        string;
  title:     string;
  artist:    string;
  albumArt:  string;
  spotifyUrl: string;
}

function SongSearchPicker({
  onSelect,
  onClear,
  selected,
}: {
  onSelect:  (song: SelectedSong) => void;
  onClear:   () => void;
  selected:  SelectedSong | null;
}) {
  const [query,   setQuery]   = useState('');
  const [results, setResults] = useState<SpotifyTrack[]>([]);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced search — fires 400ms after user stops typing
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) { setResults([]); return; }

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await searchTracks(query);
        setResults(data.tracks.items.slice(0, 6));
      } catch (e: any) {
        // If not logged in with Spotify, show a friendly message
        setError(isLoggedIn()
          ? 'Search failed. Try again.'
          : 'Log in with Spotify to search songs.');
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 400);

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query]);

  if (selected) {
    return (
      <div className="flex items-center gap-3 bg-purple-50 border-2 border-black p-3 mb-3">
        <img
          src={selected.albumArt}
          alt={selected.title}
          className="w-12 h-12 border-2 border-black object-cover flex-shrink-0"
        />
        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm truncate">{selected.title}</p>
          <p className="text-xs text-gray-500 truncate">{selected.artist}</p>
        </div>
        <button
          onClick={onClear}
          className="p-1 hover:bg-gray-200 border border-black flex-shrink-0"
          aria-label="Remove song"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="mb-3">
      {/* Search input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        <input
          type="text"
          placeholder="Search for a song or artist..."
          value={query}
          onChange={e => setQuery(e.target.value)}
          className="w-full bg-yellow-50 border-2 border-black pl-9 pr-4 py-2 text-sm focus:outline-none focus:border-purple-500"
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 animate-spin" />
        )}
      </div>

      {/* Error */}
      {error && (
        <p className="text-xs text-red-500 mt-1 px-1">{error}</p>
      )}

      {/* Results */}
      {results.length > 0 && (
        <div className="border-2 border-black border-t-0 divide-y-2 divide-gray-200 bg-white">
          {results.map(track => {
            const artist    = track.artists?.[0]?.name ?? 'Unknown Artist';
            const albumArt  = track.album?.images?.[0]?.url ?? '';
            const spotifyUrl = track.external_urls?.spotify ?? '';

            return (
              <button
                key={track.id}
                onClick={() => {
                  onSelect({
                    id:        track.id,
                    title:     track.name,
                    artist,
                    albumArt,
                    spotifyUrl,
                  });
                  setQuery('');
                  setResults([]);
                }}
                className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-purple-50 transition-colors"
              >
                {albumArt ? (
                  <img
                    src={albumArt}
                    alt={track.name}
                    className="w-10 h-10 border border-black object-cover flex-shrink-0"
                  />
                ) : (
                  <div className="w-10 h-10 bg-gray-200 border border-black flex-shrink-0" />
                )}
                <div className="min-w-0">
                  <p className="text-sm font-bold truncate">{track.name}</p>
                  <p className="text-xs text-gray-500 truncate">{artist}</p>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Empty state after search */}
      {!loading && query.trim() && results.length === 0 && !error && (
        <p className="text-xs text-gray-400 mt-1 px-1">No results found.</p>
      )}
    </div>
  );
}

// ─── New Post Modal ────────────────────────────────────────────────────────────

function NewPostModal({ onClose }: { onClose: () => void }) {
  const [selectedSong, setSelectedSong] = useState<SelectedSong | null>(null);
  const [caption,      setCaption]      = useState('');
  const [submitting,   setSubmitting]   = useState(false);

  const handlePost = async () => {
    if (!selectedSong || !caption.trim()) return;
    setSubmitting(true);

    try {
      // Fetch real audio features from Spotify for this track
      const features = await getAudioFeatures(selectedSong.id);

      // TODO: save post to your DB with features attached
      // For now just log it — this is the shape you'll store
      console.log('New post:', {
        userId:    currentUser.id,
        songId:    selectedSong.id,
        songTitle: selectedSong.title,
        artist:    selectedSong.artist,
        albumArt:  selectedSong.albumArt,
        spotifyUrl: selectedSong.spotifyUrl,
        caption:   caption.trim(),
        features,  // ← real Spotify audio features — ready for the map pipeline
        postedAt:  new Date().toISOString(),
      });

      onClose();
    } catch (e) {
      console.error('Failed to fetch audio features:', e);
      // Still allow posting without features in dev
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white border-4 border-black p-6 w-full max-w-md shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">SHARE TODAY'S SONG</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 border border-black">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Song search */}
        <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">Song</p>
        <SongSearchPicker
          selected={selectedSong}
          onSelect={setSelectedSong}
          onClear={() => setSelectedSong(null)}
        />

        {/* Caption */}
        <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">Caption</p>
        <textarea
          placeholder="Why this song today? (max 140 characters)"
          maxLength={140}
          value={caption}
          onChange={e => setCaption(e.target.value)}
          className="w-full bg-yellow-100 border-2 border-black px-4 py-2 mb-1 focus:outline-none focus:border-purple-500 resize-none h-24 text-sm"
        />
        <p className="text-xs text-gray-400 text-right mb-4">{caption.length}/140</p>

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 bg-gray-200 border-2 border-black px-4 py-2 font-bold hover:bg-gray-300 transition-colors"
          >
            CANCEL
          </button>
          <button
            onClick={handlePost}
            disabled={!selectedSong || !caption.trim() || submitting}
            className="flex-1 bg-gradient-to-r from-purple-500 to-pink-500 text-white border-2 border-black px-4 py-2 font-bold hover:translate-x-0.5 hover:translate-y-0.5 transition-transform disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {submitting ? <><Loader2 className="w-4 h-4 animate-spin" /> POSTING…</> : 'POST'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Feed Page ────────────────────────────────────────────────────────────────

export function FeedPage() {
  const todayEmojiSet = dailyEmojiSets[0];
  const [posts, setPosts] = useState(initialPosts.filter(p => p.date === '2026-02-12'));
  const [showNewPost, setShowNewPost] = useState(false);

  const handleReaction = (postId: string, emoji: string) => {
    setPosts(posts.map(post => {
      if (post.id === postId) {
        const existingReaction = post.reactions.find(r => r.userId === 'user-1');
        if (existingReaction) {
          return { ...post, reactions: post.reactions.filter(r => r.userId !== 'user-1') };
        } else {
          return { ...post, reactions: [...post.reactions, { emoji, userId: 'user-1', userName: 'musiclover' }] };
        }
      }
      return post;
    }));
  };

  const handleAddComment = (postId: string, comment: Comment) => {
    setPosts(posts.map(post => {
      if (post.id === postId) {
        return { ...post, comments: [...post.comments, comment] };
      }
      return post;
    }));
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="sticky top-0 bg-white border-b-4 border-black z-10">
        <div className="px-4 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold">Today's Songs</h1>
            <p className="text-sm text-gray-600">February 12, 2026</p>
          </div>
          <button
            onClick={() => setShowNewPost(true)}
            className="bg-gradient-to-r from-purple-500 to-pink-500 text-white px-4 py-2 border-2 border-black font-bold hover:translate-x-0.5 hover:translate-y-0.5 transition-transform shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]"
          >
            + POST
          </button>
        </div>

        {/* Today's Emoji Set */}
        <div className="px-4 pb-3">
          <p className="text-xs text-gray-600 mb-2 font-bold">TODAY'S EMOTIONAL PALETTE:</p>
          <div className="flex gap-2">
            {todayEmojiSet.emojis.map((emoji, i) => (
              <div
                key={i}
                className="w-10 h-10 bg-gradient-to-br from-blue-400 to-purple-400 border-2 border-black flex items-center justify-center text-xl shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
              >
                {emoji}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* New Post Modal */}
      {showNewPost && <NewPostModal onClose={() => setShowNewPost(false)} />}

      {/* Feed */}
      <div className="divide-y-2 divide-gray-300">
        {posts.map((post) => (
          <SongPostComponent
            key={post.id}
            post={post}
            emojiSet={todayEmojiSet.emojis}
            onReaction={handleReaction}
            onAddComment={handleAddComment}
          />
        ))}
      </div>

      {posts.length === 0 && (
        <div className="text-center py-16 text-gray-500">
          <p>No songs posted yet today.</p>
          <p className="text-sm mt-2">Be the first to share!</p>
        </div>
      )}
    </div>
  );
}

// ─── Song Post Component ──────────────────────────────────────────────────────

function SongPostComponent({ post, emojiSet, onReaction, onAddComment }: SongPostComponentProps) {
  const [showReactions,   setShowReactions]   = useState(false);
  const [showComments,    setShowComments]    = useState(false);
  const [showAddComment,  setShowAddComment]  = useState(false);
  const userReaction = post.reactions.find(r => r.userId === 'user-1');

  return (
    <div className="px-4 py-6 bg-white">
      {/* User Info */}
      <div className="flex items-center gap-3 mb-4">
        <img src={post.user.avatarUrl} alt={post.user.username} className="w-10 h-10 border-2 border-black object-cover" />
        <div>
          <p className="font-bold">{post.user.displayName}</p>
          <p className="text-sm text-gray-600">@{post.user.username}</p>
        </div>
      </div>

      {/* Album Art & Song Info */}
      <div className="flex gap-4 mb-3">
        <img src={post.albumArt} alt={post.songTitle} className="w-24 h-24 border-2 border-black object-cover shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]" />
        <div className="flex flex-col justify-center">
          <p className="font-bold">{post.songTitle}</p>
          <p className="text-sm text-gray-600">{post.artist}</p>
          <a href={post.spotifyUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:text-blue-800 mt-2 font-bold underline">
            OPEN IN SPOTIFY
          </a>
        </div>
      </div>

      {/* Caption */}
      <p className="text-black mb-4">{post.caption}</p>

      {/* Reactions */}
      <div className="flex items-center gap-2 flex-wrap mb-3">
        {post.reactions.map((reaction, i) => (
          <div key={i} className="bg-gradient-to-r from-yellow-300 to-pink-300 border-2 border-black px-3 py-1 text-sm flex items-center gap-1 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
            <span>{reaction.emoji}</span>
            <span className="text-black font-bold">{reaction.userName}</span>
          </div>
        ))}
        <button
          onClick={() => setShowReactions(!showReactions)}
          className={`px-3 py-1 text-sm border-2 border-black transition-colors font-bold ${userReaction ? 'bg-gradient-to-r from-blue-400 to-purple-400 text-white' : 'bg-white hover:bg-gray-100'}`}
        >
          {userReaction ? userReaction.emoji : '+'}
        </button>
      </div>

      {/* Emoji Picker */}
      {showReactions && (
        <div className="mt-3 flex gap-2 p-3 bg-gradient-to-r from-blue-100 to-purple-100 border-2 border-black mb-3">
          {emojiSet.map((emoji, i) => (
            <button key={i} onClick={() => { onReaction(post.id, emoji); setShowReactions(false); }} className="w-10 h-10 hover:bg-white border-2 border-transparent hover:border-black flex items-center justify-center text-xl transition-all">
              {emoji}
            </button>
          ))}
        </div>
      )}

      {/* Comments */}
      <div className="border-t-2 border-gray-300 pt-3">
        <button onClick={() => setShowComments(!showComments)} className="flex items-center gap-2 text-sm font-bold text-gray-700 hover:text-black transition-colors">
          <MessageCircle className="w-4 h-4" />
          <span>{post.comments.length} {post.comments.length === 1 ? 'COMMENT' : 'COMMENTS'}</span>
          {showComments ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        {showComments && (
          <div className="mt-4 space-y-4">
            <button onClick={() => setShowAddComment(!showAddComment)} className="w-full bg-gradient-to-r from-green-400 to-blue-400 text-white px-4 py-2 border-2 border-black font-bold hover:translate-x-0.5 hover:translate-y-0.5 transition-transform shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
              + ADD COMMENT
            </button>
            {showAddComment && <AddCommentForm postId={post.id} onAddComment={onAddComment} onCancel={() => setShowAddComment(false)} />}
            {post.comments.map((comment) => <CommentComponent key={comment.id} comment={comment} />)}
            {post.comments.length === 0 && !showAddComment && <p className="text-sm text-gray-500 text-center py-4">No comments yet</p>}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Comment components (unchanged) ──────────────────────────────────────────

function CommentComponent({ comment }: { comment: Comment }) {
  return (
    <div className="flex gap-3 p-3 bg-gradient-to-r from-blue-50 to-purple-50 border-2 border-black">
      <div className="flex flex-col items-center gap-1 min-w-[60px]">
        <img src={comment.user.avatarUrl} alt={comment.user.username} className="w-12 h-12 border-2 border-black object-cover" />
        <p className="text-xs font-bold text-center">{comment.user.displayName}</p>
        <p className="text-xs text-gray-600">@{comment.user.username}</p>
      </div>
      <div className="flex-1">
        {comment.song && (
          <div className="mb-3 flex gap-2 bg-white border-2 border-black p-2 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
            <img src={comment.song.albumArt} alt={comment.song.songTitle} className="w-12 h-12 border-2 border-black object-cover" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold truncate">{comment.song.songTitle}</p>
              <p className="text-xs text-gray-600 truncate">{comment.song.artist}</p>
            </div>
            <a href={comment.song.spotifyUrl} target="_blank" rel="noopener noreferrer" className="self-center p-2 bg-green-500 hover:bg-green-600 border-2 border-black transition-colors">
              <ExternalLink className="w-4 h-4 text-white" />
            </a>
          </div>
        )}
        <p className="text-sm text-black">{comment.caption}</p>
      </div>
    </div>
  );
}

function AddCommentForm({ postId, onAddComment, onCancel }: { postId: string; onAddComment: (postId: string, comment: Comment) => void; onCancel: () => void }) {
  const [caption,     setCaption]     = useState('');
  const [includeSong, setIncludeSong] = useState(false);
  const [songUrl,     setSongUrl]     = useState('');
  const [songTitle,   setSongTitle]   = useState('');
  const [artist,      setArtist]      = useState('');

  const handleSubmit = () => {
    if (!caption.trim()) return;
    const newComment: Comment = {
      id: `comment-${Date.now()}`,
      userId: currentUser.id,
      user: currentUser,
      caption: caption.trim(),
      timestamp: new Date().toISOString(),
    };
    if (includeSong && songTitle && artist) {
      newComment.song = {
        songTitle, artist,
        albumArt: 'https://images.unsplash.com/photo-1616663395403-2e0052b8e595?w=400',
        spotifyUrl: songUrl || 'https://open.spotify.com/track/example',
      };
    }
    onAddComment(postId, newComment);
    onCancel();
  };

  return (
    <div className="bg-white border-4 border-black p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
      <h3 className="text-sm font-bold mb-3">NEW COMMENT</h3>
      <textarea placeholder="Your comment (max 140 characters)" maxLength={140} value={caption} onChange={e => setCaption(e.target.value)} className="w-full bg-yellow-100 border-2 border-black px-3 py-2 mb-3 focus:outline-none focus:border-purple-500 resize-none h-20 text-sm" />
      <label className="flex items-center gap-2 mb-3 cursor-pointer">
        <input type="checkbox" checked={includeSong} onChange={e => setIncludeSong(e.target.checked)} className="w-4 h-4" />
        <span className="text-sm font-bold">Include a song</span>
      </label>
      {includeSong && (
        <div className="space-y-2 mb-3 p-3 bg-blue-50 border-2 border-black">
          <input type="text" placeholder="Song title" value={songTitle} onChange={e => setSongTitle(e.target.value)} className="w-full bg-white border-2 border-black px-3 py-2 focus:outline-none text-sm" />
          <input type="text" placeholder="Artist" value={artist} onChange={e => setArtist(e.target.value)} className="w-full bg-white border-2 border-black px-3 py-2 focus:outline-none text-sm" />
          <input type="text" placeholder="Spotify URL (optional)" value={songUrl} onChange={e => setSongUrl(e.target.value)} className="w-full bg-white border-2 border-black px-3 py-2 focus:outline-none text-sm" />
        </div>
      )}
      <div className="flex gap-2">
        <button onClick={onCancel} className="flex-1 bg-gray-200 border-2 border-black px-4 py-2 font-bold hover:bg-gray-300 text-sm">CANCEL</button>
        <button onClick={handleSubmit} disabled={!caption.trim()} className="flex-1 bg-gradient-to-r from-purple-500 to-pink-500 text-white border-2 border-black px-4 py-2 font-bold disabled:opacity-50 text-sm">POST</button>
      </div>
    </div>
  );
}