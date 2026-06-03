"use client";

import { FormEvent, useEffect, useState } from "react";
import { AuthGate } from "@/components/AuthGate";
import { Nav } from "@/components/Nav";
import { api, authHeaders } from "@/lib/api";
import { useAppPreferences } from "@/lib/app-preferences";

type Profile = {
  username: string;
  email: string;
  donationNotificationEmail?: string | null;
  accountStatus: string;
  role: string;
};

export default function ProfileSettingsPage() {
  const { t } = useAppPreferences();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function load() {
    const { data } = await api.get("/settings/profile", { headers: authHeaders() });
    setProfile(data);
    setEmail(data?.donationNotificationEmail ?? (data?.email?.endsWith("@tiphouse.local") ? "" : data?.email ?? ""));
    if (data?.accountStatus) localStorage.setItem("tiphouse_account_status", data.accountStatus);
  }

  useEffect(() => {
    load().catch(() => setError(t("โหลดข้อมูลโปรไฟล์ไม่สำเร็จ", "Could not load profile.")));
  }, []);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setError("");
    try {
      await api.patch("/settings/profile", { donationNotificationEmail: email.trim() }, { headers: authHeaders() });
      await load();
      setMessage(t("บันทึกโปรไฟล์สำเร็จ", "Profile saved successfully."));
    } catch {
      setError(t("บันทึกข้อมูลไม่สำเร็จ กรุณาตรวจสอบข้อมูลอีกครั้ง", "Could not save. Please check the information again."));
    }
  }

  return (
    <AuthGate allowPending>
      <Nav />
      <main className="mx-auto w-[min(860px,calc(100%-2rem))] py-10">
        <p className="font-bold text-mint">Account Profile</p>
        <h1 className="mt-3 text-5xl font-black">{t("จัดการโปรไฟล์", "Profile Management")}</h1>
        <section className="card mt-8 p-5">
          {profile && (
            <form onSubmit={save} className="grid gap-4">
              <label>Username<input className="input mt-2" value={profile.username} readOnly /></label>
              <label>
                Email
                <input className="input mt-2" name="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
                <span className="mt-2 block text-sm text-white/60">{t("ใช้รับการติดต่อจาก TipHouse เท่านั้น", "Used only for TipHouse contact.")}</span>
              </label>
              {message && <p className="text-mint">{message}</p>}
              {error && <p className="text-coral">{error}</p>}
              <button className="btn btn-primary" type="submit">{t("บันทึกโปรไฟล์", "Save Profile")}</button>
            </form>
          )}
        </section>
      </main>
    </AuthGate>
  );
}
