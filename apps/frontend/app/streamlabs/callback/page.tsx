"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { saveSession } from "@/lib/session";

const STREAMLABS_DASHBOARD_URL = "https://streamlabs.com/dashboard";

export default function StreamlabsCallbackPage() {
  const router = useRouter();
  const [message, setMessage] = useState("กำลังเชื่อมต่อ Streamlabs และเข้าสู่ระบบ TipHouse...");

  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const accessToken = params.get("accessToken");
    const id = params.get("id");
    const role = params.get("role") ?? "USER";
    const accountStatus = params.get("accountStatus") ?? "APPROVED";

    if (!accessToken || !id) {
      setMessage("Login ผ่าน Streamlabs ไม่สำเร็จ");
      window.setTimeout(() => router.replace("/login?streamlabs=failed"), 1200);
      return;
    }

    saveSession({ id, role, accountStatus }, accessToken);

    // Browsers may block this because the OAuth callback is not a direct click,
    // so the page also shows a manual link below while redirecting to TipHouse.
    window.open(STREAMLABS_DASHBOARD_URL, "_blank", "noopener,noreferrer");
    setMessage("เชื่อมต่อสำเร็จ กำลังพาไป Dashboard ของ TipHouse...");
    window.setTimeout(() => {
      router.replace(accountStatus === "APPROVED" ? "/dashboard?streamlabs=connected" : "/settings/profile");
    }, 800);
  }, [router]);

  return (
    <main className="grid min-h-screen place-items-center px-4 text-center">
      <section className="card max-w-lg p-6">
        <span className="badge">Streamlabs Connected</span>
        <h1 className="mt-4 text-3xl font-black">TipHouse</h1>
        <p className="mt-3 text-white/70">{message}</p>
        <a className="btn mt-5" href={STREAMLABS_DASHBOARD_URL} target="_blank" rel="noreferrer">
          เปิด Streamlabs Dashboard
        </a>
      </section>
    </main>
  );
}
