"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { saveSession } from "@/lib/session";

const STREAMLABS_DASHBOARD_URL = "https://streamlabs.com/dashboard";

export default function StreamlabsCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const code = searchParams.get("code");
    window.history.replaceState(null, "", "/streamlabs/callback");

    if (!code) {
      router.replace("/login?streamlabs=failed&reason=missing_code");
      return;
    }

    api.post("/auth/streamlabs/exchange", { code }).then(({ data }) => {
      const user = data.user;
      const accessToken = data.tokens?.accessToken;
      if (!user?.id || !accessToken) throw new Error("invalid streamlabs session");
      saveSession(user, accessToken, "user");
      window.open(STREAMLABS_DASHBOARD_URL, "_blank", "noopener,noreferrer");
      const needsOnboarding = !user.creatorSetupCompleted || String(user.username ?? "").startsWith("streamlabs-");
      router.replace(needsOnboarding ? "/onboarding" : user.accountStatus === "APPROVED" ? "/dashboard?streamlabs=connected" : "/settings/profile");
    }).catch(() => {
      router.replace("/login?streamlabs=failed&reason=exchange_expired");
    });
  }, [router]);

  return null;
}
