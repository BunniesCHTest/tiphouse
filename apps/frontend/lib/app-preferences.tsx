"use client";

import { createContext, ReactNode, useContext, useEffect, useMemo, useRef, useState } from "react";

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

const uiDictionary: Record<string, string> = {
  "หน้าแรก": "Home",
  "หน้าโดเนท": "Donation Page",
  "จัดการโปรไฟล์": "Profile",
  "บัญชีรับเงิน": "Payout Account",
  "ตั้งค่าหน้าโดเนท": "Donation Page Settings",
  "ตั้งค่า Overlay": "Overlay Settings",
  "ออกจากระบบ": "Logout",
  "เริ่มต้นใช้งานด้วย Streamlabs": "Get Started with Streamlabs",
  "เข้าสู่ระบบด้วย Streamlabs": "Sign in with Streamlabs",
  "Login ผ่าน Streamlabs": "Login with Streamlabs",
  "ชื่อครีเอเตอร์": "Creator Name",
  "URL หน้าโดเนท": "Donation Page URL",
  "ยอดโดเนทขั้นต่ำ": "Minimum Donation",
  "รูป Banner": "Banner Image",
  "บันทึกหน้าโดเนท": "Save Donation Page",
  "กำลังบันทึก...": "Saving...",
  "เปิดหน้าโดเนท": "Open Donation Page",
  "ปิด": "Close",
  "เลือกจำนวนเงิน": "Choose Amount",
  "กำหนดเอง": "Custom",
  "ชื่อผู้โดเนท": "Donor Name",
  "ข้อความถึงสตรีมเมอร์": "Message to Streamer",
  "ดำเนินการต่อ": "Continue",
  "ตรวจสอบรายการ": "Review Donation",
  "ยืนยันและชำระเงิน": "Confirm and Pay",
  "กลับไปแก้ไข": "Back to Edit",
  "ชำระเงินด้วย QR": "Pay with QR",
  "ตรวจสอบสถานะ": "Check Status",
  "ยกเลิก QR code": "Cancel QR code",
  "โดเนทสำเร็จแล้ว": "Donation Completed",
  "กลับไปหน้าโดเนท": "Back to Donation Page",
  "วิธีการโดเนท": "How to Donate",
  "ยังไม่มีข้อมูล Top Tippers จาก Streamlabs": "No Streamlabs Top Tippers yet",
  "ภาพรวมโดเนท": "Donation Overview",
  "สถิติรายได้": "Revenue Analytics",
  "สถานะรายการ": "Alert Status",
  "ชำระสำเร็จ": "Paid",
  "รอดำเนินการ": "Pending",
  "ยอดขั้นต่ำ": "Minimum",
  "ยังไม่มีรายการโดเนท": "No donations yet",
  "จัดการ User": "Manage Users",
  "ค้นหา": "Search",
  "ทุกสถานะ": "All Statuses",
  "แก้ไข": "Edit",
  "ประวัติ": "History",
  "บันทึกข้อมูล User": "Save User",
  "สร้างรหัสผ่านชั่วคราวให้หลังบันทึก": "A temporary password will be generated after saving",
};

function shouldSkipNode(node: Node) {
  const parent = node.parentElement;
  if (!parent) return true;
  return ["SCRIPT", "STYLE", "TEXTAREA", "INPUT", "OPTION"].includes(parent.tagName);
}

export function AppPreferencesProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<AppLanguage>("th");
  const [theme, setTheme] = useState<AppTheme>("dark");
  const originals = useRef<WeakMap<Text, string>>(new WeakMap());

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

  useEffect(() => {
    function translateTextNode(node: Text) {
      if (shouldSkipNode(node)) return;
      if (!originals.current.has(node)) originals.current.set(node, node.nodeValue ?? "");
      const original = originals.current.get(node) ?? "";
      if (language === "th") {
        node.nodeValue = original;
        return;
      }
      let translated = original;
      for (const [thai, english] of Object.entries(uiDictionary)) {
        translated = translated.replaceAll(thai, english);
      }
      node.nodeValue = translated;
    }

    function translateTree(root: ParentNode) {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      let current = walker.nextNode();
      while (current) {
        translateTextNode(current as Text);
        current = walker.nextNode();
      }
    }

    const run = () => translateTree(document.body);
    window.setTimeout(run, 0);
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.TEXT_NODE) translateTextNode(node as Text);
          if (node.nodeType === Node.ELEMENT_NODE) translateTree(node as Element);
        });
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [language]);

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
