"use client";

import { FormEvent, useEffect, useState } from "react";
import { AuthGate } from "@/components/AuthGate";
import { Nav } from "@/components/Nav";
import { api, authHeaders } from "@/lib/api";

type PayoutAccount = {
  accountName: string;
  legalName: string;
  phone: string;
  contactEmail: string;
  taxId: string;
  address: string;
  bankName: string;
  branchName: string;
  accountType: string;
  accountNumber: string;
  payoutMethod: string;
  promptpayType: string;
  promptpayId: string;
  note: string;
};

const defaults: PayoutAccount = {
  accountName: "",
  legalName: "",
  phone: "",
  contactEmail: "",
  taxId: "",
  address: "",
  bankName: "Kasikorn Bank",
  branchName: "",
  accountType: "Savings",
  accountNumber: "",
  payoutMethod: "BANK_TRANSFER",
  promptpayType: "PHONE",
  promptpayId: "",
  note: "",
};

function normalizeDigits(value: FormDataEntryValue | null) {
  return String(value ?? "").replace(/\D/g, "");
}

export default function BankSettingsPage() {
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [verified, setVerified] = useState(false);
  const [account, setAccount] = useState<PayoutAccount>(defaults);

  useEffect(() => {
    api.get("/settings/payout", { headers: authHeaders() }).then((res) => {
      if (res.data) setAccount({ ...defaults, ...res.data });
    }).catch(() => undefined);
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaved(false);
    setVerified(false);
    setError("");
    const form = new FormData(event.currentTarget);
    const accountName = String(form.get("accountName") ?? "").trim();
    const legalName = String(form.get("legalName") ?? "").trim();
    const phone = normalizeDigits(form.get("phone"));
    const contactEmail = String(form.get("contactEmail") ?? "").trim();
    const taxId = normalizeDigits(form.get("taxId"));
    const address = String(form.get("address") ?? "").trim();
    const accountNumber = normalizeDigits(form.get("accountNumber"));
    const promptpayId = normalizeDigits(form.get("promptpayId"));

    if (accountName.length < 3) {
      setError("กรุณาระบุชื่อบัญชีจริงอย่างน้อย 3 ตัวอักษร");
      return;
    }
    if (accountNumber.length < 10 || accountNumber.length > 15) {
      setError("เลขที่บัญชีต้องเป็นตัวเลข 10-15 หลัก");
      return;
    }
    if (promptpayId && ![10, 13, 15].includes(promptpayId.length)) {
      setError("PromptPay ID ต้องเป็นเบอร์ 10 หลัก, เลขบัตร 13 หลัก หรือ e-wallet 15 หลัก");
      return;
    }

    const payload = {
      accountName,
      legalName,
      phone,
      contactEmail,
      taxId,
      address,
      bankName: String(form.get("bankName") ?? ""),
      branchName: String(form.get("branchName") ?? "").trim(),
      accountType: String(form.get("accountType") ?? "Savings"),
      accountNumber,
      payoutMethod: String(form.get("payoutMethod") ?? "BANK_TRANSFER"),
      promptpayType: String(form.get("promptpayType") ?? "PHONE"),
      promptpayId,
      note: String(form.get("note") ?? "").trim(),
    };

    await api.patch("/settings/payout", payload, { headers: authHeaders() });
    setAccount(payload);
    setVerified(true);
    setSaved(true);
  }

  return (
    <AuthGate>
      <Nav />
      <main className="mx-auto w-[min(900px,calc(100%-2rem))] py-10">
        <p className="font-bold text-mint">Payout Account</p>
        <h1 className="mt-3 text-5xl font-black">ข้อมูลบัญชีโอนจ่าย</h1>
        <form onSubmit={submit} className="card mt-8 grid gap-4 p-5 md:grid-cols-2">
          <label>ชื่อบัญชีจริง<input className="input mt-2" name="accountName" value={account.accountName} onChange={(event) => setAccount({ ...account, accountName: event.target.value })} required /></label>
          <label>ชื่อนิติบุคคล/ชื่อจริงตามเอกสาร<input className="input mt-2" name="legalName" value={account.legalName} onChange={(event) => setAccount({ ...account, legalName: event.target.value })} /></label>
          <label>เบอร์โทรศัพท์<input className="input mt-2" name="phone" inputMode="numeric" value={account.phone} onChange={(event) => setAccount({ ...account, phone: event.target.value })} /></label>
          <label>อีเมลติดต่อ<input className="input mt-2" name="contactEmail" type="email" value={account.contactEmail} onChange={(event) => setAccount({ ...account, contactEmail: event.target.value })} /></label>
          <label>เลขผู้เสียภาษี/เลขบัตรประชาชน<input className="input mt-2" name="taxId" inputMode="numeric" value={account.taxId} onChange={(event) => setAccount({ ...account, taxId: event.target.value })} /></label>
          <label>วิธีโอนจ่าย<select className="input mt-2" name="payoutMethod" value={account.payoutMethod} onChange={(event) => setAccount({ ...account, payoutMethod: event.target.value })}><option value="BANK_TRANSFER">โอนเข้าบัญชีธนาคาร</option><option value="PROMPTPAY">พร้อมเพย์</option><option value="BANK_AND_PROMPTPAY">ธนาคารและพร้อมเพย์</option></select></label>
          <label>ธนาคาร<select className="input mt-2" name="bankName" value={account.bankName} onChange={(event) => setAccount({ ...account, bankName: event.target.value })}><option>Kasikorn Bank</option><option>SCB</option><option>Bangkok Bank</option><option>Krungthai Bank</option><option>Krungsri</option><option>TTB</option><option>Government Savings Bank</option></select></label>
          <label>สาขา<input className="input mt-2" name="branchName" value={account.branchName} onChange={(event) => setAccount({ ...account, branchName: event.target.value })} /></label>
          <label>ประเภทบัญชี<select className="input mt-2" name="accountType" value={account.accountType} onChange={(event) => setAccount({ ...account, accountType: event.target.value })}><option>Savings</option><option>Current</option></select></label>
          <label>เลขที่บัญชี<input className="input mt-2" name="accountNumber" inputMode="numeric" value={account.accountNumber} onChange={(event) => setAccount({ ...account, accountNumber: event.target.value })} required /></label>
          <label>ประเภทพร้อมเพย์<select className="input mt-2" name="promptpayType" value={account.promptpayType} onChange={(event) => setAccount({ ...account, promptpayType: event.target.value })}><option value="PHONE">เบอร์โทรศัพท์</option><option value="NATIONAL_ID">เลขบัตรประชาชน</option><option value="EWALLET">e-Wallet</option></select></label>
          <label>PromptPay ID<input className="input mt-2" name="promptpayId" inputMode="numeric" value={account.promptpayId} onChange={(event) => setAccount({ ...account, promptpayId: event.target.value })} /></label>
          <label className="md:col-span-2">ที่อยู่สำหรับเอกสาร<textarea className="input mt-2 min-h-24" name="address" value={account.address} onChange={(event) => setAccount({ ...account, address: event.target.value })} /></label>
          <label className="md:col-span-2">หมายเหตุ<textarea className="input mt-2 min-h-20" name="note" value={account.note} onChange={(event) => setAccount({ ...account, note: event.target.value })} /></label>
          {error && <p className="text-coral">{error}</p>}
          {saved && verified && <p className="text-mint">บันทึกและตรวจรูปแบบข้อมูลแล้ว พร้อมส่งต่อ KYC/Bank verification provider ใน production</p>}
          <p className="text-sm text-white/55">หมายเหตุ: การตรวจสอบบัญชีว่าเป็นของจริงและรับเงินได้จริง ต้องเชื่อมต่อผู้ให้บริการ KYC/Bank verification หรือ payment gateway ใน production</p>
          <button className="btn btn-primary" type="submit">บันทึกและตรวจสอบบัญชีรับเงิน</button>
        </form>
      </main>
    </AuthGate>
  );
}
