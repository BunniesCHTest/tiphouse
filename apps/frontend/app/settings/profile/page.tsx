"use client";

import { FormEvent, useEffect, useState } from "react";
import { AxiosError } from "axios";
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

function getErrorMessage(error: unknown) {
  if (error instanceof AxiosError) {
    const message = error.response?.data?.message;
    if (typeof message === "string") return message;
    if (Array.isArray(message)) return message.join(", ");
  }
  return "ส่งคำขอเปลี่ยนแปลงไม่สำเร็จ กรุณาตรวจสอบข้อมูลอีกครั้ง";
}

export default function ProfileSettingsPage() {
  const { t } = useAppPreferences();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function load() {
    const { data } = await api.get("/settings/profile", { headers: authHeaders() });
    setProfile(data);
    setUsername(data?.username ?? "");
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
      await api.patch("/settings/profile", { username: username.trim(), email: email.trim() }, { headers: authHeaders() });
      await load();
      setMessage(t("ส่งคำขอเปลี่ยนแปลงแล้ว กรุณารอ Admin อนุมัติก่อนข้อมูลจึงจะถูกเปลี่ยนแปลง", "Change request sent. An admin must approve it before the profile is updated."));
    } catch (caught) {
      setError(getErrorMessage(caught));
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
              <label>
                Username
                <input className="input mt-2" value={username} onChange={(event) => setUsername(event.target.value.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 20))} required />
                <span className="mt-2 block text-sm text-white/60">4-20 ตัวอักษร ใช้ตัวพิมพ์เล็กและตัวเลขเท่านั้น</span>
              </label>
              <label>
                Email
                <input className="input mt-2" name="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
                <span className="mt-2 block text-sm text-white/60">{t("ใช้รับการติดต่อจาก TipHouse เท่านั้น", "Used only for TipHouse contact.")}</span>
              </label>
              <p className="rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-white/65">
                การเปลี่ยน Username หรือ Email จะยังไม่เปลี่ยนทันที ต้องได้รับการอนุมัติจาก Admin ก่อน
              </p>
              {message && <p className="text-mint">{message}</p>}
              {error && <p className="text-coral">{error}</p>}
              <button className="btn btn-primary" type="submit">{t("ส่งคำขอเปลี่ยนแปลง", "Submit Change Request")}</button>
            </form>
          )}
        </section>
      </main>
    </AuthGate>
  );
}
