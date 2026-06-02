"use client";

import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from "react";

export type AppLanguage = "th" | "en";
export type AppTheme = "dark" | "light";

type PreferencesContextValue = {
  language: AppLanguage;
  theme: AppTheme;
  toggleLanguage: () => void;
  toggleTheme: () => void;
  t: (th: string, en: string) => string;
};

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

export function AppPreferencesProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<AppLanguage>("th");
  const [theme, setTheme] = useState<AppTheme>("dark");

  useEffect(() => {
    const storedLanguage = localStorage.getItem("tiphouse_language") as AppLanguage | null;
    const storedTheme = localStorage.getItem("tiphouse_theme") as AppTheme | null;
    if (storedLanguage === "th" || storedLanguage === "en") setLanguage(storedLanguage);
    if (storedTheme === "dark" || storedTheme === "light") setTheme(storedTheme);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.lang = language;
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("tiphouse_language", language);
    localStorage.setItem("tiphouse_theme", theme);
  }, [language, theme]);

  const value = useMemo<PreferencesContextValue>(() => ({
    language,
    theme,
    toggleLanguage: () => setLanguage((current) => current === "th" ? "en" : "th"),
    toggleTheme: () => setTheme((current) => current === "dark" ? "light" : "dark"),
    t: (th, en) => language === "th" ? th : en,
  }), [language, theme]);

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function useAppPreferences() {
  const context = useContext(PreferencesContext);
  if (!context) {
    return {
      language: "th" as AppLanguage,
      theme: "dark" as AppTheme,
      toggleLanguage: () => undefined,
      toggleTheme: () => undefined,
      t: (th: string) => th,
    };
  }
  return context;
}
