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
  handle: string;
  slug: string;
  quicklinkUrl: string;
  donationBackgroundUrl?: string;
  bannerUrl?: string;
  minAmount: number;
};

type SaveStatus = {
  type: "success" | "error";
  title: string;
  message: string;
};

const defaults: PageSettings = {
  displayName: "",
  handle: "",
  slug: "",
  quicklinkUrl: "",
  donationBackgroundUrl: "",
  minAmount: 20,
};

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const MAX_TEXT_LENGTH = 30;

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

function validateImageFile(file: File | null, label: string) {
  if (file && file.size > MAX_IMAGE_SIZE) {
    throw new Error(`${label} ต้องมีขนาดไม่เกิน 5MB`);
  }
}

function isDataUrl(value?: string) {
  return Boolean(value?.startsWith("data:"));
}

function cachePageSettings(page: PageSettings) {
  const cacheable = {
    ...page,
    bannerUrl: isDataUrl(page.bannerUrl) ? "" : page.bannerUrl,
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
  const [bannerPreview, setBannerPreview] = useState("");
  const [backgroundPreview, setBackgroundPreview] = useState("");
  const [bannerInputKey, setBannerInputKey] = useState(0);
  const [backgroundInputKey, setBackgroundInputKey] = useState(0);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<SaveStatus | null>(null);

  useEffect(() => {
    let cachedSettings: PageSettings | null = null;
    const cached = localStorage.getItem(userCacheKey("page_settings"));
    if (cached) {
      const parsed = { ...defaults, ...JSON.parse(cached) };
      cachedSettings = parsed;
    }

    api.get("/dashboard", { headers: authHeaders() }).then((res) => {
      if (!res.data?.page) return;
      const page = {
        ...defaults,
        ...res.data.page,
        quicklinkUrl: res.data.page?.theme?.quicklinkUrl ?? "",
        donationBackgroundUrl: res.data.page?.theme?.donationBackgroundUrl ?? cachedSettings?.donationBackgroundUrl ?? "",
      };
      setSettings(page);
      cachePageSettings(page);
      if (page.bannerUrl) setBannerPreview(page.bannerUrl);
      if (page.donationBackgroundUrl) setBackgroundPreview(page.donationBackgroundUrl);
    }).catch(() => {
      if (!cachedSettings) return;
      setSettings(cachedSettings);
      if (cachedSettings.bannerUrl) setBannerPreview(cachedSettings.bannerUrl);
      if (cachedSettings.donationBackgroundUrl) setBackgroundPreview(cachedSettings.donationBackgroundUrl);
    });
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setStatus(null);
    const form = new FormData(event.currentTarget);
    const bannerFile = form.get("bannerFile") instanceof File ? (form.get("bannerFile") as File) : null;
    const backgroundFile = form.get("backgroundFile") instanceof File ? (form.get("backgroundFile") as File) : null;
    let bannerUrl = settings.bannerUrl;
    let donationBackgroundUrl = settings.donationBackgroundUrl;
    try {
      validateImageFile(bannerFile && bannerFile.size ? bannerFile : null, "Banner");
      validateImageFile(backgroundFile && backgroundFile.size ? backgroundFile : null, "BG หน้าโดเนท");
      bannerUrl = (await readFileAsDataUrl(bannerFile && bannerFile.size ? bannerFile : null)) ?? settings.bannerUrl;
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
    const handle = String(form.get("handle") ?? "").trim().slice(0, MAX_TEXT_LENGTH);
    const payload = {
      displayName: String(form.get("displayName") ?? "").trim().slice(0, MAX_TEXT_LENGTH),
      handle,
      slug: normalizeDonationSlug(String(form.get("slug") ?? "").trim()),
      quicklinkUrl: String(form.get("quicklinkUrl") ?? "").trim(),
      bannerUrl,
      donationBackgroundUrl,
      minAmount: Number(form.get("minAmount") ?? defaults.minAmount),
      theme: {
        quicklinkUrl: String(form.get("quicklinkUrl") ?? "").trim(),
        quicklinkText: handle,
        donationBackgroundUrl,
      },
    };

    try {
      const { data } = await api.patch("/settings/page", payload, { headers: authHeaders() });
      const savedPage = { ...payload, ...data, quicklinkUrl: data?.theme?.quicklinkUrl ?? payload.quicklinkUrl };
      setSettings(savedPage);
      if (savedPage.bannerUrl) setBannerPreview(savedPage.bannerUrl);
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

  function onBannerChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setBannerPreview(URL.createObjectURL(file));
  }

  function onBackgroundChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setBackgroundPreview(URL.createObjectURL(file));
  }

  function clearBanner() {
    setSettings((current) => ({ ...current, bannerUrl: "" }));
    setBannerPreview("");
    setBannerInputKey((key) => key + 1);
  }

  function clearBackground() {
    setSettings((current) => ({ ...current, donationBackgroundUrl: "" }));
    setBackgroundPreview("");
    setBackgroundInputKey((key) => key + 1);
  }

  return (
    <AuthGate>
      <Nav />
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
          <label>{t("ชื่อครีเอเตอร์", "Creator Name")}<input className="input mt-2" name="displayName" maxLength={MAX_TEXT_LENGTH} value={settings.displayName} onChange={(event) => setSettings({ ...settings, displayName: event.target.value.slice(0, MAX_TEXT_LENGTH) })} required /><span className="mt-2 block text-sm text-white/60">{settings.displayName.length}/{MAX_TEXT_LENGTH}</span></label>
          <div className="grid gap-4 md:grid-cols-2">
            <label>
              Handle
              <input className="input mt-2" name="handle" maxLength={MAX_TEXT_LENGTH} value={settings.handle} onChange={(event) => setSettings({ ...settings, handle: event.target.value.slice(0, MAX_TEXT_LENGTH) })} required />
              <span className="mt-2 block text-sm text-white/60">{settings.handle.length}/{MAX_TEXT_LENGTH}</span>
            </label>
            <label>Quicklink URL<input className="input mt-2" name="quicklinkUrl" value={settings.quicklinkUrl} onChange={(event) => setSettings({ ...settings, quicklinkUrl: event.target.value })} placeholder="https://www.twitch.tv/..." /></label>
          </div>
          <label>
            {t("URL หน้าโดเนท", "Donation Page URL")}
            <input className="input mt-2" name="slug" maxLength={MAX_TEXT_LENGTH} value={settings.slug} onChange={(event) => setSettings({ ...settings, slug: normalizeDonationSlug(event.target.value) })} required />
            <span className="mt-2 block text-sm text-white/60">{t("4-30 ตัวอักษร ใช้ตัวพิมพ์เล็กและตัวเลขเท่านั้น", "4-30 characters. Lowercase letters and numbers only.")}</span>
          </label>
          <div>
            <label className="font-bold">{t("รูป Banner", "Banner Image")}</label>
            <p className="mt-1 text-sm text-white/60">{t("แนะนำขนาด 1920 x 640 px, ไฟล์ JPG/PNG/WebP, ไม่เกิน 5MB", "Recommended size 1920 x 640 px, JPG/PNG/WebP, up to 5MB.")}</p>
            <input key={bannerInputKey} className="input mt-2" name="bannerFile" type="file" accept="image/png,image/jpeg,image/webp" onChange={onBannerChange} />
            {bannerPreview && (
              <div className="relative mt-3">
                <img alt="Banner preview" src={bannerPreview} className="h-44 w-full rounded-lg object-cover" />
                <button className="btn absolute right-3 top-3 h-10 min-h-10 border-coral bg-coral px-4 font-black text-ink" type="button" aria-label="Delete banner image" onClick={clearBanner}>ลบรูป</button>
              </div>
            )}
          </div>
          <div>
            <label className="font-bold">BG หน้าโดเนท</label>
            <p className="mt-1 text-sm text-white/60">{t("แนะนำขนาด 1920 x 1080 px สำหรับพื้นหลังส่วนเนื้อหาด้านล่าง Banner, JPG/PNG/WebP, ไม่เกิน 5MB", "Recommended size 1920 x 1080 px for the content background below the banner, JPG/PNG/WebP, up to 5MB.")}</p>
            <input key={backgroundInputKey} className="input mt-2" name="backgroundFile" type="file" accept="image/png,image/jpeg,image/webp" onChange={onBackgroundChange} />
            {backgroundPreview && (
              <div className="relative mt-3">
                <img alt="Donation background preview" src={backgroundPreview} className="h-44 w-full rounded-lg object-cover" />
                <button className="btn absolute right-3 top-3 h-10 min-h-10 border-coral bg-coral px-4 font-black text-ink" type="button" aria-label="Delete donation background image" onClick={clearBackground}>ลบรูป</button>
              </div>
            )}
          </div>
          <label>{t("ยอดโดเนทขั้นต่ำ", "Minimum Donation")}<input className="input mt-2" name="minAmount" type="number" min="1" value={settings.minAmount} onChange={(event) => setSettings({ ...settings, minAmount: Number(event.target.value) })} required /></label>
          <button className="btn btn-primary disabled:cursor-not-allowed disabled:opacity-50" type="submit" disabled={saving}>{saving ? t("กำลังบันทึก...", "Saving...") : t("บันทึกหน้าโดเนท", "Save Donation Page")}</button>
        </form>
      </main>
    </AuthGate>
  );
}
