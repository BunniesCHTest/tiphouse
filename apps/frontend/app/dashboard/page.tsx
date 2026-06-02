"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AuthGate } from "@/components/AuthGate";
import { Nav } from "@/components/Nav";
import { api, authHeaders } from "@/lib/api";

type Donation = {
  id: string;
  donorName: string;
  amount: number;
  message: string;
  anonymous: boolean;
  paymentStatus: string;
  createdAt?: string;
};

const quickLinks = [
  { href: "/settings/donation-page", title: "ตั้งค่าหน้าโดเนท", text: "แก้ Banner, ชื่อ Creator, URL หน้าโดเนท และยอดขั้นต่ำ" },
  { href: "/settings/overlay", title: "ตั้งค่า Overlay", text: "จัดการ OBS URL, Streamlabs Alert Box, TTS และ Custom HTML/CSS/JS" },
  { href: "/settings/bank", title: "บัญชีรับเงิน", text: "ผูกข้อมูลบัญชีสำหรับรับยอดโดเนท" },
  { href: "/settings/profile", title: "จัดการโปรไฟล์", text: "แก้ข้อมูล Account User และอีเมลที่ต้องรออนุมัติ" },
];

export default function DashboardPage() {
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    api.get("/dashboard", { headers: authHeaders() }).then((res) => setData(res.data)).catch(() => setData(null));
  }, []);

  const donations = useMemo<Donation[]>(() => data?.donations ?? [], [data]);
  const paidDonations = donations.filter((item) => item.paymentStatus === "PAID");
  const pendingDonations = donations.filter((item) => item.paymentStatus !== "PAID");
  const highestDonation = paidDonations.reduce((max, item) => Math.max(max, item.amount), 0);
  const bars = [28, 48, 36, 72, 54, 88];

  return (
    <AuthGate>
      <Nav />
      <main className="mx-auto w-[min(1200px,calc(100%-2rem))] py-10">
        <p className="font-bold text-mint">Creator Dashboard</p>
        <h1 className="mt-3 text-5xl font-black">ภาพรวมโดเนท</h1>
        <section className="mt-8 grid gap-4 md:grid-cols-4">
          <div className="card p-5"><strong className="block text-3xl">฿{(data?.revenue ?? 0).toLocaleString("th-TH")}</strong><span className="text-white/60">รายได้รวมที่ชำระสำเร็จ</span></div>
          <div className="card p-5"><strong className="block text-3xl">{data?.donationCount ?? 0}</strong><span className="text-white/60">จำนวนรายการทั้งหมด</span></div>
          <div className="card p-5"><strong className="block text-3xl">฿{highestDonation.toLocaleString("th-TH")}</strong><span className="text-white/60">ยอดโดเนทสูงสุด</span></div>
          <div className="card p-5"><strong className="block text-3xl">/{data?.page?.slug ?? "-"}</strong><span className="text-white/60">URL หน้าโดเนท</span></div>
        </section>

        <section className="mt-5 grid gap-5 lg:grid-cols-[1fr_.8fr]">
          <div className="card p-5">
            <h2 className="text-2xl font-black">สถิติรายได้</h2>
            <div className="mt-5 flex h-64 items-end gap-3 rounded-2xl border border-white/10 bg-white/5 p-4">
              {bars.map((height, index) => (
                <div key={index} className="flex-1 rounded-t-xl bg-gradient-to-t from-mint to-coral" style={{ height: `${height}%` }} />
              ))}
            </div>
          </div>
          <div className="card p-5">
            <h2 className="text-2xl font-black">สถานะรายการ</h2>
            <div className="mt-5 grid gap-3">
              <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 p-4"><span>ชำระสำเร็จ</span><strong className="text-mint">{paidDonations.length}</strong></div>
              <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 p-4"><span>รอดำเนินการ</span><strong className="text-gold">{pendingDonations.length}</strong></div>
              <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 p-4"><span>ยอดขั้นต่ำ</span><strong>฿{(data?.page?.minAmount ?? 0).toLocaleString("th-TH")}</strong></div>
            </div>
          </div>
        </section>

        <section className="mt-5 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {quickLinks.map((item) => (
            <Link key={item.href} href={item.href} className="card block p-5 transition hover:border-mint/60">
              <h2 className="text-xl font-black">{item.title}</h2>
              <p className="mt-2 text-sm leading-6 text-white/60">{item.text}</p>
            </Link>
          ))}
        </section>

        <section className="card mt-5 overflow-auto p-5">
          <h2 className="mb-4 text-2xl font-black">Donation History</h2>
          <table className="w-full min-w-[760px] text-left">
            <thead className="text-white/60"><tr><th className="p-2">Donor</th><th>Amount</th><th>Status</th><th>Message</th><th>Created</th></tr></thead>
            <tbody>
              {donations.map((item) => (
                <tr key={item.id} className="border-t border-white/10">
                  <td className="p-2">{item.anonymous ? "บุคคลนิรนาม" : item.donorName}</td>
                  <td>฿{item.amount.toLocaleString("th-TH")}</td>
                  <td><span className="badge">{item.paymentStatus}</span></td>
                  <td>{item.message}</td>
                  <td className="text-white/45">{item.createdAt ? new Date(item.createdAt).toLocaleString("th-TH") : "-"}</td>
                </tr>
              ))}
              {!donations.length && (
                <tr><td className="p-4 text-white/45" colSpan={5}>ยังไม่มีรายการโดเนท</td></tr>
              )}
            </tbody>
          </table>
        </section>
      </main>
    </AuthGate>
  );
}
