import { useState } from 'react';
import { songPosts, dailyEmojiSets } from '../data/mockData';
import { SongPost as SongPostType } from '../types';
import { Plus } from 'lucide-react';

export function FeedPage() {
  const todayEmojiSet = dailyEmojiSets[0];
  const [posts, setPosts] = useState(songPosts.filter(p => p.date === '2026-02-12'));
  const [showNewPost, setShowNewPost] = useState(false);

  const handleReaction = (postId: string, emoji: string) => {
    setPosts(posts.map(post => {
      if (post.id === postId) {
        const existingReaction = post.reactions.find(r => r.userId === 'user-1');
        if (existingReaction) {
          // Remove existing reaction
          return {
            ...post,
            reactions: post.reactions.filter(r => r.userId !== 'user-1'),
          };
        } else {
          // Add new reaction
          return {
            ...post,
            reactions: [...post.reactions, { emoji, userId: 'user-1', userName: 'musiclover' }],
          };
        }
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

      {/* Feed */}
      <div className="divide-y-2 divide-gray-300">
        {posts.map((post) => (
          <SongPostComponent
            key={post.id}
            post={post}
            emojiSet={todayEmojiSet.emojis}
            onReaction={handleReaction}
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

interface SongPostComponentProps {
  post: SongPostType;
  emojiSet: string[];
  onReaction: (postId: string, emoji: string) => void;
}

function SongPostComponent({ post, emojiSet, onReaction }: SongPostComponentProps) {
  const [showReactions, setShowReactions] = useState(false);
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
      <div className="flex items-center gap-2 flex-wrap">
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
        <div className="mt-3 flex gap-2 p-3 bg-gradient-to-r from-blue-100 to-purple-100 border-2 border-black">
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
    </div>
  );
}