"use client";

import { type CSSProperties, FormEvent, use, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { api } from "@/lib/api";

type PageData = {
  slug: string;
  displayName: string;
  bannerUrl?: string | null;
  avatarUrl?: string | null;
  donationAccountName?: string | null;
  minAmount: number;
  goalAmount: number;
  theme?: {
    donationBackgroundUrl?: string;
    mobileBackgroundUrl?: string;
    mobileBackgroundColor?: string;
    description?: string;
  } | null;
};

type QrState = {
  qrDataUrl: string;
  qrDisplayName: string;
  transactionRef: string;
  paymentProvider: "STRIPE";
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

type DonateStep = "form" | "summary" | "qr" | "verifying" | "success" | "failed";
type RankPeriod = "week" | "month" | "all";

const THAI_ANONYMOUS = "บุคคลนิรนาม";
const rankMedals = ["🥇", "🥈", "🥉"];
const quickAmounts = [20, 50, 100, 300];
const previewExpiredQr = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='256' height='256' viewBox='0 0 256 256'%3E%3Crect width='256' height='256' fill='white'/%3E%3Crect x='24' y='24' width='56' height='56' fill='black'/%3E%3Crect x='36' y='36' width='32' height='32' fill='white'/%3E%3Crect x='176' y='24' width='56' height='56' fill='black'/%3E%3Crect x='188' y='36' width='32' height='32' fill='white'/%3E%3Crect x='24' y='176' width='56' height='56' fill='black'/%3E%3Crect x='36' y='188' width='32' height='32' fill='white'/%3E%3Cpath d='M104 28h16v16h-16zm32 0h16v32h-16zm-32 40h48v16h-48zm72 36h32v16h-32zm-72 24h16v48h-16zm32 0h56v16h-56zm72 24h24v40h-24zm-72 32h56v16h-56zm-32 24h16v24h-16zm32 8h72v16h-72z' fill='black'/%3E%3C/svg%3E";
const MIN_DONATION_AMOUNT = 20;
const MAX_DONOR_NAME_LENGTH = 20;
const DEFAULT_DONOR_NAME = "แพนด้าที่ผ่านทางมา";
const DONOR_EMAIL_STORAGE_KEY = "tiphouse_donor_email";
const DEFAULT_DONATION_BACKGROUND = "#7D9CEDE6";
const DEFAULT_CREATOR_DESCRIPTION = "อยากให้ทุกคนเอ็นดูแพนด้าน่ารักคนนี้มากๆเลยนะคะ เราจะพยายามต่อไปด้วยกัน อยากเป็นเพื่อนกับคนขี้เหงาและคนชอบนอนดึกน้า~~";
const extraBannedWords = ["ไอ้โง่", "ไอ้ควาย", "ไอ้เหี้ย", "ไอ้ดำ", "ไอ้เตี้ย", "อีโง่", "อีควาย", "อีเหี้ย", "โง่", "ควาย", "เหี้ย", "สัส", "สัตว์"];
const rudePrefixPattern = /(ไอ้|อี)(โง่|ควาย|เหี้ย|สัตว์|สัส|ดำ|เตี้ย|บ้า|เวร|ห่า|ร่าน|ตอแหล)/i;
const bannedWords = ["เหี้ย", "ควย", "สัส", "ไอ้สัตว์", "fuck", "shit", "bitch", "asshole"];

const defaultPage: PageData = {
  slug: "bunniesch",
  displayName: "CONNESE.PLAI",
  bannerUrl: null,
  donationAccountName: "BunnieSCH Donate",
  minAmount: 20,
  goalAmount: 5000,
  theme: {},
};

function cookieValue(name: string) {
  if (typeof document === "undefined") return "";
  return document.cookie.split("; ").find((row) => row.startsWith(`${name}=`))?.split("=")[1] ?? "";
}

function hasBlockedWord(value: string) {
  const normalized = value.toLowerCase().replace(/\s+/g, "");
  if (rudePrefixPattern.test(normalized)) return true;
  return [...bannedWords, ...extraBannedWords].some((word) => normalized.includes(word.toLowerCase().replace(/\s+/g, "")));
}

type DonationLandingStyle = CSSProperties & {
  "--donation-mobile-bg-color"?: string;
  "--donation-mobile-bg-image"?: string;
};

function fixedCreatorDescription(value?: string) {
  const source = value?.trim() || DEFAULT_CREATOR_DESCRIPTION;
  return source.replace(/<br\s*\/?>/gi, " ").replace(/\s+/g, " ").trim();
}

function donationLandingStyle(page: PageData): DonationLandingStyle {
  const desktopBackground = page.theme?.donationBackgroundUrl || "";
  const mobileBackground = page.theme?.mobileBackgroundUrl || "";
  const mobileBackgroundColor = page.theme?.mobileBackgroundColor || DEFAULT_DONATION_BACKGROUND;
  return {
    backgroundColor: mobileBackgroundColor,
    backgroundImage: desktopBackground
      ? `linear-gradient(90deg, rgba(125, 156, 237, 0.18), rgba(125, 156, 237, 0.74)), url(${desktopBackground})`
      : "none",
    "--donation-mobile-bg-color": mobileBackgroundColor,
    "--donation-mobile-bg-image": mobileBackground ? `url(${mobileBackground})` : "none",
  };
}

function t(thai: string, _english?: string) {
  return thai;
}

export default function DonatePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const searchParams = useSearchParams();
  const [page, setPage] = useState<PageData | null>(null);
  const [qr, setQr] = useState<QrState | null>(null);
  const [error, setError] = useState("");
  const [paymentStatusMessage, setPaymentStatusMessage] = useState("");
  const [remainingSeconds, setRemainingSeconds] = useState(600);
  const [expiredModal, setExpiredModal] = useState(false);
  const [isCreatingQr, setIsCreatingQr] = useState(false);
  const [step, setStep] = useState<DonateStep>("form");
  const [formState, setFormState] = useState({ donorName: DEFAULT_DONOR_NAME, donorEmail: "", message: "", amount: "", anonymous: false });
  const [donorRank, setDonorRank] = useState<DonorRank[]>([]);
  const [rankPeriod, setRankPeriod] = useState<RankPeriod>("all");

  useEffect(() => {
    const storedDonorName = decodeURIComponent(cookieValue("tiphouse_donor_name"));
    const storedDonorEmail = localStorage.getItem(DONOR_EMAIL_STORAGE_KEY) ?? "";
    if (storedDonorName) setFormState((current) => current.anonymous ? current : { ...current, donorName: storedDonorName });
    if (storedDonorEmail) setFormState((current) => current.donorEmail ? current : { ...current, donorEmail: storedDonorEmail });

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
  }, [slug]);

  useEffect(() => {
    api.get(`/donations/rank/${slug}?period=${rankPeriod}`).then((res) => setDonorRank(res.data ?? [])).catch(() => setDonorRank([]));
  }, [rankPeriod, slug]);

  useEffect(() => {
    if (!formState.anonymous) return;
    setFormState((current) => current.donorName ? { ...current, donorName: "" } : current);
  }, [formState.anonymous]);

  useEffect(() => {
    if (!["127.0.0.1", "localhost"].includes(window.location.hostname)) return;
    if (searchParams.get("preview") === "verifying") setStep("verifying");
    if (searchParams.get("preview") === "expired") {
      const now = new Date();
      setFormState((current) => ({
        ...current,
        donorName: current.donorName || "Test Bun",
        donorEmail: current.donorEmail || "name@example.com",
        message: current.message || "Preview expired QR",
        amount: current.amount || "100",
      }));
      setQr({
        qrDataUrl: previewExpiredQr,
        qrDisplayName: "TipHouse Donate",
        transactionRef: "THCEXPIREDPREVIEW",
        paymentProvider: "STRIPE",
        amount: 100,
        createdAt: new Date(now.getTime() - 11 * 60 * 1000).toISOString(),
        expiresAt: new Date(now.getTime() - 1000).toISOString(),
      });
      setRemainingSeconds(0);
      setStep("qr");
      setExpiredModal(true);
    }
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

  useEffect(() => {
    if (step !== "qr" || !qr) return;
    let active = true;
    let completing = false;
    const checkStatus = async () => {
      if (completing) return;
      try {
        const { data } = await api.get(`/donations/status/${encodeURIComponent(qr.transactionRef)}`);
        if (!active) return;
        if (data.status === "PAID") {
          completing = true;
          setStep("verifying");
          window.setTimeout(() => {
            setStep("success");
          }, 700);
          return;
        }
        if (data.status === "FAILED") {
          setPaymentStatusMessage(t(
            "การชำระเงินไม่สำเร็จ กรุณายกเลิกรายการและลองใหม่",
            "Payment failed. Cancel this payment and try again.",
          ));
          setStep("failed");
        }
        if (data.status === "EXPIRED") setExpiredModal(true);
      } catch {
        // A temporary polling failure must not cancel an active payment.
      }
    };
    void checkStatus();
    const timer = window.setInterval(checkStatus, 2500);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [qr, step, t]);

  const amountNumber = Number(formState.amount || 0);
  const effectiveMinAmount = Math.max(MIN_DONATION_AMOUNT, page?.minAmount ?? MIN_DONATION_AMOUNT);
  const amountTooLow = Boolean(page && formState.amount && amountNumber < effectiveMinAmount);
  const amountTooHigh = Boolean(formState.amount && amountNumber > 20000);
  const anonymousLabel = THAI_ANONYMOUS;
  const amountPlaceholder = "ใส่จำนวนเงิน";
  const displayDonorName = formState.anonymous ? anonymousLabel : formState.donorName.trim();
  const blockedName = !formState.anonymous && hasBlockedWord(formState.donorName);
  const blockedMessage = hasBlockedWord(formState.message);
  const messageTooLong = formState.message.length > 250;
  const hasValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formState.donorEmail.trim());
  const canDonate = useMemo(() => {
    const hasDonorName = formState.anonymous || formState.donorName.trim();
    return Boolean(page && hasDonorName && hasValidEmail && !blockedName && !blockedMessage && !messageTooLong && formState.message.trim() && formState.amount && Number.isFinite(amountNumber) && amountNumber >= effectiveMinAmount && amountNumber <= 20000);
  }, [amountNumber, blockedMessage, blockedName, effectiveMinAmount, formState, hasValidEmail, messageTooLong, page]);

  function continueToSummary(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!page || !canDonate) return;
    if (!formState.anonymous) {
      document.cookie = `tiphouse_donor_name=${encodeURIComponent(formState.donorName.trim())};path=/;max-age=31536000;samesite=lax`;
    }
    if (formState.donorEmail.trim()) localStorage.setItem(DONOR_EMAIL_STORAGE_KEY, formState.donorEmail.trim().toLowerCase());
    setError("");
    setStep("summary");
  }

  async function createQr() {
    if (!page || !canDonate || isCreatingQr) return;
    const anonymous = formState.anonymous;
    const donorName = anonymous ? "Anonymous" : formState.donorName.trim();
    try {
      setError("");
      setPaymentStatusMessage("");
      setIsCreatingQr(true);
      const { data } = await api.post("/donate", {
        pageSlug: page.slug,
        donorName: donorName.slice(0, MAX_DONOR_NAME_LENGTH),
        donorEmail: formState.donorEmail.trim().toLowerCase(),
        message: formState.message.trim(),
        amount: amountNumber,
        anonymous,
        provider: "STRIPE",
      });
      if (Number(data.amount) !== amountNumber || !data.transactionRef) {
        throw new Error("Donation transaction does not match the requested amount");
      }
      const paymentProvider = String(data.paymentProvider ?? data.provider ?? "STRIPE").toUpperCase();
      if (paymentProvider !== "STRIPE") {
        throw new Error("ระบบชำระเงินยังไม่ได้ตั้งค่า Stripe กรุณาอย่าชำระเงินและแจ้ง Creator");
      }
      const qrDataUrl =
        data.qrDataUrl ??
        data.qrCodeDataUrl ??
        data.promptPayQrDataUrl ??
        data.payment?.qrDataUrl ??
        data.payment?.qrCodeDataUrl ??
        data.nextAction?.promptpayDisplayQrCode?.imageUrlPng ??
        data.next_action?.promptpay_display_qr_code?.image_url_png;
      if (!qrDataUrl) {
        throw new Error("ไม่สามารถสร้าง QR ชำระเงินได้ กรุณาลองใหม่อีกครั้ง");
      }
      setQr({
        qrDataUrl,
        qrDisplayName: data.qrDisplayName ?? page.donationAccountName ?? "TipHouse Donate",
        transactionRef: data.transactionRef,
        paymentProvider: "STRIPE",
        amount: Number(data.amount),
        createdAt: data.createdAt,
        expiresAt: data.expiresAt,
      });
      setRemainingSeconds(Math.max(0, Math.ceil((new Date(data.expiresAt).getTime() - Date.now()) / 1000)));
      setError("");
      setPaymentStatusMessage("");
      setStep("qr");
    } catch (cause) {
      const message = (cause as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message;
      setError(Array.isArray(message) ? message.join(", ") : message ?? "ไม่สามารถสร้าง QR ชำระเงินได้ กรุณาลองใหม่อีกครั้ง");
    } finally {
      setIsCreatingQr(false);
    }
  }

  function resetFlow() {
    setQr(null);
    setExpiredModal(false);
    setPaymentStatusMessage("");
    setError("");
    setStep("form");
  }

  function toggleAnonymous() {
    setFormState((current) => ({
      ...current,
      anonymous: !current.anonymous,
      donorName: !current.anonymous ? "" : current.donorName,
    }));
  }

  const countdown = `${String(Math.floor(remainingSeconds / 60)).padStart(2, "0")}:${String(remainingSeconds % 60).padStart(2, "0")}`;

  function downloadQr() {
    if (!qr) return;
    const link = document.createElement("a");
    link.href = qr.qrDataUrl;
    link.download = `tiphouse-${qr.transactionRef}.png`;
    link.click();
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

  if (step === "form") {
    const rankRows = donorRank.slice(0, 10);
    const secondaryRankRows = rankRows.slice(1, 10);
    const emptyRankRows = Math.max(0, 9 - secondaryRankRows.length);
    const creatorDescription = fixedCreatorDescription(page.theme?.description);
    const landingStyle = donationLandingStyle(page);
    return (
      <main
        className="donation-landing min-h-screen"
        style={landingStyle}
      >
        <section className="donation-hero mx-auto grid min-h-screen w-[min(1540px,100%)] items-center gap-4 px-5 py-8 lg:grid-cols-[minmax(520px,1fr)_minmax(440px,520px)_minmax(270px,320px)] lg:px-8 xl:px-10">
          <aside className="donation-creator-copy">
            <p>สนับสนุน</p>
            <h1>{page.displayName}</h1>
            <p>{creatorDescription}</p>
          </aside>

          <form onSubmit={continueToSummary} className="donation-form-card grid gap-4">
            <label className="grid gap-2">
              <span className="donation-label">AMOUNT</span>
              <div className={`donation-field-row ${amountTooLow || amountTooHigh ? "is-invalid" : ""}`}>
                <input
                  className="donation-field"
                  name="amount"
                  type="number"
                  min={effectiveMinAmount}
                  max={20000}
                  value={formState.amount}
                  onChange={(event) => setFormState({ ...formState, amount: event.target.value })}
                  placeholder={amountPlaceholder}
                  required
                />
                <span className="donation-field-hint">{amountPlaceholder}</span>
              </div>
              {(amountTooLow || amountTooHigh) && (
                <span className="text-sm font-black text-coral">
                  {amountTooLow ? `${t("ยอดโดเนทต้องไม่น้อยกว่า", "Minimum donation is")} ฿${effectiveMinAmount}` : t("ยอดโดเนทสูงสุด 20,000 บาท", "Maximum donation is 20,000 THB")}
                </span>
              )}
            </label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {quickAmounts.map((amount) => (
                <button
                  key={amount}
                  className={`donation-pill ${amountNumber === amount ? "is-active" : ""}`}
                  type="button"
                  onClick={() => setFormState({ ...formState, amount: String(amount) })}
                >
                  {amount.toLocaleString("en-US")} THB
                </button>
              ))}
            </div>

            <label className="grid gap-2">
              <span className="donation-label">YOUR NAME</span>
              <div className="donation-field-row">
                <input
                  className="donation-field"
                  name="donorName"
                  value={formState.anonymous ? anonymousLabel : formState.donorName}
                  maxLength={MAX_DONOR_NAME_LENGTH}
                  onChange={(event) => setFormState({ ...formState, donorName: event.target.value.slice(0, MAX_DONOR_NAME_LENGTH) })}
                  disabled={formState.anonymous}
                  required={!formState.anonymous}
                />
                <span className="donation-count">{formState.anonymous ? 0 : formState.donorName.length}/{MAX_DONOR_NAME_LENGTH}</span>
              </div>
              {blockedName && <p className="text-sm font-black text-coral">{t("ชื่อผู้โดเนทมีคำที่ระบบไม่อนุญาต", "Donor name contains blocked words")}</p>}
              <button className={`hidden donation-anonymous ${formState.anonymous ? "is-active" : ""}`} type="button" aria-pressed={formState.anonymous} onClick={toggleAnonymous}>
                {t("แสดงเป็น Anonymous", "Show as Anonymous")}
              </button>
            </label>

            <label className="donation-payer-email grid gap-2">
              <span className="donation-label">E-mail</span>
              <input
                className="donation-field-single"
                name="donorEmail"
                type="email"
                maxLength={254}
                value={formState.donorEmail}
                onChange={(event) => setFormState({ ...formState, donorEmail: event.target.value.slice(0, 254) })}
                placeholder="name@example.com"
                autoComplete="email"
                required
              />
              {formState.donorEmail && !hasValidEmail && <p className="text-sm font-black text-coral">{t("รูปแบบอีเมลไม่ถูกต้อง", "Invalid email format")}</p>}
            </label>

            <label className="grid gap-2">
              <span className="donation-label">Message</span>
              <div className="donation-message-wrap">
                <textarea
                  className="donation-message"
                  name="message"
                  maxLength={250}
                  value={formState.message}
                  onChange={(event) => setFormState({ ...formState, message: event.target.value.slice(0, 250) })}
                  required
                />
                <span className="donation-count absolute right-5 top-5">{formState.message.length}/250</span>
              </div>
              {blockedMessage && <p className="text-sm font-black text-coral">{t("ข้อความมีคำที่ระบบไม่อนุญาต", "Message contains blocked words")}</p>}
            </label>
            <button className="donation-continue disabled:cursor-not-allowed disabled:opacity-50" type="submit" disabled={!canDonate} aria-label={t("ดำเนินการต่อ", "Continue")}>
              <img src="/assets/continue-button.png" alt="" className="donation-continue-default h-auto w-[min(274px,100%)]" />
              <img src="/assets/continue-button-active.png" alt="" className="donation-continue-active h-auto w-[min(274px,100%)]" />
            </button>
          </form>

          <aside className="donation-rank-card">
            <h2 className="sr-only">Top Donator Rank</h2>
            {rankRows[0] ? (
              <div className="text-center">
                <div className="mx-auto grid size-20 place-items-center rounded-full bg-[#c98b1f] text-5xl font-black text-white shadow-lg">1</div>
                <h3 className="donation-rank-top-name mt-3 text-2xl font-black text-[#c98b1f]">{rankRows[0].anonymous ? anonymousLabel : rankRows[0].donorName}</h3>
                <div className="donation-top-strip mt-4">TOP TIPPER</div>
              </div>
            ) : (
              <div className="text-center">
                <div className="mx-auto grid size-20 place-items-center rounded-full bg-[#c98b1f] text-5xl font-black text-white shadow-lg">1</div>
                <h3 className="mt-3 text-2xl font-black text-[#c98b1f]">No Tips</h3>
                <div className="donation-top-strip mt-4">TOP TIPPER</div>
              </div>
            )}
            <div className="donation-rank-list mt-4 grid gap-2">
              {secondaryRankRows.map((item, index) => (
                <div className="donation-rank-row" key={`${item.donorName}-${index}`}>
                  <span className={`donation-rank-number rank-${index + 2}`}>{index + 2}</span>
                  <span className="donation-rank-name">{item.anonymous ? anonymousLabel : item.donorName}</span>
                </div>
              ))}
              {Array.from({ length: emptyRankRows }, (_, index) => (
                <div className="donation-rank-row" key={`empty-${index}`}>
                  <span className="donation-rank-number">{secondaryRankRows.length + index + 2}</span>
                  <span>-</span>
                </div>
              ))}
            </div>
            <div className="donation-rank-actions">
              <svg className="donation-sparkle" width="13" height="33" viewBox="0 0 13 33" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <g opacity="0.8">
                  <path d="M6.11416 23.1955C6.15855 23.0462 6.4341 23.0462 6.47849 23.1955C7.13564 25.4066 8.86983 27.1407 11.0809 27.7979C11.2302 27.8423 11.2302 28.1178 11.0809 28.1622C8.86983 28.8194 7.13564 30.5536 6.47849 32.7646C6.4341 32.914 6.15855 32.914 6.11416 32.7646C5.45701 30.5536 3.72282 28.8194 1.51178 28.1622C1.36242 28.1178 1.36242 27.8423 1.51178 27.7979C3.72282 27.1407 5.45701 25.4066 6.11416 23.1955Z" fill="#F6D78B"/>
                  <path d="M6.16562 11.9716C6.19733 11.8649 6.39415 11.8649 6.42586 11.9716C6.89525 13.5509 8.13396 14.7896 9.71328 15.259C9.81996 15.2907 9.81996 15.4876 9.71328 15.5193C8.13396 15.9887 6.89525 17.2274 6.42586 18.8067C6.39415 18.9134 6.19733 18.9134 6.16562 18.8067C5.69623 17.2274 4.45753 15.9887 2.87821 15.5193C2.77153 15.4876 2.77153 15.2907 2.87821 15.259C4.45753 14.7896 5.69623 13.5509 6.16562 11.9716Z" fill="#F6D78B"/>
                  <path d="M6.21709 3.54557C6.23612 3.48156 6.35421 3.48156 6.37323 3.54557C6.65487 4.49316 7.39809 5.23638 8.34568 5.51802C8.40969 5.53704 8.40969 5.65513 8.34568 5.67416C7.39809 5.95579 6.65487 6.69902 6.37323 7.64661C6.35421 7.71062 6.23611 7.71062 6.21709 7.64661C5.93545 6.69902 5.19223 5.95579 4.24464 5.67416C4.18063 5.65513 4.18063 5.53704 4.24464 5.51801C5.19223 5.23638 5.93545 4.49316 6.21709 3.54557Z" fill="#F6D78B"/>
                </g>
              </svg>
              <div className="flex justify-center gap-2">
              {(["week", "month", "all"] as RankPeriod[]).map((period) => (
                <button key={period} className={`donation-rank-filter ${rankPeriod === period ? "is-active" : ""}`} type="button" onClick={() => setRankPeriod(period)}>
                  {period === "week" ? "Week" : period === "month" ? "Month" : "All"}
                </button>
              ))}
              </div>
              <svg className="donation-sparkle donation-sparkle-right" width="13" height="33" viewBox="0 0 13 33" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <g opacity="0.8">
                  <path d="M6.11416 23.1955C6.15855 23.0462 6.4341 23.0462 6.47849 23.1955C7.13564 25.4066 8.86983 27.1407 11.0809 27.7979C11.2302 27.8423 11.2302 28.1178 11.0809 28.1622C8.86983 28.8194 7.13564 30.5536 6.47849 32.7646C6.4341 32.914 6.15855 32.914 6.11416 32.7646C5.45701 30.5536 3.72282 28.8194 1.51178 28.1622C1.36242 28.1178 1.36242 27.8423 1.51178 27.7979C3.72282 27.1407 5.45701 25.4066 6.11416 23.1955Z" fill="#F6D78B"/>
                  <path d="M6.16562 11.9716C6.19733 11.8649 6.39415 11.8649 6.42586 11.9716C6.89525 13.5509 8.13396 14.7896 9.71328 15.259C9.81996 15.2907 9.81996 15.4876 9.71328 15.5193C8.13396 15.9887 6.89525 17.2274 6.42586 18.8067C6.39415 18.9134 6.19733 18.9134 6.16562 18.8067C5.69623 17.2274 4.45753 15.9887 2.87821 15.5193C2.77153 15.4876 2.77153 15.2907 2.87821 15.259C4.45753 14.7896 5.69623 13.5509 6.16562 11.9716Z" fill="#F6D78B"/>
                  <path d="M6.21709 3.54557C6.23612 3.48156 6.35421 3.48156 6.37323 3.54557C6.65487 4.49316 7.39809 5.23638 8.34568 5.51802C8.40969 5.53704 8.40969 5.65513 8.34568 5.67416C7.39809 5.95579 6.65487 6.69902 6.37323 7.64661C6.35421 7.71062 6.23611 7.71062 6.21709 7.64661C5.93545 6.69902 5.19223 5.95579 4.24464 5.67416C4.18063 5.65513 4.18063 5.53704 4.24464 5.51801C5.19223 5.23638 5.93545 4.49316 6.21709 3.54557Z" fill="#F6D78B"/>
                </g>
              </svg>
            </div>
          </aside>
        </section>
      </main>
    );
  }

  {
    const sharedRankRows = donorRank.slice(0, 10);
    const sharedTop = sharedRankRows[0];
    const sharedSecondaryRows = sharedRankRows.slice(1, 10);
    const sharedEmptyRows = Math.max(0, 9 - sharedSecondaryRows.length);
    const creatorDescription = fixedCreatorDescription(page.theme?.description);
    const summaryAmount = amountNumber || qr?.amount || 0;
    const formattedSummaryAmount = summaryAmount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const landingStyle = donationLandingStyle(page);

    const sharedCreatorAside = (
      <aside className="donation-creator-copy text-left">
        <p>สนับสนุน</p>
        <h1>{page.displayName}</h1>
        <p>{creatorDescription}</p>
      </aside>
    );

    const sharedRankCard = (
      <aside className="donation-rank-card">
        <div className="text-center">
          <div className="mx-auto grid size-20 place-items-center rounded-full bg-[#c98b1f] text-5xl font-black text-white shadow-lg">
            1
          </div>
          <h3 className="donation-rank-top-name mt-3 text-2xl font-black text-[#c98b1f]">{sharedTop ? (sharedTop.anonymous ? anonymousLabel : sharedTop.donorName) : "No Tips"}</h3>
          <div className="donation-top-strip mt-4">TOP TIPPER</div>
        </div>
        <div className="donation-rank-list mt-4 grid gap-2">
          {sharedSecondaryRows.map((row, index) => (
            <div key={`${row.donorName}-${index}`} className="donation-rank-row">
              <span className={`donation-rank-number rank-${index + 2}`}>{index + 2}</span>
              <span className="donation-rank-name">{(row.anonymous ? anonymousLabel : row.donorName).slice(0, 20)}</span>
            </div>
          ))}
          {Array.from({ length: sharedEmptyRows }).map((_, index) => (
            <div key={`empty-${index}`} className="donation-rank-row">
              <span className="donation-rank-number">{sharedSecondaryRows.length + index + 2}</span>
              <span>-</span>
            </div>
          ))}
        </div>
        <div className="donation-rank-actions">
          <svg className="donation-sparkle donation-sparkle-left" width="13" height="33" viewBox="0 0 13 33" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <g opacity="0.8">
              <path d="M6.11416 23.1955C6.15855 23.0462 6.4341 23.0462 6.47849 23.1955C7.13564 25.4066 8.86983 27.1407 11.0809 27.7979C11.2302 27.8423 11.2302 28.1178 11.0809 28.1622C8.86983 28.8194 7.13564 30.5536 6.47849 32.7646C6.4341 32.914 6.15855 32.914 6.11416 32.7646C5.45701 30.5536 3.72282 28.8194 1.51178 28.1622C1.36242 28.1178 1.36242 27.8423 1.51178 27.7979C3.72282 27.1407 5.45701 25.4066 6.11416 23.1955Z" fill="#F6D78B"/>
              <path d="M6.16562 11.9716C6.19733 11.8649 6.39415 11.8649 6.42586 11.9716C6.89525 13.5509 8.13396 14.7896 9.71328 15.259C9.81996 15.2907 9.81996 15.4876 9.71328 15.5193C8.13396 15.9887 6.89525 17.2274 6.42586 18.8067C6.39415 18.9134 6.19733 18.9134 6.16562 18.8067C5.69623 17.2274 4.45753 15.9887 2.87821 15.5193C2.77153 15.4876 2.77153 15.2907 2.87821 15.259C4.45753 14.7896 5.69623 13.5509 6.16562 11.9716Z" fill="#F6D78B"/>
              <path d="M6.21709 3.54557C6.23612 3.48156 6.35421 3.48156 6.37323 3.54557C6.65487 4.49316 7.39809 5.23638 8.34568 5.51802C8.40969 5.53704 8.40969 5.65513 8.34568 5.67416C7.39809 5.95579 6.65487 6.69902 6.37323 7.64661C6.35421 7.71062 6.23611 7.71062 6.21709 7.64661C5.93545 6.69902 5.19223 5.95579 4.24464 5.67416C4.18063 5.65513 4.18063 5.53704 4.24464 5.51801C5.19223 5.23638 5.93545 4.49316 6.21709 3.54557Z" fill="#F6D78B"/>
            </g>
          </svg>
          <div className="flex justify-center gap-2">
            {(["week", "month", "all"] as RankPeriod[]).map((period) => (
              <button key={period} className={`donation-rank-filter ${rankPeriod === period ? "is-active" : ""}`} type="button" onClick={() => setRankPeriod(period)}>
                {period === "week" ? "Week" : period === "month" ? "Month" : "All"}
              </button>
            ))}
          </div>
          <svg className="donation-sparkle donation-sparkle-right" width="13" height="33" viewBox="0 0 13 33" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <g opacity="0.8">
              <path d="M6.11416 23.1955C6.15855 23.0462 6.4341 23.0462 6.47849 23.1955C7.13564 25.4066 8.86983 27.1407 11.0809 27.7979C11.2302 27.8423 11.2302 28.1178 11.0809 28.1622C8.86983 28.8194 7.13564 30.5536 6.47849 32.7646C6.4341 32.914 6.15855 32.914 6.11416 32.7646C5.45701 30.5536 3.72282 28.8194 1.51178 28.1622C1.36242 28.1178 1.36242 27.8423 1.51178 27.7979C3.72282 27.1407 5.45701 25.4066 6.11416 23.1955Z" fill="#F6D78B"/>
              <path d="M6.16562 11.9716C6.19733 11.8649 6.39415 11.8649 6.42586 11.9716C6.89525 13.5509 8.13396 14.7896 9.71328 15.259C9.81996 15.2907 9.81996 15.4876 9.71328 15.5193C8.13396 15.9887 6.89525 17.2274 6.42586 18.8067C6.39415 18.9134 6.19733 18.9134 6.16562 18.8067C5.69623 17.2274 4.45753 15.9887 2.87821 15.5193C2.77153 15.4876 2.77153 15.2907 2.87821 15.259C4.45753 14.7896 5.69623 13.5509 6.16562 11.9716Z" fill="#F6D78B"/>
              <path d="M6.21709 3.54557C6.23612 3.48156 6.35421 3.48156 6.37323 3.54557C6.65487 4.49316 7.39809 5.23638 8.34568 5.51802C8.40969 5.53704 8.40969 5.65513 8.34568 5.67416C7.39809 5.95579 6.65487 6.69902 6.37323 7.64661C6.35421 7.71062 6.23611 7.71062 6.21709 7.64661C5.93545 6.69902 5.19223 5.95579 4.24464 5.67416C4.18063 5.65513 4.18063 5.53704 4.24464 5.51801C5.19223 5.23638 5.93545 4.49316 6.21709 3.54557Z" fill="#F6D78B"/>
            </g>
          </svg>
        </div>
      </aside>
    );

    const centerContent = (() => {
      if (step === "summary") {
        return (
          <section className="donation-form-card donation-review-card">
            <div className="text-center">
              <h2 className="donation-review-title">{t("ตรวจสอบรายการ", "Review Donation")}</h2>
              <p className="donation-review-subtitle">{t("ตรวจสอบรายการก่อนโดเนททุกครั้ง", "Review every detail before continuing.")}</p>
            </div>
            <div className="donation-review-list">
              <div className="donation-review-row"><span>Name</span><strong>{displayDonorName}</strong></div>
              <div className="donation-review-row"><span>E-mail</span><strong>{formState.donorEmail || "-"}</strong></div>
              <div className="donation-review-row is-message"><span>{t("ข้อความ", "Message")}</span><strong>{formState.message || "-"}</strong></div>
              <div className="donation-review-row"><span>{t("ยอดโดเนท", "Amount")}</span><strong>฿{summaryAmount.toLocaleString("en-US")}</strong></div>
            </div>
            {error ? <p className="donation-flow-error">{error}</p> : null}
            <button className="donation-state-primary" type="button" onClick={createQr} disabled={isCreatingQr} aria-busy={isCreatingQr}>
              {t("ยืนยัน", "Confirm")}
            </button>
            <button className="donation-state-back" type="button" onClick={() => { setError(""); setStep("form"); }}>{t("ย้อนกลับ", "Back")}</button>
          </section>
        );
      }

      if (step === "qr") {
        return (
          <section className="donation-form-card donation-qr-card">
            <div className="text-center">
              <p className="donation-qr-label">{t("กรุณาชำระภายใน", "Please pay within")}</p>
              <p className="donation-qr-countdown">{countdown}</p>
            </div>
            {qr?.qrDataUrl ? <img className="donation-qr-image" src={qr.qrDataUrl} alt="PromptPay QR" /> : <div className="donation-qr-image grid place-items-center text-sm">QR</div>}
            <p className="donation-qr-amount">{formattedSummaryAmount} THB</p>
            <button className="donation-state-primary" type="button" onClick={downloadQr}>{t("ชำระเงิน", "Pay")}</button>
            <button className="donation-state-back" type="button" onClick={resetFlow}>{t("ย้อนกลับ", "Back")}</button>
          </section>
        );
      }

      if (step === "verifying") {
        return (
          <section className="donation-form-card donation-state-card">
            <h2 className="donation-state-title">{t("กำลังตรวจสอบ", "Checking")}</h2>
            <img className="donation-state-character" src="/assets/payment-checking.png" alt="" />
            <p className="donation-state-copy">{t("กำลังตรวจสอบการชำระเงิน", "Checking your payment")}</p>
            <p className="donation-state-copy is-muted">{t("กรุณารอสักครู่...", "Please wait...")}</p>
            <div className="donation-state-dots" aria-hidden="true"><span /><span /><span /><span /><span /></div>
            <p className="donation-state-note">{t("ห้ามปิดหน้านี้จนกว่าจะเสร็จสิ้น", "Please keep this page open until it finishes.")}</p>
          </section>
        );
      }

      if (step === "success") {
        return (
          <section className="donation-form-card donation-state-card donation-success-card">
            <h2 className="donation-state-title">{t("สำเร็จ", "Success")}</h2>
            <img className="donation-state-character" src="/assets/payment-success.png" alt="" />
            <p className="donation-state-copy">{t("ขอบคุณสำหรับการสนับสนุน!", "Thank you for your support!")}</p>
            <div className="donation-review-list is-compact">
              <div className="donation-review-row"><span>{t("จำนวนเงิน", "Amount")}</span><strong>{formattedSummaryAmount} THB</strong></div>
              <div className="donation-review-row"><span>{t("จากคุณ", "From")}</span><strong>{displayDonorName}</strong></div>
            </div>
            <button className="donation-state-primary" type="button" onClick={resetFlow}>{t("กลับหน้าหลัก", "Back Home")}</button>
          </section>
        );
      }

      return (
        <section className="donation-form-card donation-state-card donation-failed-card">
          <h2 className="donation-state-title">{t("ชำระเงินไม่สำเร็จ", "Payment Failed")}</h2>
          <img className="donation-state-character is-failed" src="/assets/payment-failed.png" alt="" />
          <p className="donation-state-copy">{t("การชำระเงินของคุณ อาจประสบปัญหาบางอย่าง", "Your payment may have run into a problem.")}</p>
          <p className="donation-state-copy is-muted">{t("กรุณาทำรายการใหม่หรือติดต่อเจ้าหน้าที่", "Please try again or contact support.")}</p>
          <button className="donation-state-primary" type="button" onClick={resetFlow}>{t("กลับหน้าหลัก", "Back Home")}</button>
          <a className="donation-state-primary is-blue" href="mailto:support@tiphouse.local">{t("ติดต่อเจ้าหน้าที่", "Contact Support")}</a>
        </section>
      );
    })();

    return (
      <main className="donation-landing min-h-screen" style={landingStyle}>
        <section className="donation-hero mx-auto grid min-h-screen w-[min(1540px,100%)] items-center gap-4 px-5 py-8 lg:grid-cols-[minmax(520px,1fr)_minmax(440px,520px)_minmax(270px,320px)] lg:px-8 xl:px-10">
          {sharedCreatorAside}
          {centerContent}
          {sharedRankCard}
        </section>
        {expiredModal && (
          <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4">
            <div className="max-w-sm rounded-[2rem] border border-white/15 bg-white p-6 text-center text-ink shadow-2xl">
              <p className="text-2xl font-black">{t("QR Code หมดอายุ", "QR Code Expired")}</p>
              <p className="mt-2 text-sm text-ink/70">{t("กรุณาสร้างรายการโดเนทใหม่อีกครั้ง", "Please create a new donation request.")}</p>
              <button className="donation-state-primary mt-5" type="button" onClick={() => { setExpiredModal(false); resetFlow(); }}>{t("ปิด", "Close")}</button>
            </div>
          </div>
        )}
      </main>
    );
  }

}
