"use client";

import Link from "next/link";
import { Nav } from "@/components/Nav";
import { useAppPreferences } from "@/lib/app-preferences";

export default function HomePage() {
  const { t } = useAppPreferences();
  const features = [
    { title: "PromptPay QR", text: t("สร้าง QR หลังกรอกข้อมูลครบ รองรับยอดขั้นต่ำและระบบตรวจสอบรายการโดเนท", "Generate QR codes after donors complete the form, with minimum amount validation and donation status checks.") },
    { title: "OBS Overlay", text: t("ใช้ Browser Source URL สำหรับ Alert แบบ realtime พร้อมคิวแจ้งเตือนและ TTS", "Use a Browser Source URL for realtime alerts with queue handling and TTS.") },
    { title: "Streamlabs Tips", text: t("Creator เชื่อมบัญชี Streamlabs เพื่อใช้ Alert Box Tips/Variation ที่ตั้งไว้ใน Streamlabs", "Creators can connect Streamlabs and use their existing Tips Alert Box variations.") },
    { title: "Creator Dashboard", text: t("ดูยอดโดเนทล่าสุด รายได้รวม ประวัติรายการ และตั้งค่าหน้าโดเนท", "Track recent donations, revenue, history, and donation page settings.") },
    { title: "Viewer UX", text: t("ผู้โดเนทใช้งานง่าย เลือก Anonymous ได้ และดูอันดับผู้สนับสนุนล่าสุด", "Donors get a simple flow with Anonymous mode and supporter rankings.") },
    { title: "Donate Goal", text: t("ตั้งค่า Donate Goal สำหรับแสดงบน OBS และอัปเดตตามยอดโดเนทจริง", "Configure a Donate Goal widget for OBS that updates from real donations.") },
  ];

  return (
    <>
      <Nav publicOnly />
      <main className="mx-auto w-[min(1200px,calc(100%-2rem))] py-12">
        <section className="grid min-h-[calc(100vh-9rem)] items-center gap-10 lg:grid-cols-[1.05fr_.95fr]">
          <div>
            <p className="mb-4 font-bold text-mint">Realtime Donate Platform for Streamers</p>
            <h1 className="text-6xl font-extrabold leading-none md:text-8xl">TipHouse</h1>
            <p className="home-lead mt-6 max-w-3xl text-lg leading-8 text-white/75">
              {t(
                "ระบบรับโดเนท production-ready พร้อม Streamlabs Login, PostgreSQL, payment webhook, realtime OBS overlay, dashboard และ admin audit สำหรับใช้งานจริง",
                "A production-ready donation platform with Streamlabs Login, PostgreSQL, payment webhooks, realtime OBS overlays, dashboards, and admin audit tools.",
              )}
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link className="btn btn-primary" href="/login">{t("เริ่มต้นใช้งานด้วย Streamlabs", "Get Started with Streamlabs")}</Link>
            </div>
          </div>
          <section className="card overflow-hidden">
            <div className="media-on-dark min-h-72 bg-[linear-gradient(rgba(0,0,0,.12),rgba(0,0,0,.55)),url('https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=1200&q=80')] bg-cover bg-center p-5">
              <div className="flex min-h-64 items-end justify-between gap-4">
                <div>
                  <div className="grid size-20 place-items-center rounded-2xl border-2 border-white/70 bg-mint text-2xl font-black text-ink">TH</div>
                  <h2 className="mt-4 text-3xl font-black text-white">TipHouse</h2>
                  <p className="text-white/65">@tiphouse</p>
                </div>
              </div>
            </div>
            <div className="grid gap-3 p-5 text-white/65">
              <p>{t("เชื่อมต่อ Streamlabs เพื่อเริ่มจัดการหน้าโดเนท, Overlay และ Donate Goal สำหรับ OBS ได้ในที่เดียว", "Connect Streamlabs to manage your donation page, overlay, and Donate Goal for OBS in one place.")}</p>
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
