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
  "ข้อมูลบัญชีโอนจ่าย": "Payout Account Details",
  "ใช้รับการติดต่อจาก TipHouse เท่านั้น": "Used only for TipHouse contact",
  "บันทึกโปรไฟล์สำเร็จ": "Profile saved successfully",
  "บันทึกโปรไฟล์": "Save Profile",
  "โหลดข้อมูลโปรไฟล์ไม่สำเร็จ": "Could not load profile",
  "บันทึกข้อมูลไม่สำเร็จ กรุณาตรวจสอบข้อมูลซ้ำ": "Could not save. Please check for duplicate data.",
  "ชื่อบัญชีจริง": "Account Holder Name",
  "ชื่อนิติบุคคล/ชื่อจริงตามเอกสาร": "Legal / Document Name",
  "เบอร์โทรศัพท์": "Phone Number",
  "อีเมลติดต่อ": "Contact Email",
  "เลขผู้เสียภาษี/เลขบัตรประชาชน": "Tax ID / National ID",
  "วิธีโอนจ่าย": "Payout Method",
  "โอนเข้าบัญชีธนาคาร": "Bank Transfer",
  "พร้อมเพย์": "PromptPay",
  "ธนาคารและพร้อมเพย์": "Bank and PromptPay",
  "ธนาคาร": "Bank",
  "สาขา": "Branch",
  "ประเภทบัญชี": "Account Type",
  "เลขที่บัญชี": "Account Number",
  "ประเภทพร้อมเพย์": "PromptPay Type",
  "เลขบัตรประชาชน": "National ID",
  "ที่อยู่สำหรับเอกสาร": "Document Address",
  "หมายเหตุ": "Note",
  "บันทึกและตรวจสอบบัญชีรับเงิน": "Save Payout Account",
  "บันทึกและตรวจรูปแบบข้อมูลแล้ว พร้อมส่งต่อ KYC/Bank verification provider ใน production": "Saved and format-checked. Ready for a production KYC or bank verification provider.",
  "หมายเหตุ: การตรวจสอบบัญชีว่าเป็นของจริงและรับเงินได้จริง ต้องเชื่อมต่อผู้ให้บริการ KYC/Bank verification หรือ payment gateway ใน production": "Note: Real bank-account verification requires a production KYC, bank verification, or payment gateway provider.",
  "กรุณาระบุชื่อบัญชีจริงอย่างน้อย 3 ตัวอักษร": "Please enter an account holder name with at least 3 characters.",
  "เลขที่บัญชีต้องเป็นตัวเลข 10-15 หลัก": "Account number must be 10-15 digits.",
  "PromptPay ID ต้องเป็นเบอร์ 10 หลัก, เลขบัตร 13 หลัก หรือ e-wallet 15 หลัก": "PromptPay ID must be a 10-digit phone number, 13-digit national ID, or 15-digit e-wallet ID.",
  "เปลี่ยนรหัสผ่าน": "Change Password",
  "กรุณาเปลี่ยนรหัสผ่านเริ่มต้นก่อนเข้าใช้งานครั้งแรก": "Please change the default password before your first use.",
  "รหัสผ่านเก่า": "Old Password",
  "รหัสผ่านใหม่": "New Password",
  "ยืนยันรหัสผ่านใหม่": "Confirm New Password",
  "บันทึกรหัสผ่านใหม่": "Save New Password",
  "รหัสผ่านใหม่และยืนยันรหัสผ่านไม่ตรงกัน": "New password and confirmation do not match.",
  "รหัสผ่านใหม่ต้องมีอย่างน้อย 8 ตัวอักษร พร้อมตัวพิมพ์ใหญ่ ตัวเลข และอักขระพิเศษ": "New password must be at least 8 characters and include an uppercase letter, a number, and a special character.",
  "เปลี่ยนรหัสผ่านสำเร็จ": "Password changed successfully.",
  "เปลี่ยนรหัสผ่านไม่สำเร็จ กรุณาตรวจสอบรหัสผ่านเก่า": "Could not change password. Please check your old password.",
  "ค้นหา username, email, slug, ref": "Search username, email, slug, ref",
  "ยอดโอนสำเร็จในรายการที่กรอง": "Paid total in filtered results",
  "Transaction โดเนท": "Donation Transactions",
  "โหลดรายการ User ไม่สำเร็จ": "Could not load users",
  "โหลดรายการ transaction ไม่สำเร็จ": "Could not load transactions",
  "โหลดข้อมูลไม่สำเร็จ": "Could not load data",
  "บันทึกข้อมูล User สำเร็จ": "User saved successfully",
  "ประวัติ Transaction": "Transaction History",
  "ยังไม่มีข้อมูลบัญชีโอนจ่ายของ User นี้": "This user has no payout account details yet.",
  "ชื่อบัญชี": "Account Name",
  "ชื่อนิติ/ชื่อจริง": "Legal / Real Name",
  "เบอร์โทร": "Phone",
  "เลขผู้เสียภาษี/บัตรประชาชน": "Tax ID / National ID",
  "เลขบัญชี": "Account Number",
  "สถานะ KYC": "KYC Status",
  "ที่อยู่": "Address",
  "ระบบจะสร้างรหัสผ่านชั่วคราวให้หลังบันทึก": "The system will create a temporary password after saving.",
  "ปฏิเสธ": "Reject",
  "อนุมัติ": "Approve",
  "รออีเมล": "Pending Email",
  "รอ Admin อนุมัติบัญชี": "Waiting for Admin Approval",
  "บัญชีนี้สมัครสำเร็จแล้ว แต่ยังไม่สามารถใช้งานระบบโดเนทและตั้งค่าต่าง ๆ ได้จนกว่า Admin จะอนุมัติ": "This account was created successfully, but donation and settings features are locked until an admin approves it.",
  "ดูสถานะโปรไฟล์": "View Profile Status",
  "กลับหน้าแรก": "Back Home",
  "กรุณาเข้าสู่ระบบก่อน": "Please sign in first",
  "ต้องเข้าสู่ระบบผ่าน Streamlabs ก่อนถึงจะใช้หน้าจัดการของ TipHouse ได้": "You must sign in with Streamlabs before using the TipHouse dashboard.",
  "ไม่ใช้ระบบรีเซ็ตรหัสผ่าน": "Password reset is not used",
  "ระบบ Creator ใช้ Streamlabs Login เท่านั้น จึงไม่ต้องใช้รหัสผ่านของ TipHouse สำหรับผู้ใช้งานทั่วไป": "Creator accounts use Streamlabs Login only, so general users do not need a TipHouse password.",
  "กลับไป Login ผ่าน Streamlabs": "Back to Streamlabs Login",
  "บุคคลนิรนาม": "Anonymous",
  "รายได้รวมที่ชำระสำเร็จ": "Paid revenue",
  "จำนวนรายการในช่วงที่เลือก": "Transactions in range",
  "ยอดโดเนทสูงสุด": "Highest donation",
  "Alert ซ้ำ": "Replay Alert",
  "ธุรกรรม": "Transactions",
  "รายได้รวม": "Total revenue",
  "รายได้รวมก่อนหักค่าบริการ": "Revenue before service fees",
  "ค่าธรรมเนียมการโอน 5%": "Transfer fee 5%",
  "คำนวณจากยอดรับชำระสำเร็จ": "Calculated from paid donations",
  "ยอดสุทธิโดยประมาณ": "Estimated net payout",
  "ก่อนตรวจเอกสารภาษีและการจ่ายเงินจริง": "Before tax document review and actual payout",
  "ค่าธรรมเนียมและภาษี": "Fees and Tax",
  "ค่าบริการ": "Service fee",
  "5% ของรายได้": "5% of revenue",
  "ภาษีมูลค่าเพิ่ม": "VAT",
  "ประมาณ": "Approx.",
  "ฟอร์มกรอกภาษี": "Tax Form",
  "ชื่อจริง": "First Name",
  "นามสกุล": "Last Name",
  "เลขที่เสียภาษี": "Tax ID",
  "อัปโหลดเอกสารยืนยันตัวตน: บัญชีธนาคาร / บัตรประชาชน": "Upload identity documents: bank account / national ID card",
  "ข้อมูลภาษีจะถูกใช้เพื่อออกเอกสารและตรวจสอบก่อนอนุมัติการถอนเงิน": "Tax information is used for documents and review before payout approval.",
  "ใบเสร็จรับเงิน": "Receipts",
  "เลขที่เอกสาร": "Document No.",
  "วันที่โอนเงิน": "Transfer Date",
  "จำนวนเงิน": "Amount",
  "ไม่พบหน้าโดเนทนี้ หรือ backend ยังไม่พร้อม": "Donation page not found or backend is not ready.",
  "ไม่สามารถสร้าง QR ได้ กรุณาลองใหม่อีกครั้ง": "Could not create QR. Please try again.",
  "ส่งกำลังใจให้ครีเอเตอร์ที่คุณชอบ": "Send support to your favorite creator",
  "ยอดโดเนทต้องไม่น้อยกว่า": "Minimum donation is",
  "ขั้นต่ำ": "Minimum",
  "บาท": "THB",
  "ชื่อผู้โดเนทมีคำที่ระบบไม่อนุญาต": "Donor name contains blocked words",
  "แสดงเป็น Anonymous": "Show as Anonymous",
  "ข้อความมีคำที่ระบบไม่อนุญาต": "Message contains blocked words",
  "ระบบชำระเงินเข้ารหัสและปลอดภัย ตรวจสอบรายการได้ก่อนจ่ายทุกครั้ง": "Review your secure payment before continuing.",
  "ส่งถึง": "To",
  "ชื่อที่แสดง": "Display Name",
  "ข้อความ": "Message",
  "ยอดโดเนท": "Donation",
  "ยอดชำระทั้งหมด": "Total",
  "หลังชำระเงิน กดตรวจสอบสถานะเพื่อให้ระบบยืนยันรายการ": "After payment, check status so the system can confirm the donation.",
  "ยอดชำระ": "Payment Amount",
  "บันทึกภาพ QR เพื่อเปิดในแอปธนาคาร": "Save QR image to open in your banking app",
  "กรุณาชำระภายใน 10:00 นาที อยู่ที่ขั้นตอนหน้าจอก่อนระบบตรวจสอบสำเร็จ": "Please pay within 10:00 minutes and stay on this screen until confirmation.",
  "วิธีชำระเงิน": "Payment Steps",
  "เปิดแอปธนาคาร": "Open your banking app",
  "สแกน QR Code หรือเลือกภาพ QR จากเครื่อง": "Scan the QR code or choose the saved QR image",
  "ชำระเงินตามยอดที่แสดง": "Pay the displayed amount",
  "ขอบคุณสำหรับการสนับสนุน": "Thank you for your support",
  "ระบบยืนยันรายการแล้ว": "The system has confirmed the donation",
  "สถานะ": "Status",
  "ดูอันดับผู้สนับสนุน": "View Supporter Ranking",
  "ทำตามขั้นตอนด้านล่างเพื่อโดเนทและส่ง Alert ไปยังสตรีมเมอร์": "Follow these steps to donate and send an alert to the streamer",
  "เลือกยอดโดเนทและกรอกชื่อ/ข้อความ": "Choose an amount and enter your name/message",
  "ตรวจสอบรายการก่อนสร้าง QR": "Review the donation before generating QR",
  "ชำระเงินและกดตรวจสอบสถานะ": "Pay and check the status",
  "Admin login ไม่สำเร็จ": "Admin login failed",
  "กำลังเข้าสู่ระบบ...": "Signing in...",
  "เข้าสู่ระบบ Admin": "Sign in as Admin",
  "Session หมดอายุ กรุณา Login Admin ใหม่": "Session expired. Please sign in to Admin again.",
  "โหลดรายการขออนุมัติไม่สำเร็จ": "Could not load approval requests",
  "สร้าง": "Created",
  "สำเร็จ": "successfully",
  "Reset password ของ": "Reset password for",
  "โหลดประวัติ transaction ไม่สำเร็จ": "Could not load transaction history",
  "อนุมัติคำขอแล้ว": "Request approved",
  "ปฏิเสธคำขอแล้ว": "Request rejected",
  "จัดการ": "Manage",
  "ชื่อแสดงผล": "Display Name",
};

function shouldSkipNode(node: Node) {
  const parent = node.parentElement;
  if (!parent) return true;
  return ["SCRIPT", "STYLE", "TEXTAREA", "INPUT"].includes(parent.tagName);
}

function hasThai(text: string) {
  return /[\u0E00-\u0E7F]/.test(text);
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
      if (language === "th") {
        if (originals.current.has(node)) node.nodeValue = originals.current.get(node) ?? node.nodeValue;
        return;
      }
      const currentValue = node.nodeValue ?? "";
      if (!hasThai(currentValue)) return;
      if (!originals.current.has(node)) originals.current.set(node, currentValue);
      const original = originals.current.get(node) ?? currentValue;
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
