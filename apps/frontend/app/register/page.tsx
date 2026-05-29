"use client";

import { FormEvent, useState } from "react";
import { AxiosError } from "axios";
import { useRouter } from "next/navigation";
import { Nav } from "@/components/Nav";
import { api } from "@/lib/api";
import { saveSession } from "@/lib/session";

function errorMessage(error: unknown) {
  if (error instanceof AxiosError) {
    const message = error.response?.data?.message;
    if (Array.isArray(message)) return message.join(", ");
    if (typeof message === "string") return message;
  }
  return "สมัครไม่สำเร็จ กรุณาตรวจสอบข้อมูลอีกครั้ง";
}

export default function RegisterPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");
    const form = new FormData(event.currentTarget);
    try {
      const { data } = await api.post("/auth/register", Object.fromEntries(form));
      saveSession(data.user, data.tokens.accessToken);
      setSuccess("สมัครใช้งานสำเร็จแล้ว รอ Admin อนุมัติก่อนจึงจะเปิดรับโดเนทได้");
      setTimeout(() => router.push("/settings/profile"), 900);
    } catch (caught) {
      setError(errorMessage(caught));
    }
  }

  return (
    <>
      <Nav publicOnly />
      <main className="mx-auto w-[min(900px,calc(100%-2rem))] py-10">
        <p className="font-bold text-mint">Create Account</p>
        <h1 className="mt-3 text-5xl font-black">สมัครใช้งาน TipHouse</h1>
        <form onSubmit={submit} className="card mt-8 grid gap-4 p-5">
          <label>ชื่อช่อง<input className="input mt-2" name="displayName" placeholder="เช่น TestBunny" required /></label>
          <label>Username<input className="input mt-2" name="username" placeholder="เช่น testbunny" required /></label>
          <label>Email<input className="input mt-2" name="email" type="email" placeholder="you@example.com" required /></label>
          <label>Password<input className="input mt-2" name="password" type="password" placeholder="อย่างน้อย 8 ตัว มี A-Z, ตัวเลข, อักขระพิเศษ" pattern="^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$" title="ต้องมีอย่างน้อย 8 ตัวอักษร ตัวพิมพ์ใหญ่ ตัวเลข และอักขระพิเศษ" required /></label>
          <label>URL หน้าโดเนท<input className="input mt-2" name="slug" placeholder="เช่น testbunny หรือ my-channel" required /></label>
          {error && <p className="text-coral">{error}</p>}
          {success && <p className="text-mint">{success}</p>}
          <button className="btn btn-primary" type="submit">สมัครใช้งาน</button>
        </form>
      </main>
    </>
  );
}
