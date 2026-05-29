import Link from "next/link";
import { Nav } from "@/components/Nav";

export default function HomePage() {
  return (
    <>
      <Nav publicOnly />
      <main className="mx-auto grid min-h-[calc(100vh-5rem)] w-[min(1200px,calc(100%-2rem))] items-center gap-10 py-12 lg:grid-cols-[1.05fr_.95fr]">
        <section>
          <p className="mb-4 font-bold text-mint">Realtime Donate Platform for Streamers</p>
          <h1 className="text-6xl font-extrabold leading-none md:text-8xl">TipHouse</h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-white/75">
            ระบบรับโดเนท production-ready พร้อม auth, PostgreSQL, payment webhook,
            realtime OBS overlay, dashboard และ admin audit สำหรับนำขึ้นใช้งานจริง
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link className="btn btn-primary" href="/register">เริ่มต้นใช้งาน</Link>
          </div>
        </section>
        <section className="card overflow-hidden">
          <div className="min-h-64 bg-[linear-gradient(rgba(0,0,0,.12),rgba(0,0,0,.55)),url('https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=1200&q=80')] bg-cover bg-center p-5">
            <div className="flex min-h-56 items-end justify-between">
              <div>
                <div className="grid size-20 place-items-center rounded-2xl border-2 border-white/70 bg-mint text-2xl font-black text-ink">TH</div>
                <h2 className="mt-4 text-3xl font-black">TipHouse</h2>
                <p className="text-white/65">@tiphouse</p>
              </div>
              <span className="badge">Live</span>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
