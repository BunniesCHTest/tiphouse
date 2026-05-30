"use client";

import { AnimatePresence, motion } from "framer-motion";
import { use, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { io } from "socket.io-client";
import { api } from "@/lib/api";

type SoundPreset = "none" | "chime" | "pop" | "bell" | "success";

type AlertPayload = {
  donorName: string;
  amount: number;
  message: string;
  anonymous?: boolean;
  settings?: unknown;
};

type OverlaySettings = {
  position?: "Center" | "Top" | "Bottom";
  durationSeconds?: number;
  soundUrl?: string;
  ttsEnabled?: boolean;
  ttsVoice?: "female" | "male";
  soundPreset?: SoundPreset;
  widgetHtml?: string;
  widgetCss?: string;
  widgetJs?: string;
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
const THAI_MESSAGE_PREFIX = "\u0e02\u0e49\u0e2d\u0e04\u0e27\u0e32\u0e21\u0e27\u0e48\u0e32";
const THAI_PREVIEW_MESSAGE = "\u0e2a\u0e39\u0e49\u0e46\u0e19\u0e30\u0e04\u0e23\u0e31\u0e1a";

function normalizeSettings(data: any): OverlaySettings {
  return {
    position: data?.animation?.position ?? data?.position,
    durationSeconds: data?.animation?.durationSeconds ?? data?.animation?.duration ?? data?.durationSeconds,
    soundUrl: data?.soundUrl,
    ttsEnabled: data?.ttsEnabled ?? true,
    ttsVoice: data?.theme?.ttsVoice ?? "female",
    soundPreset: data?.theme?.soundPreset ?? "chime",
    widgetHtml: data?.theme?.widgetHtml,
    widgetCss: data?.theme?.widgetCss,
    widgetJs: data?.theme?.widgetJs,
  };
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

function thaiBaht(amount: number) {
  return `${thaiNumber(Number.isFinite(amount) ? amount : 0)}${THAI_BAHT}`;
}

function donorNameFor(payload: AlertPayload) {
  return payload.anonymous || payload.donorName === "Anonymous" ? THAI_ANONYMOUS : payload.donorName;
}

function donationSpeechText(payload: AlertPayload) {
  return `${donorNameFor(payload)} ${THAI_DONATE} ${thaiBaht(payload.amount)} ${THAI_MESSAGE_PREFIX} ${payload.message}`;
}

function fillTemplate(value: string | undefined, payload: AlertPayload) {
  if (!value) return "";
  const replacements: Record<string, string> = {
    donorName: donorNameFor(payload),
    amount: String(payload.amount),
    amountBaht: thaiBaht(payload.amount),
    message: payload.message,
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
  const sameLang = voices.filter((voice) => voice.lang.toLowerCase().startsWith(lang.split("-")[0].toLowerCase()));
  const malePattern = /male|man|narong|kitt|daniel|david|mark|george|arthur|guy|paul|alex/i;
  const femalePattern = /female|woman|siri|kanya|google|zira|susan|samantha|victoria|karen|moira|joanna/i;
  const pattern = voiceType === "male" ? malePattern : femalePattern;
  return sameLang.find((voice) => pattern.test(voice.name))
    ?? voices.find((voice) => pattern.test(voice.name))
    ?? sameLang[0]
    ?? voices[0];
}

async function speakDonationMessage(message: string, voiceType: "female" | "male") {
  if (!message.trim()) return;
  if (/[\u0E00-\u0E7F]/.test(message)) {
    await playGoogleThaiTts(message);
    return;
  }
  if (!("speechSynthesis" in window)) return;
  await ensureVoicesLoaded();
  await new Promise<void>((resolve) => {
    const utterance = new SpeechSynthesisUtterance(message);
    utterance.lang = "en-US";
    utterance.pitch = voiceType === "male" ? 0.55 : 1.3;
    utterance.rate = voiceType === "male" ? 0.9 : 1.03;
    utterance.volume = 1;
    const voice = chooseVoice("en-US", voiceType);
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

async function playGoogleThaiTts(message: string) {
  const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:4000/api";
  const chunks = chunkText(message, 180);
  for (const chunk of chunks) {
    const encoded = encodeURIComponent(chunk);
    const backendUrl = `${apiBase}/overlay/tts/th?text=${encoded}`;
    const directUrl = `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=th&q=${encoded}`;
    const played = await playAudioUrl(backendUrl);
    if (!played) await playAudioUrl(directUrl);
  }
}

function chunkText(text: string, maxLength: number) {
  const words = text.split(/\s+/);
  const chunks: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxLength && current) {
      chunks.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) chunks.push(current);
  return chunks.length ? chunks : [text.slice(0, maxLength)];
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

async function playPresetSound(preset: SoundPreset | undefined) {
  if (!preset || preset === "none") return;
  const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioContextClass) return;
  const context = new AudioContextClass();
  const patterns: Record<Exclude<SoundPreset, "none">, Array<[number, number]>> = {
    chime: [[880, 0.12], [1320, 0.18]],
    pop: [[520, 0.08], [260, 0.12]],
    bell: [[740, 0.18], [988, 0.24]],
    success: [[660, 0.1], [880, 0.1], [1175, 0.18]],
  };
  let cursor = context.currentTime;
  for (const [frequency, duration] of patterns[preset]) {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0.0001, cursor);
    gain.gain.exponentialRampToValueAtTime(0.22, cursor + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, cursor + duration);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(cursor);
    oscillator.stop(cursor + duration);
    cursor += duration + 0.04;
  }
  await wait(Math.ceil((cursor - context.currentTime) * 1000));
  await context.close().catch(() => undefined);
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
          message: searchParams.get("message") || THAI_PREVIEW_MESSAGE,
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
    } else {
      await playPresetSound(current.soundPreset);
    }
    if (!current.ttsEnabled) return;
    await speakDonationMessage(donationSpeechText(payload), current.ttsVoice ?? "female");
  }

  const customHtml = useMemo(() => alert ? fillTemplate(settings.widgetHtml, alert) : "", [alert, settings.widgetHtml]);
  const customCss = useMemo(() => alert ? fillTemplate(settings.widgetCss, alert) : "", [alert, settings.widgetCss]);

  useEffect(() => {
    if (!alert || !settings.widgetJs || !widgetRef.current) return;
    try {
      const code = fillTemplate(settings.widgetJs, alert);
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
            <div ref={widgetRef} className="tiphouse-widget">
              <style dangerouslySetInnerHTML={{ __html: customCss }} />
              <div dangerouslySetInnerHTML={{ __html: customHtml }} />
            </div>
          </motion.section>
        )}
      </AnimatePresence>
    </main>
  );
}
