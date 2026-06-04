"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AxiosError } from "axios";
import { AuthGate } from "@/components/AuthGate";
import { api, authHeaders } from "@/lib/api";
import { clearSession, setSessionValue, userCacheKey } from "@/lib/session";
import { useAppPreferences } from "@/lib/app-preferences";

type Profile = {
  username?: string;
  email?: string;
  donationNotificationEmail?: string | null;
  page?: {
    slug?: string;
    displayName?: string;
  } | null;
};

const MAX_CREATOR_FIELD_LENGTH = 30;
const slugPattern = /^[a-z0-9]{4,30}$/;

function normalizeSlug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, MAX_CREATOR_FIELD_LENGTH);
}

function apiMessage(error: unknown) {
  if (error instanceof AxiosError) {
    const message = error.response?.data?.message;
    if (Array.isArray(message)) return message.join(", ");
    if (typeof message === "string") return message;
  }
  return "บันทึกไม่สำเร็จ กรุณาลองใหม่อีกครั้ง";
}

export default function CreatorOnboardingPage() {
  const router = useRouter();
  const { t } = useAppPreferences();
  const [displayName, setDisplayName] = useState("");
  const [slug, setSlug] = useState("");
  const [notificationEmail, setNotificationEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api.get<Profile>("/settings/profile", { headers: authHeaders() }).then((res) => {
      const page = res.data.page;
      setDisplayName(page?.displayName ?? res.data.username ?? "");
      setNotificationEmail(res.data.donationNotificationEmail ?? (res.data.email?.endsWith("@tiphouse.local") ? "" : res.data.email ?? ""));
      const currentSlug = page?.slug ?? res.data.username ?? "";
      setSlug(currentSlug.startsWith("streamlabs-") ? "" : normalizeSlug(currentSlug));
    }).catch(() => undefined);
  }, []);

  const donationUrl = useMemo(() => {
    if (typeof window === "undefined") return `/${slug || "your-url"}`;
    return `${window.location.origin}/${slug || "your-url"}`;
  }, [slug]);
  const slugValid = slugPattern.test(slug);
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(notificationEmail);
  const canSubmit = displayName.trim().length >= 2 && displayName.trim().length <= MAX_CREATOR_FIELD_LENGTH && slugValid && emailValid;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) return;
    setSaving(true);
    setError("");
    try {
      const { data } = await api.post("/settings/onboarding", {
        displayName: displayName.trim().slice(0, MAX_CREATOR_FIELD_LENGTH),
        slug,
        donationNotificationEmail: notificationEmail.trim(),
      }, { headers: authHeaders() });
      const page = data?.page ?? { slug, displayName, handle: `@${slug}` };
      localStorage.setItem(userCacheKey("donation_slug"), page.slug);
      localStorage.setItem(userCacheKey("page_settings"), JSON.stringify(page));
      setSessionValue("user", "creator_setup_completed", "true");
      window.dispatchEvent(new CustomEvent("tiphouse:page-updated", { detail: page }));
      router.replace("/dashboard?setup=done");
    } catch (caught) {
      setError(apiMessage(caught));
    } finally {
      setSaving(false);
    }
  }

  function backToLogin() {
    clearSession("user");
    router.replace("/login");
  }

  return (
    <AuthGate>
      <main className="mx-auto w-[min(760px,calc(100%-2rem))] py-10">
        <p className="font-bold text-mint">{t("ตั้งค่า Creator ครั้งแรก", "Creator Setup")}</p>
        <h1 className="mt-3 text-5xl font-black">{t("ตั้งค่าหน้าโดเนทของคุณ", "Set Up Your Donation Page")}</h1>
        <p className="mt-4 leading-7 text-white/65">
          {t("หลัง Login ด้วย Streamlabs ครั้งแรก กรุณาตั้งชื่อและ URL หน้าโดเนทก่อนเริ่มใช้งานระบบ", "After your first Streamlabs login, set your creator name and donation URL before using TipHouse.")}
        </p>
        <form onSubmit={submit} className="card mt-8 grid gap-5 p-5">
          <label>
            {t("ชื่อครีเอเตอร์", "Creator Name")}
            <input className="input mt-2" value={displayName} maxLength={MAX_CREATOR_FIELD_LENGTH} onChange={(event) => setDisplayName(event.target.value.slice(0, MAX_CREATOR_FIELD_LENGTH))} required />
            <span className="mt-2 block text-sm text-white/60">{displayName.length}/{MAX_CREATOR_FIELD_LENGTH}</span>
          </label>
          <label>
            {t("Username URL หน้าโดเนท", "Donation Page Username URL")}
            <input
              className={`input mt-2 ${slug && !slugValid ? "border-coral text-coral" : ""}`}
              value={slug}
              onChange={(event) => setSlug(normalizeSlug(event.target.value))}
              placeholder="bunniesch"
              required
            />
            <span className="mt-2 block text-sm text-white/60">4-30 ตัวอักษร ใช้ตัวพิมพ์เล็กและตัวเลขเท่านั้น</span>
          </label>
          <label>
            {t("URL หน้าโดเนท", "Donation Page URL")}
            <input className="input mt-2" value={donationUrl} readOnly />
          </label>
          <label>
            {t("Email รับข้อมูลโดเนท", "Donation Notification Email")}
            <input className={`input mt-2 ${notificationEmail && !emailValid ? "border-coral text-coral" : ""}`} type="email" value={notificationEmail} onChange={(event) => setNotificationEmail(event.target.value)} placeholder="you@example.com" required />
            <span className="mt-2 block text-sm text-white/60">{t("ใช้รับการแจ้งเตือนการโอนเงินและข้อมูลโดเนทจาก TipHouse", "Used for TipHouse donation and transfer notifications.")}</span>
          </label>
          {error && <p className="font-bold text-coral">{error}</p>}
          <div className="flex flex-wrap gap-3">
            <button className="btn btn-primary disabled:cursor-not-allowed disabled:opacity-50" type="submit" disabled={!canSubmit || saving}>
              {saving ? t("กำลังบันทึก...", "Saving...") : t("บันทึกและเริ่มใช้งาน", "Save and Continue")}
            </button>
            <button className="btn" type="button" onClick={backToLogin}>{t("ย้อนกลับไปหน้า Login", "Back to Login")}</button>
          </div>
        </form>
      </main>
    </AuthGate>
  );
}
