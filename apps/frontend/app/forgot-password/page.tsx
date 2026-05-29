"use client";

import { FormEvent, useState } from "react";
import { Nav } from "@/components/Nav";
import { api } from "@/lib/api";

export default function ForgotPasswordPage() {
  const [token, setToken] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function requestReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    const form = new FormData(event.currentTarget);
    try {
      const { data } = await api.post("/auth/password-reset/request", { email: form.get("email") });
      setToken(data.resetToken ?? "");
      setMessage("สร้างคำขอรีเซตรหัสผ่านแล้ว");
    } catch {
      setError("สร้างคำขอรีเซตรหัสผ่านไม่สำเร็จ");
    }
  }

  async function confirmReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    const form = new FormData(event.currentTarget);
    try {
      await api.post("/auth/password-reset/confirm", {
        token: form.get("token"),
        password: form.get("password"),
      });
      setMessage("เปลี่ยนรหัสผ่านสำเร็จ สามารถกลับไป Login ได้แล้ว");
      setToken("");
    } catch {
      setError("รีเซตรหัสผ่านไม่สำเร็จ กรุณาตรวจสอบ token หรือรหัสผ่านใหม่");
    }
  }

  return (
    <>
      <Nav publicOnly />
      <main className="mx-auto grid w-[min(860px,calc(100%-2rem))] gap-5 py-10">
        <section>
          <p className="font-bold text-mint">Password Recovery</p>
          <h1 className="mt-3 text-5xl font-black">รีเซตรหัสผ่าน</h1>
        </section>
        <form onSubmit={requestReset} className="card grid gap-4 p-5">
          <label>Email<input className="input mt-2" name="email" type="email" placeholder="you@example.com" required /></label>
          <button className="btn btn-primary" type="submit">ขอรีเซตรหัสผ่าน</button>
          <p className="text-sm text-white/55">MVP จะแสดง reset token บนหน้านี้ ก่อนใช้งานจริงควรเชื่อมต่อระบบส่งอีเมล</p>
        </form>
        {(token || message || error) && (
          <form onSubmit={confirmReset} className="card grid gap-4 p-5">
            {token && <p className="rounded-lg border border-gold/30 bg-gold/10 p-3 text-gold">Reset token: {token}</p>}
            <label>Reset token<input className="input mt-2" name="token" defaultValue={token} required /></label>
            <label>รหัสผ่านใหม่<input className="input mt-2" name="password" type="password" pattern="^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$" placeholder="อย่างน้อย 8 ตัว มี A-Z, ตัวเลข, อักขระพิเศษ" required /></label>
            {message && <p className="text-mint">{message}</p>}
            {error && <p className="text-coral">{error}</p>}
            <button className="btn btn-primary" type="submit">ตั้งรหัสผ่านใหม่</button>
          </form>
        )}
      </main>
    </>
  );
}
