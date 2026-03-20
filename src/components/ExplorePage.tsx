import { useState } from 'react';
import { genreCategories } from '../data/genreData';
import { GenreCategory, GenreSong } from '../data/genreData';

export function ExplorePage() {
  const [expandedGenre, setExpandedGenre] = useState<string | null>(null);

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="sticky top-0 bg-white border-b-4 border-black z-10">
        <div className="px-4 py-4">
          <h1 className="text-xl font-bold">EXPLORE MUSIC</h1>
          <p className="text-sm text-gray-600">Discover songs by genre</p>
        </div>
      </div>

      {/* Genre Categories */}
      <div className="p-4 space-y-4">
        {genreCategories.map((genre) => (
          <GenreSection
            key={genre.id}
            genre={genre}
            isExpanded={expandedGenre === genre.id}
            onToggle={() => setExpandedGenre(expandedGenre === genre.id ? null : genre.id)}
          />
        ))}
      </div>
    </div>
  );
}

interface GenreSectionProps {
  genre: GenreCategory;
  isExpanded: boolean;
  onToggle: () => void;
}

function GenreSection({ genre, isExpanded, onToggle }: GenreSectionProps) {
  return (
    <div className="border-4 border-black bg-white shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
      <button
        onClick={onToggle}
        className={`w-full p-4 bg-gradient-to-r ${genre.color} border-b-4 border-black flex justify-between items-center hover:translate-x-0.5 hover:translate-y-0.5 transition-transform`}
      >
        <h2 className="text-lg font-bold text-black">{genre.name}</h2>
        <span className="text-2xl font-bold text-black">{isExpanded ? '−' : '+'}</span>
      </button>

      {isExpanded && (
        <div className="p-4 space-y-3 bg-white">
          {genre.songs.map((song) => (
            <SongCard key={song.id} song={song} />
          ))}
        </div>
      )}
    </div>
  );
}

interface SongCardProps {
  song: GenreSong;
}

function SongCard({ song }: SongCardProps) {
  const [saved, setSaved] = useState(false);

  return (
    <div className="flex gap-4 p-3 border-2 border-black bg-gradient-to-r from-blue-50 to-purple-50">
      <img
        src={song.albumArt}
        alt={song.songTitle}
        className="w-20 h-20 border-2 border-black object-cover shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]"
      />
      <div className="flex-1 flex flex-col justify-center">
        <p className="font-bold text-black">{song.songTitle}</p>
        <p className="text-sm text-gray-600 font-medium">{song.artist}</p>
      </div>
      <div className="flex flex-col gap-2 justify-center">
        <a
          href={song.spotifyUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="bg-green-500 text-white px-3 py-1 border-2 border-black font-bold hover:bg-green-600 transition-colors text-xs text-center"
        >
          PLAY
        </a>
        <button
          onClick={() => setSaved(!saved)}
          className={`px-3 py-1 border-2 border-black font-bold transition-colors text-xs ${
            saved
              ? 'bg-gradient-to-r from-yellow-300 to-pink-300 text-black'
              : 'bg-white text-black hover:bg-gray-100'
          }`}
        >
          {saved ? 'SAVED' : 'SAVE'}
        </button>
      </div>
    </div>
  );
}
