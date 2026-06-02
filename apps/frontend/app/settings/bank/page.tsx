"use client";

import { FormEvent, useEffect, useState } from "react";
import { AuthGate } from "@/components/AuthGate";
import { Nav } from "@/components/Nav";
import { api, authHeaders } from "@/lib/api";
import { useAppPreferences } from "@/lib/app-preferences";

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
  note: "",
};

function normalizeDigits(value: FormDataEntryValue | null) {
  return String(value ?? "").replace(/\D/g, "");
}

export default function BankSettingsPage() {
  const { t } = useAppPreferences();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [account, setAccount] = useState<PayoutAccount>(defaults);

  useEffect(() => {
    api.get("/settings/payout", { headers: authHeaders() }).then((res) => {
      if (res.data) setAccount({ ...defaults, ...res.data });
    }).catch(() => undefined);
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaved(false);
    setError("");
    const form = new FormData(event.currentTarget);
    const accountName = String(form.get("accountName") ?? "").trim();
    const legalName = String(form.get("legalName") ?? "").trim();
    const phone = normalizeDigits(form.get("phone"));
    const contactEmail = String(form.get("contactEmail") ?? "").trim();
    const taxId = normalizeDigits(form.get("taxId"));
    const address = String(form.get("address") ?? "").trim();
    const accountNumber = normalizeDigits(form.get("accountNumber"));

    if (accountName && accountName.length < 3) {
      setError(t("กรุณาระบุชื่อบัญชีจริงอย่างน้อย 3 ตัวอักษร", "Please enter an account holder name with at least 3 characters."));
      return;
    }
    if (accountNumber && (accountNumber.length < 10 || accountNumber.length > 15)) {
      setError(t("เลขที่บัญชีต้องเป็นตัวเลข 10-15 หลัก", "Account number must be 10-15 digits."));
      return;
    }

    const payload: PayoutAccount = {
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
      payoutMethod: "BANK_TRANSFER",
      note: String(form.get("note") ?? "").trim(),
    };

    await api.patch("/settings/payout", payload, { headers: authHeaders() });
    setAccount(payload);
    setSaved(true);
  }

  return (
    <AuthGate>
      <Nav />
      <main className="mx-auto w-[min(900px,calc(100%-2rem))] py-10">
        <p className="font-bold text-mint">Payout Account</p>
        <h1 className="mt-3 text-5xl font-black">{t("ข้อมูลบัญชีโอนจ่าย", "Payout Account Details")}</h1>
        <p className="mt-4 leading-7 text-white/65">
          {t(
            "ใช้เก็บข้อมูลบัญชีธนาคารของ Creator สำหรับตรวจสอบและโอนจ่ายยอดโดเนทในอนาคต ตอนนี้ยังสามารถข้ามการบันทึกเพื่อดูหน้าอื่นได้",
            "Store the creator bank account for future payout verification. You can skip saving this for now and continue using other pages.",
          )}
        </p>
        <form onSubmit={submit} className="card mt-8 grid gap-4 p-5 md:grid-cols-2">
          <label>{t("ชื่อบัญชีจริง", "Account Holder Name")}<input className="input mt-2" name="accountName" value={account.accountName} onChange={(event) => setAccount({ ...account, accountName: event.target.value })} /></label>
          <label>{t("ชื่อนิติบุคคล/ชื่อจริงตามเอกสาร", "Legal / Document Name")}<input className="input mt-2" name="legalName" value={account.legalName} onChange={(event) => setAccount({ ...account, legalName: event.target.value })} /></label>
          <label>{t("เบอร์โทรศัพท์", "Phone Number")}<input className="input mt-2" name="phone" inputMode="numeric" value={account.phone} onChange={(event) => setAccount({ ...account, phone: event.target.value })} /></label>
          <label>{t("อีเมลติดต่อ", "Contact Email")}<input className="input mt-2" name="contactEmail" type="email" value={account.contactEmail} onChange={(event) => setAccount({ ...account, contactEmail: event.target.value })} /></label>
          <label>{t("เลขผู้เสียภาษี/เลขบัตรประชาชน", "Tax ID / National ID")}<input className="input mt-2" name="taxId" inputMode="numeric" value={account.taxId} onChange={(event) => setAccount({ ...account, taxId: event.target.value })} /></label>
          <label>{t("วิธีโอนจ่าย", "Payout Method")}<input className="input mt-2" value={t("โอนเข้าบัญชีธนาคาร", "Bank Transfer")} readOnly /></label>
          <label>{t("ธนาคาร", "Bank")}<select className="input mt-2" name="bankName" value={account.bankName} onChange={(event) => setAccount({ ...account, bankName: event.target.value })}><option>Kasikorn Bank</option><option>SCB</option><option>Bangkok Bank</option><option>Krungthai Bank</option><option>Krungsri</option><option>TTB</option><option>Government Savings Bank</option></select></label>
          <label>{t("สาขา", "Branch")}<input className="input mt-2" name="branchName" value={account.branchName} onChange={(event) => setAccount({ ...account, branchName: event.target.value })} /></label>
          <label>{t("ประเภทบัญชี", "Account Type")}<select className="input mt-2" name="accountType" value={account.accountType} onChange={(event) => setAccount({ ...account, accountType: event.target.value })}><option>Savings</option><option>Current</option></select></label>
          <label>{t("เลขที่บัญชี", "Account Number")}<input className="input mt-2" name="accountNumber" inputMode="numeric" value={account.accountNumber} onChange={(event) => setAccount({ ...account, accountNumber: event.target.value })} /></label>
          <label className="md:col-span-2">{t("ที่อยู่สำหรับเอกสาร", "Document Address")}<textarea className="input mt-2 min-h-24" name="address" value={account.address} onChange={(event) => setAccount({ ...account, address: event.target.value })} /></label>
          <label className="md:col-span-2">{t("หมายเหตุ", "Note")}<textarea className="input mt-2 min-h-20" name="note" value={account.note} onChange={(event) => setAccount({ ...account, note: event.target.value })} /></label>
          {error && <p className="text-coral md:col-span-2">{error}</p>}
          {saved && <p className="text-mint md:col-span-2">{t("บันทึกข้อมูลบัญชีโอนจ่ายแล้ว", "Payout account saved.")}</p>}
          <p className="text-sm text-white/55 md:col-span-2">
            {t(
              "หมายเหตุ: การตรวจสอบบัญชีว่าเป็นของจริงและรับเงินได้จริง จะเชื่อมต่อผู้ให้บริการ KYC/Bank verification หรือ payment gateway ในขั้น production ภายหลัง",
              "Note: Real bank-account verification will be connected later through a production KYC, bank verification, or payment gateway provider.",
            )}
          </p>
          <button className="btn btn-primary md:col-span-2" type="submit">{t("บันทึกข้อมูลบัญชีรับเงิน", "Save Payout Account")}</button>
        </form>
      </main>
    </AuthGate>
  );
}
