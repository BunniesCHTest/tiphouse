"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AuthGate } from "@/components/AuthGate";
import { Nav } from "@/components/Nav";
import { api, authHeaders } from "@/lib/api";
import { userCacheKey } from "@/lib/session";

type SoundPreset = "none" | "chime" | "pop" | "bell" | "success";

type OverlaySettings = {
  streamerKey: string;
  position: "Center" | "Top" | "Bottom";
  durationSeconds: number;
  ttsEnabled: boolean;
  ttsVoice: "female" | "male";
  soundPreset: SoundPreset;
  streamlabsAlertBoxEnabled: boolean;
  streamlabsConnected: boolean;
  streamlabsUsername?: string;
  widgetHtml: string;
  widgetCss: string;
  widgetJs: string;
};

type TestAlert = {
  donorName: string;
  amount: number;
  message: string;
};

const THAI_DIGITS = [
  "\u0e28\u0e39\u0e19\u0e22\u0e4c",
  "\u0e2b\u0e19\u0e36\u0e48\u0e07",
  "\u0e2a\u0e2d\u0e07",
  "\u0e2a\u0e32\u0e21",
  "\u0e2a\u0e35\u0e48",
  "\u0e2b\u0e49\u0e32",
  "\u0e2b\u0e01",
  "\u0e40\u0e08\u0e47\u0e14",
  "\u0e41\u0e1b\u0e14",
  "\u0e40\u0e01\u0e49\u0e32",
];
const THAI_UNITS = ["", "\u0e2a\u0e34\u0e1a", "\u0e23\u0e49\u0e2d\u0e22", "\u0e1e\u0e31\u0e19", "\u0e2b\u0e21\u0e37\u0e48\u0e19", "\u0e41\u0e2a\u0e19"];
const THAI_MILLION = "\u0e25\u0e49\u0e32\u0e19";
const THAI_YI = "\u0e22\u0e35\u0e48";
const THAI_ET = "\u0e40\u0e2d\u0e47\u0e14";
const THAI_BAHT = "\u0e1a\u0e32\u0e17";
const THAI_ANONYMOUS = "\u0e1a\u0e38\u0e04\u0e04\u0e25\u0e19\u0e34\u0e23\u0e19\u0e32\u0e21";
const THAI_DONATE = "\u0e42\u0e14\u0e40\u0e19\u0e17";
const THAI_SAVE_OK = "\u0e1a\u0e31\u0e19\u0e17\u0e36\u0e01 Overlay \u0e41\u0e25\u0e49\u0e27";
const THAI_RESET_OK = "\u0e2a\u0e23\u0e49\u0e32\u0e07 Overlay URL \u0e43\u0e2b\u0e21\u0e48\u0e41\u0e25\u0e49\u0e27";
const THAI_RESET_ERROR = "\u0e23\u0e35\u0e40\u0e0b\u0e47\u0e15 Overlay URL \u0e44\u0e21\u0e48\u0e2a\u0e33\u0e40\u0e23\u0e47\u0e08 \u0e01\u0e23\u0e38\u0e13\u0e32\u0e25\u0e2d\u0e07 Login \u0e43\u0e2b\u0e21\u0e48\u0e2b\u0e23\u0e37\u0e2d\u0e15\u0e23\u0e27\u0e08 backend";
const THAI_SU_SU = "\u0e2a\u0e39\u0e49\u0e46\u0e19\u0e30\u0e04\u0e23\u0e31\u0e1a";
const THAI_FUN = "\u0e27\u0e31\u0e19\u0e19\u0e35\u0e49\u0e2a\u0e19\u0e38\u0e01\u0e21\u0e32\u0e01\u0e04\u0e23\u0e31\u0e1a";

const soundOptions: Array<{ value: SoundPreset; label: string }> = [
  { value: "none", label: "\u0e44\u0e21\u0e48\u0e21\u0e35\u0e40\u0e2a\u0e35\u0e22\u0e07" },
  { value: "chime", label: "Chime" },
  { value: "pop", label: "Pop" },
  { value: "bell", label: "Bell" },
  { value: "success", label: "Success" },
];

