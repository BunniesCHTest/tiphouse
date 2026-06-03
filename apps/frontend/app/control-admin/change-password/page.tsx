"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { AuthGate } from "@/components/AuthGate";
import { api, authHeaders } from "@/lib/api";

const passwordRule = /^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

export default function AdminChangePasswordPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const oldPassword = String(form.get("oldPassword") ?? "");
    const newPassword = String(form.get("newPassword") ?? "");
    const confirmPassword = String(form.get("confirmPassword") ?? "");
    setError("");

    if (newPassword !== confirmPassword) {
      setError("รหัสผ่านใหม่และยืนยันรหัสผ่านใหม่ไม่ตรงกัน");
      return;
    }
    if (!passwordRule.test(newPassword)) {
      setError("รหัสผ่านใหม่ต้องมีอย่างน้อย 8 ตัวอักษร พร้อมตัวพิมพ์ใหญ่ ตัวเลข และอักขระพิเศษ");
      return;
    }

    setSaving(true);
    try {
      await api.post("/auth/change-password", { oldPassword, newPassword, confirmPassword }, { headers: authHeaders("admin") });
      router.replace("/control-admin");
    } catch {
      setError("เปลี่ยนรหัสผ่านไม่สำเร็จ กรุณาตรวจสอบรหัสผ่านเก่า");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AuthGate admin>
      <main className="grid min-h-screen place-items-center px-4">
        <form onSubmit={submit} className="card grid w-[min(520px,100%)] gap-4 p-6">
          <p className="font-bold text-mint">TipHouse Admin</p>
          <h1 className="text-4xl font-black">เปลี่ยนรหัสผ่าน</h1>
          <p className="text-white/65">กรุณาเปลี่ยนรหัสผ่านเริ่มต้นก่อนเข้าใช้งานครั้งแรก</p>
          <label>รหัสผ่านเก่า<input className="input mt-2" name="oldPassword" type="password" required /></label>
          <label>รหัสผ่านใหม่<input className="input mt-2" name="newPassword" type="password" required /></label>
          <label>ยืนยันรหัสผ่านใหม่<input className="input mt-2" name="confirmPassword" type="password" required /></label>
          {error && <p className="text-coral">{error}</p>}
          <button className="btn btn-primary disabled:opacity-60" type="submit" disabled={saving}>{saving ? "กำลังบันทึก..." : "บันทึกรหัสผ่านใหม่"}</button>
        </form>
      </main>
    </AuthGate>
  );
}
