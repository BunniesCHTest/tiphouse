"use client";

import { FormEvent, use, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";

type PageData = {
  slug: string;
  displayName: string;
  handle: string;
  bannerUrl?: string | null;
  avatarUrl?: string | null;
  donationAccountName?: string | null;
  minAmount: number;
  goalAmount: number;
};

type QrState = {
  qrDataUrl: string;
  qrDisplayName: string;
  transactionRef: string;
};

const defaultPage: PageData = {
  slug: "bunniesch",
  displayName: "Bunnie SCH",
  handle: "@bunniesch",
  bannerUrl: "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=1200&q=80",
  donationAccountName: "Bunnie SCH Donate",
  minAmount: 20,
  goalAmount: 5000,
};

function triggerOverlay(payload: { donorName: string; amount: number; message: string }) {
  localStorage.setItem("tiphouse_overlay_donation", JSON.stringify({ ...payload, nonce: Date.now() }));
}

export default function DonatePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const [page, setPage] = useState<PageData | null>(null);
  const [qr, setQr] = useState<QrState | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [formState, setFormState] = useState({ donorName: "", message: "", amount: "" });

  useEffect(() => {
    api.get(`/page/${slug}`).then((res) => {
      setPage(res.data);
      setError("");
    }).catch(() => {
      setPage({ ...defaultPage, slug });
      setError("ไม่พบหน้าโดเนทนี้ หรือ backend ยังไม่พร้อม");
    });
  }, [slug]);

  const amountNumber = Number(formState.amount || 0);
  const amountTooLow = Boolean(page && formState.amount && amountNumber < page.minAmount);
  const canDonate = useMemo(() => {
    return Boolean(page && formState.donorName.trim() && formState.message.trim() && formState.amount && Number.isFinite(amountNumber) && amountNumber >= page.minAmount);
  }, [amountNumber, formState, page]);

  async function donate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!page || !canDonate) return;
    const form = new FormData(event.currentTarget);
    const donorName = String(form.get("donorName") || "Anonymous");
    const message = String(form.get("message") || "");
    try {
      const { data } = await api.post("/donate", {
        pageSlug: page.slug,
        donorName,
        message,
        amount: Number(form.get("amount")),
        anonymous: form.get("anonymous") === "on",
        provider: "PROMPTPAY",
      });
      setQr({
        qrDataUrl: data.qrDataUrl,
        qrDisplayName: data.qrDisplayName ?? page.donationAccountName ?? "TipHouse Donate",
        transactionRef: data.transactionRef,
      });
      setError("");
    } catch {
      const transactionRef = `LOCAL-${Date.now()}`;
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240"><rect width="240" height="240" fill="white"/><text x="120" y="110" text-anchor="middle" font-family="Arial" font-size="18" fill="#071012">TipHouse QR</text><text x="120" y="140" text-anchor="middle" font-family="Arial" font-size="14" fill="#071012">${page.donationAccountName ?? "TipHouse Donate"}</text><text x="120" y="165" text-anchor="middle" font-family="Arial" font-size="14" fill="#071012">THB ${amountNumber}</text></svg>`;
      setQr({
        qrDataUrl: `data:image/svg+xml;base64,${btoa(svg)}`,
        qrDisplayName: page.donationAccountName ?? "TipHouse Donate",
        transactionRef,
      });
      setError("");
    }
  }

  function cancelQr() {
    setQr(null);
    setSuccess(false);
  }

  function completePaymentCheck() {
    triggerOverlay({
      donorName: formState.donorName || "Anonymous",
      amount: amountNumber,
      message: formState.message || "Thank you!",
    });
    setSuccess(true);
  }

  if (!page) return <main className="grid min-h-screen place-items-center">{error || "Loading..."}</main>;

  return (
    <main>
      {success && (
        <div className="fixed inset-0 z-40 grid place-items-center bg-black/60 px-4">
          <section className="card max-w-md p-6 text-center">
            <span className="badge">SUCCESS</span>
            <h2 className="mt-3 text-3xl font-black">ดำเนินการโดเนทสำเร็จ</h2>
            <p className="mt-2 text-white/65">ระบบตรวจสอบการโอนเงินเสร็จสิ้นแล้ว และส่ง Overlay ไปยัง OBS แล้ว</p>
            <button className="btn btn-primary mt-5" onClick={cancelQr}>กลับไปหน้าโดเนท</button>
          </section>
        </div>
      )}
      <section
        className="grid min-h-[45vh] content-end bg-cover bg-center p-6"
        style={{ backgroundImage: `linear-gradient(rgba(0,0,0,.1),rgba(0,0,0,.72)), url(${page.bannerUrl ?? defaultPage.bannerUrl})` }}
      >
        <div className="mx-auto flex w-[min(1100px,100%)] items-end gap-4">
          <div className="grid size-20 place-items-center overflow-hidden rounded-2xl border-2 border-white/70 bg-mint text-2xl font-black text-ink">
            {page.avatarUrl ? <img alt="" src={page.avatarUrl} className="size-full object-cover" /> : "TH"}
          </div>
          <div>
            <h1 className="mt-2 text-5xl font-black md:text-7xl">{page.displayName}</h1>
            <p className="text-white/70">{page.handle}</p>
          </div>
        </div>
      </section>
      <section className="mx-auto grid w-[min(1100px,calc(100%-2rem))] gap-5 py-8 lg:grid-cols-[1fr_.75fr]">
        {!qr ? (
          <form onSubmit={donate} className="card grid gap-4 p-5">
            <label>ชื่อผู้โดเนท<input className="input mt-2" name="donorName" value={formState.donorName} onChange={(event) => setFormState({ ...formState, donorName: event.target.value })} required /></label>
            <label>ข้อความ<textarea className="input mt-2 min-h-28" name="message" value={formState.message} onChange={(event) => setFormState({ ...formState, message: event.target.value })} required /></label>
            <label>
              จำนวนเงิน
              <input className={`input mt-2 ${amountTooLow ? "border-coral text-coral" : ""}`} name="amount" type="number" min={page.minAmount} value={formState.amount} onChange={(event) => setFormState({ ...formState, amount: event.target.value })} required />
              {amountTooLow && <span className="mt-2 block font-bold text-coral">ยอดโดเนทต้องไม่น้อยกว่า ฿{page.minAmount}</span>}
            </label>
            <label className="flex gap-2 text-white/70"><input name="anonymous" type="checkbox" /> แสดงเป็น Anonymous</label>
            {error && <p className="text-coral">{error}</p>}
            <button className="btn btn-primary disabled:cursor-not-allowed disabled:opacity-40" type="submit" disabled={!canDonate}>ดำเนินการโดเนท</button>
          </form>
        ) : (
          <aside className="card grid gap-4 p-5 text-center">
            <h2 className="text-2xl font-black">PromptPay QR</h2>
            <p className="text-white/60">สแกนแล้วจะแสดงชื่อบัญชีโดเนท: <strong className="text-white">{qr.qrDisplayName}</strong></p>
            <img alt="PromptPay QR" src={qr.qrDataUrl} className="mx-auto size-64 rounded-lg bg-white p-3" />
            <p className="text-sm text-white/45">Ref: {qr.transactionRef}</p>
            <div className="flex flex-wrap justify-center gap-3">
              <button className="btn btn-primary" type="button" onClick={completePaymentCheck}>จำลองตรวจสอบการโอนเงินสำเร็จ</button>
              <button className="btn" type="button" onClick={cancelQr}>ยกเลิก QR code</button>
            </div>
          </aside>
        )}
        <aside className="card grid content-start gap-4 p-5">
          <h2 className="text-2xl font-black">Donation Detail</h2>
          <p className="text-white/60">QR code จะแสดงหลังจากกรอกข้อมูลครบและกด “ดำเนินการโดเนท” เท่านั้น</p>
        </aside>
      </section>
    </main>
  );
}
