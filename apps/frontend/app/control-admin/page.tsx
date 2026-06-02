"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AuthGate } from "@/components/AuthGate";
import { api, authHeaders } from "@/lib/api";
import { clearSession } from "@/lib/session";

type UserRow = {
  id: string;
  username: string;
  email: string;
  role: string;
  accountStatus: string;
  authProvider?: string;
  streamlabsUsername?: string | null;
  pendingEmail?: string | null;
  payout?: {
    accountName?: string | null;
    legalName?: string | null;
    phone?: string | null;
    contactEmail?: string | null;
    taxId?: string | null;
    address?: string | null;
    bankName?: string | null;
    branchName?: string | null;
    accountType?: string | null;
    accountNumber?: string | null;
    payoutMethod?: string | null;
    promptpayType?: string | null;
    promptpayId?: string | null;
    kycStatus?: string | null;
  } | null;
  page?: { slug: string; displayName: string; minAmount: number; goalAmount: number } | null;
  _count?: { donations: number; approvals: number };
};

type DonationRow = {
  id: string;
  donorName: string;
  message: string;
  amount: number;
  paymentStatus: string;
  transactionRef?: string | null;
  createdAt: string;
  paidAt?: string | null;
  user?: { id: string; username: string; email: string };
  page?: { slug: string; displayName: string };
};

type ApprovalRow = {
  id: string;
  type: string;
  status: string;
  requestedEmail?: string | null;
  createdAt: string;
  user: UserRow;
};

type AdminTab = "users" | "transactions" | "approvals";

const adminTabs: Array<[AdminTab, string]> = [
  ["users", "จัดการ User"],
  ["transactions", "Transaction โดเนท"],
];

const accountingTabs: Array<[AdminTab, string]> = [
  ["transactions", "Transaction โดเนท"],
];

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? value : [];
}

function isAuthError(error: unknown) {
  const status = (error as { response?: { status?: number } })?.response?.status;
  return status === 401 || status === 403;
}

