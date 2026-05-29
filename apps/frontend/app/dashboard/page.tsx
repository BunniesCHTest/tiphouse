"use client";

import { useEffect, useState } from "react";
import { AuthGate } from "@/components/AuthGate";
import { Nav } from "@/components/Nav";
import { api, authHeaders } from "@/lib/api";

export default function DashboardPage() {
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    api.get("/dashboard", { headers: authHeaders() }).then((res) => setData(res.data)).catch(() => setData(null));
  }, []);

  return (
    <AuthGate>
      <Nav />
      <main className="mx-auto w-[min(1200px,calc(100%-2rem))] py-10">
        <p className="font-bold text-mint">User Dashboard</p>
        <h1 className="mt-3 text-5xl font-black">Dashboard</h1>
        <section className="mt-8 grid gap-4 md:grid-cols-4">
          <div className="card p-5"><strong className="block text-3xl">฿{data?.revenue ?? 0}</strong><span className="text-white/60">Revenue</span></div>
          <div className="card p-5"><strong className="block text-3xl">{data?.donationCount ?? 0}</strong><span className="text-white/60">Donations</span></div>
          <div className="card p-5"><strong className="block text-3xl">฿{data?.page?.minAmount ?? 0}</strong><span className="text-white/60">Minimum tip</span></div>
          <div className="card p-5"><strong className="block text-3xl">/{data?.page?.slug ?? "-"}</strong><span className="text-white/60">Page slug</span></div>
        </section>
        <section className="card mt-5 overflow-auto p-5">
          <h2 className="mb-4 text-2xl font-black">Donation History</h2>
          <table className="w-full text-left">
            <thead className="text-white/60"><tr><th className="p-2">Donor</th><th>Amount</th><th>Status</th><th>Message</th></tr></thead>
            <tbody>
              {(data?.donations ?? []).map((item: any) => (
                <tr key={item.id} className="border-t border-white/10">
                  <td className="p-2">{item.anonymous ? "Anonymous" : item.donorName}</td>
                  <td>฿{item.amount}</td>
                  <td><span className="badge">{item.paymentStatus}</span></td>
                  <td>{item.message}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </main>
    </AuthGate>
  );
}
