"use client";

import { AnimatePresence, motion } from "framer-motion";
import { use, useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import { api } from "@/lib/api";

type AlertPayload = {
  donorName: string;
  amount: number;
  message: string;
  settings?: any;
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
};

const previewAlert: AlertPayload = {
  donorName: "Test Overlay",
  amount: 100,
  message: "ทดสอบข้อความโดเนท",
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

function ensureVoicesLoaded() {
  if (!("speechSynthesis" in window)) return Promise.resolve();
  if (window.speechSynthesis.getVoices().length) return Promise.resolve();
  return new Promise<void>((resolve) => {
    const timer = window.setTimeout(() => resolve(), 800);
    window.speechSynthesis.onvoiceschanged = () => {
      window.clearTimeout(timer);
      resolve();
    };
  });
}

export default function OverlayPage({ params }: { params: Promise<{ key: string }> }) {
  const { key } = use(params);
  const [alert, setAlert] = useState<AlertPayload | null>(null);
  const [settings, setSettings] = useState<OverlaySettings>({});
  const queueRef = useRef<AlertPayload[]>([]);
  const processingRef = useRef(false);
  const settingsRef = useRef<OverlaySettings>({});

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  useEffect(() => {
    const previousBodyBackground = document.body.style.background;
    const previousHtmlBackground = document.documentElement.style.background;
    const previousOverflow = document.body.style.overflow;
    document.body.style.background = "transparent";
    document.documentElement.style.background = "transparent";
    document.body.style.overflow = "hidden";

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
        // Keep the overlay transparent and connected even if settings are not found yet.
      }
    }

    loadSettings();
    const onStorage = (event: StorageEvent) => {
      if (event.key === `tiphouse_overlay_settings:${key}`) {
        const next = readLocalSettings(key);
        settingsRef.current = next;
        setSettings(next);
      }
      if (event.key === "tiphouse_overlay_test" && event.newValue) {
        const payload = JSON.parse(event.newValue);
        if (!payload.streamerKey || payload.streamerKey === key) enqueueAlert(previewAlert);
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
  }, [key]);

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
    if (!current.ttsEnabled || !("speechSynthesis" in window)) return;
    await ensureVoicesLoaded();
    const utterance = new SpeechSynthesisUtterance(payload.message);
    utterance.lang = /[ก-๙]/.test(payload.message) ? "th-TH" : "en-US";
    utterance.pitch = current.ttsVoice === "male" ? 0.55 : 1.35;
    utterance.rate = current.ttsVoice === "male" ? 0.92 : 1.04;
    const voices = window.speechSynthesis.getVoices();
    const malePattern = /male|man|ชาย|narong|kitt|daniel|david|mark|george|arthur|guy|paul|alex/i;
    const femalePattern = /female|woman|หญิง|siri|kanya|google|zira|susan|samantha|victoria|karen|moira|joanna/i;
    const sameLangVoices = voices.filter((voice) => voice.lang.toLowerCase().startsWith(utterance.lang.toLowerCase()));
    const preferred = sameLangVoices.find((voice) => current.ttsVoice === "male" ? malePattern.test(voice.name) : femalePattern.test(voice.name))
      ?? voices.find((voice) => current.ttsVoice === "male" ? malePattern.test(voice.name) : femalePattern.test(voice.name))
      ?? sameLangVoices[0]
      ?? voices[0];
    if (preferred) utterance.voice = preferred;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  }

  const textColor = settings.textColor ?? "#ffffff";

  return (
    <main className={`grid min-h-screen bg-transparent ${positionClass(settings.position)}`}>
      <AnimatePresence>
        {alert && (
          <motion.section
            initial={{ opacity: 0, y: 40, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -30, scale: 0.95 }}
            className={`mx-auto grid max-w-3xl place-items-center gap-3 bg-transparent p-5 text-center ${animationClass(settings.theme)}`}
          >
            {settings.imageUrl && (
              <img alt="Overlay donation image" src={settings.imageUrl} className="size-28 bg-transparent object-contain" />
            )}
            <h1 className="text-4xl font-black" style={{ color: textColor }}>{alert.donorName} donated ฿{alert.amount}</h1>
            <p className="text-2xl font-bold" style={{ color: textColor }}>{alert.message}</p>
          </motion.section>
        )}
      </AnimatePresence>
    </main>
  );
}
