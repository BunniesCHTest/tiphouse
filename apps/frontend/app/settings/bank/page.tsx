"use client";

import { FormEvent, useEffect, useState } from "react";
import { AuthGate } from "@/components/AuthGate";
import { Nav } from "@/components/Nav";
import { api, authHeaders } from "@/lib/api";

type PayoutAccount = {
  accountName: string;
  bankName: string;
  accountNumber: string;
  promptpayId: string;
};

const defaults: PayoutAccount = {
  accountName: "",
  bankName: "Kasikorn Bank",
  accountNumber: "",
  promptpayId: "",
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
    if (![10, 13, 15].includes(promptpayId.length)) {
      setError("PromptPay ID ต้องเป็นเบอร์ 10 หลัก, เลขบัตร 13 หลัก หรือ e-wallet 15 หลัก");
      return;
    }

    const payload = {
      accountName,
      bankName: String(form.get("bankName") ?? ""),
      accountNumber,
      promptpayId,
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
        <h1 className="mt-3 text-5xl font-black">ผูกบัญชีรับเงิน</h1>
        <form onSubmit={submit} className="card mt-8 grid gap-4 p-5">
          <label>ชื่อบัญชีจริง<input className="input mt-2" name="accountName" value={account.accountName} onChange={(event) => setAccount({ ...account, accountName: event.target.value })} required /></label>
          <label>ธนาคาร<select className="input mt-2" name="bankName" value={account.bankName} onChange={(event) => setAccount({ ...account, bankName: event.target.value })}><option>Kasikorn Bank</option><option>SCB</option><option>Bangkok Bank</option><option>Krungthai Bank</option></select></label>
          <label>เลขที่บัญชี<input className="input mt-2" name="accountNumber" inputMode="numeric" value={account.accountNumber} onChange={(event) => setAccount({ ...account, accountNumber: event.target.value })} required /></label>
          <label>PromptPay ID<input className="input mt-2" name="promptpayId" inputMode="numeric" value={account.promptpayId} onChange={(event) => setAccount({ ...account, promptpayId: event.target.value })} required /></label>
          {error && <p className="text-coral">{error}</p>}
          {saved && verified && <p className="text-mint">บันทึกและตรวจรูปแบบข้อมูลแล้ว พร้อมส่งต่อ KYC/Bank verification provider ใน production</p>}
          <p className="text-sm text-white/55">หมายเหตุ: การตรวจสอบบัญชีว่าเป็นของจริงและรับเงินได้จริง ต้องเชื่อมต่อผู้ให้บริการ KYC/Bank verification หรือ payment gateway ใน production</p>
          <button className="btn btn-primary" type="submit">บันทึกและตรวจสอบบัญชีรับเงิน</button>
        </form>
      </main>
    </AuthGate>
  );
}
