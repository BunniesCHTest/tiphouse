"use client";

import { FormEvent, useEffect, useState } from "react";
import { AuthGate } from "@/components/AuthGate";
import { Nav } from "@/components/Nav";
import { api, authHeaders } from "@/lib/api";

type Profile = {
  username: string;
  email: string;
  accountStatus: string;
  role: string;
};

export default function ProfileSettingsPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function load() {
    const { data } = await api.get("/settings/profile", { headers: authHeaders() });
    setProfile(data);
    if (data?.accountStatus) localStorage.setItem("tiphouse_account_status", data.accountStatus);
  }

  useEffect(() => {
    load().catch(() => setError("โหลดข้อมูลโปรไฟล์ไม่สำเร็จ"));
  }, []);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      const { data } = await api.patch(
        "/settings/profile",
        { username: form.get("username"), email: form.get("email") },
        { headers: authHeaders() },
      );
      setProfile(data);
      if (data?.accountStatus) localStorage.setItem("tiphouse_account_status", data.accountStatus);
      setMessage("บันทึกโปรไฟล์สำเร็จ");
    } catch {
      setError("บันทึกข้อมูลไม่สำเร็จ กรุณาตรวจสอบข้อมูลซ้ำ");
    }
  }

  return (
    <AuthGate allowPending>
      <Nav />
      <main className="mx-auto w-[min(860px,calc(100%-2rem))] py-10">
        <p className="font-bold text-mint">Account Profile</p>
        <h1 className="mt-3 text-5xl font-black">จัดการโปรไฟล์</h1>
        <section className="card mt-8 p-5">
          {profile && (
            <form onSubmit={save} className="grid gap-4">
              <label>Username<input className="input mt-2" name="username" defaultValue={profile.username} required /></label>
              <label>Email<input className="input mt-2" name="email" type="email" defaultValue={profile.email} required /><span className="mt-2 block text-sm text-white/60">ใช้รับการติดต่อจาก TipHouse เท่านั้น</span></label>
              {message && <p className="text-mint">{message}</p>}
              {error && <p className="text-coral">{error}</p>}
              <button className="btn btn-primary" type="submit">บันทึกโปรไฟล์</button>
            </form>
          )}
        </section>
      </main>
    </AuthGate>
  );
}
