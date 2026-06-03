"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, authHeaders } from "@/lib/api";
import { clearSession, getSession, setSessionValue, userCacheKey } from "@/lib/session";
import { useAppPreferences } from "@/lib/app-preferences";

export function Nav({ publicOnly = false }: { publicOnly?: boolean }) {
  const router = useRouter();
  const { language, theme, toggleLanguage, toggleTheme, t } = useAppPreferences();
  const [loggedIn, setLoggedIn] = useState(false);
  const [role, setRole] = useState("");
  const [approved, setApproved] = useState(false);
  const [donationSlug, setDonationSlug] = useState("bunniesch");

  useEffect(() => {
    const session = getSession("user");
    const token = session.accessToken;
    const storedRole = session.role;
    const storedStatus = session.accountStatus;
    const storedSetupCompleted = session.creatorSetupCompleted;
    setLoggedIn(Boolean(token));
    setRole(storedRole);
    setApproved(storedRole === "ADMIN" || (storedStatus === "APPROVED" && storedSetupCompleted));

    const cached = localStorage.getItem(userCacheKey("donation_slug"));
    if (cached) setDonationSlug(cached);

    if (token) {
      api.get("/settings/profile", { headers: authHeaders() }).then((res) => {
        const nextRole = res.data?.role ?? storedRole;
        const nextStatus = res.data?.accountStatus ?? storedStatus;
        const nextSlug = res.data?.page?.slug;
        const creatorSetupCompleted = Boolean(res.data?.creatorSetupCompleted);
        setSessionValue("user", "role", nextRole);
        setSessionValue("user", "account_status", nextStatus);
        setSessionValue("user", "creator_setup_completed", creatorSetupCompleted ? "true" : "false");
        setRole(nextRole);
        setApproved(nextRole === "ADMIN" || (nextStatus === "APPROVED" && creatorSetupCompleted));
        if (nextSlug) {
          setDonationSlug(nextSlug);
          localStorage.setItem(userCacheKey("donation_slug"), nextSlug);
        }
      }).catch(() => undefined);
    }

    const onPageUpdated = (event: Event) => {
      const detail = (event as CustomEvent<{ slug?: string }>).detail;
      if (detail?.slug) setDonationSlug(detail.slug);
    };
    window.addEventListener("tiphouse:page-updated", onPageUpdated);
    return () => window.removeEventListener("tiphouse:page-updated", onPageUpdated);
  }, []);

  function logout() {
    clearSession("user");
    setLoggedIn(false);
    setRole("");
    setApproved(false);
    router.push("/");
  }

  const showPublicMenu = !loggedIn || publicOnly;
  const showAppMenu = loggedIn && !publicOnly;

  return (
    <header className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-ink/80 px-5 py-4 backdrop-blur">
      <Link href={loggedIn ? (approved ? "/dashboard" : "/settings/profile") : "/"} className="flex items-center gap-3 font-extrabold">
        <span className="grid size-9 place-items-center rounded-lg bg-gradient-to-br from-mint to-coral text-ink">TH</span>
        <span>TipHouse</span>
      </Link>
      <nav className="flex flex-wrap gap-2 text-sm text-white/70">
        {showPublicMenu && <Link className="btn min-h-9 px-3 py-1" href="/">{t("หน้าแรก", "Home")}</Link>}
        {showPublicMenu && <Link className="btn min-h-9 px-3 py-1" href="/login">Login</Link>}
        {showAppMenu && approved && <Link className="btn min-h-9 px-3 py-1" href={`/${donationSlug}`} target="_blank" rel="noopener">{t("หน้าโดเนท", "Donation Page")}</Link>}
        {showAppMenu && approved && <Link className="btn min-h-9 px-3 py-1" href="/dashboard">Dashboard</Link>}
        {showAppMenu && <Link className="btn min-h-9 px-3 py-1" href="/settings/profile">{t("จัดการโปรไฟล์", "Profile")}</Link>}
        {showAppMenu && approved && <Link className="btn min-h-9 px-3 py-1" href="/settings/bank">{t("ข้อมูลบัญชีโอนจ่าย", "Payout Account")}</Link>}
        {showAppMenu && approved && <Link className="btn min-h-9 px-3 py-1" href="/settings/donation-page">{t("ตั้งค่าหน้าโดเนท", "Donation Settings")}</Link>}
        {showAppMenu && approved && <Link className="btn min-h-9 px-3 py-1" href="/settings/overlay">{t("ตั้งค่า Overlay", "Overlay Settings")}</Link>}
        {showAppMenu && <button className="btn min-h-9 px-3 py-1" type="button" onClick={logout}>Logout</button>}
        <button className="btn btn-danger min-h-9 px-3 py-1" type="button" onClick={toggleLanguage}>{language === "th" ? "TH/ENG" : "ENG/TH"}</button>
        <button className="btn btn-danger min-h-9 px-3 py-1" type="button" onClick={toggleTheme}>{theme === "dark" ? "Light" : "Dark"}</button>
      </nav>
    </header>
  );
}
