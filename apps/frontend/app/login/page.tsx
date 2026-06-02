"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Nav } from "@/components/Nav";
import { api } from "@/lib/api";
import { useAppPreferences } from "@/lib/app-preferences";

function LoginContent() {
  const searchParams = useSearchParams();
  const { t } = useAppPreferences();
  const [streamlabsMessage, setStreamlabsMessage] = useState("");

  useEffect(() => {
    if (searchParams.get("streamlabs") !== "failed") return;
    const reason = searchParams.get("reason") ?? "unknown";
    const messages: Record<string, string> = {
      token_exchange: "Streamlabs login ไม่สำเร็จ: ตรวจสอบ STREAMLABS_CLIENT_ID, STREAMLABS_CLIENT_SECRET และ Redirect URI ให้ตรงกับ Streamlabs App",
      user_lookup: "Streamlabs login ไม่สำเร็จ: ได้ token แล้วแต่ดึงข้อมูลบัญชีไม่ได้ กรุณาตรวจ scope และสิทธิ์ของแอป",
      invalid_state: "Streamlabs login ไม่สำเร็จ: session สำหรับ OAuth หมดอายุ กรุณาลอง Login ใหม่",
      missing_code: "Streamlabs login ไม่สำเร็จ: Streamlabs ไม่ส่ง authorization code กลับมา",
      unknown: "Streamlabs login ไม่สำเร็จ กรุณาตรวจ backend logs และค่า env ของ Streamlabs",
    };
    setStreamlabsMessage(messages[reason] ?? messages.unknown);
  }, [searchParams]);

  async function streamlabsLogin() {
    try {
      const { data } = await api.get("/auth/streamlabs");
      if (data.configured && data.url) {
        window.location.href = data.url;
        return;
      }
      const missing = Array.isArray(data.missing) && data.missing.length ? ` ขาด: ${data.missing.join(", ")}` : "";
      setStreamlabsMessage(`ยังไม่ได้ตั้งค่า Streamlabs OAuth ในระบบ production.${missing}`);
    } catch {
      setStreamlabsMessage("เชื่อมต่อ backend เพื่อเริ่ม Streamlabs login ไม่สำเร็จ");
    }
  }

  return (
    <>
      <Nav publicOnly />
      <main className="mx-auto w-[min(760px,calc(100%-2rem))] py-10">
        <p className="font-bold text-mint">{t("เข้าสู่ระบบ Creator", "Creator Login")}</p>
        <h1 className="mt-3 text-5xl font-black">{t("เข้าสู่ระบบด้วย Streamlabs", "Sign in with Streamlabs")}</h1>
        <section className="card mt-8 grid gap-4 p-5">
          <p className="leading-7 text-white/65">{t("TipHouse ใช้ Streamlabs Login สำหรับ Creator เท่านั้น เพื่อเชื่อม Alert Box, Tips และ Variation จากบัญชี Streamlabs ของคุณ", "TipHouse uses Streamlabs Login for creators, connecting your Alert Box, Tips, and variations from your Streamlabs account.")}</p>
          <button className="btn btn-primary" type="button" onClick={streamlabsLogin}>{t("Login ผ่าน Streamlabs", "Login with Streamlabs")}</button>
          {streamlabsMessage && <p className="text-gold">{streamlabsMessage}</p>}
        </section>
      </main>
    </>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<main className="grid min-h-screen place-items-center">Loading...</main>}>
      <LoginContent />
    </Suspense>
  );
}
