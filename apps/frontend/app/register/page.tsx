"use client";

import Link from "next/link";
import { Nav } from "@/components/Nav";

export default function RegisterPage() {
  return (
    <>
      <Nav publicOnly />
      <main className="mx-auto w-[min(760px,calc(100%-2rem))] py-10">
        <p className="font-bold text-mint">Streamlabs Only</p>
        <h1 className="mt-3 text-5xl font-black">สมัครใช้งานผ่าน Streamlabs</h1>
        <section className="card mt-8 grid gap-4 p-5">
          <p className="leading-7 text-white/65">TipHouse ปิดการสมัครแบบกรอกข้อมูลเองแล้ว กรุณา Login ผ่าน Streamlabs เพื่อสร้างหรือเชื่อมบัญชี Creator</p>
          <Link className="btn btn-primary" href="/login">ไปหน้า Streamlabs Login</Link>
        </section>
      </main>
    </>
  );
}
