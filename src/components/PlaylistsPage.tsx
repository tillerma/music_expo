import { useState } from 'react';
import { playlists as initialPlaylists } from '../data/mockData';
import { Playlist } from '../types';
import { Plus, Music, Trash2, Globe } from 'lucide-react';

export function PlaylistsPage() {
  const [playlists, setPlaylists] = useState(initialPlaylists);
  const [selectedPlaylist, setSelectedPlaylist] = useState<Playlist | null>(null);
  const [showNewPlaylist, setShowNewPlaylist] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [newPlaylistEmoji, setNewPlaylistEmoji] = useState('');

  const emojiOptions = ['🌧️', '🔥', '🌙', '✨', '🌊', '🦋', '🎭', '🌸', '⚡', '🔮'];

  const handleCreatePlaylist = () => {
    if (!newPlaylistName.trim()) return;

    const newPlaylist: Playlist = {
      id: `playlist-${Date.now()}`,
      name: newPlaylistName,
      emoji: newPlaylistEmoji || undefined,
      songs: [],
    };

    setPlaylists([...playlists, newPlaylist]);
    setNewPlaylistName('');
    setNewPlaylistEmoji('');
    setShowNewPlaylist(false);
  };

  const handleDeletePlaylist = (playlistId: string) => {
    setPlaylists(playlists.filter(p => p.id !== playlistId));
    if (selectedPlaylist?.id === playlistId) {
      setSelectedPlaylist(null);
    }
  };

  const handleRemoveSong = (playlistId: string, songId: string) => {
    setPlaylists(playlists.map(playlist => {
      if (playlist.id === playlistId) {
        return {
          ...playlist,
          songs: playlist.songs.filter(s => s.id !== songId),
        };
      }
      return playlist;
    }));
    
    if (selectedPlaylist?.id === playlistId) {
      setSelectedPlaylist({
        ...selectedPlaylist,
        songs: selectedPlaylist.songs.filter(s => s.id !== songId),
      });
    }
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="sticky top-0 bg-white border-b-4 border-black z-10">
        <div className="px-4 py-4 flex justify-between items-center">
          <h1 className="text-xl font-bold">MY PLAYLISTS</h1>
          <button
            onClick={() => setShowNewPlaylist(true)}
            className="bg-gradient-to-r from-green-400 to-blue-400 text-white px-4 py-2 border-2 border-black font-bold hover:translate-x-0.5 hover:translate-y-0.5 transition-transform shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]"
          >
            + NEW
          </button>
        </div>
      </div>

      {/* New Playlist Modal */}
      {showNewPlaylist && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white border-4 border-black p-6 w-full max-w-md shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
            <h2 className="text-xl font-bold mb-4">CREATE PLAYLIST</h2>
            
            <input
              type="text"
              placeholder="Playlist name"
              value={newPlaylistName}
              onChange={(e) => setNewPlaylistName(e.target.value)}
              className="w-full bg-blue-100 border-2 border-black px-4 py-2 mb-4 focus:outline-none focus:border-purple-500"
            />

            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-2 font-bold">CHOOSE AN EMOJI (OPTIONAL):</p>
              <div className="grid grid-cols-5 gap-2">
                {emojiOptions.map(emoji => (
                  <button
                    key={emoji}
                    onClick={() => setNewPlaylistEmoji(emoji === newPlaylistEmoji ? '' : emoji)}
                    className={`w-12 h-12 flex items-center justify-center text-2xl transition-all border-2 border-black ${
                      emoji === newPlaylistEmoji
                        ? 'bg-gradient-to-br from-yellow-300 to-pink-300 scale-110'
                        : 'bg-white hover:bg-gray-100'
                    }`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => {
                  setShowNewPlaylist(false);
                  setNewPlaylistName('');
                  setNewPlaylistEmoji('');
                }}
                className="flex-1 bg-gray-200 border-2 border-black px-4 py-2 font-bold hover:bg-gray-300 transition-colors"
              >
                CANCEL
              </button>
              <button
                onClick={handleCreatePlaylist}
                className="flex-1 bg-gradient-to-r from-purple-500 to-pink-500 text-white border-2 border-black px-4 py-2 font-bold hover:translate-x-0.5 hover:translate-y-0.5 transition-transform"
              >
                CREATE
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Playlists List */}
      <div className="p-4 space-y-3">
        {playlists.map((playlist) => {
          const isMasterPlaylist = playlist.id === 'playlist-master';
          const gradientColor = isMasterPlaylist 
            ? 'from-orange-400 to-pink-400' 
            : playlist.emoji 
            ? 'from-purple-300 to-blue-300'
            : 'from-gray-200 to-gray-300';

          return (
            <div
              key={playlist.id}
              className="bg-white border-4 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] overflow-hidden"
            >
              <div className={`bg-gradient-to-r ${gradientColor} p-4 border-b-4 border-black flex items-center gap-3`}>
                {isMasterPlaylist ? (
                  <div className="w-12 h-12 bg-white border-2 border-black flex items-center justify-center">
                    <Globe className="w-6 h-6 text-black" />
                  </div>
                ) : playlist.emoji ? (
                  <div className="w-12 h-12 bg-white border-2 border-black flex items-center justify-center text-2xl">
                    {playlist.emoji}
                  </div>
                ) : (
                  <div className="w-12 h-12 bg-white border-2 border-black flex items-center justify-center">
                    <Music className="w-6 h-6 text-black" />
                  </div>
                )}
                <div className="flex-1">
                  <h3 className="font-bold text-black">{playlist.name}</h3>
                  <p className="text-sm text-black/80 font-medium">
                    {playlist.songs.length} {playlist.songs.length === 1 ? 'SONG' : 'SONGS'}
                  </p>
                </div>
                {!isMasterPlaylist && playlist.id !== 'playlist-1' && (
                  <button
                    onClick={() => handleDeletePlaylist(playlist.id)}
                    className="p-2 hover:bg-black/10 border-2 border-black bg-white transition-colors"
                  >
                    <Trash2 className="w-4 h-4 text-black" />
                  </button>
                )}
              </div>

              {playlist.songs.length > 0 && (
                <button
                  onClick={() => setSelectedPlaylist(playlist)}
                  className="w-full p-3 text-sm font-bold text-black hover:bg-gradient-to-r hover:from-blue-100 hover:to-purple-100 transition-colors text-left border-t-2 border-transparent hover:border-black"
                >
                  VIEW ALL SONGS →
                </button>
              )}
            </div>
          );
        })}
      </div>

      {playlists.length === 0 && (
        <div className="text-center py-16 text-gray-500">
          <Music className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>No playlists yet.</p>
          <p className="text-sm mt-2">Create your first playlist!</p>
        </div>
      )}

      {/* Playlist Detail Modal */}
      {selectedPlaylist && (
        <div
          className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedPlaylist(null)}
        >
          <div
            className="bg-white border-4 border-black w-full max-w-md max-h-[80vh] overflow-hidden shadow-[10px_10px_0px_0px_rgba(0,0,0,1)] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className={`bg-gradient-to-r ${
              selectedPlaylist.id === 'playlist-master' 
                ? 'from-orange-400 to-pink-400'
                : selectedPlaylist.emoji
                ? 'from-purple-300 to-blue-300'
                : 'from-gray-200 to-gray-300'
            } p-6 border-b-4 border-black flex items-center gap-3`}>
              {selectedPlaylist.id === 'playlist-master' ? (
                <div className="w-16 h-16 bg-white border-2 border-black flex items-center justify-center">
                  <Globe className="w-8 h-8 text-black" />
                </div>
              ) : selectedPlaylist.emoji ? (
                <div className="w-16 h-16 bg-white border-2 border-black flex items-center justify-center text-3xl">
                  {selectedPlaylist.emoji}
                </div>
              ) : (
                <div className="w-16 h-16 bg-white border-2 border-black flex items-center justify-center">
                  <Music className="w-8 h-8 text-black" />
                </div>
              )}
              <div>
                <h2 className="text-xl font-bold text-black">{selectedPlaylist.name}</h2>
                <p className="text-sm text-black/80 font-medium">
                  {selectedPlaylist.songs.length} {selectedPlaylist.songs.length === 1 ? 'SONG' : 'SONGS'}
                </p>
              </div>
            </div>

            <div className="overflow-y-auto p-4 space-y-3 flex-1 bg-gradient-to-br from-blue-50 to-purple-50">
              {selectedPlaylist.songs.map((song) => (
                <div
                  key={song.id}
                  onClick={() => {
                    // open the song in Spotify in a new tab
                    const url = song.spotifyUrl || `https://open.spotify.com/track/${song.id}`;
                    window.open(url, '_blank', 'noopener');
                  }}
                  className="flex gap-3 p-3 bg-white border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] cursor-pointer"
                >
                  <img
                    src={song.albumArt}
                    alt={song.songTitle}
                    className="w-14 h-14 border-2 border-black object-cover"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-bold truncate text-black">{song.songTitle}</p>
                    <p className="text-sm text-gray-600 truncate font-medium">{song.artist}</p>
                  </div>
                  {selectedPlaylist.id !== 'playlist-master' && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveSong(selectedPlaylist.id, song.id);
                      }}
                      className="p-2 hover:bg-red-100 border-2 border-black bg-white transition-colors self-center"
                    >
                      <Trash2 className="w-4 h-4 text-black" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            <div className="p-4 border-t-4 border-black bg-white">
              <button
                onClick={() => setSelectedPlaylist(null)}
                className="w-full bg-gray-200 border-2 border-black px-4 py-2 font-bold hover:bg-gray-300 transition-colors"
              >
                CLOSE
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
