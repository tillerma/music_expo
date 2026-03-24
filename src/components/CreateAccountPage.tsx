import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { supabase } from '../lib/supabase';
import { setAppCurrentUserId } from '../data/authUser';

export function CreateAccountPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const noAccountMessage = searchParams.get('message') === 'no-account';

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);

  const handleSubmit = async (e: { preventDefault(): void }) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setError(null);

    const trimmedUsername = username.trim();
    if (!trimmedUsername || !password) {
      setError('Username and password are required.');
      setLoading(false);
      return;
    }

    // Check if username is already taken
    const { data: existing } = await supabase
      .from('profiles')
      .select('id')
      .eq('username', trimmedUsername)
      .maybeSingle();

    if (existing) {
      setError('That username is already taken. Please choose another.');
      setLoading(false);
      return;
    }

    // Define avatarUrl if user uploaded photo
    const userId = crypto.randomUUID();
    let avatarUrl = '';

    if (avatarFile) {
      const ext = avatarFile.name.split('.').pop() || 'png';
      const filePath = `${userId}/avatar.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, avatarFile, {
          upsert: true,
          contentType: avatarFile.type,
        });

      if (uploadError) {
        setError(uploadError.message);
        return;
      }

      const { data } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      avatarUrl = data.publicUrl;
    }

    const newUser = {
      id: userId,
      username: trimmedUsername,
      password,
      display_name: displayName.trim() || trimmedUsername,
      bio: bio.trim(),
      avatar_url: avatarUrl,
      followers: 0,
      following: 0,
    };

    const { data, error: insertError } = await supabase
      .from('profiles')
      .insert(newUser)
      .select()
      .single();

    if (insertError || !data) {
      setError(insertError?.message ?? 'Failed to create account. Please try again.');
      setLoading(false);
      return;
    }

    setAppCurrentUserId(data.id);
    localStorage.setItem('app_current_user', JSON.stringify(data));
    navigate('/');
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-white">
      <form
        onSubmit={handleSubmit}
        className="bg-white border-4 border-black p-6 w-full max-w-md shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]"
      >
        <h2 className="text-2xl font-bold mb-1">Create Account</h2>

        {noAccountMessage && (
          <p className="mb-4 text-sm text-purple-700 bg-purple-50 border-2 border-purple-300 px-3 py-2">
            We couldn't find an account with those credentials. Create one below!
          </p>
        )}

        <label className="block text-sm font-bold mb-1 mt-3">Upload Profile Photo</label>
        <input
          type="file"
          accept="image/*"
          className="w-full mb-3 border-2 border-black px-3 py-2 focus:outline-none focus:border-purple-500"
          onChange={(e) => setAvatarFile(e.target.files?.[0] ?? null)}
        />

        <label className="block text-sm font-bold mb-1 mt-3">Username *</label>
        <input
          value={username}
          onChange={e => setUsername(e.target.value)}
          required
          className="w-full mb-3 border-2 border-black px-3 py-2 focus:outline-none focus:border-purple-500"
          placeholder="e.g. musiclover480"
        />

        <label className="block text-sm font-bold mb-1">Password *</label>
        <input
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          required
          className="w-full mb-3 border-2 border-black px-3 py-2 focus:outline-none focus:border-purple-500"
          placeholder="Choose a password"
        />

        <label className="block text-sm font-bold mb-1">Display Name</label>
        <input
          value={displayName}
          onChange={e => setDisplayName(e.target.value)}
          className="w-full mb-3 border-2 border-black px-3 py-2 focus:outline-none focus:border-purple-500"
          placeholder="How your name appears to others"
        />

        <label className="block text-sm font-bold mb-1">Bio</label>
        <textarea
          value={bio}
          onChange={e => setBio(e.target.value)}
          className="w-full mb-4 border-2 border-black px-3 py-2 h-24 resize-none focus:outline-none focus:border-purple-500"
          placeholder="Tell people about yourself"
        />

        {error && (
          <p className="mb-3 text-sm text-red-600 bg-red-50 border-2 border-red-300 px-3 py-2">
            {error}
          </p>
        )}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => navigate('/login')}
            className="flex-1 bg-gray-200 border-2 border-black px-4 py-2 font-bold hover:bg-gray-300 transition-colors"
          >
            Back to Login
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex-1 bg-gradient-to-r from-purple-500 to-pink-500 text-white border-2 border-black px-4 py-2 font-bold disabled:opacity-50 hover:translate-x-0.5 hover:translate-y-0.5 transition-transform shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]"
          >
            {loading ? 'Creating…' : 'Create Account'}
          </button>
        </div>
      </form>
    </div>
  );
}

export default CreateAccountPage;
