'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import { Send } from 'lucide-react';
import type { ChatMessageRow, ProfileRow } from '@/lib/types';

type ChatPanelProps = {
  roomKey: string | null;
  messages: ChatMessageRow[];
  profileMap: Record<string, ProfileRow>;
  currentUserId: string;
  onSendMessage: (message: string) => Promise<void>;
};

export function ChatPanel({ roomKey, messages, profileMap, currentUserId, onSendMessage }: ChatPanelProps) {
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = draft.trim();

    if (!trimmed || !roomKey) {
      return;
    }

    setSending(true);
    try {
      await onSendMessage(trimmed);
      setDraft('');
    } finally {
      setSending(false);
    }
  }

  return (
    <section className="flex h-full min-h-[760px] flex-col rounded-[28px] border border-white/10 bg-gradient-to-b from-white/8 to-white/4 shadow-glow backdrop-blur">
      {/* Header */}
      <div className="border-b border-white/10 px-6 py-4">
        <p className="text-xs uppercase tracking-[0.35em] text-white/40">Live room</p>
        <h2 className="mt-1 text-lg font-semibold text-white">{roomKey ?? 'No room active yet'}</h2>
      </div>

      {/* Messages Area */}
      <div className="flex-1 space-y-4 overflow-y-auto bg-[radial-gradient(circle_at_top,rgba(77,215,176,0.06),transparent_35%)] px-4 py-6 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/10">
        {messages.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <div className="text-center space-y-2">
              <p className="text-sm text-white/60">No messages yet</p>
              <p className="text-xs text-white/40">Start the conversation once you are in a room</p>
            </div>
          </div>
        ) : (
          <>
            {messages.map((message) => {
              const profile = profileMap[message.user_id];
              const isOwn = message.user_id === currentUserId;

              return (
                <div key={message.id} className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`} suppressHydrationWarning>
                  <article
                    className={`max-w-[82%] rounded-2xl px-4 py-3 shadow-md ${
                      isOwn
                        ? 'rounded-br-none border border-[#d7fff1] bg-[#69e8d6] text-[#041410]'
                        : 'rounded-bl-none bg-black/60 text-white ring-1 ring-white/10'
                    }`}
                  >
                    {!isOwn && <p className="mb-1 text-xs font-semibold text-white/75">{profile?.display_name ?? 'Nearby user'}</p>}
                    <p className="break-words text-[15px] leading-6">{message.body}</p>
                    <span className={`mt-1 flex justify-end text-xs ${isOwn ? 'text-[#041410]/65' : 'text-white/50'}`}>
                      {new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </article>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Input Area */}
      <form onSubmit={handleSubmit} className="border-t border-white/10 bg-black/30 px-4 py-4">
        <div className="flex gap-2 rounded-full border border-white/10 bg-black/45 px-4 py-2 transition focus-within:border-aqua/60 focus-within:bg-black/65">
          <input
            id="message"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder={roomKey ? 'Message...' : 'Join a room first'}
            className="min-w-0 flex-1 bg-transparent text-[15px] text-white outline-none placeholder:text-white/40"
            disabled={!roomKey}
          />
          <button
            type="submit"
            disabled={!roomKey || sending || !draft.trim()}
            className="inline-flex min-w-[96px] items-center justify-center gap-2 rounded-full border border-[#d7fff1] bg-[#74ebda] px-4 py-2 text-sm font-semibold text-[#04110f] shadow-[0_8px_24px_rgba(77,215,176,0.26)] transition hover:bg-[#84f0e3] hover:shadow-[0_12px_28px_rgba(77,215,176,0.34)] active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
            title="Send message"
          >
            <Send size={16} />
            <span>Send</span>
          </button>
        </div>
      </form>
    </section>
  );
}
