import { useState, useEffect } from 'react';
import { songPosts as initialPosts, dailyEmojiSets, currentUser } from '../data/mockData';
import { SongPost, Comment } from '../types';
import { ChevronDown, ChevronUp, MessageCircle, ExternalLink } from 'lucide-react';
import { supabase } from '../lib/supabase'

interface SongPostComponentProps {
  post: SongPost;
  emojiSet: string[];
  onReaction: (postId: string, emoji: string) => void;
  onAddComment: (postId: string, comment: Comment) => void;
}

export function FeedPage() {
  const todayEmojiSet = dailyEmojiSets[0];
  const [posts, setPosts] = useState(initialPosts.filter(p => p.date === '2026-02-12'));
  const [showNewPost, setShowNewPost] = useState(false);

  const [sbPosts, setSbPosts] = useState([])
  useEffect(() => {
    async function getSbPosts() {
      const { data, error } = await supabase
        .from('posts')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) {
        console.error(error)
      } else {
        setSbPosts(data)
      }
    }
    getSbPosts()
  }, [])

  const handleReaction = (postId: string, emoji: string) => {
    setPosts(posts.map(post => {
      if (post.id === postId) {
        const existingReaction = post.reactions.find(r => r.userId === 'user-1');
        if (existingReaction) {
          return {
            ...post,
            reactions: post.reactions.filter(r => r.userId !== 'user-1'),
          };
        } else {
          return {
            ...post,
            reactions: [...post.reactions, { emoji, userId: 'user-1', userName: 'musiclover' }],
          };
        }
      }
      return post;
    }));
  };

  const handleAddComment = (postId: string, comment: Comment) => {
    setPosts(posts.map(post => {
      if (post.id === postId) {
        return {
          ...post,
          comments: [...post.comments, comment],
        };
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
      {showNewPost && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white border-4 border-black p-6 w-full max-w-md shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
            <h2 className="text-xl font-bold mb-4">SHARE TODAY'S SONG</h2>
            <input
              type="text"
              placeholder="Spotify URL"
              className="w-full bg-yellow-100 border-2 border-black px-4 py-2 mb-3 focus:outline-none focus:border-purple-500"
            />
            <textarea
              placeholder="Caption (max 140 characters)"
              maxLength={140}
              className="w-full bg-yellow-100 border-2 border-black px-4 py-2 mb-4 focus:outline-none focus:border-purple-500 resize-none h-24"
            />
            <div className="flex gap-2">
              <button
                onClick={() => setShowNewPost(false)}
                className="flex-1 bg-gray-200 border-2 border-black px-4 py-2 font-bold hover:bg-gray-300 transition-colors"
              >
                CANCEL
              </button>
              <button
                onClick={() => setShowNewPost(false)}
                className="flex-1 bg-gradient-to-r from-purple-500 to-pink-500 text-white border-2 border-black px-4 py-2 font-bold hover:translate-x-0.5 hover:translate-y-0.5 transition-transform"
              >
                POST
              </button>
            </div>
          </div>
        </div>
      )}

      {/* OG SUPABASE TEST DATA */}
      <div className="p-4 border-b-4 border-red-500">
        <h2 className="font-bold mb-2">Supabase Test Data:</h2>
        {sbPosts.map((post) => (
          <div key={post.id} className="mb-2 p-2 border">
            <p>👤 {post.username}</p>
            <p>🎵 {post.song.name} by {post.song.artist}</p>
            <p>{post.user_msg}</p>
            <p>Link: {post.song.link}</p>
          </div>
        ))}
      </div>

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

function SongPostComponent({ post, emojiSet, onReaction, onAddComment }: SongPostComponentProps) {
  const [showReactions, setShowReactions] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [showAddComment, setShowAddComment] = useState(false);
  const userReaction = post.reactions.find(r => r.userId === 'user-1');

  return (
    <div className="px-4 py-6 bg-white">
      {/* User Info */}
      <div className="flex items-center gap-3 mb-4">
        <img
          src={post.user.avatarUrl}
          alt={post.user.username}
          className="w-10 h-10 border-2 border-black object-cover"
        />
        <div>
          <p className="font-bold">{post.user.displayName}</p>
          <p className="text-sm text-gray-600">@{post.user.username}</p>
        </div>
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

      {/* Reactions */}
      <div className="flex items-center gap-2 flex-wrap mb-3">
        {post.reactions.map((reaction, i) => (
          <div
            key={i}
            className="bg-gradient-to-r from-yellow-300 to-pink-300 border-2 border-black px-3 py-1 text-sm flex items-center gap-1 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
          >
            <span>{reaction.emoji}</span>
            <span className="text-black font-bold">{reaction.userName}</span>
          </div>
        ))}
        
        {/* Add Reaction Button */}
        <button
          onClick={() => setShowReactions(!showReactions)}
          className={`px-3 py-1 text-sm border-2 border-black transition-colors font-bold ${
            userReaction
              ? 'bg-gradient-to-r from-blue-400 to-purple-400 text-white'
              : 'bg-white hover:bg-gray-100'
          }`}
        >
          {userReaction ? userReaction.emoji : '+'}
        </button>
      </div>

      {/* Emoji Picker */}
      {showReactions && (
        <div className="mt-3 flex gap-2 p-3 bg-gradient-to-r from-blue-100 to-purple-100 border-2 border-black mb-3">
          {emojiSet.map((emoji, i) => (
            <button
              key={i}
              onClick={() => {
                onReaction(post.id, emoji);
                setShowReactions(false);
              }}
              className="w-10 h-10 hover:bg-white border-2 border-transparent hover:border-black flex items-center justify-center text-xl transition-all"
            >
              {emoji}
            </button>
          ))}
        </div>
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
              <CommentComponent key={comment.id} comment={comment} />
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
}

function CommentComponent({ comment }: CommentComponentProps) {
  return (
    <div className="flex gap-3 p-3 bg-gradient-to-r from-blue-50 to-purple-50 border-2 border-black">
      {/* User Info */}
      <div className="flex flex-col items-center gap-1 min-w-[60px]">
        <img
          src={comment.user.avatarUrl}
          alt={comment.user.username}
          className="w-12 h-12 border-2 border-black object-cover"
        />
        <p className="text-xs font-bold text-center">{comment.user.displayName}</p>
        <p className="text-xs text-gray-600">@{comment.user.username}</p>
      </div>

      {/* Comment Content */}
      <div className="flex-1">
        {comment.song && (
          <div className="mb-3 flex gap-2 bg-white border-2 border-black p-2 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
            <img
              src={comment.song.albumArt}
              alt={comment.song.songTitle}
              className="w-12 h-12 border-2 border-black object-cover"
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold truncate">{comment.song.songTitle}</p>
              <p className="text-xs text-gray-600 truncate">{comment.song.artist}</p>
            </div>
            <a
              href={comment.song.spotifyUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="self-center p-2 bg-green-500 hover:bg-green-600 border-2 border-black transition-colors"
              title="Open in Spotify"
            >
              <ExternalLink className="w-4 h-4 text-white" />
            </a>
          </div>
        )}
        <p className="text-sm text-black">{comment.caption}</p>
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
        songTitle,
        artist,
        albumArt: 'https://images.unsplash.com/photo-1616663395403-2e0052b8e595?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxhbGJ1bSUyMGNvdmVyJTIwdmlueWx8ZW58MXx8fHwxNzcwODEwMjE3fDA&ixlib=rb-4.1.0&q=80&w=1080',
        spotifyUrl: songUrl || 'https://open.spotify.com/track/example',
      };
    }

    onAddComment(postId, newComment);
    setCaption('');
    setIncludeSong(false);
    setSongUrl('');
    setSongTitle('');
    setArtist('');
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
          disabled={!caption.trim()}
          className="flex-1 bg-gradient-to-r from-purple-500 to-pink-500 text-white border-2 border-black px-4 py-2 font-bold hover:translate-x-0.5 hover:translate-y-0.5 transition-transform disabled:opacity-50 disabled:cursor-not-allowed text-sm"
        >
          POST
        </button>
      </div>
    </div>
  );
}
