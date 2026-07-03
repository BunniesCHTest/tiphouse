"use client";

import { FormEvent, use, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import { useAppPreferences } from "@/lib/app-preferences";

type PageData = {
  slug: string;
  displayName: string;
  handle: string;
  bannerUrl?: string | null;
  avatarUrl?: string | null;
  donationAccountName?: string | null;
  minAmount: number;
  goalAmount: number;
  theme?: {
    quicklinkUrl?: string;
    quicklinkText?: string;
    donationBackgroundUrl?: string;
  } | null;
};

type QrState = {
  qrDataUrl: string;
  qrDisplayName: string;
  transactionRef: string;
  amount: number;
  createdAt: string;
  expiresAt: string;
};

type DonorRank = {
  donorName: string;
  amount: number;
  count: number;
  anonymous: boolean;
};

type DonateStep = "form" | "summary" | "qr" | "verifying" | "success";

const THAI_ANONYMOUS = "บุคคลนิรนาม";
const rankMedals = ["🥇", "🥈", "🥉"];
const quickAmounts = [50, 100, 300, 500, 1000];
const MAX_DONOR_NAME_LENGTH = 20;
const extraBannedWords = ["ไอ้โง่", "ไอ้ควาย", "ไอ้เหี้ย", "ไอ้ดำ", "ไอ้เตี้ย", "อีโง่", "อีควาย", "อีเหี้ย", "โง่", "ควาย", "เหี้ย", "สัส", "สัตว์"];
const rudePrefixPattern = /(ไอ้|อี)(โง่|ควาย|เหี้ย|สัตว์|สัส|ดำ|เตี้ย|บ้า|เวร|ห่า|ร่าน|ตอแหล)/i;
const bannedWords = ["เหี้ย", "ควย", "สัส", "ไอ้สัตว์", "fuck", "shit", "bitch", "asshole"];

const defaultPage: PageData = {
  slug: "bunniesch",
  displayName: "Bunnie SCH",
  handle: "@bunniesch",
  bannerUrl: "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=1200&q=80",
  donationAccountName: "Bunnie SCH Donate",
  minAmount: 20,
  goalAmount: 5000,
  theme: {},
};

function externalUrl(value?: string) {
  if (!value) return "";
  return /^https?:\/\//i.test(value) ? value : `https://${value}`;
}

function cookieValue(name: string) {
  if (typeof document === "undefined") return "";
  return document.cookie.split("; ").find((row) => row.startsWith(`${name}=`))?.split("=")[1] ?? "";
}

function hasBlockedWord(value: string) {
  const normalized = value.toLowerCase().replace(/\s+/g, "");
  if (rudePrefixPattern.test(normalized)) return true;
  return [...bannedWords, ...extraBannedWords].some((word) => normalized.includes(word.toLowerCase().replace(/\s+/g, "")));
}

export default function DonatePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const searchParams = useSearchParams();
  const { language, t, toggleLanguage } = useAppPreferences();
  const [page, setPage] = useState<PageData | null>(null);
  const [qr, setQr] = useState<QrState | null>(null);
  const [error, setError] = useState("");
  const [paymentStatusMessage, setPaymentStatusMessage] = useState("");
  const [checkingPayment, setCheckingPayment] = useState(false);
  const [slipFile, setSlipFile] = useState<File | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState(600);
  const [expiredModal, setExpiredModal] = useState(false);
  const [step, setStep] = useState<DonateStep>("form");
  const [formState, setFormState] = useState({ donorName: "", message: "", amount: "", anonymous: false });
  const [donorRank, setDonorRank] = useState<DonorRank[]>([]);

  useEffect(() => {
    const storedDonorName = decodeURIComponent(cookieValue("tiphouse_donor_name"));
    if (storedDonorName) setFormState((current) => current.anonymous || current.donorName ? current : { ...current, donorName: storedDonorName });

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
    api.get(`/donations/rank/${slug}`).then((res) => setDonorRank(res.data ?? [])).catch(() => setDonorRank([]));
  }, [slug]);

  useEffect(() => {
    if (!["127.0.0.1", "localhost"].includes(window.location.hostname)) return;
    if (searchParams.get("preview") === "verifying") setStep("verifying");
  }, [searchParams]);

  useEffect(() => {
    if (step !== "qr" || !qr) return;
    const tick = () => {
      const seconds = Math.max(0, Math.ceil((new Date(qr.expiresAt).getTime() - Date.now()) / 1000));
      setRemainingSeconds(seconds);
      if (seconds === 0) setExpiredModal(true);
    };
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [qr, step]);

  const amountNumber = Number(formState.amount || 0);
  const amountTooLow = Boolean(page && formState.amount && amountNumber < page.minAmount);
  const amountTooHigh = Boolean(formState.amount && amountNumber > 20000);
  const displayDonorName = formState.anonymous ? THAI_ANONYMOUS : formState.donorName.trim();
  const blockedName = !formState.anonymous && hasBlockedWord(formState.donorName);
  const blockedMessage = hasBlockedWord(formState.message);
  const messageTooLong = formState.message.length > 250;
  const canDonate = useMemo(() => {
    const hasDonorName = formState.anonymous || formState.donorName.trim();
    return Boolean(page && hasDonorName && !blockedName && !blockedMessage && !messageTooLong && formState.message.trim() && formState.amount && Number.isFinite(amountNumber) && amountNumber >= page.minAmount && amountNumber <= 20000);
  }, [amountNumber, blockedMessage, blockedName, formState, messageTooLong, page]);

  function continueToSummary(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!page || !canDonate) return;
    if (!formState.anonymous) {
      document.cookie = `tiphouse_donor_name=${encodeURIComponent(formState.donorName.trim())};path=/;max-age=31536000;samesite=lax`;
    }
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
        donorName: donorName.slice(0, MAX_DONOR_NAME_LENGTH),
        message: formState.message.trim(),
        amount: amountNumber,
        anonymous,
        provider: "PROMPTPAY",
      });
      if (Number(data.amount) !== amountNumber || !data.transactionRef) {
        throw new Error("Donation transaction does not match the requested amount");
      }
      setQr({
        qrDataUrl: data.qrDataUrl,
        qrDisplayName: data.qrDisplayName ?? page.donationAccountName ?? "TipHouse Donate",
        transactionRef: data.transactionRef,
        amount: Number(data.amount),
        createdAt: data.createdAt,
        expiresAt: data.expiresAt,
      });
      setRemainingSeconds(Math.max(0, Math.ceil((new Date(data.expiresAt).getTime() - Date.now()) / 1000)));
      setSlipFile(null);
      setError("");
      setPaymentStatusMessage("");
      setStep("qr");
    } catch (cause) {
      const message = (cause as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message;
      setError(Array.isArray(message) ? message.join(", ") : message ?? "ไม่สามารถสร้าง QR ได้ กรุณาตรวจสอบว่า Creator บันทึก QR รับเงินแล้ว");
    }
  }

  function resetFlow() {
    setQr(null);
    setSlipFile(null);
    setExpiredModal(false);
    setPaymentStatusMessage("");
    setStep("form");
  }

  function toggleAnonymous() {
    setFormState((current) => ({
      ...current,
      anonymous: !current.anonymous,
      donorName: !current.anonymous ? "" : current.donorName,
    }));
  }

  async function completePaymentCheck() {
    if (!qr || !slipFile || checkingPayment || remainingSeconds <= 0) return;
    setCheckingPayment(true);
    setPaymentStatusMessage("");
    setStep("verifying");
    try {
      const form = new FormData();
      form.append("slip", slipFile);
      const [{ data }] = await Promise.all([
        api.post(`/payment/slip/${encodeURIComponent(qr.transactionRef)}/verify`, form, {
          headers: { "Content-Type": "multipart/form-data" },
          timeout: 60_000,
        }),
        new Promise((resolve) => window.setTimeout(resolve, 900)),
      ]);
      if (data.status !== "PAID") throw new Error("Payment was not confirmed");
      setStep("success");
    } catch (cause) {
      const status = (cause as { response?: { status?: number } })?.response?.status;
      const message = (cause as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message;
      if (status === 410) {
        setExpiredModal(true);
      } else {
        setPaymentStatusMessage(Array.isArray(message)
          ? message.join(", ")
          : message ?? t("ตรวจสอบสลิปไม่สำเร็จ กรุณาตรวจสอบรูปแล้วลองอีกครั้ง", "Slip verification failed. Check the image and try again."));
      }
      setStep("qr");
    } finally {
      setCheckingPayment(false);
    }
  }

  const countdown = `${String(Math.floor(remainingSeconds / 60)).padStart(2, "0")}:${String(remainingSeconds % 60).padStart(2, "0")}`;

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

  if (!page && error) return <main className="grid min-h-screen place-items-center p-6 text-center text-coral">{error}</main>;

  if (!page) {
    return (
      <main className="min-h-screen bg-ink">
        <section className="grid min-h-[45vh] content-end bg-white/5 p-6">
          <div className="mx-auto flex w-[min(1100px,100%)] items-end gap-4">
            <div className="size-20 animate-pulse rounded-2xl bg-white/10" />
            <div className="grid flex-1 gap-3">
              <div className="h-10 w-72 max-w-full animate-pulse rounded-xl bg-white/10" />
              <div className="h-5 w-48 animate-pulse rounded-lg bg-white/10" />
            </div>
          </div>
        </section>
        <section className="mx-auto grid w-[min(1180px,calc(100%-2rem))] gap-6 py-8 lg:grid-cols-[430px_1fr]">
          <div className="phone-frame">
            <div className="phone-screen grid gap-4 p-5">
              <div className="h-28 animate-pulse rounded-2xl bg-white/10" />
              <div className="draft-panel grid gap-3">
                <div className="h-5 w-36 animate-pulse rounded bg-white/10" />
                <div className="grid grid-cols-3 gap-2">
                  {Array.from({ length: 6 }, (_, index) => <div key={index} className="h-12 animate-pulse rounded-xl bg-white/10" />)}
                </div>
              </div>
              <div className="draft-panel h-28 animate-pulse" />
              <div className="draft-panel h-32 animate-pulse" />
            </div>
          </div>
          <aside className="draft-band grid content-start gap-4 p-5">
            <div className="h-7 w-40 animate-pulse rounded bg-white/10" />
            {Array.from({ length: 4 }, (_, index) => <div key={index} className="h-12 animate-pulse rounded-xl bg-white/10" />)}
          </aside>
        </section>
      </main>
    );
  }

  return (
    <main
      style={page.theme?.donationBackgroundUrl ? {
        backgroundImage: `linear-gradient(rgba(7,16,28,.82),rgba(7,16,28,.88)), url(${page.theme.donationBackgroundUrl})`,
        backgroundAttachment: "fixed",
        backgroundPosition: "center top",
        backgroundSize: "cover",
      } : undefined}
    >
      <button className="btn fixed right-4 top-4 z-30 bg-ink/80 backdrop-blur" type="button" onClick={toggleLanguage}>
        TH/ENG
      </button>
      <section
        className="grid min-h-[clamp(170px,24vh,260px)] content-end bg-cover bg-center p-4 sm:p-6"
        style={{ backgroundImage: `linear-gradient(rgba(0,0,0,.1),rgba(0,0,0,.72)), url(${page.bannerUrl ?? defaultPage.bannerUrl})` }}
      >
        <div className="media-on-dark mx-auto flex w-[min(1100px,100%)] items-end gap-3 sm:gap-4">
          <div className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-2xl border-2 border-white/70 bg-mint text-xl font-black text-ink sm:size-20 sm:text-2xl">
            {page.avatarUrl ? <img alt="" src={page.avatarUrl} className="size-full object-cover" /> : "TH"}
          </div>
          <div>
            <h1 className="mt-2 break-words text-3xl font-black sm:text-5xl md:text-6xl">{page.displayName}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              {page.theme?.quicklinkUrl && (
                <a className="text-base font-bold text-mint underline decoration-mint/50 underline-offset-4 hover:text-sky" href={externalUrl(page.theme.quicklinkUrl)} target="_blank" rel="noreferrer">
                  {page.theme.quicklinkText || page.handle || "Quicklink"}
                </a>
              )}
            </div>
          </div>
        </div>
      </section>
      <section className="mx-auto grid w-[min(1180px,calc(100%-1.5rem))] min-w-0 gap-5 py-6 sm:w-[min(1180px,calc(100%-2rem))] sm:gap-6 sm:py-8 md:grid-cols-[minmax(340px,430px)_minmax(0,1fr)]">
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
                    <p className="mt-1 font-semibold opacity-75">{t("ส่งกำลังใจให้ครีเอเตอร์ที่คุณชอบ", "Send support to your favorite creator")}</p>
                  </div>
                </div>
              </div>
              <section className="draft-panel">
                <div className="mb-3 font-black">{t("เลือกจำนวนเงิน", "Choose Amount")}</div>
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
                  {t("กำหนดเอง", "Custom")}
                  <input className={`input mt-2 ${amountTooLow || amountTooHigh ? "border-coral text-coral" : ""}`} name="amount" type="number" min={page.minAmount} max={20000} value={formState.amount} onChange={(event) => setFormState({ ...formState, amount: event.target.value })} required />
                  {amountTooLow && <span className="mt-2 block font-bold text-coral">{t("ยอดโดเนทต้องไม่น้อยกว่า", "Minimum donation is")} ฿{page.minAmount}</span>}
                  {amountTooHigh && <span className="mt-2 block font-bold text-coral">{t("ยอดโดเนทสูงสุด 20,000 บาท", "Maximum donation is 20,000 THB")}</span>}
                  {!amountTooLow && !amountTooHigh && <span className="mt-2 block text-sm text-white/60">{t("ขั้นต่ำ", "Minimum")} {page.minAmount.toLocaleString("th-TH")} - 20,000 {t("บาท", "THB")}</span>}
                </label>
              </section>
              <section className="draft-panel grid gap-3">
                <label>
                  {t("ชื่อผู้โดเนท", "Donor Name")}
                  <input
                    className="input mt-2 disabled:cursor-not-allowed disabled:opacity-75"
                    name="donorName"
                    value={formState.anonymous ? THAI_ANONYMOUS : formState.donorName}
                    maxLength={MAX_DONOR_NAME_LENGTH}
                    onChange={(event) => setFormState({ ...formState, donorName: event.target.value.slice(0, MAX_DONOR_NAME_LENGTH) })}
                    disabled={formState.anonymous}
                    required={!formState.anonymous}
                  />
                </label>
                {!formState.anonymous && <p className="text-right text-sm text-white/55">{formState.donorName.length}/{MAX_DONOR_NAME_LENGTH}</p>}
                {blockedName && <p className="text-sm font-bold text-coral">{t("ชื่อผู้โดเนทมีคำที่ระบบไม่อนุญาต", "Donor name contains blocked words")}</p>}
                <button className={`btn justify-self-start ${formState.anonymous ? "btn-primary" : ""}`} type="button" aria-pressed={formState.anonymous} onClick={toggleAnonymous}>
                  แสดงเป็น Anonymous
                </button>
              </section>
              <section className="draft-panel">
                <label>{t("ข้อความถึงสตรีมเมอร์", "Message to Streamer")}<textarea className="input mt-2 min-h-28" name="message" maxLength={250} value={formState.message} onChange={(event) => setFormState({ ...formState, message: event.target.value.slice(0, 250) })} required /></label>
                <p className={`mt-2 text-right text-sm ${messageTooLong ? "text-coral" : "text-white/55"}`}>{formState.message.length}/250</p>
                {blockedMessage && <p className="mt-2 text-sm font-bold text-coral">{t("ข้อความมีคำที่ระบบไม่อนุญาต", "Message contains blocked words")}</p>}
              </section>
              {error && <p className="text-coral">{error}</p>}
              <button className="btn btn-primary disabled:cursor-not-allowed disabled:opacity-40" type="submit" disabled={!canDonate}>{t("ดำเนินการต่อ", "Continue")}</button>
            </form>
          </div>
        )}

        {step === "summary" && (
          <div className="phone-frame">
            <section className="phone-screen grid gap-4 p-5">
              <div className="rounded-2xl bg-gradient-to-br from-mint to-coral p-6 text-ink">
                <h2 className="text-3xl font-black">{t("ตรวจสอบรายการ", "Review Donation")}</h2>
                <p className="mt-3 font-semibold opacity-80">{t("ระบบชำระเงินเข้ารหัสและปลอดภัย ตรวจสอบรายการได้ก่อนจ่ายทุกครั้ง", "Review your secure payment before continuing")}</p>
              </div>
              <div className="draft-panel grid gap-3">
                {[
                  [t("ส่งถึง", "To"), page.displayName],
                  [t("ชื่อที่แสดง", "Display Name"), displayDonorName],
                  [t("ข้อความ", "Message"), formState.message],
                  [t("ยอดโดเนท", "Donation"), `฿${amountNumber.toLocaleString("th-TH")}`],
                ].map(([label, value]) => (
                  <div key={label} className="flex items-start justify-between gap-4 border-b border-dashed border-white/10 pb-3 last:border-0 last:pb-0">
                    <span className="text-white/70">{label}</span>
                    <strong className="max-w-[55%] text-right">{value}</strong>
                  </div>
                ))}
                <div className="flex items-center justify-between pt-2">
                  <span className="font-black">{t("ยอดชำระทั้งหมด", "Total")}</span>
                  <strong className="text-4xl font-black text-mint">฿{amountNumber.toLocaleString("th-TH")}</strong>
                </div>
              </div>
              {error && <p className="text-coral">{error}</p>}
              <button className="btn btn-primary" type="button" onClick={createQr}>{t("ยืนยันและชำระเงิน", "Confirm and Pay")}</button>
              <button className="btn" type="button" onClick={() => setStep("form")}>{t("กลับไปแก้ไข", "Back to Edit")}</button>
            </section>
          </div>
        )}

        {step === "qr" && qr && (
          <div className="phone-frame">
            <aside className="phone-screen grid gap-4 p-5 text-center">
              <div className="rounded-2xl bg-gradient-to-br from-mint to-coral p-6 text-left text-ink">
                <h2 className="text-3xl font-black">ชำระเงินด้วย QR</h2>
                <p className="mt-3 font-semibold opacity-80">หลังชำระเงิน แนบสลิปเพื่อให้ระบบตรวจสอบก่อนส่ง Alert</p>
              </div>
              <section className="draft-panel">
                <p className="font-black">ยอดชำระ</p>
                <strong className="mt-1 block text-4xl font-black text-mint">฿{qr.amount.toLocaleString("th-TH")}</strong>
                <div className={`mx-auto mt-3 w-fit rounded-lg border px-4 py-2 font-black ${remainingSeconds <= 60 ? "border-coral/60 bg-coral/10 text-coral" : "border-sky/30 bg-sky/10 text-sky"}`}>
                  QR หมดอายุใน {countdown}
                </div>
                <img alt="PromptPay QR" src={qr.qrDataUrl} className="mx-auto mt-4 size-64 rounded-2xl bg-white p-3" />
                <button className="btn mt-4 w-full" type="button" onClick={downloadQr}>บันทึกภาพ QR เพื่อเปิดในแอปธนาคาร</button>
                <p className="mt-3 text-sm text-white/55">{t("QR นี้ผูกกับยอดและเลขรายการด้านล่าง กรุณาตรวจสอบยอดในแอปธนาคารก่อนยืนยัน", "This QR is tied to the amount and reference below. Check the amount in your banking app before confirming.")}</p>
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
              <section className="draft-panel grid gap-3 text-left">
                <label className="font-black">
                  แนบสลิปหลังชำระเงิน
                  <input
                    className="input mt-2"
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={(event) => {
                      const file = event.target.files?.[0] ?? null;
                      if (file && file.size > 5 * 1024 * 1024) {
                        setPaymentStatusMessage("รูปสลิปต้องมีขนาดไม่เกิน 5MB");
                        setSlipFile(null);
                        return;
                      }
                      setPaymentStatusMessage("");
                      setSlipFile(file);
                    }}
                  />
                </label>
                <p className="text-sm text-white/55">รองรับ PNG, JPG และ WEBP ขนาดไม่เกิน 5MB</p>
                {slipFile && <p className="truncate font-bold text-mint">เลือกแล้ว: {slipFile.name}</p>}
              </section>
              <p className="break-all text-xs text-white/55">Ref: {qr.transactionRef}</p>
              {paymentStatusMessage && <p className="rounded-xl border border-sky/30 bg-sky/10 p-3 text-sm text-white/80">{paymentStatusMessage}</p>}
              <div className="grid gap-3">
                <button className="btn btn-primary disabled:cursor-wait disabled:opacity-40" type="button" onClick={completePaymentCheck} disabled={!slipFile || checkingPayment || remainingSeconds <= 0}>
                  {checkingPayment ? t("กำลังตรวจสอบ...", "Checking...") : t("ตรวจสอบสลิป", "Verify Slip")}
                </button>
                <button className="btn" type="button" onClick={resetFlow}>ยกเลิก QR code</button>
              </div>
            </aside>
          </div>
        )}

        {step === "verifying" && (
          <div className="phone-frame">
            <section className="phone-screen grid min-h-[620px] content-center justify-items-center gap-5 p-6 text-center">
              <p className="text-sm font-black uppercase tracking-[0.18em] text-sky">Secure payment verification</p>
              <h2 className="text-3xl font-black">กำลังตรวจสอบ</h2>
              <div className="relative grid size-40 place-items-center rounded-full border-2 border-sky/25">
                <div className="absolute inset-[-2px] animate-spin rounded-full border-4 border-transparent border-t-mint border-r-sky" />
                <div className="grid size-24 place-items-center rounded-full bg-sky/10 text-sm font-black text-sky">SLIP<br />CHECK</div>
              </div>
              <div>
                <p className="font-black">กำลังตรวจสอบการชำระเงิน</p>
                <p className="mt-2 text-white/55">กรุณารอสักครู่...</p>
              </div>
              <div className="flex gap-2" aria-hidden="true">
                {[0, 1, 2, 3].map((index) => (
                  <span key={index} className="size-2 animate-pulse rounded-full bg-sky" style={{ animationDelay: `${index * 160}ms` }} />
                ))}
              </div>
              <p className="text-xs text-white/45">ห้ามปิดหน้านี้จนกว่าจะตรวจสอบเสร็จสิ้น</p>
            </section>
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
          <h2 className="text-2xl font-black">{t("วิธีการโดเนท", "How to Donate")}</h2>
          <p className="text-white/60">{t("ทำตามขั้นตอนด้านล่างเพื่อโดเนทและส่ง Alert ไปยังสตรีมเมอร์", "Follow these steps to donate and send an alert to the streamer")}</p>
          <div className="grid gap-2">
            {[
              t("เลือกยอดโดเนทและกรอกชื่อ/ข้อความ", "Choose amount and enter name/message"),
              t("ตรวจสอบรายละเอียดก่อนชำระเงิน", "Review donation details"),
              t("สแกน QR และชำระเงินตามยอดที่แสดง", "Scan QR and pay the exact amount"),
              t("การโดเนทเสร็จสิ้น", "Donation completed"),
            ].map((stepLabel, index) => (
              <div className="draft-step" key={stepLabel}>
                <span className="draft-step-number">{index + 1}</span>
                <span className="font-bold">{stepLabel}</span>
              </div>
            ))}
          </div>
          <div id="top-donator-rank" className="mt-2 border-t border-white/10 pt-4">
            <h3 className="text-xl font-black">Top Donator Rank</h3>
            <div className="mt-3 grid gap-2">
              {donorRank.slice(0, 3).map((item, index) => (
                <div key={`${item.donorName}-${index}`} className="flex items-center justify-between gap-3 rounded-xl border border-sky/20 bg-white/5 px-3 py-2">
                  <strong className="flex min-w-0 items-center gap-2">
                    <span className="text-xl" aria-hidden="true">{rankMedals[index]}</span>
                    <span className="truncate">{item.anonymous ? THAI_ANONYMOUS : item.donorName}</span>
                  </strong>
                  <strong className="shrink-0">฿{item.amount.toLocaleString(language === "en" ? "en-US" : "th-TH")}</strong>
                </div>
              ))}
              {!donorRank.length && <p className="rounded-xl border border-sky/20 bg-white/5 p-3 text-sm text-white/55">เธขเธฑเธเนเธกเนเธกเธตเธเนเธญเธกเธนเธฅ Top Tippers เธเธฒเธ Streamlabs</p>}
            </div>
          </div>
        </aside>
      </section>
      {expiredModal && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/75 p-4">
          <section className="card w-[min(420px,100%)] p-6 text-center" role="alertdialog" aria-modal="true" aria-labelledby="qr-expired-title">
            <p className="font-black text-coral">EXPIRED</p>
            <h2 id="qr-expired-title" className="mt-2 text-3xl font-black">QR Code หมดอายุ</h2>
            <p className="mt-3 text-white/60">รายการนี้เกินเวลา 10 นาที กรุณาสร้างรายการโดเนทใหม่</p>
            <button className="btn btn-primary mt-6 w-full" type="button" onClick={resetFlow}>ปิด</button>
          </section>
        </div>
      )}
    </main>
  );
}
