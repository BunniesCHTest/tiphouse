"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AuthGate } from "@/components/AuthGate";
import { Nav } from "@/components/Nav";
import { api, authHeaders } from "@/lib/api";
import { userCacheKey } from "@/lib/session";

type OverlaySettings = {
  streamerKey: string;
  position: "Center" | "Top" | "Bottom";
  durationSeconds: number;
  soundUrl?: string;
  imageUrl?: string;
  ttsEnabled: boolean;
  ttsVoice: "female" | "male";
  widgetHtml: string;
  widgetCss: string;
  widgetJs: string;
};

type TestAlert = {
  donorName: string;
  amount: number;
  message: string;
};

const defaultWidgetHtml = `<div class="tiphouse-alert">
  <img class="tiphouse-image" src="{{imageUrl}}" alt="" />
  <div class="tiphouse-name">{{donorName}}</div>
  <div class="tiphouse-amount">โดเนท {{amountBaht}}</div>
  <div class="tiphouse-message">{{message}}</div>
</div>`;

const defaultWidgetCss = `.tiphouse-alert {
  display: grid;
  place-items: center;
  gap: 12px;
  text-align: center;
  color: #ffffff;
  font-family: Arial, sans-serif;
  text-shadow: 0 0 18px rgba(56, 226, 194, .85);
}
.tiphouse-image {
  width: 112px;
  height: 112px;
  object-fit: contain;
}
.tiphouse-name {
  font-size: 44px;
  font-weight: 900;
}
.tiphouse-amount {
  font-size: 34px;
  font-weight: 800;
  color: #7ef7cf;
}
.tiphouse-message {
  font-size: 28px;
  font-weight: 700;
}`;

const defaultWidgetJs = `const alertBox = root.querySelector(".tiphouse-alert");
if (alertBox) {
  alertBox.animate([
    { opacity: 0, transform: "translateY(24px) scale(.96)" },
    { opacity: 1, transform: "translateY(0) scale(1)" }
  ], { duration: 450, easing: "ease-out", fill: "both" });
}`;

const defaultSettings: OverlaySettings = {
  streamerKey: "",
  position: "Center",
  durationSeconds: 7,
  ttsEnabled: true,
  ttsVoice: "female",
  widgetHtml: defaultWidgetHtml,
  widgetCss: defaultWidgetCss,
  widgetJs: defaultWidgetJs,
};

const testAlerts: TestAlert[] = [
  { donorName: "Mint", amount: 50, message: "สู้ๆนะครับ" },
  { donorName: "Alex", amount: 120, message: "Keep going, your stream is awesome!" },
  { donorName: "Anonymous", amount: 300, message: "วันนี้สนุกมากครับ" },
  { donorName: "Nina", amount: 99, message: "Love your content!" },
];

function randomTestAlert() {
  return testAlerts[Math.floor(Math.random() * testAlerts.length)];
}

