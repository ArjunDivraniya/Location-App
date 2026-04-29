'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { MapPin, LogIn, UserPlus } from 'lucide-react';
import { createSupabaseBrowserClient } from '@/lib/supabase';

export function AuthPanel() {
  const router = useRouter();
  const [mode, setMode] = useState<'login' | 'signup'>('signup');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    const supabase = createSupabaseBrowserClient();
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        router.replace('/dashboard');
      }
    });
  }, [router, mounted]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const supabase = createSupabaseBrowserClient();

      if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { display_name: name },
          },
        });

        if (error) {
          throw error;
        }

        if (data.user) {
          await supabase.from('profiles').upsert({
            id: data.user.id,
            display_name: name,
            avatar_url: null,
          });
        }

        setMessage('Account created. Open your email if confirmation is enabled, then sign in.');
        setMode('login');
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });

        if (error) {
          throw error;
        }

        router.push('/dashboard');
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Authentication failed.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} suppressHydrationWarning className="space-y-4 rounded-3xl border border-white/10 bg-white/6 p-6 shadow-glow backdrop-blur">
      <div className="flex gap-2 rounded-2xl bg-black/20 p-1">
        <button
          type="button"
          onClick={() => setMode('signup')}
          className={`flex-1 rounded-xl px-4 py-2 text-sm font-semibold transition ${mode === 'signup' ? 'bg-aqua text-ink shadow-lg' : 'text-white/60 hover:text-white'}`}
        >
          Sign up
        </button>
        <button
          type="button"
          onClick={() => setMode('login')}
          className={`flex-1 rounded-xl px-4 py-2 text-sm font-semibold transition ${mode === 'login' ? 'bg-aqua text-ink shadow-lg' : 'text-white/60 hover:text-white'}`}
        >
          Log in
        </button>
      </div>

      {mode === 'signup' ? (
        <label className="block space-y-2">
          <span className="text-sm text-white/70">Display name</span>
          <input value={name} onChange={(event) => setName(event.target.value)} className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 outline-none ring-0 placeholder:text-white/30 focus:border-aqua/60" placeholder="Arjun" required />
        </label>
      ) : null}

      <label className="block space-y-2">
        <span className="text-sm text-white/70">Email</span>
        <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 outline-none placeholder:text-white/30 focus:border-aqua/60" placeholder="you@example.com" required />
      </label>

      <label className="block space-y-2">
        <span className="text-sm text-white/70">Password</span>
        <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 outline-none placeholder:text-white/30 focus:border-aqua/60" placeholder="••••••••" minLength={6} required />
      </label>

      <button type="submit" disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-aqua px-4 py-3 font-semibold text-ink transition hover:bg-[#72e7d5] disabled:cursor-not-allowed disabled:opacity-70">
        {mode === 'signup' ? <UserPlus size={18} /> : <LogIn size={18} />}
        {loading ? 'Working...' : mode === 'signup' ? 'Create account' : 'Log in'}
      </button>

      <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white/70">
        <div className="mb-1 flex items-center gap-2 font-semibold text-white">
          <MapPin size={16} className="text-aqua" />
          Location-first chat
        </div>
        {message ?? 'After login, the dashboard will ask for your location and show the nearest active users.'}
      </div>
    </form>
  );
}
