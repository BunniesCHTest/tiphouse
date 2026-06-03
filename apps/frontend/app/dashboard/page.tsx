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

type StreamlabsTip = {
  id: string;
  when?: string | null;
  tipper: string;
  amount: number;
  message: string;
};

type HistoryRow = {
  id: string;
  when?: string | null;
  tipper: string;
  amount: number;
  message: string;
  provider: string;
  reference?: string | null;
  source: "streamlabs" | "tiphouse";
  anonymous?: boolean;
};

type ViewBy = "day" | "week" | "month" | "year";
type DashboardTab = "overview" | "transactions";

const PAGE_SIZE = 10;

function toDateInput(date: Date) {
  return date.toISOString().slice(0, 10);
}

function defaultFromDate() {
  const date = new Date();
  date.setMonth(date.getMonth() - 1, 1);
  return toDateInput(date);
}

function defaultToDate() {
  return toDateInput(new Date());
}

function formatBaht(amount: number) {
  return `฿${amount.toLocaleString("th-TH")}`;
}

function rowDate(row: HistoryRow) {
  if (!row.when) return null;
  const date = new Date(row.when);
  return Number.isNaN(date.getTime()) ? null : date;
}

function groupKey(date: Date, viewBy: ViewBy) {
  if (viewBy === "year") return `${date.getFullYear()}`;
  if (viewBy === "month") return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  if (viewBy === "week") {
    const start = new Date(date.getFullYear(), 0, 1);
    const week = Math.ceil((((date.getTime() - start.getTime()) / 86400000) + start.getDay() + 1) / 7);
    return `${date.getFullYear()}-W${String(week).padStart(2, "0")}`;
  }
  return toDateInput(date);
}

function triggerOverlayAgain(item: HistoryRow) {
  localStorage.setItem("tiphouse_overlay_donation", JSON.stringify({
    donorName: item.anonymous ? "บุคคลนิรนาม" : item.tipper,
    amount: item.amount,
    message: item.message,
    anonymous: Boolean(item.anonymous),
    nonce: Date.now(),
  }));
}

