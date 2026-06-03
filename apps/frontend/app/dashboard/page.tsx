"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AuthGate } from "@/components/AuthGate";
import { Nav } from "@/components/Nav";
import { api, authHeaders } from "@/lib/api";
import { useAppPreferences } from "@/lib/app-preferences";

type Donation = {
  id: string;
  donorName: string;
  amount: number;
  message: string;
  anonymous: boolean;
  paymentStatus: string;
  paymentProvider?: string;
  transactionRef?: string | null;
  createdAt?: string;
  paidAt?: string | null;
};

type ViewBy = "day" | "week" | "month";

function toDateInput(date: Date) {
  return date.toISOString().slice(0, 10);
}

function startDefaultDate() {
  return "2026-05-03";
}

function yesterday() {
  const date = new Date();
  date.setDate(date.getDate() - 1);
  return toDateInput(date);
}

function triggerOverlayAgain(item: Donation) {
  localStorage.setItem("tiphouse_overlay_donation", JSON.stringify({
    donorName: item.anonymous ? "บุคคลนิรนาม" : item.donorName,
    amount: item.amount,
    message: item.message,
    anonymous: item.anonymous,
    nonce: Date.now(),
  }));
}

export default function DashboardPage() {
  const { t } = useAppPreferences();
  const [data, setData] = useState<any>(null);
  const [viewBy, setViewBy] = useState<ViewBy>("day");
  const [fromDate, setFromDate] = useState(startDefaultDate);
  const [toDate, setToDate] = useState(yesterday);

  useEffect(() => {
    api.get("/dashboard", { headers: authHeaders() }).then((res) => setData(res.data)).catch(() => setData(null));
  }, []);

  const donations = useMemo<Donation[]>(() => data?.donations ?? [], [data]);
  const filteredDonations = useMemo(() => {
    const from = new Date(`${fromDate}T00:00:00`);
    const to = new Date(`${toDate}T23:59:59`);
    return donations.filter((item) => {
      const created = item.paidAt || item.createdAt ? new Date(item.paidAt ?? item.createdAt ?? "") : null;
      return created && created >= from && created <= to;
    });
  }, [donations, fromDate, toDate]);

  const paidDonations = filteredDonations.filter((item) => item.paymentStatus === "PAID");
  const pendingDonations = donations.filter((item) => item.paymentStatus !== "PAID");
  const highestDonation = paidDonations.reduce((max, item) => Math.max(max, item.amount), 0);
  const revenue = paidDonations.reduce((sum, item) => sum + item.amount, 0);
  const bars = useMemo(() => {
    const groups = new Map<string, number>();
    for (const item of paidDonations) {
      const date = item.paidAt || item.createdAt ? new Date(item.paidAt ?? item.createdAt ?? "") : new Date();
      const key = viewBy === "month"
        ? `${date.getFullYear()}-${date.getMonth() + 1}`
        : viewBy === "week"
          ? `${date.getFullYear()}-W${Math.ceil(date.getDate() / 7)}-${date.getMonth() + 1}`
          : toDateInput(date);
      groups.set(key, (groups.get(key) ?? 0) + item.amount);
    }
    const values = [...groups.values()].slice(-8);
    const max = Math.max(...values, 1);
    return values.length ? values.map((value) => Math.max(12, Math.round((value / max) * 100))) : [20, 28, 16, 36, 24, 44];
  }, [paidDonations, viewBy]);

  return (
    <AuthGate>
      <Nav />
      <main className="mx-auto w-[min(1200px,calc(100%-2rem))] py-10">
        <p className="font-bold text-mint">Creator Dashboard</p>
        <h1 className="mt-3 text-5xl font-black">{t("ภาพรวมโดเนท", "Donation Overview")}</h1>

        <section className="mt-8 grid gap-4 md:grid-cols-4">
          <div className="card p-5"><strong className="block text-3xl">฿{revenue.toLocaleString("th-TH")}</strong><span className="text-white/60">{t("รายได้ที่ชำระสำเร็จ", "Paid Revenue")}</span></div>
          <div className="card p-5"><strong className="block text-3xl">{filteredDonations.length}</strong><span className="text-white/60">{t("รายการในช่วงที่เลือก", "Transactions in Range")}</span></div>
          <div className="card p-5"><strong className="block text-3xl">฿{highestDonation.toLocaleString("th-TH")}</strong><span className="text-white/60">{t("ยอดโดเนทสูงสุด", "Highest Donation")}</span></div>
          <div className="card p-5"><strong className="block text-3xl">/{data?.page?.slug ?? "-"}</strong><span className="text-white/60">{t("URL หน้าโดเนท", "Donation URL")}</span></div>
        </section>

        <section className="mt-5 grid gap-5 lg:grid-cols-[1fr_.8fr]">
          <div className="card p-5">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <h2 className="text-2xl font-black">{t("สถิติรายได้", "Revenue Analytics")}</h2>
              <div className="flex flex-wrap gap-2 text-sm">
                <label>{t("ดูตาม", "View By")}<select className="input mt-1 h-11 min-w-36 py-1" value={viewBy} onChange={(event) => setViewBy(event.target.value as ViewBy)}><option value="day">Day</option><option value="week">Week</option><option value="month">Month</option></select></label>
                <label>{t("จาก", "From")}<input className="input mt-1 h-10 py-1" type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} /></label>
                <label>{t("ถึง", "To")}<input className="input mt-1 h-10 py-1" type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} /></label>
              </div>
            </div>
            <div className="mt-5 flex h-64 items-end gap-3 rounded-2xl border border-white/10 bg-white/5 p-4">
              {bars.map((height, index) => (
                <div key={index} className="flex-1 rounded-t-xl bg-gradient-to-t from-mint to-coral" style={{ height: `${height}%` }} />
              ))}
            </div>
          </div>
          <div className="card p-5">
            <h2 className="text-2xl font-black">{t("สถานะรายการ", "Transaction Status")}</h2>
            <div className="mt-5 grid gap-3">
              <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 p-4"><span>{t("ชำระสำเร็จ", "Paid")}</span><strong className="text-mint">{paidDonations.length}</strong></div>
              <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 p-4"><span>{t("รอดำเนินการ", "Pending")}</span><strong className="text-gold">{pendingDonations.length}</strong></div>
              <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 p-4"><span>{t("ยอดขั้นต่ำ", "Minimum")}</span><strong>฿{(data?.page?.minAmount ?? 0).toLocaleString("th-TH")}</strong></div>
            </div>
          </div>
        </section>

        <section className="card mt-5 overflow-auto p-5">
          <h2 className="mb-4 text-2xl font-black">{t("ประวัติโดเนท", "Donation History")}</h2>
          <table className="w-full min-w-[860px] text-left">
            <thead className="text-white/60"><tr><th className="p-2">{t("วันที่", "Date")}</th><th>{t("รายการ", "Method")}</th><th>{t("เลขที่อ้างอิง", "Reference")}</th><th>{t("จำนวนเงิน", "Amount")}</th><th>{t("ข้อความ", "Message")}</th><th>Alert</th></tr></thead>
            <tbody>
              {filteredDonations.map((item) => (
                <tr key={item.id} className="border-t border-white/10">
                  <td className="p-2">{item.createdAt ? new Date(item.paidAt ?? item.createdAt).toLocaleString("th-TH") : "-"}</td>
                  <td>{item.paymentProvider ?? "PROMPTPAY"}</td>
                  <td>{item.transactionRef ? <Link className="text-mint underline" href={`/receipt/${encodeURIComponent(item.transactionRef)}`} target="_blank">{item.transactionRef}</Link> : "-"}</td>
                  <td>฿{item.amount.toLocaleString("th-TH")}</td>
                  <td>{item.message || "-"}</td>
                  <td><button className="btn h-9 min-h-9 px-3 py-1 text-xs" type="button" onClick={() => triggerOverlayAgain(item)}>{t("Alert ซ้ำ", "Replay Alert")}</button></td>
                </tr>
              ))}
              {!filteredDonations.length && (
                <tr><td className="p-4 text-white/45" colSpan={6}>{t("ยังไม่มีรายการโดเนท", "No donations yet")}</td></tr>
              )}
            </tbody>
          </table>
        </section>
      </main>
    </AuthGate>
  );
}
