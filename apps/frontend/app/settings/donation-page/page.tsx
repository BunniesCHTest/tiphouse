"use client";

import { ChangeEvent, FormEvent, useEffect, useState } from "react";
import { AxiosError } from "axios";
import Link from "next/link";
import { AuthGate } from "@/components/AuthGate";
import { Nav } from "@/components/Nav";
import { api, authHeaders } from "@/lib/api";
import { useAppPreferences } from "@/lib/app-preferences";
import { userCacheKey } from "@/lib/session";

type PageSettings = {
  displayName: string;
  description: string;
  slug: string;
  donationBackgroundUrl?: string;
  minAmount: number;
};

type SaveStatus = {
  type: "success" | "error";
  title: string;
  message: string;
};

const defaults: PageSettings = {
  displayName: "",
  description: "",
  slug: "",
  donationBackgroundUrl: "",
  minAmount: 20,
};

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const MAX_TEXT_LENGTH = 30;
const MAX_DESCRIPTION_LENGTH = 180;
const MIN_DONATION_AMOUNT = 20;

function normalizeDonationSlug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, MAX_TEXT_LENGTH);
}

function readFileAsDataUrl(file: File | null) {
  return new Promise<string | undefined>((resolve, reject) => {
    if (!file) return resolve(undefined);
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function validateImageFile(file: File | null) {
  if (file && file.size > MAX_IMAGE_SIZE) {
    throw new Error("รูป BG หน้าโดเนทต้องมีขนาดไม่เกิน 5MB");
  }
}

function isDataUrl(value?: string) {
  return Boolean(value?.startsWith("data:"));
}

function cachePageSettings(page: PageSettings) {
  const cacheable = {
    ...page,
    donationBackgroundUrl: isDataUrl(page.donationBackgroundUrl) ? "" : page.donationBackgroundUrl,
  };
  try {
    localStorage.setItem(userCacheKey("page_settings"), JSON.stringify(cacheable));
    localStorage.setItem(userCacheKey("donation_slug"), page.slug);
  } catch {
    localStorage.removeItem(userCacheKey("page_settings"));
    localStorage.setItem(userCacheKey("donation_slug"), page.slug);
  }
}

function errorMessage(error: unknown) {
  if (error instanceof AxiosError) {
    const message = error.response?.data?.message;
    if (Array.isArray(message)) return message.join(", ");
    if (typeof message === "string") return message;
  }
  return "บันทึกไม่สำเร็จ กรุณาตรวจสอบข้อมูลหรือ backend";
}

export default function DonationPageSettings() {
  const { t } = useAppPreferences();
  const [settings, setSettings] = useState<PageSettings>(defaults);
  const [backgroundPreview, setBackgroundPreview] = useState("");
  const [backgroundInputKey, setBackgroundInputKey] = useState(0);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<SaveStatus | null>(null);
  const [minAmountWarning, setMinAmountWarning] = useState(false);

  useEffect(() => {
    let cachedSettings: PageSettings | null = null;
    const cached = localStorage.getItem(userCacheKey("page_settings"));
    if (cached) {
      cachedSettings = { ...defaults, ...JSON.parse(cached) };
    }

    api.get("/settings/page", { headers: authHeaders() }).then((res) => {
      if (!res.data) return;
      const page: PageSettings = {
        displayName: res.data?.displayName ?? cachedSettings?.displayName ?? "",
        description: res.data?.theme?.description ?? cachedSettings?.description ?? "",
        slug: res.data?.slug ?? cachedSettings?.slug ?? "",
        donationBackgroundUrl: res.data?.theme?.donationBackgroundUrl ?? cachedSettings?.donationBackgroundUrl ?? "",
        minAmount: res.data?.minAmount ?? cachedSettings?.minAmount ?? MIN_DONATION_AMOUNT,
      };
      setSettings(page);
      cachePageSettings(page);
      if (page.donationBackgroundUrl) setBackgroundPreview(page.donationBackgroundUrl);
    }).catch(() => {
      if (!cachedSettings) return;
      setSettings(cachedSettings);
      if (cachedSettings.donationBackgroundUrl) setBackgroundPreview(cachedSettings.donationBackgroundUrl);
    }).finally(() => setLoading(false));
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setStatus(null);
    const form = new FormData(event.currentTarget);
    const backgroundFile = form.get("backgroundFile") instanceof File ? (form.get("backgroundFile") as File) : null;
    let donationBackgroundUrl = settings.donationBackgroundUrl;

    try {
      validateImageFile(backgroundFile && backgroundFile.size ? backgroundFile : null);
      donationBackgroundUrl = (await readFileAsDataUrl(backgroundFile && backgroundFile.size ? backgroundFile : null)) ?? settings.donationBackgroundUrl;
    } catch (caught) {
      setStatus({
        type: "error",
        title: t("บันทึกไม่สำเร็จ", "Save Failed"),
        message: caught instanceof Error ? caught.message : errorMessage(caught),
      });
      setSaving(false);
      return;
    }

    const payload = {
      displayName: String(form.get("displayName") ?? "").trim().slice(0, MAX_TEXT_LENGTH),
      slug: normalizeDonationSlug(String(form.get("slug") ?? "").trim()),
      donationBackgroundUrl,
      minAmount: Math.max(MIN_DONATION_AMOUNT, Number(form.get("minAmount") ?? defaults.minAmount)),
      theme: {
        description: String(form.get("description") ?? "").trim().slice(0, MAX_DESCRIPTION_LENGTH),
        donationBackgroundUrl,
      },
    };

    try {
      const { data } = await api.patch("/settings/page", payload, { headers: authHeaders() });
      const savedPage: PageSettings = {
        displayName: data?.displayName ?? payload.displayName,
        description: data?.theme?.description ?? payload.theme.description,
        slug: data?.slug ?? payload.slug,
        donationBackgroundUrl: data?.theme?.donationBackgroundUrl ?? payload.donationBackgroundUrl,
        minAmount: data?.minAmount ?? payload.minAmount,
      };
      setSettings(savedPage);
      if (savedPage.donationBackgroundUrl) setBackgroundPreview(savedPage.donationBackgroundUrl);
      cachePageSettings(savedPage);
      window.dispatchEvent(new CustomEvent("tiphouse:page-updated", { detail: savedPage }));
      setStatus({
        type: "success",
        title: t("บันทึกสำเร็จ", "Saved"),
        message: t(`ข้อมูลหน้าโดเนท /${savedPage.slug} ถูกบันทึกแล้ว`, `Donation page /${savedPage.slug} has been saved.`),
      });
    } catch (caught) {
      setStatus({
        type: "error",
        title: t("บันทึกไม่สำเร็จ", "Save Failed"),
        message: errorMessage(caught),
      });
    } finally {
      setSaving(false);
    }
  }

  function onBackgroundChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setBackgroundPreview(URL.createObjectURL(file));
  }

  function clearBackground() {
    setSettings((current) => ({ ...current, donationBackgroundUrl: "" }));
    setBackgroundPreview("");
    setBackgroundInputKey((key) => key + 1);
  }

  return (
    <AuthGate>
      <Nav />
      {loading ? (
        <main className="mx-auto w-[min(980px,calc(100%-2rem))] py-10">
          <div className="h-12 w-72 animate-pulse rounded-lg bg-white/10" />
          <section className="card mt-8 grid gap-5 p-5">
            {Array.from({ length: 5 }, (_, index) => <div key={index} className="h-16 animate-pulse rounded-lg bg-white/10" />)}
            <div className="h-44 animate-pulse rounded-lg bg-white/10" />
          </section>
        </main>
      ) : (
        <main className="mx-auto w-[min(980px,calc(100%-2rem))] py-10">
          {status && (
            <div className="fixed inset-0 z-40 grid place-items-center bg-black/60 px-4">
              <section className="card max-w-md p-6 text-center">
                <span className={`badge ${status.type === "success" ? "text-mint" : "text-coral"}`}>{status.type === "success" ? "SUCCESS" : "ERROR"}</span>
                <h2 className="mt-3 text-3xl font-black">{status.title}</h2>
                <p className="mt-2 text-white/65">{status.message}</p>
                <div className="mt-5 flex flex-wrap justify-center gap-3">
                  {status.type === "success" && <Link className="btn btn-primary" href={`/${settings.slug}`} target="_blank">{t("เปิดหน้าโดเนท", "Open Donation Page")}</Link>}
                  <button className="btn" type="button" onClick={() => setStatus(null)}>{t("ปิด", "Close")}</button>
                </div>
              </section>
            </div>
          )}
          <p className="font-bold text-mint">Donation Page Builder</p>
          <h1 className="mt-3 text-5xl font-black">{t("ตั้งค่าหน้าโดเนท", "Donation Page Settings")}</h1>
          <form onSubmit={submit} className="card mt-8 grid gap-4 p-5">
            <label>
              {t("ชื่อครีเอเตอร์", "Creator Name")}
              <input className="input mt-2" name="displayName" maxLength={MAX_TEXT_LENGTH} value={settings.displayName} onChange={(event) => setSettings({ ...settings, displayName: event.target.value.slice(0, MAX_TEXT_LENGTH) })} required />
              <span className="mt-2 block text-sm text-white/60">{settings.displayName.length}/{MAX_TEXT_LENGTH}</span>
            </label>
            <label>
              Description
              <textarea className="input mt-2 min-h-28 resize-y" name="description" maxLength={MAX_DESCRIPTION_LENGTH} value={settings.description} onChange={(event) => setSettings({ ...settings, description: event.target.value.slice(0, MAX_DESCRIPTION_LENGTH) })} placeholder={t("ข้อความแนะนำตัวหรือข้อความใต้ชื่อครีเอเตอร์บนหน้าโดเนท", "Short intro shown under the creator name on the donation page")} />
              <span className="mt-2 block text-sm text-white/60">{settings.description.length}/{MAX_DESCRIPTION_LENGTH}</span>
            </label>
            <label>
              {t("URL หน้าโดเนท", "Donation Page URL")}
              <input className="input mt-2" name="slug" maxLength={MAX_TEXT_LENGTH} value={settings.slug} onChange={(event) => setSettings({ ...settings, slug: normalizeDonationSlug(event.target.value) })} required />
              <span className="mt-2 block text-sm text-white/60">{t("4-30 ตัวอักษร ใช้ตัวพิมพ์เล็กและตัวเลขเท่านั้น", "4-30 characters. Lowercase letters and numbers only.")}</span>
            </label>
            <div>
              <label className="font-bold">BG หน้าโดเนท</label>
              <p className="mt-1 text-sm text-white/60">{t("แนะนำขนาด 1920 x 1080 px ใช้เป็นพื้นหลังหน้าโดเนท, JPG/PNG/WebP, ไม่เกิน 5MB", "Recommended size 1920 x 1080 px for the donation page background, JPG/PNG/WebP, up to 5MB.")}</p>
              <input key={backgroundInputKey} className="input mt-2" name="backgroundFile" type="file" accept="image/png,image/jpeg,image/webp" onChange={onBackgroundChange} />
              {backgroundPreview && (
                <div className="relative mt-3">
                  <img alt="Donation background preview" src={backgroundPreview} className="h-44 w-full rounded-lg object-cover" />
                  <button className="absolute right-3 top-3 grid h-10 w-10 place-items-center rounded-full border border-coral bg-coral text-2xl font-black leading-none text-ink shadow-lg shadow-black/30 transition hover:scale-105 hover:bg-[#ff8f7d]" type="button" aria-label="Delete donation background image" title="Delete donation background image" onClick={clearBackground}>X</button>
                </div>
              )}
            </div>
            <label>
              {t("ยอดโดเนทขั้นต่ำ", "Minimum Donation")}
              <input
                className={`input mt-2 ${minAmountWarning ? "border-coral text-coral" : ""}`}
                name="minAmount"
                type="number"
                min={MIN_DONATION_AMOUNT}
                value={settings.minAmount}
                onChange={(event) => {
                  const next = Number(event.target.value);
                  const belowMinimum = Number.isFinite(next) && next < MIN_DONATION_AMOUNT;
                  setMinAmountWarning(belowMinimum);
                  setSettings({ ...settings, minAmount: Number.isFinite(next) ? next : MIN_DONATION_AMOUNT });
                }}
                onBlur={() => setSettings((current) => ({ ...current, minAmount: Math.max(MIN_DONATION_AMOUNT, Number(current.minAmount || MIN_DONATION_AMOUNT)) }))}
                required
              />
              {minAmountWarning && <span className="mt-2 block text-sm font-bold text-coral">ยอดโดเนทขั้นต่ำต้องไม่น้อยกว่า 20 บาท</span>}
            </label>
            <button className="btn btn-primary disabled:cursor-not-allowed disabled:opacity-50" type="submit" disabled={saving || minAmountWarning}>{saving ? t("กำลังบันทึก...", "Saving...") : t("บันทึกหน้าโดเนท", "Save Donation Page")}</button>
          </form>
        </main>
      )}
    </AuthGate>
  );
}
