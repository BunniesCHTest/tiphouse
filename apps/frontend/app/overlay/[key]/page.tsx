"use client";

import { AnimatePresence, motion } from "framer-motion";
import { use, useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import { api } from "@/lib/api";

type AlertPayload = {
  donorName: string;
  amount: number;
  message: string;
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
  donorName: "Anonymous",
  amount: 100,
  message: "สู้ๆนะ",
};

function normalizeSettings(data: any): OverlaySettings {
  return {
    theme: data?.theme?.name ?? data?.theme,
    position: data?.animation?.position,
    durationSeconds: data?.animation?.durationSeconds ?? data?.animation?.duration,
    soundUrl: data?.soundUrl,
    imageUrl: data?.theme?.imageUrl ?? data?.imageUrl,
    textColor: data?.theme?.textColor ?? "#ffffff",
    ttsEnabled: data?.ttsEnabled ?? true,
    ttsVoice: data?.theme?.ttsVoice ?? "female",
  };
}

function themeClass(theme?: OverlaySettings["theme"]) {
  if (theme === "Anime Bounce") return "border-pink-300/50 bg-[#201225]/90 shadow-[0_0_80px_rgba(245,123,193,.3)]";
  if (theme === "Minimal Slide") return "border-white/30 bg-white/95 shadow-2xl";
  return "border-mint/50 bg-[#071012]/90 shadow-[0_0_80px_rgba(56,226,194,.32)]";
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

async function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
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
    const loadSettings = async () => {
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
        // OBS can still use local test settings when backend is sleeping.
      }
    };

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
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", loadSettings);
    };
  }, [key]);

  useEffect(() => {
    const socket = io(`${process.env.NEXT_PUBLIC_SOCKET_URL ?? "http://127.0.0.1:4000"}/overlay`, {
      transports: ["websocket"],
    });
    socket.emit("join_overlay", { streamerKey: key });
    socket.on("new_donation", (payload: AlertPayload) => enqueueAlert(payload));
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
    const utterance = new SpeechSynthesisUtterance(payload.message);
    utterance.lang = /[ก-๙]/.test(payload.message) ? "th-TH" : "en-US";
    utterance.pitch = current.ttsVoice === "male" ? 0.75 : 1.15;
    utterance.rate = 1;
    const voices = window.speechSynthesis.getVoices();
    const preferred = voices.find((voice) => voice.lang.startsWith(utterance.lang) && (
      current.ttsVoice === "male"
        ? /male|ชาย|narong|kitt/i.test(voice.name)
        : /female|หญิง|siri|kanya|google/i.test(voice.name)
    )) ?? voices.find((voice) => voice.lang.startsWith(utterance.lang));
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
            className={`mx-auto grid max-w-3xl place-items-center gap-3 rounded-2xl border p-5 text-center ${themeClass(settings.theme)}`}
          >
            {settings.imageUrl ? (
              <img alt="Overlay donation image" src={settings.imageUrl} className="size-28 rounded-2xl bg-transparent object-contain shadow-2xl" />
            ) : (
              <div className="grid size-28 place-items-center rounded-2xl bg-mint text-3xl font-black text-ink">TH</div>
            )}
            <h1 className="text-4xl font-black" style={{ color: textColor }}>{alert.donorName} donated ฿{alert.amount}</h1>
            <p className="text-2xl" style={{ color: textColor }}>{alert.message}</p>
          </motion.section>
        )}
      </AnimatePresence>
    </main>
  );
}
