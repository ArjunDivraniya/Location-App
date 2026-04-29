import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { AuthPanel } from '@/components/auth-panel';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function AuthPage() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();

  // If already logged in, redirect to dashboard
  if (data.user) {
    redirect('/dashboard');
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(77,215,176,0.14),_transparent_32%),linear-gradient(180deg,#07111f_0%,#050b15_100%)] px-4 py-6 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-md space-y-4">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/6 px-3 py-2 text-sm font-semibold text-white hover:bg-white/10"
          >
            <ArrowLeft size={16} />
            Back
          </Link>
          <h1 className="text-2xl font-semibold text-white">Sign in or create account</h1>
        </div>

        <div className="rounded-[28px] border border-white/10 bg-white/6 p-6 shadow-glow backdrop-blur">
          <AuthPanel />
        </div>

        <p className="text-center text-sm text-white/60">
          Share your location safely and chat with people nearby.
        </p>
      </div>
    </main>
  );
}
