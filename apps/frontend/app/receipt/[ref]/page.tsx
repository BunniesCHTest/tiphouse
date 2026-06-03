"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import { useAppPreferences } from "@/lib/app-preferences";

type Receipt = {
  reference: string;
  paymentMethod: string;
  createdAt: string;
  paidAt?: string | null;
  status: string;
  amount: number;
  donorName: string;
  message: string;
  page?: { slug: string; displayName: string };
};

export default function ReceiptPage() {
  const params = useParams<{ ref: string }>();
  const { t } = useAppPreferences();
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const ref = Array.isArray(params.ref) ? params.ref[0] : params.ref;
    if (!ref) return;
    api.get(`/donations/receipt/${encodeURIComponent(ref)}`)
      .then((res) => setReceipt(res.data))
      .catch(() => setError(t("ไม่พบใบยืนยันการโอนเงินนี้", "Receipt not found.")));
  }, [params.ref, t]);

  const createdAt = receipt ? new Date(receipt.createdAt).toLocaleString("th-TH", { dateStyle: "long", timeStyle: "short" }) : "";

  return (
    <main className="grid min-h-screen place-items-center px-4 py-10">
      <section className="card w-[min(560px,100%)] p-6">
        <p className="font-bold text-mint">TipHouse Receipt</p>
        <h1 className="mt-3 text-4xl font-black">{t("ยืนยันการโอนเงินสำเร็จ", "Payment Confirmation")}</h1>
        {error && <p className="mt-5 text-coral">{error}</p>}
        {receipt && (
          <div className="mt-6 grid gap-3">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <span className="text-white/60">{t("วิธีชำระเงิน", "Payment Method")}</span>
              <strong>{receipt.paymentMethod}</strong>
            </div>
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <span className="text-white/60">{t("สร้างเมื่อ", "Created At")}</span>
              <strong className="text-right">{createdAt}</strong>
            </div>
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <span className="text-white/60">{t("สถานะ", "Status")}</span>
              <strong className="rounded-full bg-mint/15 px-3 py-1 text-mint">{receipt.status}</strong>
            </div>
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <span className="text-white/60">{t("จำนวนเงิน", "Amount")}</span>
              <strong className="text-3xl text-mint">฿{receipt.amount.toLocaleString("th-TH", { minimumFractionDigits: 2 })}</strong>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-sm text-white/60">{t("เลขที่อ้างอิง", "Reference")}</p>
              <p className="mt-1 break-all font-bold">{receipt.reference}</p>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
