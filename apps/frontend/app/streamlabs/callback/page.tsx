"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { saveSession } from "@/lib/session";

export default function StreamlabsCallbackPage() {
  const router = useRouter();
  const [message, setMessage] = useState("กำลังเข้าสู่ระบบผ่าน Streamlabs...");

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
    router.replace(accountStatus === "APPROVED" ? "/dashboard" : "/settings/profile");
  }, [router]);

  return <main className="grid min-h-screen place-items-center text-center">{message}</main>;
}
