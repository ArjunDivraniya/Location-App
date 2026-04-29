import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { DashboardClient } from '../dashboard-client';

export const dynamic = 'force-dynamic';

export default async function DashboardChatPage() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();

  if (!data.user) {
    redirect('/');
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(77,215,176,0.14),_transparent_32%),linear-gradient(180deg,#07111f_0%,#050b15_100%)] px-4 py-6 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <DashboardClient view="chat" />
      </div>
    </main>
  );
}
