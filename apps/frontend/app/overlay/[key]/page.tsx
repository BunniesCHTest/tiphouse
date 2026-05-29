"use client";

import { AnimatePresence, motion } from "framer-motion";
import { use, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { io } from "socket.io-client";
import { api } from "@/lib/api";

type AlertPayload = {
  donorName: string;
  amount: number;
  message: string;
  anonymous?: boolean;
  settings?: unknown;
};

type OverlaySettings = {
  theme?: "Neon Glow" | "Anime Bounce" | "Minimal Slide";
  position?: "Center" | "Top" | "Bottom";
  durationSeconds?: number;
  soundUrl?: string;
  imageUrl?: string;
  textColor?: string;
  ttsEnabled?: boolean;
  ttsVoice?: "female" | "male";
  widgetHtml?: string;
  widgetCss?: string;
  widgetJs?: string;
};

function normalizeSettings(data: any): OverlaySettings {
  return {
    theme: data?.theme?.name ?? data?.theme?.theme ?? data?.theme,
    position: data?.animation?.position ?? data?.position,
    durationSeconds: data?.animation?.durationSeconds ?? data?.animation?.duration ?? data?.durationSeconds,
    soundUrl: data?.soundUrl,
    imageUrl: data?.theme?.imageUrl ?? data?.imageUrl,
    textColor: data?.theme?.textColor ?? "#ffffff",
    ttsEnabled: data?.ttsEnabled ?? true,
    ttsVoice: data?.theme?.ttsVoice ?? "female",
    widgetHtml: data?.theme?.widgetHtml,
    widgetCss: data?.theme?.widgetCss,
    widgetJs: data?.theme?.widgetJs,
  };
}

function animationClass(theme?: OverlaySettings["theme"]) {
  if (theme === "Anime Bounce") return "drop-shadow-[0_0_28px_rgba(245,123,193,.7)]";
  if (theme === "Minimal Slide") return "drop-shadow-[0_8px_22px_rgba(0,0,0,.45)]";
  return "drop-shadow-[0_0_28px_rgba(56,226,194,.7)]";
}

function positionClass(position?: OverlaySettings["position"]) {
  if (position === "Top") return "items-start pt-[7vh]";
  if (position === "Bottom") return "items-end pb-[7vh]";
  return "items-center";
}

function readLocalSettings(key: string) {
  const raw = localStorage.getItem(`tiphouse_overlay_settings:${key}`);
  return raw ? (JSON.parse(raw) as OverlaySettings) : {};
}

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
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

function thaiBaht(amount: number) {
  return `${thaiNumber(Number.isFinite(amount) ? amount : 0)}บาท`;
}

function donationSpeechText(payload: AlertPayload) {
  const donorName = payload.anonymous || payload.donorName === "Anonymous" ? "บุคคลนิรนาม" : payload.donorName;
  return `${donorName} โดเนท ${thaiBaht(payload.amount)} ข้อความว่า ${payload.message}`;
}

function fillTemplate(value: string | undefined, payload: AlertPayload, settings: OverlaySettings) {
  if (!value) return "";
  const donorName = payload.anonymous || payload.donorName === "Anonymous" ? "บุคคลนิรนาม" : payload.donorName;
  const replacements: Record<string, string> = {
    donorName,
    amount: String(payload.amount),
    amountBaht: thaiBaht(payload.amount),
    message: payload.message,
    imageUrl: settings.imageUrl ?? "",
    textColor: settings.textColor ?? "#ffffff",
  };
  return Object.entries(replacements).reduce(
    (result, [key, replacement]) => result.replaceAll(`{{${key}}}`, replacement),
    value,
  );
}

async function ensureVoicesLoaded() {
  if (!("speechSynthesis" in window)) return;
  if (window.speechSynthesis.getVoices().length) return;
  await new Promise<void>((resolve) => {
    const timer = window.setTimeout(resolve, 1000);
    window.speechSynthesis.onvoiceschanged = () => {
      window.clearTimeout(timer);
      resolve();
    };
  });
}

function chooseVoice(lang: string, voiceType: "female" | "male") {
  const voices = window.speechSynthesis.getVoices();
  const languageFamily = lang.split("-")[0].toLowerCase();
  const sameLang = voices.filter((voice) => {
    const voiceLang = voice.lang.toLowerCase();
    return voiceLang === lang.toLowerCase() || voiceLang.startsWith(`${languageFamily}-`);
  });
  const malePattern = /male|man|narong|kitt|daniel|david|mark|george|arthur|guy|paul|alex|ชาย/i;
  const femalePattern = /female|woman|siri|kanya|google|zira|susan|samantha|victoria|karen|moira|joanna|หญิง/i;
  const pattern = voiceType === "male" ? malePattern : femalePattern;
  return sameLang.find((voice) => pattern.test(voice.name))
    ?? voices.find((voice) => pattern.test(voice.name))
    ?? sameLang[0]
    ?? voices[0];
}

async function speakDonationMessage(message: string, voiceType: "female" | "male") {
  if (!message.trim()) return;

  // OBS Browser Source is inconsistent with Thai speechSynthesis voices, so Thai always uses backend audio.
  if (/[\u0E00-\u0E7F]/.test(message)) {
    await playThaiAudioFallback(message);
    return;
  }

  if (!("speechSynthesis" in window)) return;
  await ensureVoicesLoaded();
  await new Promise<void>((resolve) => {
    const lang = /[A-Za-z]/.test(message) ? "en-US" : navigator.language || "en-US";
    const utterance = new SpeechSynthesisUtterance(message);
    utterance.lang = lang;
    utterance.pitch = voiceType === "male" ? 0.55 : 1.3;
    utterance.rate = voiceType === "male" ? 0.9 : 1.03;
    utterance.volume = 1;
    const voice = chooseVoice(lang, voiceType);
    if (voice) utterance.voice = voice;
    const keepAlive = window.setInterval(() => window.speechSynthesis.resume(), 250);
    const done = () => {
      window.clearInterval(keepAlive);
      window.clearTimeout(timeout);
      resolve();
    };
    const timeout = window.setTimeout(done, Math.max(2500, message.length * 180));
    utterance.onend = done;
    utterance.onerror = done;
    window.speechSynthesis.cancel();
    window.speechSynthesis.resume();
    window.setTimeout(() => window.speechSynthesis.speak(utterance), 80);
  });
}

async function playThaiAudioFallback(message: string) {
  const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:4000/api";
  const text = encodeURIComponent(message.slice(0, 180));
  const backendUrl = `${apiBase}/overlay/tts/th?text=${text}`;
  const directUrl = `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=th&q=${text}`;
  const played = await playAudioUrl(backendUrl);
  if (!played) await playAudioUrl(directUrl);
}

async function playAudioUrl(url: string) {
  return new Promise<boolean>((resolve) => {
    const audio = new Audio(url);
    audio.preload = "auto";
    audio.onended = () => resolve(true);
    audio.onerror = () => resolve(false);
    audio.play().catch(() => resolve(false));
  });
}

export default function OverlayPage({ params }: { params: Promise<{ key: string }> }) {
  const { key } = use(params);
  const searchParams = useSearchParams();
  const [alert, setAlert] = useState<AlertPayload | null>(null);
  const [settings, setSettings] = useState<OverlaySettings>({});
  const queueRef = useRef<AlertPayload[]>([]);
  const processingRef = useRef(false);
  const settingsRef = useRef<OverlaySettings>({});
  const widgetRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  async function loadSettings() {
    const local = readLocalSettings(key);
    if (Object.keys(local).length) {
      settingsRef.current = local;
      setSettings(local);
    }
    try {
      const { data } = await api.get(`/overlay/${key}`);
      const next = normalizeSettings(data);
      settingsRef.current = next;
      setSettings(next);
      localStorage.setItem(`tiphouse_overlay_settings:${key}`, JSON.stringify(next));
    } catch {
      // Keep current settings if backend is waking up.
    }
  }

  useEffect(() => {
    const previousBodyBackground = document.body.style.background;
    const previousHtmlBackground = document.documentElement.style.background;
    const previousOverflow = document.body.style.overflow;
    document.body.style.background = "transparent";
    document.documentElement.style.background = "transparent";
    document.body.style.overflow = "hidden";

    loadSettings().then(() => {
      if (searchParams.get("preview") === "1") {
        enqueueAlert({
          donorName: searchParams.get("donor") || "Preview",
          amount: Number(searchParams.get("amount") || 100),
          message: searchParams.get("message") || "สู้ๆนะครับ",
        });
      }
    });
    const onStorage = (event: StorageEvent) => {
      if (event.key === `tiphouse_overlay_settings:${key}`) {
        const next = readLocalSettings(key);
        settingsRef.current = next;
        setSettings(next);
      }
      if (event.key === "tiphouse_overlay_donation" && event.newValue) {
        enqueueAlert(JSON.parse(event.newValue) as AlertPayload);
      }
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener("focus", loadSettings);
    return () => {
      document.body.style.background = previousBodyBackground;
      document.documentElement.style.background = previousHtmlBackground;
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", loadSettings);
    };
  }, [key, searchParams]);

  useEffect(() => {
    const socket = io(`${process.env.NEXT_PUBLIC_SOCKET_URL ?? "http://127.0.0.1:4000"}/overlay`);
    socket.emit("join_overlay", { streamerKey: key });
    socket.on("connect", () => socket.emit("join_overlay", { streamerKey: key }));
    socket.on("new_donation", async (payload: AlertPayload) => {
      if (payload.settings) {
        const next = normalizeSettings(payload.settings);
        settingsRef.current = next;
        setSettings(next);
        localStorage.setItem(`tiphouse_overlay_settings:${key}`, JSON.stringify(next));
      } else {
        await loadSettings();
      }
      enqueueAlert(payload);
    });
    return () => {
      socket.disconnect();
    };
  }, [key]);

  function enqueueAlert(payload: AlertPayload) {
    queueRef.current.push(payload);
    void processQueue();
  }

  async function processQueue() {
    if (processingRef.current) return;
    processingRef.current = true;
    while (queueRef.current.length) {
      const payload = queueRef.current.shift()!;
      const current = settingsRef.current;
      setAlert(payload);
      await playSoundThenTts(current, payload);
      await wait((current.durationSeconds ?? 7) * 1000);
      setAlert(null);
      await wait(350);
    }
    processingRef.current = false;
  }

  async function playSoundThenTts(current: OverlaySettings, payload: AlertPayload) {
    if (current.soundUrl) {
      await new Promise<void>((resolve) => {
        const audio = new Audio(current.soundUrl);
        audio.onended = () => resolve();
        audio.onerror = () => resolve();
        audio.play().catch(() => resolve());
      });
    }
    if (!current.ttsEnabled) return;
    await speakDonationMessage(donationSpeechText(payload), current.ttsVoice ?? "female");
  }

  const textColor = settings.textColor ?? "#ffffff";
  const customHtml = useMemo(() => alert ? fillTemplate(settings.widgetHtml, alert, settings) : "", [alert, settings]);
  const customCss = useMemo(() => alert ? fillTemplate(settings.widgetCss, alert, settings) : "", [alert, settings]);

  useEffect(() => {
    if (!alert || !settings.widgetJs || !widgetRef.current) return;
    try {
      const code = fillTemplate(settings.widgetJs, alert, settings);
      new Function("root", "payload", "settings", code)(widgetRef.current, alert, settings);
    } catch {
      // Custom widget JS should never break the overlay runtime.
    }
  }, [alert, settings]);

  return (
    <main className={`grid min-h-screen bg-transparent ${positionClass(settings.position)}`}>
      <AnimatePresence>
        {alert && (
          <motion.section
            initial={{ opacity: 0, y: 40, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -30, scale: 0.95 }}
            className="mx-auto grid max-w-3xl place-items-center gap-3 bg-transparent p-5 text-center"
          >
            {settings.widgetHtml ? (
              <div ref={widgetRef} className="tiphouse-widget">
                <style dangerouslySetInnerHTML={{ __html: customCss }} />
                <div dangerouslySetInnerHTML={{ __html: customHtml }} />
              </div>
            ) : (
              <>
                {settings.imageUrl && (
                  <img alt="Overlay donation image" src={settings.imageUrl} className="size-28 bg-transparent object-contain" />
                )}
                <h1 className="text-4xl font-black" style={{ color: textColor }}>{alert.donorName} donated ฿{alert.amount}</h1>
                <p className="text-2xl font-bold" style={{ color: textColor }}>{alert.message}</p>
              </>
            )}
          </motion.section>
        )}
      </AnimatePresence>
    </main>
  );
}
