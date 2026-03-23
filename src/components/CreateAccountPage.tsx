import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { allUsers } from '../data/allUsers';
import { setAppCurrentUserId } from '../data/authUser';
import type { SpotifyUser } from '../types';

export function CreateAccountPage() {
  const navigate = useNavigate();
  const [spotifyProfile, setSpotifyProfile] = useState<SpotifyUser | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');

  useEffect(() => {
    const raw = sessionStorage.getItem('pending_spotify_profile');
    if (!raw) {
      // Nothing pending — go back to feed
      navigate('/');
      return;
    }
    const profile = JSON.parse(raw) as SpotifyUser;
    setSpotifyProfile(profile);
    setDisplayName(profile.display_name || '');
    if (profile.images && profile.images[0]) setAvatarUrl(profile.images[0].url);
  }, [navigate]);

  if (!spotifyProfile) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const id = spotifyProfile.id;
    const username = spotifyProfile.id; // set identical to spotify account

    const newUser = {
      id,
      username,
      displayName: displayName || spotifyProfile.display_name || username,
      bio: bio || '',
      avatarUrl: avatarUrl || '',
      followers: 0,
      following: 0,
    };

  // Add to local DB
  allUsers.push(newUser as any);
  // Clear pending profile
  sessionStorage.removeItem('pending_spotify_profile');
  // Set as current app user
  setAppCurrentUserId(id);
  // Navigate to feed
  navigate('/');
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <form onSubmit={handleSubmit} className="bg-white border-4 border-black p-6 w-full max-w-md shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
        <h2 className="text-xl font-bold mb-4">Create your account</h2>

        <label className="block text-sm font-bold mb-1">User ID</label>
        <input value={spotifyProfile.id} readOnly className="w-full mb-3 border-2 border-black px-3 py-2 bg-gray-100" />

        <label className="block text-sm font-bold mb-1">Username</label>
        <input value={spotifyProfile.id} readOnly className="w-full mb-3 border-2 border-black px-3 py-2 bg-gray-100" />

        <label className="block text-sm font-bold mb-1">Display name</label>
        <input value={displayName} onChange={e => setDisplayName(e.target.value)} className="w-full mb-3 border-2 border-black px-3 py-2" />

        <label className="block text-sm font-bold mb-1">Bio</label>
        <textarea value={bio} onChange={e => setBio(e.target.value)} className="w-full mb-3 border-2 border-black px-3 py-2 h-24" />

        <label className="block text-sm font-bold mb-1">Avatar URL</label>
        <input value={avatarUrl} onChange={e => setAvatarUrl(e.target.value)} className="w-full mb-4 border-2 border-black px-3 py-2" />

        <div className="flex gap-2">
          <button type="button" onClick={() => navigate('/')} className="flex-1 bg-gray-200 border-2 border-black px-4 py-2 font-bold">Cancel</button>
          <button type="submit" className="flex-1 bg-gradient-to-r from-purple-500 to-pink-500 text-white border-2 border-black px-4 py-2 font-bold">Create</button>
        </div>
      </form>
    </div>
  );
}

export default CreateAccountPage;
