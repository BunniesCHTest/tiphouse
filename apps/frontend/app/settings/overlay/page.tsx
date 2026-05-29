"use client";

import { ChangeEvent, FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { AuthGate } from "@/components/AuthGate";
import { Nav } from "@/components/Nav";
import { api, authHeaders } from "@/lib/api";
import { userCacheKey } from "@/lib/session";

type OverlaySettings = {
  streamerKey: string;
  theme: "Neon Glow" | "Anime Bounce" | "Minimal Slide";
  position: "Center" | "Top" | "Bottom";
  durationSeconds: number;
  soundUrl?: string;
  imageUrl?: string;
  textColor: string;
  ttsEnabled: boolean;
  ttsVoice: "female" | "male";
};

const defaultSettings: OverlaySettings = {
  streamerKey: "",
  theme: "Neon Glow",
  position: "Center",
  durationSeconds: 7,
  textColor: "#ffffff",
  ttsEnabled: true,
  ttsVoice: "female",
};

function readFileAsDataUrl(file: File | null) {
  return new Promise<string | undefined>((resolve, reject) => {
    if (!file) return resolve(undefined);
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function normalizeOverlay(data: any): OverlaySettings {
  return {
    ...defaultSettings,
    streamerKey: data?.streamerKey ?? defaultSettings.streamerKey,
    theme: data?.theme?.name ?? data?.theme ?? defaultSettings.theme,
    position: data?.animation?.position ?? defaultSettings.position,
    durationSeconds: data?.animation?.durationSeconds ?? data?.animation?.duration ?? defaultSettings.durationSeconds,
    soundUrl: data?.soundUrl,
    imageUrl: data?.theme?.imageUrl ?? data?.imageUrl,
    textColor: data?.theme?.textColor ?? defaultSettings.textColor,
    ttsEnabled: data?.ttsEnabled ?? true,
    ttsVoice: data?.theme?.ttsVoice ?? defaultSettings.ttsVoice,
  };
}

function themeClass(theme: OverlaySettings["theme"]) {
  if (theme === "Anime Bounce") return "border-pink-300/40 bg-[#201225]/90 shadow-[0_0_60px_rgba(245,123,193,.25)]";
  if (theme === "Minimal Slide") return "border-white/30 bg-white/95 shadow-2xl";
  return "border-mint/40 bg-[#071012]/90 shadow-[0_0_60px_rgba(56,226,194,.25)]";
}

function AlertPreview({ settings, test }: { settings: OverlaySettings; test: boolean }) {
  return (
    <div className={`grid w-full max-w-xl place-items-center gap-3 rounded-xl border p-5 text-center ${themeClass(settings.theme)}`}>
      {settings.imageUrl ? (
        <img alt="Overlay donation image" src={settings.imageUrl} className="size-28 rounded-2xl bg-transparent object-contain shadow-2xl" />
      ) : (
        <div className="grid size-28 place-items-center rounded-2xl bg-mint text-3xl font-black text-ink">TH</div>
      )}
      <h2 className="text-3xl font-black" style={{ color: settings.textColor }}>Anonymous donated ฿100</h2>
      <p className="text-xl" style={{ color: settings.textColor }}>สู้ๆนะ</p>
      {test && <span className="badge">กำลังทดสอบ Overlay</span>}
    </div>
  );
}

export default function OverlaySettingsPage() {
  const [saved, setSaved] = useState(false);
  const [testVisible, setTestVisible] = useState(false);
  const [settings, setSettings] = useState<OverlaySettings>(defaultSettings);
  const overlayUrl = `${process.env.NEXT_PUBLIC_FRONTEND_URL ?? "https://yourdomain.com"}/overlay/${settings.streamerKey || "loading"}`;

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
    const soundFile = form.get("soundFile") instanceof File ? (form.get("soundFile") as File) : null;
    const imageFile = form.get("imageFile") instanceof File ? (form.get("imageFile") as File) : null;
    const nextSettings: OverlaySettings = {
      streamerKey: settings.streamerKey,
      theme: String(form.get("theme") || "Neon Glow") as OverlaySettings["theme"],
      position: String(form.get("position") || "Center") as OverlaySettings["position"],
      durationSeconds: Math.max(3, Math.min(30, Number(form.get("durationSeconds") || 7))),
      soundUrl: (await readFileAsDataUrl(soundFile && soundFile.size ? soundFile : null)) ?? settings.soundUrl,
      imageUrl: (await readFileAsDataUrl(imageFile && imageFile.size ? imageFile : null)) ?? settings.imageUrl,
      textColor: String(form.get("textColor") || "#ffffff"),
      ttsEnabled: form.get("ttsEnabled") === "on",
      ttsVoice: String(form.get("ttsVoice") || "female") as OverlaySettings["ttsVoice"],
    };
    await api.patch("/settings/overlay", {
      streamerKey: nextSettings.streamerKey,
      soundUrl: nextSettings.soundUrl,
      ttsEnabled: nextSettings.ttsEnabled,
      theme: {
        name: nextSettings.theme,
        imageUrl: nextSettings.imageUrl,
        textColor: nextSettings.textColor,
        ttsVoice: nextSettings.ttsVoice,
      },
      animation: { position: nextSettings.position, durationSeconds: nextSettings.durationSeconds },
    }, { headers: authHeaders() });
    setSettings(nextSettings);
    localStorage.setItem(userCacheKey("overlay_settings"), JSON.stringify(nextSettings));
    localStorage.setItem(`tiphouse_overlay_settings:${nextSettings.streamerKey}`, JSON.stringify(nextSettings));
    setSaved(true);
  }

  function onImageChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setSettings((current) => ({ ...current, imageUrl: URL.createObjectURL(file) }));
  }

  function testOverlay() {
    setTestVisible(true);
    localStorage.setItem(`tiphouse_overlay_settings:${settings.streamerKey}`, JSON.stringify(settings));
    localStorage.setItem("tiphouse_overlay_test", JSON.stringify({ streamerKey: settings.streamerKey, nonce: Date.now() }));
    api.post("/settings/overlay/test", {}, { headers: authHeaders() }).catch(() => undefined);
    window.setTimeout(() => setTestVisible(false), settings.durationSeconds * 1000);
  }

  return (
    <AuthGate>
      <Nav />
      <main className="mx-auto w-[min(1000px,calc(100%-2rem))] py-10">
        <p className="font-bold text-mint">Browser Source</p>
        <h1 className="mt-3 text-5xl font-black">ตั้งค่า Overlay</h1>
        <section className="mt-8 grid gap-5 lg:grid-cols-[1fr_.8fr]">
          <form onSubmit={submit} className="card grid gap-4 p-5">
            <label>Overlay URL<input className="input mt-2" readOnly value={overlayUrl} /></label>
            <p className="text-sm text-white/55">URL นี้สุ่มเฉพาะ Account ของคุณและไม่ซ้ำกับคนอื่น</p>
            <label>Alert Animation<select className="input mt-2" name="theme" value={settings.theme} onChange={(event) => setSettings({ ...settings, theme: event.target.value as OverlaySettings["theme"] })}><option>Neon Glow</option><option>Anime Bounce</option><option>Minimal Slide</option></select></label>
            <label>ตำแหน่ง<select className="input mt-2" name="position" value={settings.position} onChange={(event) => setSettings({ ...settings, position: event.target.value as OverlaySettings["position"] })}><option>Center</option><option>Top</option><option>Bottom</option></select></label>
            <label>ระยะเวลาแสดงผล Overlay (วินาที)<input className="input mt-2" name="durationSeconds" type="number" min="3" max="30" value={settings.durationSeconds} onChange={(event) => setSettings({ ...settings, durationSeconds: Number(event.target.value) })} required /></label>
            <label>สีข้อความ<input className="input mt-2 h-12" name="textColor" type="color" value={settings.textColor} onChange={(event) => setSettings({ ...settings, textColor: event.target.value })} /></label>
            <label>เสียง TTS<select className="input mt-2" name="ttsVoice" value={settings.ttsVoice} onChange={(event) => setSettings({ ...settings, ttsVoice: event.target.value as OverlaySettings["ttsVoice"] })}><option value="female">ผู้หญิง</option><option value="male">ผู้ชาย</option></select></label>
            <div>
              <label className="font-bold">รูปโดเนทสำหรับ Overlay</label>
              <p className="mt-1 text-sm text-white/60">แนะนำ 512 x 512 px, PNG/JPG/WebP ใช้แทน Icon TH และแสดงบนชื่อผู้โดเนท</p>
              <input className="input mt-2" name="imageFile" type="file" accept="image/png,image/jpeg,image/webp" onChange={onImageChange} />
            </div>
            <div>
              <label className="font-bold">ไฟล์เสียงเมื่อมีคนโดเนท</label>
              <p className="mt-1 text-sm text-white/60">รองรับ MP3/WAV/OGG ระบบจะอ่านข้อความ TTS หลังไฟล์เสียงเล่นจบ</p>
              <input className="input mt-2" name="soundFile" type="file" accept="audio/mpeg,audio/wav,audio/ogg" />
            </div>
            <label className="flex gap-2 text-white/70"><input name="ttsEnabled" type="checkbox" checked={settings.ttsEnabled} onChange={(event) => setSettings({ ...settings, ttsEnabled: event.target.checked })} /> เปิด TTS</label>
            {saved && <p className="text-mint">บันทึก Overlay แล้ว</p>}
            <button className="btn btn-primary" type="submit">บันทึก Overlay</button>
            <button className="btn" type="button" onClick={testOverlay}>ทดสอบ Overlay</button>
            <Link className="btn" href={`/overlay/${settings.streamerKey}`} target="_blank">เปิด Overlay</Link>
          </form>
          <div className="card grid place-items-center p-5">
            <div className="relative grid min-h-72 w-full place-items-center rounded-lg border border-white/10 bg-black/20 p-4">
              <AlertPreview settings={settings} test={testVisible} />
            </div>
          </div>
        </section>
      </main>
    </AuthGate>
  );
}
