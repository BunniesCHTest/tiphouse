"use client";

import Link from "next/link";
import { Nav } from "@/components/Nav";

export default function ForgotPasswordPage() {
  return (
    <>
      <Nav publicOnly />
      <main className="mx-auto w-[min(760px,calc(100%-2rem))] py-10">
        <p className="font-bold text-mint">Password Reset Disabled</p>
        <h1 className="mt-3 text-5xl font-black">ไม่ใช้ระบบรีเซ็ตรหัสผ่าน</h1>
        <section className="card mt-8 grid gap-4 p-5">
          <p className="leading-7 text-white/65">ระบบ Creator ใช้ Streamlabs Login เท่านั้น จึงไม่ต้องใช้รหัสผ่านของ TipHouse สำหรับผู้ใช้งานทั่วไป</p>
          <Link className="btn btn-primary" href="/login">กลับไป Login ผ่าน Streamlabs</Link>
        </section>
      </main>
    </>
  );
}
