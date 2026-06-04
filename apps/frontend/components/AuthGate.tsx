"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { clearSession, getSession } from "@/lib/session";

const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000;
const LAST_ACTIVITY_KEY = "tiphouse_last_activity";

function AppSkeleton() {
  return (
    <main className="min-h-screen px-4 py-8">
      <section className="mx-auto grid w-[min(1200px,100%)] gap-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="h-12 w-64 animate-pulse rounded-2xl bg-white/10" />
          <div className="flex gap-2">
            <div className="h-10 w-24 animate-pulse rounded-xl bg-white/10" />
            <div className="h-10 w-24 animate-pulse rounded-xl bg-white/10" />
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => <div key={index} className="h-28 animate-pulse rounded-2xl bg-white/10" />)}
        </div>
        <div className="h-80 animate-pulse rounded-2xl bg-white/10" />
        <div className="grid gap-3">
          {Array.from({ length: 5 }, (_, index) => <div key={index} className="h-14 animate-pulse rounded-xl bg-white/10" />)}
        </div>
      </section>
    </main>
  );
}

export function AuthGate({ children, admin = false, allowPending = false }: { children: React.ReactNode; admin?: boolean; allowPending?: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const [allowed, setAllowed] = useState(false);
  const [pendingApproval, setPendingApproval] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    const session = getSession(admin ? "admin" : "user");
    const token = session.accessToken;
    const role = session.role;
    const accountStatus = session.accountStatus;
    const creatorSetupCompleted = session.creatorSetupCompleted;
    const isAllowedRole = Boolean(token) && (admin ? role === "ADMIN" || role === "ACCOUNTING" : role === "USER");
    const isApproved = admin || allowPending || accountStatus === "APPROVED";
    if (token && !admin && role === "USER" && !creatorSetupCompleted && pathname !== "/onboarding") {
      router.replace("/onboarding");
      return;
    }
    setAllowed(isAllowedRole && isApproved);
    setPendingApproval(Boolean(token) && isAllowedRole && !isApproved);
    setChecked(true);
  }, [admin, allowPending, pathname, router]);

  useEffect(() => {
    if (!allowed) return;
    const loginPath = admin ? "/control-admin/login" : "/login";
    const touch = () => localStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now()));
    const verify = () => {
      const lastActivity = Number(localStorage.getItem(LAST_ACTIVITY_KEY) || Date.now());
      if (Date.now() - lastActivity >= INACTIVITY_TIMEOUT_MS) {
        clearSession(admin ? "admin" : "user");
        localStorage.removeItem(LAST_ACTIVITY_KEY);
        router.replace(loginPath);
      }
    };
    touch();
    const events = ["click", "keydown", "mousemove", "scroll", "touchstart"];
    events.forEach((eventName) => window.addEventListener(eventName, touch, { passive: true }));
    const timer = window.setInterval(verify, 30_000);
    return () => {
      events.forEach((eventName) => window.removeEventListener(eventName, touch));
      window.clearInterval(timer);
    };
  }, [admin, allowed, router]);

  if (!checked) return <AppSkeleton />;

  if (!allowed) {
    if (pendingApproval) {
      return (
        <main className="grid min-h-screen place-items-center px-4 text-center">
          <section className="card max-w-lg p-6">
            <h1 className="text-3xl font-black">รอ Admin อนุมัติบัญชี</h1>
            <p className="mt-3 text-white/65">บัญชีนี้สมัครสำเร็จแล้ว แต่ยังไม่สามารถใช้งานระบบโดเนทและตั้งค่าต่าง ๆ ได้จนกว่า Admin จะอนุมัติ</p>
            <div className="mt-5 flex flex-wrap justify-center gap-3">
              <Link className="btn btn-primary" href="/settings/profile">ดูสถานะโปรไฟล์</Link>
              <Link className="btn" href="/">กลับหน้าแรก</Link>
            </div>
          </section>
        </main>
      );
    }
    return (
      <main className="grid min-h-screen place-items-center px-4 text-center">
        <section className="card max-w-md p-6">
          <h1 className="text-3xl font-black">กรุณาเข้าสู่ระบบก่อน</h1>
          <p className="mt-3 text-white/65">ต้องเข้าสู่ระบบผ่าน Streamlabs ก่อนถึงจะใช้หน้าจัดการของ TipHouse ได้</p>
          <div className="mt-5 flex justify-center gap-3">
            <Link className="btn btn-primary" href={admin ? "/control-admin/login" : "/login"}>Login</Link>
          </div>
        </section>
      </main>
    );
  }

  return children;
}
