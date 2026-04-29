"use client";

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { LogIn } from 'lucide-react';

const AuthPanel = dynamic(() => import('./auth-panel').then((m) => m.AuthPanel), { ssr: false });

export default function AuthModal() {
  const [open, setOpen] = useState(false);
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

  // Mobile: show a button that opens a full-screen modal with the auth form
  return (
    <div>
      <button
        onClick={() => setOpen(true)}
        className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-aqua to-[#66e6d3] px-4 py-3.5 font-semibold text-[#03110e] shadow-[0_10px_30px_rgba(77,215,176,0.28)] transition hover:from-[#74ebda] hover:to-[#4dd7b0]"
      >
        <LogIn size={18} />
        Get started
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="mx-auto w-full max-w-md">
            <div className="rounded-3xl border border-white/10 bg-white/6 p-4 shadow-glow">
              <div className="flex justify-end">
                <button onClick={() => setOpen(false)} className="text-white/70 hover:text-white">Close</button>
              </div>
              <div className="mt-2">
                <AuthPanel />
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
