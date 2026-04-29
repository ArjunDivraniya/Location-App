"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { LogIn } from 'lucide-react';

const AuthPanel = dynamic(() => import('./auth-panel').then((m) => m.AuthPanel), { ssr: false });

export default function AuthModal() {
  const router = useRouter();
  const [isWide, setIsWide] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    const handle = () => setIsWide(mq.matches);
    handle();
    mq.addEventListener?.('change', handle);
    return () => mq.removeEventListener?.('change', handle);
  }, []);

  if (isWide) {
    // Desktop/tablet: show inline form
    return <AuthPanel />;
  }

  // Mobile: navigate to dedicated auth page instead of showing overlay
  return (
    <button
      onClick={() => router.push('/auth')}
      className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-aqua to-[#66e6d3] px-4 py-3.5 font-semibold text-white shadow-[0_10px_30px_rgba(77,215,176,0.28)] transition hover:from-[#74ebda] hover:to-[#4dd7b0]"
    >
      <LogIn size={18} />
      Get started
    </button>
  );
}
