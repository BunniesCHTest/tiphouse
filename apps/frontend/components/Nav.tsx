"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, authHeaders } from "@/lib/api";
import { clearSession, userCacheKey } from "@/lib/session";

export function Nav({ publicOnly = false }: { publicOnly?: boolean }) {
  const router = useRouter();
  const [loggedIn, setLoggedIn] = useState(false);
  const [role, setRole] = useState("");
  const [donationSlug, setDonationSlug] = useState("bunniesch");

  useEffect(() => {
    setLoggedIn(Boolean(localStorage.getItem("tiphouse_access_token")));
    setRole(localStorage.getItem("tiphouse_role") ?? "");
    const cached = localStorage.getItem(userCacheKey("donation_slug"));
    if (cached) setDonationSlug(cached);
    api.get("/dashboard", { headers: authHeaders() }).then((res) => {
      if (res.data?.page?.slug) {
        setDonationSlug(res.data.page.slug);
        localStorage.setItem(userCacheKey("donation_slug"), res.data.page.slug);
      }
    }).catch(() => undefined);

    const onPageUpdated = (event: Event) => {
      const detail = (event as CustomEvent<{ slug?: string }>).detail;
      if (detail?.slug) setDonationSlug(detail.slug);
    };
    window.addEventListener("tiphouse:page-updated", onPageUpdated);
    return () => window.removeEventListener("tiphouse:page-updated", onPageUpdated);
  }, []);

  function logout() {
    clearSession();
    setLoggedIn(false);
    setRole("");
    router.push("/");
  }

  return (
    <header className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-ink/80 px-5 py-4 backdrop-blur">
      <Link href="/" className="flex items-center gap-3 font-extrabold">
        <span className="grid size-9 place-items-center rounded-lg bg-gradient-to-br from-mint to-coral text-ink">TH</span>
        <span>TipHouse</span>
      </Link>
      <nav className="flex flex-wrap gap-2 text-sm text-white/70">
        <Link className="btn min-h-9 px-3 py-1" href="/">หน้าแรก</Link>
        {loggedIn && !publicOnly && (
          <Link className="btn min-h-9 px-3 py-1" href={`/${donationSlug}`} target="_blank" rel="noopener">
            หน้าโดเนท
          </Link>
        )}
        {(!loggedIn || publicOnly) && <Link className="btn min-h-9 px-3 py-1" href="/register">สมัครใช้งาน</Link>}
        {(!loggedIn || publicOnly) && <Link className="btn min-h-9 px-3 py-1" href="/login">Login</Link>}
        {loggedIn && !publicOnly && <Link className="btn min-h-9 px-3 py-1" href="/dashboard">Dashboard</Link>}
        {loggedIn && !publicOnly && <Link className="btn min-h-9 px-3 py-1" href="/settings/profile">จัดการโปรไฟล์</Link>}
        {loggedIn && !publicOnly && <Link className="btn min-h-9 px-3 py-1" href="/settings/bank">บัญชีรับเงิน</Link>}
        {loggedIn && !publicOnly && <Link className="btn min-h-9 px-3 py-1" href="/settings/donation-page">ตั้งค่าหน้าโดเนท</Link>}
        {loggedIn && !publicOnly && <Link className="btn min-h-9 px-3 py-1" href="/settings/overlay">ตั้งค่า Overlay</Link>}
        {loggedIn && !publicOnly && <button className="btn min-h-9 px-3 py-1" type="button" onClick={logout}>Logout</button>}
        {loggedIn && !publicOnly && role === "ADMIN" && <Link className="btn min-h-9 px-3 py-1" href="/control-admin">Admin</Link>}
      </nav>
    </header>
  );
}
