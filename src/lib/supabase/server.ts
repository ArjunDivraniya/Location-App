import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

type CookieStore = Awaited<ReturnType<typeof cookies>>;
type CookieOptions = Parameters<CookieStore['set']>[2];

type CookieToSet = {
  name: string;
  value: string;
  options: CookieOptions;
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://placeholder.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'placeholder-anon-key';

export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll().map(({ name, value }) => ({ name, value }));
      },
      setAll(cookiesToSet: CookieToSet[]) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // The page render path is read-only; middleware handles cookie writes.
        }
      },
    },
  });
}