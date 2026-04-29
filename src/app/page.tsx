import AuthModal from '@/components/auth-modal';
import { MessageCircleMore, Radar, Route } from 'lucide-react';

const featureCards = [
  { title: 'Geolocation first', description: 'Users can share their live location or drop a pin directly on the map.', icon: Route },
  { title: '5km proximity rooms', description: 'Nearby users are discovered with exact distance filtering and grouped automatically.', icon: Radar },
  { title: 'Realtime chat', description: 'Each room streams messages instantly as users move in and out of range.', icon: MessageCircleMore },
];

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(77,215,176,0.18),_transparent_28%),linear-gradient(180deg,#07111f_0%,#050b15_100%)] px-4 py-8 text-white sm:px-6 lg:px-8">
      <div className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-7xl items-center gap-8 lg:grid-cols-[1.15fr_0.85fr]">
        <section className="space-y-8">
          <div className="inline-flex items-center gap-3 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/70 backdrop-blur">
            <img src="/logo.svg" alt="Location Chat" className="h-6 w-6" />
            <span>Proximity-based chat for nearby people</span>
          </div>

          <div className="space-y-4">
            <h1 className="max-w-3xl text-5xl font-semibold leading-tight tracking-tight sm:text-6xl">
              A live location chat that groups people by the space they share.
            </h1>
            <p className="max-w-2xl text-lg leading-8 text-white/68">
              Sign up, allow location access, drop a pin, and instantly see nearby users within 5km. The dashboard keeps your room updated as you move.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            {featureCards.map(({ title, description, icon: Icon }) => (
              <article key={title} className="rounded-[28px] border border-white/10 bg-white/6 p-5 shadow-glow backdrop-blur">
                <Icon className="text-aqua" size={20} />
                <h2 className="mt-4 text-lg font-semibold text-white">{title}</h2>
                <p className="mt-2 text-sm leading-6 text-white/62">{description}</p>
              </article>
            ))}
          </div>
        </section>

        <aside className="rounded-[36px] border border-white/10 bg-white/6 p-4 shadow-glow backdrop-blur">
          <div className="rounded-[28px] border border-white/10 bg-black/20 p-6">
            <p className="text-xs uppercase tracking-[0.35em] text-white/40">Get started</p>
            <h2 className="mt-3 text-2xl font-semibold text-white">Create your room</h2>
            <p className="mt-2 text-sm leading-6 text-white/60">
              Login or sign up to enter the dashboard, share your position, and join the closest group automatically.
            </p>
            <div className="mt-6">
              <AuthModal />
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}