function readFileAsDataUrl(file: File | null) {
  return new Promise<string | undefined>((resolve, reject) => {
    if (!file) return resolve(undefined);
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function thaiNumber(value: number): string {
  const digits = ["ศูนย์", "หนึ่ง", "สอง", "สาม", "สี่", "ห้า", "หก", "เจ็ด", "แปด", "เก้า"];
  const units = ["", "สิบ", "ร้อย", "พัน", "หมื่น", "แสน"];
  const number = Math.floor(Math.abs(value));
  if (number === 0) return digits[0];
  if (number >= 1000000) {
    const million = Math.floor(number / 1000000);
    const rest = number % 1000000;
    return `${thaiNumber(million)}ล้าน${rest ? thaiNumber(rest) : ""}`;
  }
  const chars = String(number).split("").map(Number);
  return chars.map((digit, index) => {
    if (digit === 0) return "";
    const place = chars.length - index - 1;
    if (place === 1 && digit === 1) return units[place];
    if (place === 1 && digit === 2) return `ยี่${units[place]}`;
    if (place === 0 && digit === 1 && chars.length > 1) return "เอ็ด";
    return `${digits[digit]}${units[place]}`;
  }).join("");
}

function normalizeOverlay(data: any): OverlaySettings {
  return {
    ...defaultSettings,
    streamerKey: data?.streamerKey ?? defaultSettings.streamerKey,
    position: data?.animation?.position ?? defaultSettings.position,
    durationSeconds: data?.animation?.durationSeconds ?? data?.animation?.duration ?? defaultSettings.durationSeconds,
    soundUrl: data?.soundUrl,
    imageUrl: data?.theme?.imageUrl ?? data?.imageUrl,
    ttsEnabled: data?.ttsEnabled ?? true,
    ttsVoice: data?.theme?.ttsVoice ?? defaultSettings.ttsVoice,
    widgetHtml: data?.theme?.widgetHtml ?? defaultSettings.widgetHtml,
    widgetCss: data?.theme?.widgetCss ?? defaultSettings.widgetCss,
    widgetJs: data?.theme?.widgetJs ?? defaultSettings.widgetJs,
  };
}

function fillTemplate(value: string, settings: OverlaySettings, alert: TestAlert) {
  const donorName = alert.donorName === "Anonymous" ? "บุคคลนิรนาม" : alert.donorName;
  const replacements: Record<string, string> = {
    donorName,
    amount: String(alert.amount),
    amountBaht: `${thaiNumber(alert.amount)}บาท`,
    message: alert.message,
    imageUrl: settings.imageUrl ?? "",
  };
  return Object.entries(replacements).reduce((result, [key, replacement]) => result.replaceAll(`{{${key}}}`, replacement), value);
}

function overlayPayload(settings: OverlaySettings) {
  return {
    streamerKey: settings.streamerKey,
    soundUrl: settings.soundUrl,
    ttsEnabled: settings.ttsEnabled,
    theme: {
      imageUrl: settings.imageUrl,
      ttsVoice: settings.ttsVoice,
      widgetHtml: settings.widgetHtml,
      widgetCss: settings.widgetCss,
      widgetJs: settings.widgetJs,
    },
    animation: { position: settings.position, durationSeconds: settings.durationSeconds },
  };
}

function previewDoc(settings: OverlaySettings, alert: TestAlert) {
  return `<!doctype html><html><head><style>html,body{margin:0;background:transparent;min-height:100%;display:grid;place-items:center}${fillTemplate(settings.widgetCss, settings, alert)}</style></head><body>${fillTemplate(settings.widgetHtml, settings, alert)}<script>${fillTemplate(settings.widgetJs, settings, alert)}</script></body></html>`;
}

export default function OverlaySettingsPage() {
  const [saved, setSaved] = useState(false);
  const [settings, setSettings] = useState<OverlaySettings>(defaultSettings);
  const [previewAlert, setPreviewAlert] = useState<TestAlert>(randomTestAlert);
  const overlayUrl = `${process.env.NEXT_PUBLIC_FRONTEND_URL ?? "https://yourdomain.com"}/overlay/${settings.streamerKey || "loading"}`;
  const previewUrl = `/overlay/${settings.streamerKey}?preview=1&donor=${encodeURIComponent(previewAlert.donorName)}&amount=${previewAlert.amount}&message=${encodeURIComponent(previewAlert.message)}`;
  const previewSrcDoc = useMemo(() => previewDoc(settings, previewAlert), [settings, previewAlert]);

  useEffect(() => {
    const cached = localStorage.getItem(userCacheKey("overlay_settings"));
    if (cached) setSettings(normalizeOverlay(JSON.parse(cached)));

    api.get("/settings/overlay", { headers: authHeaders() }).then((res) => {
      const next = normalizeOverlay(res.data);
      setSettings(next);
      localStorage.setItem(userCacheKey("overlay_settings"), JSON.stringify(next));
      localStorage.setItem(`tiphouse_overlay_settings:${next.streamerKey}`, JSON.stringify(next));
    }).catch(() => undefined);
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const nextSettings = await settingsFromForm(form);
    await api.patch("/settings/overlay", overlayPayload(nextSettings), { headers: authHeaders() });
    setSettings(nextSettings);
    localStorage.setItem(userCacheKey("overlay_settings"), JSON.stringify(nextSettings));
    localStorage.setItem(`tiphouse_overlay_settings:${nextSettings.streamerKey}`, JSON.stringify(nextSettings));
    setSaved(true);
  }

  async function settingsFromForm(form: FormData): Promise<OverlaySettings> {
    const soundFile = form.get("soundFile") instanceof File ? (form.get("soundFile") as File) : null;
    const imageFile = form.get("imageFile") instanceof File ? (form.get("imageFile") as File) : null;
    return {
      ...settings,
      position: String(form.get("position") || "Center") as OverlaySettings["position"],
      durationSeconds: Math.max(3, Math.min(30, Number(form.get("durationSeconds") || 7))),
      soundUrl: (await readFileAsDataUrl(soundFile && soundFile.size ? soundFile : null)) ?? settings.soundUrl,
      imageUrl: (await readFileAsDataUrl(imageFile && imageFile.size ? imageFile : null)) ?? settings.imageUrl,
      ttsEnabled: form.get("ttsEnabled") === "on",
      ttsVoice: String(form.get("ttsVoice") || "female") as OverlaySettings["ttsVoice"],
      widgetHtml: String(form.get("widgetHtml") || ""),
      widgetCss: String(form.get("widgetCss") || ""),
      widgetJs: String(form.get("widgetJs") || ""),
    };
  }

  function onImageChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setSettings((current) => ({ ...current, imageUrl: URL.createObjectURL(file) }));
  }

  async function resetOverlayUrl() {
    const { data } = await api.post("/settings/overlay/reset-url", {}, { headers: authHeaders() });
    const next = normalizeOverlay(data);
    setSettings(next);
    localStorage.setItem(userCacheKey("overlay_settings"), JSON.stringify(next));
    localStorage.setItem(`tiphouse_overlay_settings:${next.streamerKey}`, JSON.stringify(next));
    setSaved(true);
  }

  async function testOverlay() {
    const nextAlert = randomTestAlert();
    setPreviewAlert(nextAlert);
    localStorage.setItem(`tiphouse_overlay_settings:${settings.streamerKey}`, JSON.stringify(settings));
    await api.post("/settings/overlay/test", {
      ...overlayPayload(settings),
      testDonorName: nextAlert.donorName,
      testAmount: String(nextAlert.amount),
      testMessage: nextAlert.message,
    }, { headers: authHeaders() }).catch(() => undefined);
  }

  return (
    <AuthGate>
      <Nav />
      <main className="mx-auto w-[min(1100px,calc(100%-2rem))] py-10">
        <p className="font-bold text-mint">Browser Source</p>
        <h1 className="mt-3 text-5xl font-black">ตั้งค่า Overlay</h1>
        <section className="mt-8 grid gap-5 lg:grid-cols-[1fr_.8fr]">
          <form onSubmit={submit} className="card grid gap-4 p-5">
            <label>Overlay URL<input className="input mt-2" readOnly value={overlayUrl} /></label>
            <button className="btn" type="button" onClick={resetOverlayUrl}>Reset Overlay URL</button>
            <p className="text-sm text-white/55">URL นี้สุ่มเฉพาะ Account ของคุณและระบบตรวจไม่ให้ซ้ำกับ User คนอื่น</p>
            <label>ตำแหน่ง<select className="input mt-2" name="position" value={settings.position} onChange={(event) => setSettings({ ...settings, position: event.target.value as OverlaySettings["position"] })}><option>Center</option><option>Top</option><option>Bottom</option></select></label>
            <label>ระยะเวลาแสดงผล Overlay (วินาที)<input className="input mt-2" name="durationSeconds" type="number" min="3" max="30" value={settings.durationSeconds} onChange={(event) => setSettings({ ...settings, durationSeconds: Number(event.target.value) })} required /></label>
            <label>เสียง TTS<select className="input mt-2" name="ttsVoice" value={settings.ttsVoice} onChange={(event) => setSettings({ ...settings, ttsVoice: event.target.value as OverlaySettings["ttsVoice"] })}><option value="female">ผู้หญิง</option><option value="male">ผู้ชาย</option></select></label>
            <div>
              <label className="font-bold">รูปโดเนทสำหรับ Overlay</label>
              <p className="mt-1 text-sm text-white/60">แนะนำ 512 x 512 px, PNG/JPG/WebP ใช้กับตัวแปร {"{{imageUrl}}"}</p>
              <input className="input mt-2" name="imageFile" type="file" accept="image/png,image/jpeg,image/webp" onChange={onImageChange} />
            </div>
            <div>
              <label className="font-bold">ไฟล์เสียงเมื่อมีคนโดเนท</label>
              <p className="mt-1 text-sm text-white/60">รองรับ MP3/WAV/OGG ระบบจะอ่าน TTS หลังไฟล์เสียงเล่นจบ</p>
              <input className="input mt-2" name="soundFile" type="file" accept="audio/mpeg,audio/wav,audio/ogg" />
            </div>
            <label className="flex gap-2 text-white/70"><input name="ttsEnabled" type="checkbox" checked={settings.ttsEnabled} onChange={(event) => setSettings({ ...settings, ttsEnabled: event.target.checked })} /> เปิด TTS</label>
            <label>HTML<textarea className="input mt-2 min-h-40 font-mono text-sm" name="widgetHtml" value={settings.widgetHtml} onChange={(event) => setSettings({ ...settings, widgetHtml: event.target.value })} /></label>
            <label>CSS<textarea className="input mt-2 min-h-52 font-mono text-sm" name="widgetCss" value={settings.widgetCss} onChange={(event) => setSettings({ ...settings, widgetCss: event.target.value })} /></label>
            <label>JS<textarea className="input mt-2 min-h-36 font-mono text-sm" name="widgetJs" value={settings.widgetJs} onChange={(event) => setSettings({ ...settings, widgetJs: event.target.value })} /></label>
            {saved && <p className="text-mint">บันทึก Overlay แล้ว</p>}
            <button className="btn btn-primary" type="submit">บันทึก Overlay</button>
            <button className="btn" type="button" onClick={testOverlay}>ทดสอบ Overlay</button>
            <Link className="btn" href={previewUrl} target="_blank">เปิด Overlay</Link>
          </form>
          <div className="card grid place-items-center p-5">
            <iframe className="min-h-80 w-full rounded-lg border border-white/10 bg-transparent" srcDoc={previewSrcDoc} title="Overlay preview" />
          </div>
        </section>
      </main>
    </AuthGate>
  );
}
