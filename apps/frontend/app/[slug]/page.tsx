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

type RecentDonation = {
  donorName: string;
  amount: number;
  message: string;
  anonymous: boolean;
  paidAt?: string | null;
};

type DonorRank = {
  donorName: string;
  amount: number;
  count: number;
  anonymous: boolean;
};

type DonateStep = "form" | "summary" | "qr" | "success";

const THAI_ANONYMOUS = "บุคคลนิรนาม";
const quickAmounts = [50, 100, 300, 500, 1000];

const defaultPage: PageData = {
  slug: "bunniesch",
  displayName: "Bunnie SCH",
  handle: "@bunniesch",
  bannerUrl: "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=1200&q=80",
  donationAccountName: "Bunnie SCH Donate",
  minAmount: 20,
  goalAmount: 5000,
};

function triggerOverlay(payload: { donorName: string; amount: number; message: string; anonymous?: boolean }) {
  localStorage.setItem("tiphouse_overlay_donation", JSON.stringify({ ...payload, nonce: Date.now() }));
}

export default function DonatePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const [page, setPage] = useState<PageData | null>(null);
  const [qr, setQr] = useState<QrState | null>(null);
  const [error, setError] = useState("");
  const [step, setStep] = useState<DonateStep>("form");
  const [formState, setFormState] = useState({ donorName: "", message: "", amount: "", anonymous: false });
  const [recentDonations, setRecentDonations] = useState<RecentDonation[]>([]);
  const [donorRank, setDonorRank] = useState<DonorRank[]>([]);

  useEffect(() => {
    api.get(`/page/${slug}`).then((res) => {
      setPage(res.data);
      setError("");
    }).catch(() => {
      if (["127.0.0.1", "localhost"].includes(window.location.hostname)) {
        setPage({ ...defaultPage, slug });
        return;
      }
      setPage(null);
      setError("ไม่พบหน้าโดเนทนี้ หรือ backend ยังไม่พร้อม");
    });
    api.get(`/donations/latest/${slug}`).then((res) => setRecentDonations(res.data ?? [])).catch(() => setRecentDonations([]));
    api.get(`/donations/rank/${slug}`).then((res) => setDonorRank(res.data ?? [])).catch(() => setDonorRank([]));
  }, [slug]);

  const amountNumber = Number(formState.amount || 0);
  const amountTooLow = Boolean(page && formState.amount && amountNumber < page.minAmount);
  const displayDonorName = formState.anonymous ? THAI_ANONYMOUS : formState.donorName.trim();
  const canDonate = useMemo(() => {
    const hasDonorName = formState.anonymous || formState.donorName.trim();
    return Boolean(page && hasDonorName && formState.message.trim() && formState.amount && Number.isFinite(amountNumber) && amountNumber >= page.minAmount);
  }, [amountNumber, formState, page]);

  function continueToSummary(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!page || !canDonate) return;
    setError("");
    setStep("summary");
  }

  async function createQr() {
    if (!page || !canDonate) return;
    const anonymous = formState.anonymous;
    const donorName = anonymous ? "Anonymous" : formState.donorName.trim();
    try {
      const { data } = await api.post("/donate", {
        pageSlug: page.slug,
        donorName,
        message: formState.message.trim(),
        amount: amountNumber,
        anonymous,
        provider: "PROMPTPAY",
      });
      setQr({
        qrDataUrl: data.qrDataUrl,
        qrDisplayName: data.qrDisplayName ?? page.donationAccountName ?? "TipHouse Donate",
        transactionRef: data.transactionRef,
      });
      setError("");
      setStep("qr");
    } catch {
      if (!["127.0.0.1", "localhost"].includes(window.location.hostname)) {
        setError("ไม่สามารถสร้าง QR ได้ กรุณาลองใหม่อีกครั้ง");
        return;
      }
      const transactionRef = `LOCAL-${Date.now()}`;
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240"><rect width="240" height="240" fill="white"/><text x="120" y="110" text-anchor="middle" font-family="Arial" font-size="18" fill="#071012">TipHouse QR</text><text x="120" y="140" text-anchor="middle" font-family="Arial" font-size="14" fill="#071012">${page.donationAccountName ?? "TipHouse Donate"}</text><text x="120" y="165" text-anchor="middle" font-family="Arial" font-size="14" fill="#071012">THB ${amountNumber}</text></svg>`;
      setQr({
        qrDataUrl: `data:image/svg+xml;base64,${btoa(svg)}`,
        qrDisplayName: page.donationAccountName ?? "TipHouse Donate",
        transactionRef,
      });
      setError("");
      setStep("qr");
    }
  }

  function resetFlow() {
    setQr(null);
    setStep("form");
  }

  function toggleAnonymous() {
    setFormState((current) => ({
      ...current,
      anonymous: !current.anonymous,
      donorName: !current.anonymous ? "" : current.donorName,
    }));
  }

  function completePaymentCheck() {
    triggerOverlay({
      donorName: formState.anonymous ? THAI_ANONYMOUS : formState.donorName,
      amount: amountNumber,
      message: formState.message || "Thank you!",
      anonymous: formState.anonymous,
    });
    setStep("success");
  }

  function downloadQr() {
    if (!qr) return;
    const link = document.createElement("a");
    link.href = qr.qrDataUrl;
    link.download = `tiphouse-${qr.transactionRef}.png`;
    link.click();
  }

  function scrollToRank() {
    document.getElementById("top-donator-rank")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  if (!page) return <main className="grid min-h-screen place-items-center">{error || "Loading..."}</main>;

  return (
    <main>
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
      <section className="mx-auto grid w-[min(1180px,calc(100%-2rem))] gap-6 py-8 lg:grid-cols-[430px_1fr]">
        {step === "form" && (
          <div className="phone-frame">
            <form onSubmit={continueToSummary} className="phone-screen grid gap-4 p-5">
              <div className="rounded-2xl bg-gradient-to-br from-mint to-coral p-5 text-ink">
                <div className="flex items-center gap-3">
                  <div className="grid size-14 place-items-center overflow-hidden rounded-2xl bg-white/90 text-lg font-black text-ink">
                    {page.avatarUrl ? <img alt="" src={page.avatarUrl} className="size-full object-cover" /> : "TH"}
                  </div>
                  <div>
                    <h2 className="text-3xl font-black">{page.displayName}</h2>
                    <p className="mt-1 font-semibold opacity-75">ส่งกำลังใจให้ครีเอเตอร์ที่คุณชอบ</p>
                  </div>
                </div>
              </div>
              <section className="draft-panel">
                <div className="mb-3 font-black">เลือกจำนวนเงิน</div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {quickAmounts.map((amount) => (
                    <button
                      key={amount}
                      className={`btn ${amountNumber === amount ? "btn-primary" : ""}`}
                      type="button"
                      onClick={() => setFormState({ ...formState, amount: String(amount) })}
                    >
                      ฿{amount.toLocaleString("th-TH")}
                    </button>
                  ))}
                </div>
                <label className="mt-3 block">
                  กำหนดเอง
                  <input className={`input mt-2 ${amountTooLow ? "border-coral text-coral" : ""}`} name="amount" type="number" min={page.minAmount} value={formState.amount} onChange={(event) => setFormState({ ...formState, amount: event.target.value })} required />
                  {amountTooLow && <span className="mt-2 block font-bold text-coral">ยอดโดเนทต้องไม่น้อยกว่า ฿{page.minAmount}</span>}
                  {!amountTooLow && <span className="mt-2 block text-sm text-white/60">ขั้นต่ำ {page.minAmount.toLocaleString("th-TH")} บาท</span>}
                </label>
              </section>
              <section className="draft-panel grid gap-3">
                <label>
                  ชื่อผู้โดเนท
                  <input
                    className="input mt-2 disabled:cursor-not-allowed disabled:opacity-75"
                    name="donorName"
                    value={formState.anonymous ? THAI_ANONYMOUS : formState.donorName}
                    onChange={(event) => setFormState({ ...formState, donorName: event.target.value })}
                    disabled={formState.anonymous}
                    required={!formState.anonymous}
                  />
                </label>
                <button className={`btn justify-self-start ${formState.anonymous ? "btn-primary" : ""}`} type="button" aria-pressed={formState.anonymous} onClick={toggleAnonymous}>
                  แสดงเป็น Anonymous
                </button>
              </section>
              <section className="draft-panel">
                <label>ข้อความถึงสตรีมเมอร์<textarea className="input mt-2 min-h-28" name="message" value={formState.message} onChange={(event) => setFormState({ ...formState, message: event.target.value })} required /></label>
              </section>
              {error && <p className="text-coral">{error}</p>}
              <button className="btn btn-primary disabled:cursor-not-allowed disabled:opacity-40" type="submit" disabled={!canDonate}>ดำเนินการต่อ</button>
            </form>
          </div>
        )}

        {step === "summary" && (
          <div className="phone-frame">
            <section className="phone-screen grid gap-4 p-5">
              <div className="rounded-2xl bg-gradient-to-br from-mint to-coral p-6 text-ink">
                <h2 className="text-3xl font-black">ตรวจสอบรายการ</h2>
                <p className="mt-3 font-semibold opacity-80">ระบบชำระเงินเข้ารหัสและปลอดภัย ตรวจสอบรายการได้ก่อนจ่ายทุกครั้ง</p>
              </div>
              <div className="draft-panel grid gap-3">
                {[
                  ["ส่งถึง", page.displayName],
                  ["ชื่อที่แสดง", displayDonorName],
                  ["ข้อความ", formState.message],
                  ["ยอดโดเนท", `฿${amountNumber.toLocaleString("th-TH")}`],
                ].map(([label, value]) => (
                  <div key={label} className="flex items-start justify-between gap-4 border-b border-dashed border-white/10 pb-3 last:border-0 last:pb-0">
                    <span className="text-white/70">{label}</span>
                    <strong className="max-w-[55%] text-right">{value}</strong>
                  </div>
                ))}
                <div className="flex items-center justify-between pt-2">
                  <span className="font-black">ยอดชำระทั้งหมด</span>
                  <strong className="text-4xl font-black text-mint">฿{amountNumber.toLocaleString("th-TH")}</strong>
                </div>
              </div>
              {error && <p className="text-coral">{error}</p>}
              <button className="btn btn-primary" type="button" onClick={createQr}>ยืนยันและชำระเงิน</button>
              <button className="btn" type="button" onClick={() => setStep("form")}>กลับไปแก้ไข</button>
            </section>
          </div>
        )}

        {step === "qr" && qr && (
          <div className="phone-frame">
            <aside className="phone-screen grid gap-4 p-5 text-center">
              <div className="rounded-2xl bg-gradient-to-br from-mint to-coral p-6 text-left text-ink">
                <h2 className="text-3xl font-black">ชำระเงินด้วย QR</h2>
                <p className="mt-3 font-semibold opacity-80">หลังชำระเงิน กดตรวจสอบสถานะเพื่อให้ระบบยืนยันรายการ</p>
              </div>
              <section className="draft-panel">
                <p className="font-black">ยอดชำระ</p>
                <strong className="mt-1 block text-4xl font-black text-mint">฿{amountNumber.toLocaleString("th-TH")}</strong>
                <img alt="PromptPay QR" src={qr.qrDataUrl} className="mx-auto mt-4 size-64 rounded-2xl bg-white p-3" />
                <button className="btn mt-4 w-full" type="button" onClick={downloadQr}>บันทึกภาพ QR เพื่อเปิดในแอปธนาคาร</button>
                <p className="mt-3 text-sm text-white/55">กรุณาชำระภายใน 10:00 นาที อยู่ที่ขั้นตอนหน้าจอก่อนระบบตรวจสอบสำเร็จ</p>
              </section>
              <section className="draft-panel text-left">
                <h3 className="font-black">วิธีชำระเงิน</h3>
                <div className="mt-3 grid gap-2">
                  {["เปิดแอปธนาคาร", "สแกน QR Code หรือเลือกภาพ QR จากเครื่อง", "ชำระเงินตามยอดที่แสดง"].map((item, index) => (
                    <div className="draft-step" key={item}>
                      <span className="draft-step-number">{index + 1}</span>
                      <span className="font-bold">{item}</span>
                    </div>
                  ))}
                </div>
              </section>
              <p className="text-xs text-white/40">Ref: {qr.transactionRef}</p>
              <div className="grid gap-3">
                <button className="btn btn-primary" type="button" onClick={completePaymentCheck}>ตรวจสอบสถานะ</button>
                <button className="btn" type="button" onClick={resetFlow}>ยกเลิก QR code</button>
              </div>
            </aside>
          </div>
        )}

        {step === "success" && (
          <div className="phone-frame">
            <section className="phone-screen grid gap-4 p-5 text-center">
              <div className="rounded-2xl bg-gradient-to-br from-mint to-coral p-6 text-left text-ink">
                <h2 className="text-3xl font-black">โดเนทสำเร็จแล้ว</h2>
                <p className="mt-3 font-semibold opacity-80">ขอบคุณสำหรับการสนับสนุน</p>
              </div>
              <div className="mx-auto grid size-24 place-items-center rounded-[2rem] bg-gradient-to-br from-mint to-coral text-6xl font-light text-white">✓</div>
              <h3 className="text-2xl font-black">ระบบยืนยันรายการแล้ว</h3>
              <div className="draft-panel grid gap-3 text-left">
                <div className="flex items-center justify-between border-b border-dashed border-white/10 pb-3">
                  <span>ยอดโดเนท</span>
                  <strong>฿{amountNumber.toLocaleString("th-TH")}</strong>
                </div>
                <div className="flex items-center justify-between">
                  <span>สถานะ</span>
                  <strong className="badge">Completed</strong>
                </div>
              </div>
              <button className="btn btn-primary" type="button" onClick={scrollToRank}>ดูอันดับผู้สนับสนุน</button>
              <button className="btn" type="button" onClick={resetFlow}>กลับไปหน้าโดเนท</button>
            </section>
          </div>
        )}

        <aside className="draft-band grid content-start gap-4 p-5">
          <h2 className="text-2xl font-black">Donation Detail</h2>
          <p className="text-white/60">QR code จะแสดงหลังจากกรอกข้อมูลครบ ตรวจสอบรายการ และกดยืนยันชำระเงินเท่านั้น</p>
          <div className="grid gap-2">
            {["กรอกข้อมูลโดเนท", "ตรวจสอบรายการ", "ชำระเงินด้วย QR", "ส่ง Alert ไป OBS/Streamlabs"].map((stepLabel, index) => (
              <div className="draft-step" key={stepLabel}>
                <span className="draft-step-number">{index + 1}</span>
                <span className="font-bold">{stepLabel}</span>
              </div>
            ))}
          </div>
          <div className="border-t border-white/10 pt-4">
            <h3 className="text-xl font-black">Recent Donations</h3>
            <div className="mt-3 grid gap-3">
              {recentDonations.length ? recentDonations.map((item, index) => (
                <div key={`${item.paidAt ?? index}-${item.amount}`} className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <strong>{item.anonymous ? THAI_ANONYMOUS : item.donorName}</strong>
                    <span className="font-black text-mint">฿{item.amount.toLocaleString("th-TH")}</span>
                  </div>
                  <p className="mt-1 text-sm text-white/55">{item.message}</p>
                </div>
              )) : <p className="text-sm text-white/45">ยังไม่มีรายการโดเนทล่าสุด</p>}
            </div>
          </div>
        </aside>
      </section>
      <section id="top-donator-rank" className="mx-auto w-[min(1180px,calc(100%-2rem))] pb-10">
        <div className="draft-band p-5">
          <h2 className="text-3xl font-black">Top Donator Rank</h2>
          <p className="mt-3 text-sm text-white/65">ระบบ Rank ตามยอดโดเนทสูงสุด เลือกดูรายวัน รายเดือน หรือตลอดกาลได้</p>
          <div className="mt-5 grid gap-3">
            {(donorRank.length ? donorRank : [
              { donorName: "NightOwl", amount: 12500, count: 8, anonymous: false },
              { donorName: "PandaChan", amount: 9200, count: 5, anonymous: false },
              { donorName: THAI_ANONYMOUS, amount: 5600, count: 3, anonymous: true },
            ]).map((item, index) => (
              <div key={`${item.donorName}-${index}`} className="flex items-center justify-between gap-4 rounded-2xl border border-sky/20 bg-white/5 p-4">
                <strong><span className="mr-2 text-mint">#{index + 1}</span>{item.anonymous ? THAI_ANONYMOUS : item.donorName}</strong>
                <strong>฿{item.amount.toLocaleString("th-TH")}</strong>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
