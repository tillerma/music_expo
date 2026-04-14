import { useState, useEffect } from 'react';
import { Music, Trash2, X, Pencil, Check } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { currentUser } from '../auth/currentUserInfo';
import { HARDCODED_EMOJIS } from './FeedPage';

// ── Supabase setup for playlists. Run this SQL in your Supabase SQL editor:
//
//   -- App uses Spotify auth (not Supabase auth) so user_id must be text, not uuid.
//   -- 1. Drop the FK constraint that points to auth.users
//   alter table playlists drop constraint if exists playlists_user_id_fkey;
//
//   -- 2. Change user_id from uuid to text (Spotify IDs are plain strings)
//   alter table playlists alter column user_id type text using user_id::text;
//
//   -- 3. Add a permissive RLS policy (auth.uid() won't work with Spotify auth)
//   alter table playlists enable row level security;
//   drop policy if exists "playlists_allow_all" on playlists;
//   create policy "playlists_allow_all" on playlists for all using (true) with check (true);


const EMOJI_NAMES: Record<string, string> = {
  '🔥': 'Fire',
  '🪩': 'Disco',
  '💔': 'Heartbreak',
  '✨': 'Sparkle',
  '🌙': 'Night Vibes',
};

interface PlaylistSong {
  id: string;       // song id
  postId: string;   // source post — used to remove the reaction
  spotifyUrl: string;
  albumArt: string;
  songTitle: string;
  artist: string;
}

interface Playlist {
  id: string;          // '__emoji__🔥' for auto-playlists, UUID for custom
  name: string;
  emoji: string | null;
  songs: PlaylistSong[];
  isAuto: boolean;     // true = derived from reactions, cannot be renamed/deleted
}

