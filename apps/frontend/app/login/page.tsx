"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Nav } from "@/components/Nav";
import { api } from "@/lib/api";
import { saveSession } from "@/lib/session";

function isLocalhost() {
  return typeof window !== "undefined" && ["127.0.0.1", "localhost"].includes(window.location.hostname);
}

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [streamlabsMessage, setStreamlabsMessage] = useState("");

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
      router.push("/dashboard");
    } catch {
      if (isLocalhost() && form.get("email") === "creator@tiphouse.test" && form.get("password") === "password123") {
        saveSession({ id: "local-creator", role: "USER" }, "local-creator-token");
        router.push("/dashboard");
        return;
      }
      setError("เข้าสู่ระบบไม่สำเร็จ");
    }
  }

  async function streamlabsLogin() {
    const { data } = await api.get("/auth/streamlabs");
    if (data.configured && data.url) {
      window.location.href = data.url;
      return;
    }
    setStreamlabsMessage("ยังไม่ได้ตั้งค่า Streamlabs OAuth ใน .env");
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
          <button className="btn" type="button" onClick={streamlabsLogin}>Login ผ่าน Streamlabs</button>
          {streamlabsMessage && <p className="text-gold">{streamlabsMessage}</p>}
        </form>
      </main>
    </>
  );
}
