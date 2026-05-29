"use client";

import { AnimatePresence, motion } from "framer-motion";
import { use, useEffect, useState } from "react";
import { io } from "socket.io-client";

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
};

const previewAlert: AlertPayload = {
  donorName: "Anonymous",
  amount: 100,
  message: "สู้ๆนะ",
};

function themeClass(theme?: OverlaySettings["theme"]) {
  if (theme === "Anime Bounce") return "border-pink-300/40 shadow-[0_0_80px_rgba(245,123,193,.28)]";
  if (theme === "Minimal Slide") return "bg-white text-ink shadow-2xl";
  return "border-mint/40 shadow-[0_0_80px_rgba(56,226,194,.28)]";
}

function positionClass(position?: OverlaySettings["position"]) {
  if (position === "Top") return "items-start pt-[7vh]";
  if (position === "Bottom") return "items-end pb-[7vh]";
  return "items-center";
}

function readSettings(key: string) {
  const raw = localStorage.getItem(`tiphouse_overlay_settings:${key}`);
  return raw ? (JSON.parse(raw) as OverlaySettings) : {};
}

export default function OverlayPage({ params }: { params: Promise<{ key: string }> }) {
  const { key } = use(params);
  const [alert, setAlert] = useState<AlertPayload | null>(previewAlert);
  const [settings, setSettings] = useState<OverlaySettings>({});

  useEffect(() => {
    const syncSettings = () => setSettings(readSettings(key));
    syncSettings();

    const playSound = (nextSettings: OverlaySettings) => {
      if (!nextSettings.soundUrl) return;
      const audio = new Audio(nextSettings.soundUrl);
      audio.play().catch(() => undefined);
    };

    const showAlert = (payload: AlertPayload) => {
      const nextSettings = readSettings(key);
      setSettings(nextSettings);
      setAlert(payload);
      playSound(nextSettings);
      window.setTimeout(() => setAlert(null), (nextSettings.durationSeconds ?? 7) * 1000);
    };

    const onStorage = (event: StorageEvent) => {
      if (event.key === `tiphouse_overlay_settings:${key}`) syncSettings();
      if (event.key === "tiphouse_overlay_test" && event.newValue) {
        const payload = JSON.parse(event.newValue);
        if (!payload.streamerKey || payload.streamerKey === key) showAlert(previewAlert);
      }
      if (event.key === "tiphouse_overlay_donation" && event.newValue) {
        showAlert(JSON.parse(event.newValue) as AlertPayload);
      }
    };

    window.addEventListener("storage", onStorage);
    window.addEventListener("focus", syncSettings);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", syncSettings);
    };
  }, [key]);

  useEffect(() => {
    const socket = io(`${process.env.NEXT_PUBLIC_SOCKET_URL ?? "http://127.0.0.1:4000"}/overlay`, {
      transports: ["websocket"],
    });
    socket.emit("join_overlay", { streamerKey: key });
    socket.on("new_donation", (payload: AlertPayload) => {
      setAlert(payload);
      if (settings.soundUrl) {
        const audio = new Audio(settings.soundUrl);
        audio.play().catch(() => undefined);
      }
      window.setTimeout(() => setAlert(null), (settings.durationSeconds ?? 7) * 1000);
    });
    return () => {
      socket.disconnect();
    };
  }, [key, settings.soundUrl, settings.durationSeconds]);

  return (
    <main className={`grid min-h-screen bg-transparent ${positionClass(settings.position)}`}>
      <AnimatePresence>
        {alert && (
          <motion.section
            initial={{ opacity: 0, y: 40, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -30, scale: 0.95 }}
            className={`card mx-auto grid max-w-3xl place-items-center gap-3 p-5 text-center ${themeClass(settings.theme)}`}
          >
            {settings.imageUrl ? (
              <img alt="Overlay donation image" src={settings.imageUrl} className="size-28 rounded-2xl object-cover shadow-2xl" />
            ) : (
              <div className="grid size-28 place-items-center rounded-2xl bg-mint text-3xl font-black text-ink">TH</div>
            )}
            <h1 className="text-4xl font-black">{alert.donorName} donated ฿{alert.amount}</h1>
            <p className="text-2xl opacity-80">{alert.message}</p>
          </motion.section>
        )}
      </AnimatePresence>
    </main>
  );
}