export function PlaylistsPage() {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [selected, setSelected] = useState<Playlist | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmoji, setNewEmoji] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  useEffect(() => {
    loadAll();
    const onVisible = () => { if (document.visibilityState === 'visible') loadAll(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);

  async function loadAll() {
    // Step 1 — get all (emoji, post_id) reactions for this user
    const { data: reactionRows, error: rErr } = await supabase
      .from('reactions')
      .select('emoji, post_id')
      .eq('user_id', currentUser.id);

    if (rErr) console.error('Error loading reactions:', rErr);

    const rows = reactionRows ?? [];
    const songsByEmoji: Record<string, PlaylistSong[]> = {};
    HARDCODED_EMOJIS.forEach(e => { songsByEmoji[e] = []; });

    if (rows.length > 0) {
      // Step 2 — fetch songs for those posts in a single query
      const postIds = [...new Set(rows.map((r: any) => r.post_id))];
      const { data: postRows, error: pErr } = await supabase
        .from('posts')
        .select('id, songs!posts_song_id_fkey (id, spotify_url, song_title, artist, album_art)')
        .in('id', postIds);

      if (pErr) console.error('Error loading post songs:', pErr);

      const songByPost: Record<string, { id: string; spotifyUrl: string; albumArt: string; songTitle: string; artist: string }> = {};
      (postRows ?? []).forEach((p: any) => {
        if (p.songs) {
          songByPost[p.id] = {
            id: p.songs.id,
            spotifyUrl: p.songs.spotify_url ?? '',
            albumArt: p.songs.album_art ?? 'https://placehold.co/200x200',
            songTitle: p.songs.song_title ?? 'Unknown',
            artist: p.songs.artist ?? 'Unknown',
          };
        }
      });

      rows.forEach((row: any) => {
        const base = songByPost[row.post_id];
        if (!base || !songsByEmoji[row.emoji]) return;
        // Deduplicate by postId (one reaction per post)
        if (!songsByEmoji[row.emoji].find(s => s.postId === row.post_id)) {
          songsByEmoji[row.emoji].push({ ...base, postId: row.post_id });
        }
      });
    }

    // Custom playlists from DB — scoped to the current user
    const { data: customRows, error: cErr } = await supabase
      .from('playlists')
      .select('id, name, emoji')
      .eq('user_id', currentUser.id);
    if (cErr) console.error('Error loading playlists:', cErr);

    const customPlaylists: Playlist[] = (customRows ?? []).map((p: any) => ({
      id: p.id,
      name: p.name,
      emoji: p.emoji ?? null,
      songs: p.emoji ? (songsByEmoji[p.emoji] ?? []) : [],
      isAuto: false,
    }));

    // Emojis already covered by a custom playlist — suppress the auto version
    const customEmojis = new Set(customPlaylists.map(p => p.emoji).filter(Boolean));

    // Auto emoji playlists — only for emojis the user has reacted with AND no custom playlist covers it
    const autoPlaylists: Playlist[] = HARDCODED_EMOJIS
      .filter(e => songsByEmoji[e].length > 0 && !customEmojis.has(e))
      .map(e => ({
        id: `__emoji__${e}`,
        name: EMOJI_NAMES[e] ?? e,
        emoji: e,
        songs: songsByEmoji[e],
        isAuto: true,
      }));

    const next = [...autoPlaylists, ...customPlaylists];
    setPlaylists(next);

    // Keep selected in sync if it's open
    setSelected(prev => {
      if (!prev) return null;
      return next.find(p => p.id === prev.id) ?? null;
    });
  }

  async function handleCreate() {
    if (!newName.trim()) return;
    setIsCreating(true);
    setCreateError(null);
    const { error } = await supabase.from('playlists').insert({
      id: crypto.randomUUID(),
      user_id: currentUser.id,
      name: newName.trim(),
      emoji: newEmoji || null,
    });
    if (error) {
      console.error('Error creating playlist:', error);
      setCreateError(error.message);
    } else {
      setShowNew(false);
      setNewName('');
      setNewEmoji('');
      await loadAll();
    }
    setIsCreating(false);
  }

  async function handleDeletePlaylist(id: string) {
    const { error } = await supabase.from('playlists').delete().eq('id', id).eq('user_id', currentUser.id);
    if (error) { console.error('Error deleting playlist:', error); return; }
    setSelected(null);
    await loadAll();
  }

  async function handleRenamePlaylist(id: string, newName: string, emoji?: string | null) {
    if (id.startsWith('__emoji__')) {
      // Auto playlist — promote to custom by inserting into DB with the new name
      const { error } = await supabase.from('playlists').insert({
        id: crypto.randomUUID(),
        user_id: currentUser.id,
        name: newName.trim(),
        emoji: emoji ?? null,
      });
      if (error) { console.error('Error creating renamed playlist:', error); return; }
    } else {
      // Delete + re-insert to work around missing UPDATE RLS policy
      await supabase.from('playlists').delete().eq('id', id).eq('user_id', currentUser.id);
      const { error } = await supabase.from('playlists').insert({
        id,
        user_id: currentUser.id,
        name: newName.trim(),
        emoji: emoji ?? null,
      });
      if (error) { console.error('Error renaming playlist:', error); return; }
    }
    await loadAll();
  }

  // Removing a song from a playlist = removing the reaction on that post
  async function handleRemoveSong(_playlist: Playlist, song: PlaylistSong) {
    const { error } = await supabase
      .from('reactions')
      .delete()
      .eq('user_id', currentUser.id)
      .eq('post_id', song.postId);

    if (error) { console.error('Error removing reaction:', error); return; }
    await loadAll();
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="sticky top-0 bg-white border-b-4 border-black z-10">
        <div className="px-4 py-4 flex justify-between items-center">
          <h1 className="text-xl font-bold">MY PLAYLISTS</h1>
          <button
            onClick={() => setShowNew(true)}
            className="bg-gradient-to-r from-green-400 to-blue-400 text-white px-4 py-2 border-2 border-black font-bold hover:translate-x-0.5 hover:translate-y-0.5 transition-transform shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]"
          >
            + NEW
          </button>
        </div>
      </div>

      {/* New Playlist Modal */}
      {showNew && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white border-4 border-black p-6 w-full max-w-md shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
            <h2 className="text-xl font-bold mb-4">CREATE PLAYLIST</h2>
            <input
              type="text"
              placeholder="Playlist name"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCreate()}
              className="w-full bg-blue-100 border-2 border-black px-4 py-2 mb-4 focus:outline-none focus:border-purple-500"
            />
            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-2 font-bold">CHOOSE AN EMOJI:</p>
              {(() => {
                const usedEmojis = new Set(playlists.map(p => p.emoji).filter(Boolean));
                const availableEmojis = HARDCODED_EMOJIS.filter(e => !usedEmojis.has(e));
                return availableEmojis.length > 0 ? (
                  <div className="flex gap-3">
                    {availableEmojis.map(emoji => (
                      <button
                        key={emoji}
                        onClick={() => setNewEmoji(emoji === newEmoji ? '' : emoji)}
                        className={`w-12 h-12 flex items-center justify-center text-2xl border-2 border-black transition-all ${
                          emoji === newEmoji ? 'bg-gradient-to-br from-yellow-300 to-pink-300 scale-110' : 'bg-white hover:bg-gray-100'
                        }`}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-500">All emojis already have playlists.</p>
                );
              })()}
              {newEmoji && (
                <p className="text-xs text-gray-500 mt-2">Songs you reacted to with {newEmoji} will appear here.</p>
              )}
            </div>
            {createError && (
              <div className="mb-3 text-xs text-red-600 font-bold border-2 border-red-400 bg-red-50 px-3 py-2">
                {createError.includes('security policy') || createError.includes('row-level') ? (
                  <>
                    <p className="mb-1">RLS policy blocking insert. Run in Supabase SQL editor:</p>
                    <code className="block bg-red-100 p-1 font-mono text-[10px] whitespace-pre leading-relaxed">
                      {'create policy "playlists_allow_all"\non playlists for all\nusing (true) with check (true);'}
                    </code>
                  </>
                ) : createError.includes('user_id') ? (
                  <p>Missing user_id column — run the SQL in PlaylistsPage.tsx to fix.</p>
                ) : (
                  <p>{createError}</p>
                )}
              </div>
            )}
            <div className="flex gap-2">
              <button
                onClick={() => { setShowNew(false); setNewName(''); setNewEmoji(''); setCreateError(null); }}
                className="flex-1 bg-gray-200 border-2 border-black px-4 py-2 font-bold hover:bg-gray-300"
              >
                CANCEL
              </button>
              <button
                onClick={handleCreate}
                disabled={isCreating || !newName.trim()}
                className="flex-1 bg-gradient-to-r from-purple-500 to-pink-500 text-white border-2 border-black px-4 py-2 font-bold disabled:opacity-50"
              >
                {isCreating ? 'CREATING...' : 'CREATE'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Playlist list */}
      <div className="p-4 space-y-3">
        {playlists.length === 0 && (
          <p className="text-center text-gray-500 py-12 text-sm">
            No playlists yet.<br />React to posts or tap + NEW to get started.
          </p>
        )}
        {playlists.map(pl => (
          <PlaylistCard
            key={pl.id}
            playlist={pl}
            onClick={() => setSelected(pl)}
          />
        ))}
      </div>

      {/* Detail / edit modal */}
      {selected && (
        <PlaylistDetailModal
          playlist={selected}
          onClose={() => setSelected(null)}
          onRemoveSong={song => handleRemoveSong(selected, song)}
          onRename={(name) => handleRenamePlaylist(selected.id, name, selected.emoji)}
          onDelete={!selected.isAuto ? () => handleDeletePlaylist(selected.id) : undefined}
        />
      )}
    </div>
  );
}

// ── Playlist card ───────────────────────────────────────────────

function PlaylistCard({ playlist, onClick }: { playlist: Playlist; onClick: () => void }) {
  const gradient = playlist.emoji ? 'from-purple-300 to-blue-300' : 'from-gray-200 to-gray-300';

  return (
    <button
      onClick={onClick}
      className="w-full bg-white border-4 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] overflow-hidden text-left hover:translate-x-0.5 hover:translate-y-0.5 transition-transform"
    >
      <div className={`bg-gradient-to-r ${gradient} p-4 flex items-center gap-3`}>
        <div className="w-12 h-12 bg-white border-2 border-black flex items-center justify-center flex-shrink-0">
          {playlist.emoji ? <span className="text-2xl">{playlist.emoji}</span> : <Music className="w-6 h-6 text-black" />}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-black truncate">{playlist.name}</h3>
          <p className="text-sm text-black/70 font-medium">
            {playlist.songs.length} {playlist.songs.length === 1 ? 'SONG' : 'SONGS'}
            {playlist.isAuto && <span className="ml-2 text-xs opacity-60">· from reactions</span>}
          </p>
        </div>
        <Pencil className="w-4 h-4 text-black/50 flex-shrink-0" />
      </div>
    </button>
  );
}

// ── Detail / edit modal ─────────────────────────────────────────

function PlaylistDetailModal({
  playlist, onClose, onRemoveSong, onRename, onDelete,
}: {
  playlist: Playlist;
  onClose: () => void;
  onRemoveSong: (song: PlaylistSong) => void;
  onRename?: (name: string) => void;
  onDelete?: () => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(playlist.name);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const gradient = playlist.emoji ? 'from-purple-300 to-blue-300' : 'from-gray-200 to-gray-300';

  function submitRename() {
    if (editName.trim() && editName.trim() !== playlist.name) {
      onRename?.(editName.trim());
    }
    setIsEditing(false);
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white border-4 border-black w-full max-w-md max-h-[85vh] overflow-hidden shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`bg-gradient-to-r ${gradient} p-6 border-b-4 border-black`}>
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 bg-white border-2 border-black flex items-center justify-center flex-shrink-0">
              {playlist.emoji ? <span className="text-3xl">{playlist.emoji}</span> : <Music className="w-7 h-7 text-black" />}
            </div>

            <div className="flex-1 min-w-0">
              {isEditing ? (
                <div className="flex items-center gap-1">
                  <input
                    autoFocus
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') submitRename(); if (e.key === 'Escape') setIsEditing(false); }}
                    className="flex-1 bg-white border-2 border-black px-2 py-1 font-bold text-black focus:outline-none text-base"
                  />
                  <button onClick={submitRename} className="p-1 bg-white border-2 border-black hover:bg-green-100">
                    <Check className="w-4 h-4 text-black" />
                  </button>
                  <button onClick={() => setIsEditing(false)} className="p-1 bg-white border-2 border-black hover:bg-red-100">
                    <X className="w-4 h-4 text-black" />
                  </button>
                </div>
              ) : (
                <h2 className="text-xl font-bold text-black truncate">{playlist.name}</h2>
              )}
              <p className="text-sm text-black/70 font-medium mt-0.5">{playlist.songs.length} SONGS</p>
            </div>

            <button onClick={onClose} className="p-1 hover:bg-black/10 border-2 border-black bg-white flex-shrink-0 self-start">
              <X className="w-4 h-4 text-black" />
            </button>
          </div>

          {/* Edit actions */}
          <div className="flex gap-2 mt-3">
            {!isEditing && (
              <button
                onClick={() => { setEditName(playlist.name); setIsEditing(true); }}
                className="flex items-center gap-1 px-3 py-1 bg-white border-2 border-black text-xs font-bold hover:bg-gray-100"
              >
                <Pencil className="w-3 h-3" /> RENAME
              </button>
            )}
            {!playlist.isAuto && (!confirmDelete ? (
              <button
                onClick={() => setConfirmDelete(true)}
                className="flex items-center gap-1 px-3 py-1 bg-white border-2 border-black text-xs font-bold hover:bg-red-50 text-red-600"
              >
                <Trash2 className="w-3 h-3" /> DELETE PLAYLIST
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-red-600">Sure?</span>
                <button
                  onClick={() => { onDelete?.(); onClose(); }}
                  className="px-3 py-1 bg-red-500 text-white border-2 border-black text-xs font-bold"
                >
                  YES
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="px-3 py-1 bg-white border-2 border-black text-xs font-bold"
                >
                  NO
                </button>
              </div>
            ))}
          </div>

          {playlist.isAuto && (
            <p className="text-xs text-black/60 mt-2">Remove a song by clicking the trash icon — this removes your reaction.</p>
          )}
        </div>

        {/* Song list */}
        <div className="overflow-y-auto p-4 space-y-2 flex-1 bg-gradient-to-br from-blue-50 to-purple-50">
          {playlist.songs.map(song => (
            <div key={song.postId} className="flex gap-3 p-3 bg-white border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
              <img
                src={song.albumArt}
                alt={song.songTitle}
                onClick={() => window.open(song.spotifyUrl || `https://open.spotify.com/track/${song.id}`, '_blank', 'noopener')}
                className="w-14 h-14 border-2 border-black object-cover flex-shrink-0 cursor-pointer"
              />
              <div
                className="flex-1 min-w-0 flex flex-col justify-center cursor-pointer"
                onClick={() => window.open(song.spotifyUrl || `https://open.spotify.com/track/${song.id}`, '_blank', 'noopener')}
              >
                <p className="font-bold truncate text-black">{song.songTitle}</p>
                <p className="text-sm text-gray-600 truncate font-medium">{song.artist}</p>
              </div>
              <button
                onClick={() => onRemoveSong(song)}
                className="p-2 hover:bg-red-100 border-2 border-black bg-white transition-colors self-center flex-shrink-0"
                title="Remove (unreact)"
              >
                <Trash2 className="w-4 h-4 text-black" />
              </button>
            </div>
          ))}
          {playlist.songs.length === 0 && (
            <p className="text-center text-gray-500 text-sm py-8">No songs yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}
