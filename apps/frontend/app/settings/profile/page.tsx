"use client";

import { FormEvent, useEffect, useState } from "react";
import { AxiosError } from "axios";
import { AuthGate } from "@/components/AuthGate";
import { Nav } from "@/components/Nav";
import { api, authHeaders } from "@/lib/api";
import { useAppPreferences } from "@/lib/app-preferences";

type Profile = {
  username: string;
  email: string;
  donationNotificationEmail?: string | null;
  accountStatus: string;
  role: string;
  approvals?: ApprovalRequest[];
};

type ApprovalRequest = {
  id: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  requestedEmail?: string | null;
  note?: string | null;
  createdAt: string;
  reviewedAt?: string | null;
};

function approvalDetails(row?: ApprovalRequest | null) {
  try {
    return row?.note ? JSON.parse(row.note) as Record<string, string> : {};
  } catch {
    return {};
  }
}

function getErrorMessage(error: unknown) {
  if (error instanceof AxiosError) {
    const message = error.response?.data?.message;
    if (typeof message === "string") return message;
    if (Array.isArray(message)) return message.join(", ");
  }
  return "ส่งคำขอเปลี่ยนแปลงไม่สำเร็จ กรุณาตรวจสอบข้อมูลอีกครั้ง";
}

export default function ProfileSettingsPage() {
  const { t } = useAppPreferences();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [reviewPopup, setReviewPopup] = useState<ApprovalRequest | null>(null);

  async function load() {
    const { data } = await api.get("/settings/profile", { headers: authHeaders() });
    setProfile(data);
    setUsername(data?.username ?? "");
    setEmail(data?.donationNotificationEmail ?? (data?.email?.endsWith("@tiphouse.local") ? "" : data?.email ?? ""));
    if (data?.accountStatus) localStorage.setItem("tiphouse_account_status", data.accountStatus);
    const latestReviewed = data?.approvals?.find((item: ApprovalRequest) => item.status === "APPROVED" || item.status === "REJECTED");
    if (latestReviewed) {
      const seenKey = `tiphouse_profile_approval_seen:${latestReviewed.id}:${latestReviewed.status}`;
      if (!localStorage.getItem(seenKey)) setReviewPopup(latestReviewed);
    }
  }

  useEffect(() => {
    load().catch(() => setError(t("โหลดข้อมูลโปรไฟล์ไม่สำเร็จ", "Could not load profile.")));
  }, []);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setError("");
    try {
      await api.patch("/settings/profile", { username: username.trim(), email: email.trim() }, { headers: authHeaders() });
      await load();
      setMessage(t("ส่งคำขอเปลี่ยนแปลงแล้ว กรุณารอ Admin อนุมัติก่อนข้อมูลจึงจะถูกเปลี่ยนแปลง", "Change request sent. An admin must approve it before the profile is updated."));
    } catch (caught) {
      setError(getErrorMessage(caught));
    }
  }

  return (
    <AuthGate allowPending>
      <Nav />
      <main className="mx-auto w-[min(860px,calc(100%-2rem))] py-10">
        {reviewPopup && (
          <div className="fixed inset-0 z-40 grid place-items-center bg-black/60 px-4">
            <section className="card max-w-lg p-6">
              <h2 className="text-3xl font-black">
                {reviewPopup.status === "APPROVED" ? "คำขอของคุณได้รับการอนุมัติแล้ว" : "คำร้องขอของคุณถูกปฏิเสธ"}
              </h2>
              {(() => {
                const detail = approvalDetails(reviewPopup);
                const oldUsername = detail.oldUsername || profile?.username || "-";
                const oldEmail = detail.oldEmail || profile?.donationNotificationEmail || profile?.email || "-";
                const newUsername = detail.newUsername || "-";
                const newEmail = detail.newEmail || reviewPopup.requestedEmail || "-";
                const hasDetail = Boolean(detail.oldUsername || detail.oldEmail || detail.newUsername || detail.newEmail || reviewPopup.requestedEmail);
                return (
                  <div className="mt-4 grid gap-3 text-sm">
                    <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                      <div className="text-white/55">ข้อมูลเก่า</div>
                      <div className="mt-1 font-bold">Username: {oldUsername}<br />Email: {oldEmail}</div>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                      <div className="text-white/55">ข้อมูลใหม่</div>
                      <div className="mt-1 font-bold">Username: {newUsername}<br />Email: {newEmail}</div>
                    </div>
                    {!hasDetail && <p className="text-white/55">คำขอนี้เป็นข้อมูลเดิมที่ไม่มีรายละเอียดการเปลี่ยนแปลงในระบบ</p>}
                  </div>
                );
              })()}
              <button
                className="btn btn-primary mt-5 w-full"
                type="button"
                onClick={() => {
                  localStorage.setItem(`tiphouse_profile_approval_seen:${reviewPopup.id}:${reviewPopup.status}`, "1");
                  setReviewPopup(null);
                }}
              >
                ปิด
              </button>
            </section>
          </div>
        )}
        <p className="font-bold text-mint">Account Profile</p>
        <h1 className="mt-3 text-5xl font-black">{t("จัดการโปรไฟล์", "Profile Management")}</h1>
        <section className="card mt-8 p-5">
          {profile && (
            <form onSubmit={save} className="grid gap-4">
              <label>
                Username
                <input className="input mt-2" value={username} onChange={(event) => setUsername(event.target.value.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 20))} required />
                <span className="mt-2 block text-sm text-white/60">4-20 ตัวอักษร ใช้ตัวพิมพ์เล็กและตัวเลขเท่านั้น</span>
              </label>
              <label>
                Email
                <input className="input mt-2" name="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
                <span className="mt-2 block text-sm text-white/60">{t("ใช้รับการติดต่อจาก TipHouse เท่านั้น", "Used only for TipHouse contact.")}</span>
              </label>
              <p className="rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-white/65">
                การเปลี่ยน Username หรือ Email จะยังไม่เปลี่ยนทันที ต้องได้รับการอนุมัติจาก Admin ก่อน
              </p>
              {profile.approvals?.some((item) => item.status === "PENDING") && (
                <p className="rounded-xl border border-gold/30 bg-gold/10 p-3 text-sm font-bold text-gold">
                  อยู่ระหว่างการพิจารณาคำร้องขอ
                </p>
              )}
              {profile.approvals?.[0]?.status === "REJECTED" && (
                <p className="rounded-xl border border-coral/30 bg-coral/10 p-3 text-sm font-bold text-coral">
                  คำร้องขอของคุณถูกปฏิเสธ
                </p>
              )}
              {message && <p className="text-mint">{message}</p>}
              {error && <p className="text-coral">{error}</p>}
              <button className="btn btn-primary" type="submit">{t("ส่งคำขอเปลี่ยนแปลง", "Submit Change Request")}</button>
            </form>
          )}
        </section>
      </main>
    </AuthGate>
  );
}
