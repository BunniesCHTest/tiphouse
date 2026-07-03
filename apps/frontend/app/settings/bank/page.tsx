"use client";

import { ChangeEvent, FormEvent, useEffect, useState } from "react";
import jsQR from "jsqr";
import { AuthGate } from "@/components/AuthGate";
import { Nav } from "@/components/Nav";
import { api, authHeaders } from "@/lib/api";
import { useAppPreferences } from "@/lib/app-preferences";

type ReceivingAccount = {
  receivingQrImageUrl: string;
  receivingQrPayload: string;
  phone: string;
  contactEmail: string;
  slipOkBranchId: string;
  slipOkApiKey: string;
  slipOkConfigured: boolean;
};

const defaults: ReceivingAccount = {
  receivingQrImageUrl: "",
  receivingQrPayload: "",
  phone: "",
  contactEmail: "",
  slipOkBranchId: "",
  slipOkApiKey: "",
  slipOkConfigured: false,
};

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("อ่านไฟล์รูปไม่สำเร็จ"));
    reader.readAsDataURL(file);
  });
}

async function decodeQr(file: File) {
  const bitmap = await createImageBitmap(file);
  const maxSide = 1600;
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("เบราว์เซอร์ไม่สามารถอ่านรูป QR ได้");
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const image = context.getImageData(0, 0, width, height);
  const decoded = jsQR(image.data, width, height, { inversionAttempts: "attemptBoth" });
  if (!decoded?.data) throw new Error("ไม่พบ QR Code ในรูป กรุณาเลือกรูปที่คมชัดและเห็น QR ครบทั้งภาพ");
  return decoded.data;
}

