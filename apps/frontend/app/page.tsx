import Link from "next/link";
import { Nav } from "@/components/Nav";

const features = [
  { title: "PromptPay QR", text: "สร้าง QR หลังกรอกข้อมูลครบ รองรับยอดขั้นต่ำและชื่อบัญชีโดเนทของ Creator" },
  { title: "OBS Overlay", text: "ใช้ Browser Source URL สำหรับ Alert แบบ realtime พร้อมคิวแจ้งเตือนและ TTS" },
  { title: "Streamlabs Tips", text: "Creator เชื่อมบัญชี Streamlabs เพื่อใช้ Alert Box Tips/Variation ที่ตั้งไว้ใน Streamlabs" },
  { title: "Creator Dashboard", text: "ดูยอดโดเนทล่าสุด รายได้รวม ประวัติรายการ และตั้งค่าหน้าโดเนท" },
  { title: "Admin Approval", text: "บัญชีใหม่และการเปลี่ยนอีเมลต้องรอ Admin อนุมัติก่อนเปิดใช้งานรับโดเนท" },
  { title: "Viewer UX", text: "ผู้โดเนทใช้งานได้ง่าย เลือก Anonymous ได้ และดูรายการ/อันดับผู้สนับสนุนล่าสุด" },
];

const previewDonations = [
  { name: "PandaChan", amount: 100, message: "สู้ ๆ นะครับ ไลฟ์สนุกมาก!" },
  { name: "บุคคลนิรนาม", amount: 300, message: "เป็นกำลังใจให้นะ" },
  { name: "NightOwl", amount: 500, message: "Alert test พร้อม OBS" },
];

export default function HomePage() {
  return (
    <>
      <Nav />
      <main className="mx-auto w-[min(1200px,calc(100%-2rem))] py-12">
        <section className="grid min-h-[calc(100vh-9rem)] items-center gap-10 lg:grid-cols-[1.05fr_.95fr]">
          <div>
            <p className="mb-4 font-bold text-mint">Realtime Donate Platform for Streamers</p>
            <h1 className="text-6xl font-extrabold leading-none md:text-8xl">TipHouse</h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-white/75">
              ระบบรับโดเนท production-ready พร้อม auth, PostgreSQL, payment webhook,
              realtime OBS overlay, dashboard และ admin audit สำหรับนำขึ้นใช้งานจริง
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link className="btn btn-primary" href="/register">เริ่มต้นใช้งาน</Link>
              <Link className="btn" href="/login">Login Creator</Link>
            </div>
          </div>
          <section className="card overflow-hidden">
            <div className="min-h-72 bg-[linear-gradient(rgba(0,0,0,.12),rgba(0,0,0,.55)),url('https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=1200&q=80')] bg-cover bg-center p-5">
              <div className="flex min-h-64 items-end justify-between gap-4">
                <div>
                  <div className="grid size-20 place-items-center rounded-2xl border-2 border-white/70 bg-mint text-2xl font-black text-ink">TH</div>
                  <h2 className="mt-4 text-3xl font-black">TipHouse</h2>
                  <p className="text-white/65">@tiphouse</p>
                </div>
                <span className="badge">OBS Ready</span>
              </div>
            </div>
            <div className="grid gap-3 p-5">
              {previewDonations.map((item) => (
                <div key={`${item.name}-${item.amount}`} className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <strong>{item.name}</strong>
                    <span className="font-black text-mint">฿{item.amount.toLocaleString("th-TH")}</span>
                  </div>
                  <p className="mt-1 text-sm text-white/55">{item.message}</p>
                </div>
              ))}
            </div>
          </section>
        </section>
        <section className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <article key={feature.title} className="card p-5">
              <h2 className="text-2xl font-black">{feature.title}</h2>
              <p className="mt-3 leading-7 text-white/65">{feature.text}</p>
            </article>
          ))}
        </section>
      </main>
    </>
  );
}
