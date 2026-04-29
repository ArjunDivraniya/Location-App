import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://placeholder.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'placeholder-anon-key';

type MiddlewareCookieOptions = Parameters<NextResponse['cookies']['set']>[2];

type CookieToSet = {
  name: string;
  value: string;
  options: MiddlewareCookieOptions;
};

function copyCookies(source: NextResponse, target: NextResponse) {
  source.cookies.getAll().forEach((cookie) => {
    target.cookies.set(cookie.name, cookie.value, cookie);
  });
}

export async function middleware(request: NextRequest) {
  const response = NextResponse.next({ request });
  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll().map(({ name, value }) => ({ name, value }));
      },
      setAll(cookiesToSet: CookieToSet[]) {
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const { data } = await supabase.auth.getUser();
  const user = data.user;
  const { pathname } = request.nextUrl;

  if (pathname === '/' && user) {
    const redirectResponse = NextResponse.redirect(new URL('/dashboard', request.url));
    copyCookies(response, redirectResponse);
    return redirectResponse;
  }

  if (pathname.startsWith('/dashboard') && !user) {
    const redirectResponse = NextResponse.redirect(new URL('/', request.url));
    copyCookies(response, redirectResponse);
    return redirectResponse;
  }

  return response;
}

export const config = {
  matcher: ['/', '/dashboard/:path*'],
};