export default function DashboardPage() {
  const { t } = useAppPreferences();
  const [data, setData] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<DashboardTab>("overview");
  const [viewBy, setViewBy] = useState<ViewBy>("day");
  const [fromDate, setFromDate] = useState(defaultFromDate);
  const [toDate, setToDate] = useState(defaultToDate);
  const [historyPage, setHistoryPage] = useState(1);

  useEffect(() => {
    api.get("/dashboard", { headers: authHeaders() }).then((res) => setData(res.data)).catch(() => setData(null));
  }, []);

  const donations = useMemo<Donation[]>(() => data?.donations ?? [], [data]);
  const streamlabsTips = useMemo<StreamlabsTip[]>(() => data?.streamlabsTips ?? [], [data]);
  const allRows = useMemo<HistoryRow[]>(() => {
    const streamlabsRows = streamlabsTips.map((item) => ({
      id: item.id,
      when: item.when,
      tipper: item.tipper,
      amount: item.amount,
      message: item.message,
      provider: "Streamlabs Tips",
      reference: null,
      source: "streamlabs" as const,
      anonymous: item.tipper.toLowerCase() === "anonymous",
    }));
    const localRows = donations
      .filter((item) => item.paymentStatus === "PAID")
      .map((item) => ({
        id: item.id,
        when: item.paidAt ?? item.createdAt ?? null,
        tipper: item.anonymous ? "บุคคลนิรนาม" : item.donorName,
        amount: item.amount,
        message: item.message,
        provider: item.paymentProvider ?? "PROMPTPAY",
        reference: item.transactionRef ?? null,
        source: "tiphouse" as const,
        anonymous: item.anonymous,
      }));
    return (streamlabsRows.length ? streamlabsRows : localRows).sort((a, b) => (rowDate(b)?.getTime() ?? 0) - (rowDate(a)?.getTime() ?? 0));
  }, [donations, streamlabsTips]);

  const filteredRows = useMemo(() => {
    const from = new Date(`${fromDate}T00:00:00`);
    const to = new Date(`${toDate}T23:59:59`);
    return allRows.filter((item) => {
      const date = rowDate(item);
      return date && date >= from && date <= to;
    });
  }, [allRows, fromDate, toDate]);

  const revenue = filteredRows.reduce((sum, item) => sum + item.amount, 0);
  const highestDonation = filteredRows.reduce((max, item) => Math.max(max, item.amount), 0);
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const pagedRows = filteredRows.slice((historyPage - 1) * PAGE_SIZE, historyPage * PAGE_SIZE);

  useEffect(() => {
    setHistoryPage(1);
  }, [fromDate, toDate, viewBy, data]);

  const bars = useMemo(() => {
    const groups = new Map<string, number>();
    for (const item of filteredRows) {
      const date = rowDate(item);
      if (!date) continue;
      const key = groupKey(date, viewBy);
      groups.set(key, (groups.get(key) ?? 0) + item.amount);
    }
    const values = [...groups.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, value]) => value).slice(-12);
    const max = Math.max(...values, 1);
    return values.length ? values.map((value) => Math.max(12, Math.round((value / max) * 100))) : [];
  }, [filteredRows, viewBy]);

  return (
    <AuthGate>
      <Nav />
      <main className="mx-auto w-[min(1200px,calc(100%-2rem))] py-10">
        <p className="font-bold text-mint">Creator Dashboard</p>
        <h1 className="mt-3 text-5xl font-black">Dashboard</h1>

        <div className="mt-6 inline-flex rounded-2xl border border-white/10 bg-white/5 p-1">
          <button className={`btn ${activeTab === "overview" ? "btn-primary" : ""}`} type="button" onClick={() => setActiveTab("overview")}>
            {t("ภาพรวมโดเนท", "Overview")}
          </button>
          <button className={`btn ${activeTab === "transactions" ? "btn-primary" : ""}`} type="button" onClick={() => setActiveTab("transactions")}>
            {t("หน้าธุรกรรม", "Transactions")}
          </button>
        </div>

        {activeTab === "overview" && (
          <>
            <section className="mt-8 grid gap-4 md:grid-cols-4">
              <div className="card p-5"><strong className="block text-3xl">{formatBaht(revenue)}</strong><span className="text-white/60">{t("รายได้ที่ชำระสำเร็จ", "Paid Revenue")}</span></div>
              <div className="card p-5"><strong className="block text-3xl">{filteredRows.length}</strong><span className="text-white/60">{t("รายการในช่วงที่เลือก", "Transactions in Range")}</span></div>
              <div className="card p-5"><strong className="block text-3xl">{formatBaht(highestDonation)}</strong><span className="text-white/60">{t("ยอดโดเนทสูงสุด", "Highest Donation")}</span></div>
              <div className="card p-5"><strong className="block text-3xl">/{data?.page?.slug ?? "-"}</strong><span className="text-white/60">{t("URL หน้าโดเนท", "Donation URL")}</span></div>
            </section>

            <section className="card mt-5 p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <h2 className="pt-1 text-2xl font-black leading-none">{t("สถิติรายได้", "Revenue Analytics")}</h2>
                <div className="flex flex-wrap items-end gap-3 text-sm">
                  <label className="grid gap-1">
                    <span>View By</span>
                    <select className="input h-12 min-w-40 px-3 py-2 leading-normal" value={viewBy} onChange={(event) => setViewBy(event.target.value as ViewBy)}>
                      <option value="day">Day</option>
                      <option value="week">Week</option>
                      <option value="month">Month</option>
                      <option value="year">Year</option>
                    </select>
                  </label>
                  <label className="grid gap-1">{t("จาก", "From")}<input className="input h-12 min-w-40 py-2" type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} /></label>
                  <label className="grid gap-1">{t("ถึง", "To")}<input className="input h-12 min-w-40 py-2" type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} /></label>
                </div>
              </div>
              <div className="mt-5 flex h-64 items-end gap-3 rounded-2xl border border-white/10 bg-white/5 p-4">
                {bars.length ? bars.map((height, index) => (
                  <div key={index} className="flex-1 rounded-t-xl bg-gradient-to-t from-mint to-coral" style={{ height: `${height}%` }} />
                )) : <div className="grid h-full w-full place-items-center text-white/45">{t("ยังไม่มีข้อมูลในช่วงวันที่นี้", "No data in this date range")}</div>}
              </div>
            </section>

            <section className="card mt-5 overflow-auto p-5">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-2xl font-black">{t("ประวัติโดเนท", "Donation History")}</h2>
                <p className="text-sm text-white/55">{t("แสดง", "Showing")} {pagedRows.length} / {filteredRows.length}</p>
              </div>
              <table className="w-full min-w-[980px] table-fixed border-separate border-spacing-y-2 text-left">
                <thead className="text-white/60">
                  <tr>
                    <th className="w-[22%] px-3 py-2">{t("วันที่", "When")}</th>
                    <th className="w-[20%] px-3 py-2">{t("ผู้โดเนท", "Tipper")}</th>
                    <th className="w-[14%] px-3 py-2 text-right">{t("จำนวนเงิน", "Amount")}</th>
                    <th className="w-[30%] px-3 py-2">{t("ข้อความ", "Message")}</th>
                    <th className="w-[14%] px-3 py-2 text-center">ALERT</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedRows.map((item) => (
                    <tr key={item.id} className="bg-white/5">
                      <td className="rounded-l-xl px-3 py-3">{item.when ? new Date(item.when).toLocaleString("th-TH") : "-"}</td>
                      <td className="px-3 py-3 font-bold">{item.tipper}</td>
                      <td className="px-3 py-3 text-right">{formatBaht(item.amount)}</td>
                      <td className="px-3 py-3">{item.message || "-"}</td>
                      <td className="rounded-r-xl px-3 py-3 text-center">
                        <button className="btn h-9 min-h-9 px-3 py-1 text-xs" type="button" onClick={() => triggerOverlayAgain(item)}>Alert ซ้ำ</button>
                      </td>
                    </tr>
                  ))}
                  {!pagedRows.length && (
                    <tr><td className="p-4 text-white/45" colSpan={5}>{t("ยังไม่มีรายการโดเนท", "No donations yet")}</td></tr>
                  )}
                </tbody>
              </table>
              {totalPages > 1 && (
                <div className="mt-4 flex items-center justify-end gap-2">
                  <button className="btn h-9 min-h-9 px-3 py-1" type="button" disabled={historyPage <= 1} onClick={() => setHistoryPage((page) => Math.max(1, page - 1))}>Previous</button>
                  <span className="text-sm text-white/60">Page {historyPage} / {totalPages}</span>
                  <button className="btn h-9 min-h-9 px-3 py-1" type="button" disabled={historyPage >= totalPages} onClick={() => setHistoryPage((page) => Math.min(totalPages, page + 1))}>Next</button>
                </div>
              )}
              <p className="mt-3 text-sm text-white/45">ปุ่ม Alert ซ้ำเป็นการส่ง Overlay อีกครั้งเท่านั้น ไม่มีผลกับการโอนเงินหรือยอดเงินใดๆ</p>
            </section>
          </>
        )}

        {activeTab === "transactions" && (
          <section className="card mt-8 overflow-auto p-5">
            <h2 className="mb-4 text-2xl font-black">{t("หน้าธุรกรรม", "Transactions")}</h2>
            <table className="w-full min-w-[860px] text-left">
              <thead className="text-white/60"><tr><th className="p-2">{t("วันที่", "When")}</th><th>{t("รายการ", "Method")}</th><th>{t("เลขที่อ้างอิง", "Reference")}</th><th>{t("จำนวนเงิน", "Amount")}</th></tr></thead>
              <tbody>
                {filteredRows.map((item) => (
                  <tr key={item.id} className="border-t border-white/10">
                    <td className="p-2">{item.when ? new Date(item.when).toLocaleString("th-TH") : "-"}</td>
                    <td>{item.provider}</td>
                    <td>{item.reference ? <Link className="text-mint underline" href={`/receipt/${encodeURIComponent(item.reference)}`} target="_blank">{item.reference}</Link> : "-"}</td>
                    <td>{formatBaht(item.amount)}</td>
                  </tr>
                ))}
                {!filteredRows.length && <tr><td className="p-4 text-white/45" colSpan={4}>{t("ยังไม่มีรายการธุรกรรม", "No transactions yet")}</td></tr>}
              </tbody>
            </table>
          </section>
        )}
      </main>
    </AuthGate>
  );
}