const defaultWidgetHtml = `<div class="tiphouse-alert">
  <div class="tiphouse-name">{{donorName}}</div>
  <div class="tiphouse-amount">\u0e42\u0e14\u0e40\u0e19\u0e17 {{amountBaht}}</div>
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
  soundPreset: "chime",
  streamlabsAlertBoxEnabled: false,
  streamlabsConnected: false,
  widgetHtml: defaultWidgetHtml,
  widgetCss: defaultWidgetCss,
  widgetJs: defaultWidgetJs,
};

const testAlerts: TestAlert[] = [
  { donorName: "Mint", amount: 50, message: THAI_SU_SU },
  { donorName: "Alex", amount: 120, message: "Keep going, your stream is awesome!" },
  { donorName: "Anonymous", amount: 300, message: THAI_FUN },
  { donorName: "Nina", amount: 99, message: "Love your content!" },
];

function randomTestAlert() {
  return testAlerts[Math.floor(Math.random() * testAlerts.length)];
}

function thaiNumber(value: number): string {
  const number = Math.floor(Math.abs(value));
  if (number === 0) return THAI_DIGITS[0];
  if (number >= 1000000) {
    const million = Math.floor(number / 1000000);
    const rest = number % 1000000;
    return `${thaiNumber(million)}${THAI_MILLION}${rest ? thaiNumber(rest) : ""}`;
  }
  const chars = String(number).split("").map(Number);
  return chars.map((digit, index) => {
    if (digit === 0) return "";
    const place = chars.length - index - 1;
    if (place === 1 && digit === 1) return THAI_UNITS[place];
    if (place === 1 && digit === 2) return `${THAI_YI}${THAI_UNITS[place]}`;
    if (place === 0 && digit === 1 && chars.length > 1) return THAI_ET;
    return `${THAI_DIGITS[digit]}${THAI_UNITS[place]}`;
  }).join("");
}

function normalizeOverlay(data: any, fallback: OverlaySettings = defaultSettings): OverlaySettings {
  return {
    ...fallback,
    streamerKey: data?.streamerKey ?? fallback.streamerKey,
    position: data?.animation?.position ?? fallback.position,
    durationSeconds: data?.animation?.durationSeconds ?? data?.animation?.duration ?? fallback.durationSeconds,
    ttsEnabled: data?.ttsEnabled ?? fallback.ttsEnabled,
    ttsVoice: data?.theme?.ttsVoice ?? fallback.ttsVoice,
    soundPreset: data?.theme?.soundPreset ?? fallback.soundPreset,
    streamlabsAlertBoxEnabled: data?.theme?.streamlabs?.alertBoxEnabled ?? fallback.streamlabsAlertBoxEnabled,
    streamlabsConnected: data?.theme?.streamlabs?.connected ?? fallback.streamlabsConnected,
    streamlabsUsername: data?.theme?.streamlabs?.username ?? fallback.streamlabsUsername,
    widgetHtml: data?.theme?.widgetHtml ?? fallback.widgetHtml,
    widgetCss: data?.theme?.widgetCss ?? fallback.widgetCss,
    widgetJs: data?.theme?.widgetJs ?? fallback.widgetJs,
  };
}

function fillTemplate(value: string, alert: TestAlert) {
  const donorName = alert.donorName === "Anonymous" ? THAI_ANONYMOUS : alert.donorName;
  const replacements: Record<string, string> = {
    donorName,
    amount: String(alert.amount),
    amountBaht: `${thaiNumber(alert.amount)}${THAI_BAHT}`,
    message: alert.message,
  };
  return Object.entries(replacements).reduce((result, [key, replacement]) => result.replaceAll(`{{${key}}}`, replacement), value);
}

function overlayPayload(settings: OverlaySettings) {
  return {
    soundUrl: undefined,
    streamerKey: settings.streamerKey,
    ttsEnabled: settings.ttsEnabled,
    theme: {
      ttsVoice: settings.ttsVoice,
      soundPreset: settings.soundPreset,
      streamlabs: {
        connected: settings.streamlabsConnected,
        alertBoxEnabled: settings.streamlabsAlertBoxEnabled,
        username: settings.streamlabsUsername,
      },
      widgetHtml: settings.widgetHtml,
      widgetCss: settings.widgetCss,
      widgetJs: settings.widgetJs,
    },
    animation: { position: settings.position, durationSeconds: settings.durationSeconds },
  };
}

function previewDoc(settings: OverlaySettings, alert: TestAlert) {
  return `<!doctype html><html><head><style>html,body{margin:0;background:transparent;min-height:100%;display:grid;place-items:center}${fillTemplate(settings.widgetCss, alert)}</style></head><body>${fillTemplate(settings.widgetHtml, alert)}<script>${fillTemplate(settings.widgetJs, alert)}</script></body></html>`;
}

export default function OverlaySettingsPage() {
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [settings, setSettings] = useState<OverlaySettings>(defaultSettings);
  const [previewAlert, setPreviewAlert] = useState<TestAlert>(randomTestAlert);
  const overlayUrl = `${process.env.NEXT_PUBLIC_FRONTEND_URL ?? "https://yourdomain.com"}/overlay/${settings.streamerKey || "loading"}`;
  const previewUrl = `/overlay/${settings.streamerKey}?preview=1&donor=${encodeURIComponent(previewAlert.donorName)}&amount=${previewAlert.amount}&message=${encodeURIComponent(previewAlert.message)}`;
  const previewSrcDoc = useMemo(() => previewDoc(settings, previewAlert), [settings, previewAlert]);

  useEffect(() => {
    if (window.location.search.includes("streamlabs=connected")) {
      setNotice("เชื่อมต่อ Streamlabs สำเร็จ");
      window.history.replaceState({}, "", window.location.pathname);
    }

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
    setError("");
    await api.patch("/settings/overlay", overlayPayload(settings), { headers: authHeaders() });
    localStorage.setItem(userCacheKey("overlay_settings"), JSON.stringify(settings));
    localStorage.setItem(`tiphouse_overlay_settings:${settings.streamerKey}`, JSON.stringify(settings));
    setNotice(THAI_SAVE_OK);
  }

  async function resetOverlayUrl() {
    setError("");
    setNotice("");
    try {
      const { data } = await api.post("/settings/overlay/reset-url", {}, { headers: authHeaders() });
      const next = normalizeOverlay(data, settings);
      if (!next.streamerKey || next.streamerKey === settings.streamerKey) {
        throw new Error("Overlay token did not change");
      }
      setSettings(next);
      localStorage.removeItem(`tiphouse_overlay_settings:${settings.streamerKey}`);
      localStorage.setItem(userCacheKey("overlay_settings"), JSON.stringify(next));
      localStorage.setItem(`tiphouse_overlay_settings:${next.streamerKey}`, JSON.stringify(next));
      setNotice(THAI_RESET_OK);
    } catch {
      setError(THAI_RESET_ERROR);
    }
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

  async function connectStreamlabs() {
    setError("");
    setNotice("");
    try {
      const { data } = await api.get("/auth/streamlabs/connect", { headers: authHeaders() });
      if (!data?.configured || !data?.url) {
        setError("ยังไม่ได้ตั้งค่า Streamlabs OAuth ใน backend");
        return;
      }
      window.location.href = data.url;
    } catch {
      setError("เริ่มเชื่อมต่อ Streamlabs ไม่สำเร็จ กรุณา Login ใหม่");
    }
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
            <label>เสียงแจ้งเตือน<select className="input mt-2" name="soundPreset" value={settings.soundPreset} onChange={(event) => setSettings({ ...settings, soundPreset: event.target.value as SoundPreset })}>{soundOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
            <label>เสียง TTS<select className="input mt-2" name="ttsVoice" value={settings.ttsVoice} onChange={(event) => setSettings({ ...settings, ttsVoice: event.target.value as OverlaySettings["ttsVoice"] })}><option value="female">ผู้หญิง</option><option value="male">ผู้ชาย</option></select></label>
            <label className="flex gap-2 text-white/70"><input name="ttsEnabled" type="checkbox" checked={settings.ttsEnabled} onChange={(event) => setSettings({ ...settings, ttsEnabled: event.target.checked })} /> เปิด TTS</label>
            <label className="flex gap-2 text-white/70"><input name="streamlabsAlertBoxEnabled" type="checkbox" checked={settings.streamlabsAlertBoxEnabled} disabled={!settings.streamlabsConnected} onChange={(event) => setSettings({ ...settings, streamlabsAlertBoxEnabled: event.target.checked })} /> ใช้ Streamlabs Alert Box สำหรับ Tips/Variation</label>
            <button className="btn" type="button" onClick={connectStreamlabs}>{settings.streamlabsConnected ? "เชื่อมต่อ Streamlabs ใหม่" : "เชื่อมต่อ Streamlabs"}</button>
            <p className="text-sm text-white/55">{settings.streamlabsConnected ? `เชื่อมต่อ Streamlabs แล้ว: ${settings.streamlabsUsername ?? "Streamlabs"}` : "ยังไม่ได้ Login ผ่าน Streamlabs จึงยังเปิดใช้งาน Alert Box Variation ไม่ได้"}</p>
            <label>HTML<textarea className="input mt-2 min-h-40 font-mono text-sm" name="widgetHtml" value={settings.widgetHtml} onChange={(event) => setSettings({ ...settings, widgetHtml: event.target.value })} /></label>
            <label>CSS<textarea className="input mt-2 min-h-52 font-mono text-sm" name="widgetCss" value={settings.widgetCss} onChange={(event) => setSettings({ ...settings, widgetCss: event.target.value })} /></label>
            <label>JS<textarea className="input mt-2 min-h-36 font-mono text-sm" name="widgetJs" value={settings.widgetJs} onChange={(event) => setSettings({ ...settings, widgetJs: event.target.value })} /></label>
            {notice && <p className="text-mint">{notice}</p>}
            {error && <p className="text-coral">{error}</p>}
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