function downloadExcel(rows: DonationRow[]) {
  const header = ["Creator", "Email", "Donor", "Amount", "Status", "Ref", "Message", "Created", "Paid"];
  const body = rows.map((row) => [
    row.user?.username ?? "",
    row.user?.email ?? "",
    row.donorName,
    row.amount,
    row.paymentStatus,
    row.transactionRef ?? "",
    row.message,
    row.createdAt,
    row.paidAt ?? "",
  ]);
  const html = `<table><tr>${header.map((h) => `<th>${h}</th>`).join("")}</tr>${body
    .map((r) => `<tr>${r.map((c) => `<td>${String(c).replaceAll("&", "&amp;").replaceAll("<", "&lt;")}</td>`).join("")}</tr>`)
    .join("")}</table>`;
  const blob = new Blob([html], { type: "application/vnd.ms-excel;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `tiphouse-transactions-${Date.now()}.xls`;
  link.click();
  URL.revokeObjectURL(url);
}

export default function AdminPage() {
  const router = useRouter();
  const [active, setActive] = useState<AdminTab>("users");
  const [role, setRole] = useState("");
  const [users, setUsers] = useState<UserRow[]>([]);
  const [transactions, setTransactions] = useState<DonationRow[]>([]);
  const [approvals, setApprovals] = useState<ApprovalRow[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserRow | null>(null);
  const [creatingUser, setCreatingUser] = useState(false);
  const [userTransactions, setUserTransactions] = useState<DonationRow[]>([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [message, setMessage] = useState("");
  const [createdPassword, setCreatedPassword] = useState("");

  const canManageUsers = role === "ADMIN";
  const tabs = canManageUsers ? adminTabs : accountingTabs;

  useEffect(() => {
    const storedRole = localStorage.getItem("tiphouse_role") ?? "";
    setRole(storedRole);
    if (storedRole === "ACCOUNTING") setActive("transactions");
  }, []);

  async function loadUsers() {
    try {
      const { data } = await api.get("/admin/users", { headers: authHeaders(), params: { q: query || undefined } });
      setUsers(asArray<UserRow>(data));
    } catch (error) {
      setUsers([]);
      if (isAuthError(error)) {
        setMessage("Session หมดอายุ กรุณา Login Admin ใหม่");
        clearSession();
        return;
      }
      setMessage("โหลดรายการ User ไม่สำเร็จ");
    }
  }

  async function loadTransactions() {
    try {
      const { data } = await api.get("/admin/transactions", {
        headers: authHeaders(),
        params: { q: query || undefined, status: status || undefined },
      });
      setTransactions(asArray<DonationRow>(data));
    } catch (error) {
      setTransactions([]);
      if (isAuthError(error)) {
        setMessage("Session หมดอายุ กรุณา Login Admin ใหม่");
        clearSession();
        return;
      }
      setMessage("โหลดรายการ transaction ไม่สำเร็จ");
    }
  }

  async function loadApprovals() {
    try {
      const { data } = await api.get("/admin/approvals", { headers: authHeaders(), params: { status: "PENDING" } });
      setApprovals(asArray<ApprovalRow>(data));
    } catch (error) {
      setApprovals([]);
      if (isAuthError(error)) {
        setMessage("Session หมดอายุ กรุณา Login Admin ใหม่");
        clearSession();
        return;
      }
      setMessage("โหลดรายการขออนุมัติไม่สำเร็จ");
    }
  }

  async function refresh() {
    setMessage("");
    if (active === "users" && canManageUsers) await loadUsers();
    if (active === "transactions") await loadTransactions();
    if (active === "approvals") await loadApprovals();
  }

  useEffect(() => {
    refresh().catch(() => setMessage("โหลดข้อมูลไม่สำเร็จ"));
  }, [active, canManageUsers]);

  async function createStaffUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setCreatedPassword("");
    const { data } = await api.post(
      "/admin/users",
      {
        username: form.get("username"),
        email: form.get("email"),
        role: form.get("role"),
      },
      { headers: authHeaders() },
    );
    setCreatedPassword(data.tempPassword);
    setMessage(`สร้าง ${data.user.role} สำเร็จ`);
    setCreatingUser(false);
    await loadUsers();
  }

  async function saveUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedUser) return;
    const form = new FormData(event.currentTarget);
    await api.patch(
      `/admin/users/${selectedUser.id}`,
      {
        username: form.get("username"),
        email: form.get("email"),
        role: form.get("role"),
        accountStatus: form.get("accountStatus"),
        page: {
          slug: form.get("slug"),
          displayName: form.get("displayName"),
          minAmount: Number(form.get("minAmount")),
          goalAmount: Number(form.get("goalAmount")),
        },
      },
      { headers: authHeaders() },
    );
    setMessage("บันทึกข้อมูล User สำเร็จ");
    setSelectedUser(null);
    await loadUsers();
  }

  async function resetPassword(user: UserRow) {
    setCreatedPassword("");
    const { data } = await api.post(`/admin/users/${user.id}/reset-password`, {}, { headers: authHeaders() });
    setCreatedPassword(data.tempPassword);
    setMessage(`Reset password ของ ${user.username} สำเร็จ`);
  }

  async function showUserHistory(user: UserRow) {
    setSelectedUser(user);
    try {
      const { data } = await api.get(`/admin/transactions/user/${user.id}`, { headers: authHeaders() });
      setUserTransactions(asArray<DonationRow>(data));
    } catch {
      setUserTransactions([]);
      setMessage("โหลดประวัติ transaction ไม่สำเร็จ");
    }
  }

  async function review(id: string, action: "approve" | "reject") {
    await api.post(`/admin/approvals/${id}/${action}`, {}, { headers: authHeaders() });
    setMessage(action === "approve" ? "อนุมัติคำขอแล้ว" : "ปฏิเสธคำขอแล้ว");
    await loadApprovals();
  }

  const totalRevenue = useMemo(() => transactions.reduce((sum, row) => sum + (row.paymentStatus === "PAID" ? row.amount : 0), 0), [transactions]);

  function logout() {
    clearSession();
    router.push("/control-admin/login");
  }

  return (
    <AuthGate admin>
      <main className="mx-auto w-[min(1400px,calc(100%-2rem))] py-10">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="mt-3 text-5xl font-black">TipHouse Admin</h1>
          </div>
          <button className="btn" type="button" onClick={logout}>Logout</button>
        </div>
        <nav className="mt-8 flex flex-wrap gap-2">
          {tabs.map(([key, label]) => (
            <button key={key} className={`btn ${active === key ? "btn-primary" : ""}`} onClick={() => setActive(key)} type="button">
              {label}
            </button>
          ))}
        </nav>

        <section className="mt-5 flex flex-wrap gap-3">
          <input className="input max-w-sm" placeholder="ค้นหา username, email, slug, ref" value={query} onChange={(event) => setQuery(event.target.value)} />
          {active === "transactions" && (
            <select className="input max-w-48" value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="">ทุกสถานะ</option>
              <option value="PENDING">PENDING</option>
              <option value="PAID">PAID</option>
              <option value="FAILED">FAILED</option>
              <option value="REFUNDED">REFUNDED</option>
              <option value="REVIEW">REVIEW</option>
            </select>
          )}
          <button className="btn" onClick={() => refresh().catch(() => setMessage("โหลดข้อมูลไม่สำเร็จ"))} type="button">ค้นหา</button>
          {active === "transactions" && <button className="btn" onClick={() => downloadExcel(transactions)} type="button">Export Excel</button>}
          {active === "users" && canManageUsers && <button className="btn btn-primary" onClick={() => setCreatingUser(true)} type="button">Add / Create User</button>}
        </section>
        {createdPassword && <p className="mt-4 rounded-lg border border-gold/30 bg-gold/10 p-3 text-gold">Temporary password: <strong>{createdPassword}</strong></p>}
        {message && <p className="mt-4 text-mint">{message}</p>}
        {message && (
          <div className="fixed bottom-5 right-5 z-50 max-w-sm rounded-lg border border-mint/30 bg-ink p-4 font-bold text-mint shadow-2xl">
            {message}
          </div>
        )}

        {active === "users" && canManageUsers && (
          <section className="card mt-5 overflow-auto p-4">
            <table className="w-full min-w-[1100px] text-left text-sm">
              <thead className="text-white/55">
                <tr><th>User</th><th>Email</th><th>Login</th><th>Status</th><th>Role</th><th>URL หน้าโดเนท</th><th></th></tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className="border-t border-white/10">
                    <td className="py-3 font-bold">{user.username}</td>
                    <td>{user.email}{user.pendingEmail && <span className="block text-gold">รออีเมล: {user.pendingEmail}</span>}</td>
                    <td>{user.authProvider ?? "Email"}{user.streamlabsUsername && <span className="block text-mint">@{user.streamlabsUsername}</span>}</td>
                    <td>{user.accountStatus}</td>
                    <td>{user.role}</td>
                    <td>/{user.page?.slug}</td>
                    <td className="flex gap-2 py-2">
                      <button className="btn" onClick={() => setSelectedUser(user)} type="button">แก้ไข</button>
                      <button className="btn" onClick={() => showUserHistory(user)} type="button">ประวัติ</button>
                      {(user.role === "ADMIN" || user.role === "ACCOUNTING") && <button className="btn" onClick={() => resetPassword(user)} type="button">Reset Password</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {active === "transactions" && (
          <section className="card mt-5 overflow-auto p-4">
            <div className="mb-4 text-white/70">ยอดโอนสำเร็จในรายการที่กรอง: <strong className="text-mint">฿{totalRevenue.toLocaleString()}</strong></div>
            <table className="w-full min-w-[1100px] text-left text-sm">
              <thead className="text-white/55">
                <tr><th>Creator</th><th>Donor</th><th>Amount</th><th>Status</th><th>Ref</th><th>Message</th><th>Created</th></tr>
              </thead>
              <tbody>
                {transactions.map((row) => (
                  <tr key={row.id} className="border-t border-white/10">
                    <td className="py-3"><button className="font-bold text-mint" onClick={() => row.user && showUserHistory({ ...row.user, role: "", accountStatus: "" })}>{row.user?.username}</button></td>
                    <td>{row.donorName}</td>
                    <td>฿{row.amount.toLocaleString()}</td>
                    <td>{row.paymentStatus}</td>
                    <td>{row.transactionRef}</td>
                    <td>{row.message}</td>
                    <td>{new Date(row.createdAt).toLocaleString("th-TH")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {active === "approvals" && (
          <section className="card mt-5 overflow-auto p-4">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="text-white/55">
                <tr><th>Type</th><th>User</th><th>Email</th><th>Requested Email</th><th>Status</th><th>Created</th><th></th></tr>
              </thead>
              <tbody>
                {approvals.map((row) => (
                  <tr key={row.id} className="border-t border-white/10">
                    <td className="py-3 font-bold">{row.type}</td>
                    <td>{row.user.username}</td>
                    <td>{row.user.email}</td>
                    <td>{row.requestedEmail ?? "-"}</td>
                    <td>{row.status}</td>
                    <td>{new Date(row.createdAt).toLocaleString("th-TH")}</td>
                    <td className="flex gap-2 py-2">
                      <button className="btn btn-primary" onClick={() => review(row.id, "approve")} type="button">อนุมัติ</button>
                      <button className="btn" onClick={() => review(row.id, "reject")} type="button">ปฏิเสธ</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {selectedUser && (
          <div className="fixed inset-0 z-40 overflow-auto bg-black/70 p-4">
            <section className="card mx-auto my-8 grid w-[min(980px,100%)] gap-5 p-5">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-3xl font-black">จัดการ {selectedUser.username}</h2>
                <button className="btn" onClick={() => setSelectedUser(null)} type="button">ปิด</button>
              </div>
              {selectedUser.email !== undefined && (
                <form onSubmit={saveUser} className="grid gap-4 md:grid-cols-2">
                  <label>Username<input className="input mt-2" name="username" defaultValue={selectedUser.username} required /></label>
                  <label>Email<input className="input mt-2" name="email" type="email" defaultValue={selectedUser.email} required /></label>
                  <label>Role<select className="input mt-2" name="role" defaultValue={selectedUser.role || "USER"}><option>USER</option><option>ADMIN</option><option>ACCOUNTING</option></select></label>
                  <label>Status<select className="input mt-2" name="accountStatus" defaultValue={selectedUser.accountStatus || "PENDING"}><option>PENDING</option><option>APPROVED</option><option>SUSPENDED</option></select></label>
                  <label>URL หน้าโดเนท<input className="input mt-2" name="slug" defaultValue={selectedUser.page?.slug ?? ""} /></label>
                  <label>ชื่อแสดงผล<input className="input mt-2" name="displayName" defaultValue={selectedUser.page?.displayName ?? ""} /></label>
                  <label>ยอดขั้นต่ำ<input className="input mt-2" name="minAmount" type="number" defaultValue={selectedUser.page?.minAmount ?? 20} /></label>
                  <label>Goal<input className="input mt-2" name="goalAmount" type="number" defaultValue={selectedUser.page?.goalAmount ?? 5000} /></label>
                  <button className="btn btn-primary md:col-span-2" type="submit">บันทึกข้อมูล User</button>
                </form>
              )}
              <div className="overflow-auto">
                <h3 className="mb-3 text-xl font-black">ประวัติ Transaction</h3>
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead className="text-white/55"><tr><th>Donor</th><th>Amount</th><th>Status</th><th>Ref</th><th>Created</th></tr></thead>
                  <tbody>
                    {userTransactions.map((row) => (
                      <tr key={row.id} className="border-t border-white/10">
                        <td className="py-2">{row.donorName}</td>
                        <td>฿{row.amount.toLocaleString()}</td>
                        <td>{row.paymentStatus}</td>
                        <td>{row.transactionRef}</td>
                        <td>{new Date(row.createdAt).toLocaleString("th-TH")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="draft-panel">
                <h3 className="text-xl font-black">ข้อมูลบัญชีโอนจ่าย</h3>
                {selectedUser.payout ? (
                  <dl className="mt-4 grid gap-3 md:grid-cols-2">
                    {[
                      ["ชื่อบัญชี", selectedUser.payout.accountName],
                      ["ชื่อนิติ/ชื่อจริง", selectedUser.payout.legalName],
                      ["เบอร์โทร", selectedUser.payout.phone],
                      ["อีเมลติดต่อ", selectedUser.payout.contactEmail],
                      ["เลขผู้เสียภาษี/บัตรประชาชน", selectedUser.payout.taxId],
                      ["ธนาคาร", selectedUser.payout.bankName],
                      ["สาขา", selectedUser.payout.branchName],
                      ["ประเภทบัญชี", selectedUser.payout.accountType],
                      ["เลขบัญชี", selectedUser.payout.accountNumber],
                      ["วิธีโอนจ่าย", selectedUser.payout.payoutMethod],
                      ["ประเภทพร้อมเพย์", selectedUser.payout.promptpayType],
                      ["พร้อมเพย์", selectedUser.payout.promptpayId],
                      ["สถานะ KYC", selectedUser.payout.kycStatus],
                      ["ที่อยู่", selectedUser.payout.address],
                    ].map(([label, value]) => (
                      <div key={label} className="rounded-lg border border-white/10 bg-white/5 p-3">
                        <dt className="text-sm text-white/55">{label}</dt>
                        <dd className="mt-1 font-bold">{value || "-"}</dd>
                      </div>
                    ))}
                  </dl>
                ) : <p className="mt-3 text-white/55">ยังไม่มีข้อมูลบัญชีโอนจ่ายของ User นี้</p>}
              </div>
            </section>
          </div>
        )}

        {creatingUser && (
          <div className="fixed inset-0 z-40 grid place-items-center bg-black/70 p-4">
            <form onSubmit={createStaffUser} className="card grid w-[min(520px,100%)] gap-4 p-5">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-3xl font-black">Create User</h2>
                <button className="btn" type="button" onClick={() => setCreatingUser(false)}>ปิด</button>
              </div>
              <label>User<input className="input mt-2" name="username" required /></label>
              <label>Email<input className="input mt-2" name="email" type="email" required /></label>
              <label>Role<select className="input mt-2" name="role" defaultValue="ADMIN"><option value="ADMIN">Admin</option><option value="ACCOUNTING">Accounting</option></select></label>
              <p className="text-sm text-white/60">ระบบจะสร้างรหัสผ่านชั่วคราวให้หลังบันทึก</p>
              <button className="btn btn-primary" type="submit">Create</button>
            </form>
          </div>
        )}
      </main>
    </AuthGate>
  );
}
