"use client";

import { useEffect, useState } from "react";
import { AuthGate } from "@/components/AuthGate";
import { api, authHeaders } from "@/lib/api";

export default function AdminPage() {
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    api.get("/admin/overview", { headers: authHeaders() }).then((res) => setData(res.data)).catch(() => setData(null));
  }, []);

  return (
    <AuthGate admin>
      <main className="mx-auto w-[min(1200px,calc(100%-2rem))] py-10">
        <p className="font-bold text-mint">Admin Only</p>
        <h1 className="mt-3 text-5xl font-black">Admin Dashboard</h1>
        <section className="mt-8 grid gap-4 md:grid-cols-3">
          <div className="card p-5"><strong className="block text-3xl">{data?.users ?? 0}</strong><span className="text-white/60">Users</span></div>
          <div className="card p-5"><strong className="block text-3xl">{data?.donations?.length ?? 0}</strong><span className="text-white/60">Donation audits</span></div>
          <div className="card p-5"><strong className="block text-3xl">{data?.webhookLogs?.length ?? 0}</strong><span className="text-white/60">Webhook logs</span></div>
        </section>
        <section className="card mt-5 overflow-auto p-5">
          <h2 className="mb-4 text-2xl font-black">จัดการและตรวจสอบข้อมูลผู้ใช้งาน</h2>
          <pre className="max-h-[520px] overflow-auto rounded-lg bg-black/30 p-4 text-sm text-white/75">
            {JSON.stringify(data ?? { status: "login แล้ว แต่ backend/database ยังไม่พร้อมหรือยังไม่มีข้อมูล" }, null, 2)}
          </pre>
        </section>
      </main>
    </AuthGate>
  );
}
