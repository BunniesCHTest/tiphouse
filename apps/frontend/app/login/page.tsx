"use client";

import { FormEvent, Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Nav } from "@/components/Nav";
import { api } from "@/lib/api";
import { saveSession } from "@/lib/session";

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState("");
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

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      const { data } = await api.post("/auth/login", {
        email: form.get("email"),
        password: form.get("password"),
      });
      saveSession(data.user, data.tokens.accessToken);
      router.push(data.user.accountStatus === "APPROVED" ? "/dashboard" : "/settings/profile");
    } catch {
      setError("เข้าสู่ระบบไม่สำเร็จ");
    }
  }

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
        <p className="font-bold text-mint">Creator Login</p>
        <h1 className="mt-3 text-5xl font-black">เข้าสู่ระบบ TipHouse</h1>
        <form onSubmit={login} className="card mt-8 grid gap-4 p-5">
          <label>Email<input className="input mt-2" name="email" type="email" placeholder="creator@tiphouse.test" required /></label>
          <label>Password<input className="input mt-2" name="password" type="password" placeholder="password123" required /></label>
          {error && <p className="text-coral">{error}</p>}
          <button className="btn btn-primary" type="submit">Login</button>
          <a className="btn text-center" href="/forgot-password">ลืมรหัสผ่าน / Reset Password</a>
          <button className="btn" type="button" onClick={streamlabsLogin}>Login ผ่าน Streamlabs</button>
          {streamlabsMessage && <p className="text-gold">{streamlabsMessage}</p>}
        </form>
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