export default function BankSettingsPage() {
  const { t } = useAppPreferences();
  const [account, setAccount] = useState<ReceivingAccount>(defaults);
  const [loading, setLoading] = useState(true);
  const [readingQr, setReadingQr] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    api.get("/settings/payout", { headers: authHeaders() })
      .then((response) => {
        if (response.data) {
          setAccount({
            receivingQrImageUrl: response.data.receivingQrImageUrl ?? "",
            receivingQrPayload: response.data.receivingQrPayload ?? "",
            phone: response.data.phone ?? "",
            contactEmail: response.data.contactEmail ?? "",
            slipOkBranchId: response.data.slipOkBranchId ?? "",
            slipOkApiKey: "",
            slipOkConfigured: Boolean(response.data.slipOkConfigured),
          });
        }
      })
      .catch(() => setError("โหลดข้อมูล QR รับเงินไม่สำเร็จ"))
      .finally(() => setLoading(false));
  }, []);

  async function selectQr(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setError("");
    setNotice("");
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      setError("รองรับเฉพาะไฟล์ PNG, JPG และ WEBP");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setError("รูป QR ต้องมีขนาดไม่เกิน 2MB");
      return;
    }
    setReadingQr(true);
    try {
      const [receivingQrImageUrl, receivingQrPayload] = await Promise.all([
        fileToDataUrl(file),
        decodeQr(file),
      ]);
      setAccount((current) => ({ ...current, receivingQrImageUrl, receivingQrPayload }));
      setNotice("อ่าน QR Code สำเร็จ กรุณากดบันทึก");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "อ่าน QR Code ไม่สำเร็จ");
    } finally {
      setReadingQr(false);
      event.target.value = "";
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");
    const phone = account.phone.replace(/\D/g, "");
    const contactEmail = account.contactEmail.trim().toLowerCase();
    if (!account.receivingQrImageUrl || !account.receivingQrPayload) {
      setError("กรุณาแนบรูป QR Code ที่ใช้รับเงิน");
      return;
    }
    if (phone && !/^[0-9]{9,10}$/.test(phone)) {
      setError("เบอร์โทรศัพท์ต้องเป็นตัวเลข 9-10 หลัก");
      return;
    }
    if (contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
      setError("รูปแบบอีเมลติดต่อไม่ถูกต้อง");
      return;
    }
    const slipOkBranchId = account.slipOkBranchId.trim();
    const slipOkApiKey = account.slipOkApiKey.trim();
    if (slipOkBranchId && !/^[0-9]{1,20}$/.test(slipOkBranchId)) {
      setError("SlipOK Branch ID ต้องเป็นตัวเลขเท่านั้น");
      return;
    }
    if (!account.slipOkConfigured && (!slipOkBranchId || !slipOkApiKey)) {
      setError("กรุณาระบุ SlipOK Branch ID และ API Key ให้ครบถ้วน");
      return;
    }
    setSaving(true);
    try {
      const { data } = await api.patch("/settings/payout", {
        receivingQrImageUrl: account.receivingQrImageUrl,
        receivingQrPayload: account.receivingQrPayload,
        phone: phone || undefined,
        contactEmail: contactEmail || undefined,
        slipOkBranchId,
        slipOkApiKey: slipOkApiKey || undefined,
      }, { headers: authHeaders() });
      setAccount({
        receivingQrImageUrl: data.receivingQrImageUrl ?? account.receivingQrImageUrl,
        receivingQrPayload: data.receivingQrPayload ?? account.receivingQrPayload,
        phone: data.phone ?? "",
        contactEmail: data.contactEmail ?? "",
        slipOkBranchId: data.slipOkBranchId ?? slipOkBranchId,
        slipOkApiKey: "",
        slipOkConfigured: Boolean(data.slipOkConfigured),
      });
      setNotice("บันทึกข้อมูลรับเงินสำเร็จ");
    } catch (cause) {
      const message = (cause as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message;
      setError(Array.isArray(message) ? message.join(", ") : message ?? "บันทึกข้อมูลรับเงินไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AuthGate>
      <Nav />
      <main className="mx-auto w-[min(820px,calc(100%-2rem))] py-10">
        <p className="font-bold text-mint">Receiving QR</p>
        <h1 className="mt-3 text-4xl font-black sm:text-5xl">{t("ข้อมูลบัญชีโอนจ่าย", "Receiving Account")}</h1>
        <p className="mt-4 leading-7 text-white/65">
          {t(
            "เก็บ QR Code สำหรับรับเงินของ Creator ระบบจะอ่านข้อมูลจาก QR และสร้าง QR ใหม่ตามยอดโดเนทแต่ละรายการ",
            "Store the creator receiving QR. TipHouse reads its payload and generates a new fixed-amount QR for each donation.",
          )}
        </p>

        <form onSubmit={submit} className="card mt-8 grid gap-5 p-5 sm:p-6">
          <label>
            {t("รูป QR Code ที่ใช้รับเงิน", "Receiving QR Code")}
            <input
              className="input mt-2"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={selectQr}
              disabled={loading || readingQr || saving}
            />
          </label>
          <p className="text-sm text-white/55">
            {t("แนะนำรูปสี่เหลี่ยมอย่างน้อย 800 x 800 px เห็น QR ครบทุกมุม ไฟล์ไม่เกิน 2MB", "Use a square image of at least 800 x 800 px with all QR corners visible, up to 2MB.")}
          </p>
          {readingQr && <p className="font-bold text-sky">กำลังอ่านข้อมูลจาก QR Code...</p>}
          {account.receivingQrImageUrl && (
            <div className="grid justify-items-center gap-3 rounded-lg border border-sky/25 bg-white/5 p-4">
              <img className="size-64 max-w-full rounded-lg bg-white object-contain p-3" src={account.receivingQrImageUrl} alt="Receiving QR preview" />
              <button
                className="btn border-coral/60 bg-coral/15 text-coral"
                type="button"
                onClick={() => setAccount((current) => ({ ...current, receivingQrImageUrl: "", receivingQrPayload: "" }))}
              >
                ลบ QR Code
              </button>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <label>
              {t("เบอร์โทรศัพท์", "Phone Number")}
              <input
                className="input mt-2"
                type="tel"
                inputMode="numeric"
                maxLength={10}
                value={account.phone}
                onChange={(event) => setAccount({ ...account, phone: event.target.value.replace(/\D/g, "").slice(0, 10) })}
                placeholder="0812345678"
              />
            </label>
            <label>
              {t("อีเมลติดต่อ", "Contact Email")}
              <input
                className="input mt-2"
                type="email"
                value={account.contactEmail}
                onChange={(event) => setAccount({ ...account, contactEmail: event.target.value })}
                placeholder="creator@example.com"
              />
            </label>
          </div>

          <div className="grid gap-4 rounded-lg border border-sky/25 bg-sky/5 p-4 sm:grid-cols-2">
            <label>
              SlipOK Branch ID
              <input
                className="input mt-2"
                inputMode="numeric"
                maxLength={20}
                value={account.slipOkBranchId}
                onChange={(event) => setAccount({
                  ...account,
                  slipOkBranchId: event.target.value.replace(/\D/g, "").slice(0, 20),
                })}
                placeholder="ตัวอย่าง 12345"
                required
              />
            </label>
            <label>
              SlipOK API Key
              <input
                className="input mt-2"
                type="password"
                autoComplete="new-password"
                maxLength={200}
                value={account.slipOkApiKey}
                onChange={(event) => setAccount({ ...account, slipOkApiKey: event.target.value })}
                placeholder={account.slipOkConfigured ? "ตั้งค่าแล้ว - เว้นว่างเพื่อใช้คีย์เดิม" : "กรอก API Key"}
                required={!account.slipOkConfigured}
              />
            </label>
            <p className="text-sm text-white/60 sm:col-span-2">
              {account.slipOkConfigured
                ? "เชื่อมต่อ SlipOK แล้ว API Key ถูกเก็บแบบเข้ารหัสและจะไม่ถูกแสดงกลับมา"
                : "ข้อมูลชุดนี้ใช้ตรวจสลิปเฉพาะหน้าโดเนทของบัญชีนี้เท่านั้น"}
            </p>
          </div>

          {error && <p className="rounded-lg border border-coral/40 bg-coral/10 p-3 font-bold text-coral">{error}</p>}
          {notice && <p className="rounded-lg border border-mint/40 bg-mint/10 p-3 font-bold text-mint">{notice}</p>}
          <button className="btn btn-primary disabled:cursor-wait disabled:opacity-50" type="submit" disabled={loading || readingQr || saving}>
            {saving ? t("กำลังบันทึก...", "Saving...") : t("บันทึกข้อมูลรับเงิน", "Save Receiving Account")}
          </button>
        </form>
      </main>
    </AuthGate>
  );
}
