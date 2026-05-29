"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export function AuthGate({ children, admin = false }: { children: React.ReactNode; admin?: boolean }) {
  const [allowed, setAllowed] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("tiphouse_access_token");
    const role = localStorage.getItem("tiphouse_role");
    setAllowed(Boolean(token) && (!admin || role === "ADMIN"));
    setChecked(true);
  }, [admin]);

  if (!checked) return <main className="grid min-h-screen place-items-center">Loading...</main>;

  if (!allowed) {
    return (
      <main className="grid min-h-screen place-items-center px-4 text-center">
        <section className="card max-w-md p-6">
          <h1 className="text-3xl font-black">กรุณาเข้าสู่ระบบก่อน</h1>
          <p className="mt-3 text-white/65">ต้องสมัครใช้งานหรือเข้าสู่ระบบก่อนถึงจะใช้หน้าจัดการของ TipHouse ได้</p>
          <div className="mt-5 flex justify-center gap-3">
            <Link className="btn btn-primary" href={admin ? "/control-admin/login" : "/login"}>Login</Link>
            {!admin && <Link className="btn" href="/register">สมัครใช้งาน</Link>}
          </div>
        </section>
      </main>
    );
  }

  return children;
}
