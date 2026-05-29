const APP_NAME = "TipHouse";
const STORAGE_KEY = "tiphouse_donations";
const SETTINGS_KEY = "tiphouse_settings";
const BANK_KEY = "tiphouse_bank_account";
const USER_KEY = "tiphouse_user";
const ALERT_KEY = "tiphouse_last_alert";
const channel = "BroadcastChannel" in window ? new BroadcastChannel("tiphouse-alerts") : null;

const defaults = {
  slug: "bunniesch",
  creator: "Bunnie SCH",
  handle: "@bunniesch",
  goal: 5000,
  raised: 3270,
  minAmount: 20,
  streamerKey: "abc123",
  banner:
    "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=1200&q=80",
  avatar: "TH",
  pageTheme: "Aurora Mint",
  accent: "#38e2c2",
  presetAmounts: [20, 50, 100, 300],
  overlayTheme: "Neon Glow",
  overlayPosition: "Center",
  alertDuration: 7,
  ttsEnabled: true,
  soundEnabled: true,
};

const seedDonations = [
  {
    id: "d1",
    donor_name: "Mina",
    amount: 250,
    message: "สตรีมวันนี้สนุกมาก!",
    anonymous: false,
    payment_status: "paid",
    created_at: "2026-05-29T09:30:00.000Z",
  },
  {
    id: "d2",
    donor_name: "Anonymous",
    amount: 100,
    message: "สู้ๆนะ",
    anonymous: true,
    payment_status: "paid",
    created_at: "2026-05-29T10:10:00.000Z",
  },
  {
    id: "d3",
    donor_name: "North",
    amount: 500,
    message: "ขอเพลงเปิดท้ายด้วยครับ",
    anonymous: false,
    payment_status: "pending",
    created_at: "2026-05-29T11:00:00.000Z",
  },
];

const routes = {
  "/": renderHome,
  "/register": renderRegister,
  "/bunniesch": renderDonateOnly,
  "/donate/bunniesch": renderDonateOnly,
  "/dashboard": renderDashboard,
  "/bank": renderBank,
  "/overlay-settings": renderOverlaySettings,
  "/donation-design": renderDonationDesign,
  "/admin": renderAdmin,
  "/overlay/abc123": renderOverlay,
};

function readJson(key, fallback) {
  const raw = localStorage.getItem(key);
  if (!raw) {
    localStorage.setItem(key, JSON.stringify(fallback));
    return structuredClone(fallback);
  }
  try {
    return { ...structuredClone(fallback), ...JSON.parse(raw) };
  } catch {
    localStorage.setItem(key, JSON.stringify(fallback));
    return structuredClone(fallback);
  }
}

function getSettings() {
  return readJson(SETTINGS_KEY, defaults);
}

function saveSettings(settings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...getSettings(), ...settings }));
}

function getDonations() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(seedDonations));
    return seedDonations;
  }
  try {
    return JSON.parse(raw);
  } catch {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(seedDonations));
    return seedDonations;
  }
}

function saveDonations(donations) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(donations));
}

function money(value) {
  return new Intl.NumberFormat("th-TH", {
    style: "currency",
    currency: "THB",
    maximumFractionDigits: 0,
  }).format(value);
}

function dateTime(value) {
  return new Intl.DateTimeFormat("th-TH", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function baseUrl() {
  return `${location.origin}${location.pathname}`;
}

function currentPath() {
  return window.location.hash.slice(1) || "/";
}

function nav(activePath) {
  const donateUrl = `${baseUrl()}#/donate/bunniesch`;
  const items = [
    ["หน้าแรก", "/"],
    ["Dashboard", "/dashboard"],
    ["บัญชีรับเงิน", "/bank"],
    ["ตั้งค่า Overlay", "/overlay-settings"],
    ["ตั้งค่าหน้าโดเนท", "/donation-design"],
    ["Admin", "/admin"],
  ];

  return `
    <header class="topbar">
      <a class="brand" href="#/">
        <span class="brand-mark">TH</span>
        <span>${APP_NAME}</span>
      </a>
      <nav class="nav">
        <a href="${donateUrl}" target="_blank" rel="noopener">หน้าโดเนท</a>
        ${items
          .map(
            ([label, href]) =>
              `<a class="${activePath === href ? "active" : ""}" href="#${href}">${label}</a>`,
          )
          .join("")}
        <a class="${activePath === "/register" ? "active" : ""}" href="#/register">สมัครใช้งาน</a>
      </nav>
    </header>
  `;
}

function appShell(path, body) {
  return `<div class="shell">${nav(path)}<main class="main">${body}</main></div>`;
}

function renderHome() {
  const settings = getSettings();
  const paid = getDonations().filter((donation) => donation.payment_status === "paid");
  const total = paid.reduce((sum, donation) => sum + Number(donation.amount), 0);
  return appShell(
    "/",
    `
      <section class="hero">
        <div>
          <div class="eyebrow">Realtime Donate Platform for Streamers</div>
          <h1>${APP_NAME}</h1>
          <p class="lead">
            ระบบรับโดเนทสำหรับครีเอเตอร์ พร้อมหน้าโดเนทส่วนตัว PromptPay QR,
            realtime alert สำหรับ OBS/Streamlabs, dashboard, admin panel และหน้าตั้งค่าครบสำหรับ MVP
          </p>
          <div class="actions">
            <a class="btn primary" href="${baseUrl()}#/donate/${settings.slug}" target="_blank" rel="noopener">เปิดหน้าโดเนทใหม่</a>
            <a class="btn" href="#/overlay-settings">ตั้งค่า Overlay</a>
            <a class="btn" href="#/register">สมัครใช้งาน</a>
            <button class="btn warn" data-action="demo-alert">ทดสอบ Alert</button>
          </div>
        </div>
        <aside class="panel donate-preview">
          <div class="creator-banner" style="background-image: linear-gradient(rgba(0,0,0,.12), rgba(0,0,0,.55)), url('${settings.banner}')">
            <div class="creator-row">
              <div>
                <div class="avatar">${escapeHtml(settings.avatar)}</div>
                <h2>${escapeHtml(settings.creator)}</h2>
                <p class="muted">${escapeHtml(settings.handle)}</p>
              </div>
              <span class="badge">Live</span>
            </div>
          </div>
          <div class="donate-preview-body">
            <div class="stats-grid">
              <div class="stat"><strong>${money(total)}</strong><span>ยอดรับวันนี้</span></div>
              <div class="stat"><strong>${paid.length}</strong><span>โดเนทสำเร็จ</span></div>
              <div class="stat"><strong>60 FPS</strong><span>OBS Ready</span></div>
            </div>
          </div>
        </aside>
      </section>
      <section class="section">
        <h2>เมนูจัดการระบบ</h2>
        <div class="feature-grid">
          ${[
            ["สมัครใช้งาน", "ลงทะเบียน username, email, password และ slug หน้าโดเนท"],
            ["ผูกบัญชีธนาคาร", "บันทึกบัญชีรับเงิน PromptPay และสถานะ KYC สำหรับรับยอดโดเนท"],
            ["ตั้งค่า Overlay", "สร้างลิงก์ Browser Source และตกแต่ง animation, TTS, sound alert"],
            ["ตั้งค่าหน้าโดเนท", "ตั้ง banner, avatar, theme, goal และยอดโดเนทขั้นต่ำ"],
          ]
            .map(([title, desc]) => `<article class="card"><h3>${title}</h3><p>${desc}</p></article>`)
            .join("")}
        </div>
      </section>
    `,
  );
}

function renderDonateOnly() {
  const settings = getSettings();
  const donations = getDonations();
  const paid = donations.filter((donation) => donation.payment_status === "paid");
  const total = settings.raised + paid.reduce((sum, donation) => sum + Number(donation.amount), 0);
  const goalPercent = Math.min(100, Math.round((total / settings.goal) * 100));
  const presetAmounts = settings.presetAmounts
    .filter((amount) => amount >= settings.minAmount)
    .slice(0, 4);
  const initialAmount = presetAmounts[0] || settings.minAmount;

  return `
    <main class="donate-only">
      <section class="donor-hero" style="background-image: linear-gradient(rgba(0,0,0,.12), rgba(0,0,0,.72)), url('${settings.banner}')">
        <a class="brand donor-brand" href="#/">
          <span class="brand-mark">TH</span>
          <span>${APP_NAME}</span>
        </a>
        <div class="donor-profile">
          <div class="avatar">${escapeHtml(settings.avatar)}</div>
          <div>
            <span class="badge">${escapeHtml(settings.pageTheme)}</span>
            <h1>${escapeHtml(settings.creator)}</h1>
            <p>${escapeHtml(settings.handle)} รับโดเนทขั้นต่ำ ${money(settings.minAmount)}</p>
          </div>
        </div>
      </section>
      <section class="main donate-main">
        <div class="page-head">
          <div>
            <div class="eyebrow">Donation Page</div>
            <h2 class="page-title">ส่งกำลังใจให้สตรีมเมอร์</h2>
            <p class="lead">หน้านี้ถูกแยกสำหรับผู้โดเนทเท่านั้น ไม่มี dashboard/admin รบกวน flow การจ่ายเงิน</p>
          </div>
        </div>
        <section class="donation-layout">
          <form class="panel form" id="donateForm">
            <div class="field">
              <label for="donorName">ชื่อผู้โดเนท</label>
              <input class="input" id="donorName" name="donorName" value="แฟนคลับใจดี" maxlength="40" required />
            </div>
            <div class="field">
              <label for="message">ข้อความ</label>
              <textarea class="textarea" id="message" name="message" maxlength="160" required>ขอบคุณที่สตรีมให้ดูนะครับ</textarea>
            </div>
            <div class="field">
              <label>จำนวนเงิน</label>
              <div class="amounts" id="amounts">
                ${presetAmounts.map((amount) => `<button type="button" data-amount="${amount}">฿${amount}</button>`).join("")}
              </div>
              <input class="input" id="amount" name="amount" type="number" min="${settings.minAmount}" value="${initialAmount}" required />
              <span class="muted">ขั้นต่ำ ${money(settings.minAmount)}</span>
            </div>
            <label class="check">
              <input id="anonymous" name="anonymous" type="checkbox" />
              แสดงเป็น Anonymous
            </label>
            <button class="btn primary" type="submit">สร้าง PromptPay QR และส่ง Alert</button>
            <p class="muted">MVP นี้จำลอง payment validation เป็นสำเร็จทันทีเพื่อทดสอบ realtime flow</p>
          </form>
          <aside class="panel qr-box">
            <div>
              <h2>PromptPay QR</h2>
              <p class="muted">Ref: TH-${settings.streamerKey.toUpperCase()}-${Date.now().toString().slice(-5)}</p>
            </div>
            <div class="qr">${qrSvg("TIPHOUSE-PROMPTPAY-" + settings.slug)}</div>
            <strong id="qrAmount">${money(initialAmount)}</strong>
            <div class="field" style="width:100%">
              <label>Donation Goal ${goalPercent}%</label>
              <div class="goal" style="--goal:${goalPercent}%"><span></span></div>
              <span class="muted">${money(total)} / ${money(settings.goal)}</span>
            </div>
          </aside>
        </section>
        <section class="section">
          <h2>Recent Donations</h2>
          <div class="donation-list">${donationList(paid.slice(0, 6))}</div>
        </section>
      </section>
    </main>
  `;
}

function renderRegister() {
  return appShell(
    "/register",
    `
      <div class="page-head">
        <div>
          <div class="eyebrow">Create Account</div>
          <h1 class="page-title">สมัครใช้งาน ${APP_NAME}</h1>
          <p class="lead">สร้างบัญชีครีเอเตอร์และรับ slug สำหรับหน้าโดเนทของตัวเอง</p>
        </div>
      </div>
      <section class="settings-grid">
        <form class="panel form" id="registerForm">
          <div class="field"><label>ชื่อช่อง / Display name</label><input class="input" name="creator" value="Bunnie SCH" required /></div>
          <div class="field"><label>Username</label><input class="input" name="username" value="bunniesch" required /></div>
          <div class="field"><label>Email</label><input class="input" name="email" type="email" value="creator@tiphouse.test" required /></div>
          <div class="field"><label>Password</label><input class="input" name="password" type="password" value="password123" required /></div>
          <div class="field"><label>Donation slug</label><input class="input" name="slug" value="bunniesch" required /></div>
          <label class="check"><input type="checkbox" required checked /> ยอมรับเงื่อนไขการใช้งานและนโยบายความปลอดภัย</label>
          <button class="btn primary" type="submit">สมัครใช้งาน</button>
        </form>
        <aside class="panel card">
          <h3>หลังสมัครใช้งาน</h3>
          <div class="donation-list">
            <div class="donation-item"><strong>1. ผูกบัญชีธนาคาร</strong><span class="badge">Required</span><p>ใช้สำหรับรับยอดโดเนทและตรวจสอบ KYC</p></div>
            <div class="donation-item"><strong>2. ตั้งค่าหน้าโดเนท</strong><span class="badge">Theme</span><p>กำหนด banner, avatar, goal และขั้นต่ำ</p></div>
            <div class="donation-item"><strong>3. ตั้งค่า Overlay</strong><span class="badge">Live</span><p>นำลิงก์ overlay ไปใส่ใน OBS Browser Source</p></div>
          </div>
        </aside>
      </section>
    `,
  );
}

function renderBank() {
  const bank = readJson(BANK_KEY, {
    accountName: "Bunnie SCH",
    bankName: "Kasikorn Bank",
    accountNumber: "123-4-56789-0",
    promptpayId: "0812345678",
    payoutMode: "PromptPay",
    kycStatus: "pending",
  });

  return appShell(
    "/bank",
    `
      <div class="page-head">
        <div>
          <div class="eyebrow">Payout Account</div>
          <h1 class="page-title">ผูกบัญชีรับเงิน</h1>
          <p class="lead">ตั้งค่าบัญชีธนาคารหรือ PromptPay ที่ใช้รับยอดเงินโดเนท</p>
        </div>
        <span class="badge">${bank.kycStatus}</span>
      </div>
      <section class="settings-grid">
        <form class="panel form" id="bankForm">
          <div class="field"><label>ชื่อบัญชี</label><input class="input" name="accountName" value="${escapeHtml(bank.accountName)}" required /></div>
          <div class="field"><label>ธนาคาร</label><select class="select" name="bankName">${bankOptions(bank.bankName)}</select></div>
          <div class="field"><label>เลขที่บัญชี</label><input class="input" name="accountNumber" value="${escapeHtml(bank.accountNumber)}" required /></div>
          <div class="field"><label>PromptPay ID</label><input class="input" name="promptpayId" value="${escapeHtml(bank.promptpayId)}" required /></div>
          <div class="field"><label>รูปแบบรับเงิน</label><select class="select" name="payoutMode"><option>PromptPay</option><option>Bank Transfer</option><option>Gateway Settlement</option></select></div>
          <button class="btn primary" type="submit">บันทึกบัญชีรับเงิน</button>
        </form>
        <aside class="panel card">
          <h3>Payment Validation</h3>
          <div class="donation-list">
            <div class="donation-item"><strong>PromptPay QR</strong><span class="badge">ready</span><p>ใช้ข้อมูล PromptPay ID เพื่อสร้าง QR แบบ dynamic</p></div>
            <div class="donation-item"><strong>Omise / GBPrimePay</strong><span class="badge">next</span><p>เพิ่ม webhook signature เมื่อเชื่อม gateway จริง</p></div>
            <div class="donation-item"><strong>KYC</strong><span class="badge danger">pending</span><p>ต้องตรวจเอกสารก่อน payout จริงใน production</p></div>
          </div>
        </aside>
      </section>
    `,
  );
}

function renderOverlaySettings() {
  const settings = getSettings();
  const overlayUrl = `${baseUrl()}#/overlay/${settings.streamerKey}`;
  return appShell(
    "/overlay-settings",
    `
      <div class="page-head">
        <div>
          <div class="eyebrow">OBS Browser Source</div>
          <h1 class="page-title">ตั้งค่า Overlay</h1>
          <p class="lead">ตกแต่ง alert และคัดลอก path สำหรับนำไปใส่ใน OBS/Streamlabs</p>
        </div>
        <a class="btn primary" href="#/overlay/${settings.streamerKey}">เปิด Overlay</a>
      </div>
      <section class="settings-grid">
        <form class="panel form" id="overlaySettingsForm">
          <div class="field">
            <label>OBS Overlay URL</label>
            <div class="copy-row">
              <input class="input" id="overlayUrl" value="${overlayUrl}" readonly />
              <button class="btn" type="button" data-action="copy-overlay">Copy</button>
            </div>
          </div>
          <div class="field"><label>Streamer key</label><input class="input" name="streamerKey" value="${escapeHtml(settings.streamerKey)}" required /></div>
          <div class="field"><label>Alert theme</label><select class="select" name="overlayTheme">${optionList(["Neon Glow", "Anime Bounce", "Minimal Slide", "Golden Pop"], settings.overlayTheme)}</select></div>
          <div class="field"><label>ตำแหน่ง Alert</label><select class="select" name="overlayPosition">${optionList(["Center", "Top", "Bottom"], settings.overlayPosition)}</select></div>
          <div class="field"><label>ระยะเวลาแสดงผล (วินาที)</label><input class="input" name="alertDuration" type="number" min="3" max="20" value="${settings.alertDuration}" /></div>
          <label class="check"><input name="ttsEnabled" type="checkbox" ${settings.ttsEnabled ? "checked" : ""} /> เปิด Thai / English TTS</label>
          <label class="check"><input name="soundEnabled" type="checkbox" ${settings.soundEnabled ? "checked" : ""} /> เปิดเสียง Alert</label>
          <button class="btn primary" type="submit">บันทึก Overlay</button>
        </form>
        <aside class="panel card overlay-preview-card">
          <h3>Preview Alert</h3>
          <div class="mini-stage">
            <div class="stream-alert mini-alert">
              <div class="avatar">${escapeHtml(settings.avatar)}</div>
              <div>
                <span class="badge">${escapeHtml(settings.overlayTheme)}</span>
                <h1>Anonymous donated ฿100</h1>
                <p>สู้ๆนะ</p>
              </div>
            </div>
          </div>
          <button class="btn warn" data-action="demo-alert">ทดสอบ Alert</button>
        </aside>
      </section>
    `,
  );
}

function renderDonationDesign() {
  const settings = getSettings();
  return appShell(
    "/donation-design",
    `
      <div class="page-head">
        <div>
          <div class="eyebrow">Donation Page Builder</div>
          <h1 class="page-title">ตั้งค่าหน้าโดเนท</h1>
          <p class="lead">กำหนดหน้าตา หน้า URL และยอดโดเนทขั้นต่ำที่ผู้โดเนทต้องจ่าย</p>
        </div>
        <a class="btn primary" href="${baseUrl()}#/donate/${settings.slug}" target="_blank" rel="noopener">ดูหน้าโดเนท</a>
      </div>
      <section class="settings-grid">
        <form class="panel form" id="donationDesignForm">
          <div class="field"><label>ชื่อครีเอเตอร์</label><input class="input" name="creator" value="${escapeHtml(settings.creator)}" required /></div>
          <div class="field"><label>Handle</label><input class="input" name="handle" value="${escapeHtml(settings.handle)}" required /></div>
          <div class="field"><label>Donation slug</label><input class="input" name="slug" value="${escapeHtml(settings.slug)}" required /></div>
          <div class="field"><label>Avatar text</label><input class="input" name="avatar" value="${escapeHtml(settings.avatar)}" maxlength="4" required /></div>
          <div class="field"><label>Banner image URL</label><input class="input" name="banner" value="${escapeHtml(settings.banner)}" required /></div>
          <div class="field"><label>Theme</label><select class="select" name="pageTheme">${optionList(["Aurora Mint", "Concert Night", "Soft Candy", "Gold Studio"], settings.pageTheme)}</select></div>
          <div class="field"><label>Donation goal</label><input class="input" name="goal" type="number" min="100" value="${settings.goal}" required /></div>
          <div class="field"><label>ยอดโดเนทขั้นต่ำ</label><input class="input" name="minAmount" type="number" min="1" value="${settings.minAmount}" required /></div>
          <div class="field"><label>ปุ่มยอดเงินแนะนำ</label><input class="input" name="presetAmounts" value="${settings.presetAmounts.join(", ")}" /></div>
          <button class="btn primary" type="submit">บันทึกหน้าโดเนท</button>
        </form>
        <aside class="panel donate-preview">
          <div class="creator-banner" style="background-image: linear-gradient(rgba(0,0,0,.12), rgba(0,0,0,.55)), url('${settings.banner}')">
            <div class="creator-row">
              <div>
                <div class="avatar">${escapeHtml(settings.avatar)}</div>
                <h2>${escapeHtml(settings.creator)}</h2>
                <p class="muted">${escapeHtml(settings.handle)}</p>
              </div>
              <span class="badge">${escapeHtml(settings.pageTheme)}</span>
            </div>
          </div>
          <div class="donate-preview-body">
            <div class="stats-grid">
              <div class="stat"><strong>${money(settings.minAmount)}</strong><span>ขั้นต่ำ</span></div>
              <div class="stat"><strong>${money(settings.goal)}</strong><span>เป้าหมาย</span></div>
              <div class="stat"><strong>/${escapeHtml(settings.slug)}</strong><span>URL</span></div>
            </div>
          </div>
        </aside>
      </section>
    `,
  );
}

function renderDashboard() {
  const settings = getSettings();
  const donations = getDonations();
  const paid = donations.filter((donation) => donation.payment_status === "paid");
  const total = paid.reduce((sum, donation) => sum + Number(donation.amount), 0);
  const avg = paid.length ? Math.round(total / paid.length) : 0;

  return appShell(
    "/dashboard",
    `
      <div class="page-head">
        <div>
          <div class="eyebrow">User Dashboard</div>
          <h1 class="page-title">Dashboard</h1>
          <p class="lead">จัดการรายได้ donation history, payout, หน้าโดเนท และ overlay URL</p>
        </div>
        <button class="btn primary" data-action="export-csv">Export CSV</button>
      </div>
      <section class="dashboard-grid">
        <div class="stat"><strong>${money(total)}</strong><span>Revenue</span></div>
        <div class="stat"><strong>${paid.length}</strong><span>Paid donations</span></div>
        <div class="stat"><strong>${money(avg)}</strong><span>Average tip</span></div>
        <div class="stat"><strong>${money(settings.minAmount)}</strong><span>Minimum tip</span></div>
        <article class="panel card wide">
          <h3>Revenue Summary</h3>
          <div class="chart">${[35, 56, 42, 72, 58, 86, 64, 92].map((h) => `<span class="bar" style="height:${h}%"></span>`).join("")}</div>
        </article>
        <article class="panel card wide">
          <h3>Quick Links</h3>
          <div class="form">
            <div class="field"><label>Donation Page</label><input class="input" value="${baseUrl()}#/donate/${settings.slug}" readonly /></div>
            <div class="field"><label>OBS Browser Source</label><input class="input" value="${baseUrl()}#/overlay/${settings.streamerKey}" readonly /></div>
            <div class="actions compact"><a class="btn" href="#/bank">ผูกบัญชี</a><a class="btn" href="#/donation-design">ตั้งค่าหน้าโดเนท</a><a class="btn" href="#/overlay-settings">ตั้งค่า Overlay</a></div>
          </div>
        </article>
        <article class="panel card wide">
          <h3>Donation History</h3>
          ${donationTable(donations)}
        </article>
        <article class="panel card wide">
          <h3>System Status</h3>
          <div class="donation-list">
            <div class="donation-item"><strong>PromptPay</strong><span class="badge">ready</span><p>Dynamic QR mock พร้อมใช้งานใน MVP</p></div>
            <div class="donation-item"><strong>Realtime Overlay</strong><span class="badge">active</span><p>BroadcastChannel + localStorage event สำหรับทดสอบ OBS</p></div>
            <div class="donation-item"><strong>Payout Account</strong><span class="badge danger">review</span><p>รอ KYC ก่อนจ่ายเงินจริง</p></div>
          </div>
        </article>
      </section>
    `,
  );
}

function renderAdmin() {
  const donations = getDonations();
  const paidCount = donations.filter((d) => d.payment_status === "paid").length;
  const pendingCount = donations.filter((d) => d.payment_status === "pending").length;

  return appShell(
    "/admin",
    `
      <div class="page-head">
        <div>
          <div class="eyebrow">Admin Dashboard</div>
          <h1 class="page-title">Admin Panel</h1>
          <p class="lead">ตรวจสอบผู้ใช้งาน payment validation, webhook logs, fraud signal และ audit log</p>
        </div>
        <button class="btn warn" data-action="simulate-webhook">Simulate Webhook</button>
      </div>
      <section class="stats-grid">
        <div class="stat"><strong>1,284</strong><span>Users</span></div>
        <div class="stat"><strong>${paidCount}</strong><span>Validated payments</span></div>
        <div class="stat"><strong>${pendingCount}</strong><span>Pending review</span></div>
      </section>
      <section class="section admin-grid">
        <article class="panel card">
          <h3>Donation Audit</h3>
          ${donationTable(donations)}
        </article>
        <article class="panel card">
          <h3>Security Controls</h3>
          <div class="donation-list">
            ${[
              ["JWT Authentication", "active"],
              ["2FA Admin", "active"],
              ["Rate Limit", "active"],
              ["Captcha", "active"],
              ["Fraud Detection", "watch"],
              ["Webhook Signature", "active"],
            ]
              .map(([name, status]) => `<div class="donation-item"><strong>${name}</strong><span class="badge ${status === "watch" ? "danger" : ""}">${status}</span></div>`)
              .join("")}
          </div>
        </article>
        <article class="panel card">
          <h3>User Management</h3>
          <table class="table">
            <thead><tr><th>User</th><th>Role</th><th>Status</th><th>Action</th></tr></thead>
            <tbody>
              <tr><td>bunniesch</td><td>creator</td><td><span class="badge">active</span></td><td><button class="btn">Review</button></td></tr>
              <tr><td>admin</td><td>admin</td><td><span class="badge">2FA</span></td><td><button class="btn">Audit</button></td></tr>
              <tr><td>spam-watch</td><td>donor</td><td><span class="badge danger">flagged</span></td><td><button class="btn warn">Suspend</button></td></tr>
            </tbody>
          </table>
        </article>
        <article class="panel card">
          <h3>Webhook Logs</h3>
          <div class="donation-list">
            <div class="donation-item"><strong>Omise charge.complete</strong><span class="badge">200</span><p>Signature valid, donation emitted to Redis Pub/Sub</p></div>
            <div class="donation-item"><strong>GBPrimePay callback</strong><span class="badge">200</span><p>Payment matched transaction_ref</p></div>
            <div class="donation-item"><strong>PromptPay manual check</strong><span class="badge danger">review</span><p>Amount mismatch requires admin validation</p></div>
          </div>
        </article>
      </section>
    `,
  );
}

function renderOverlay() {
  const settings = getSettings();
  document.body.classList.add("overlay-page", `overlay-${settings.overlayPosition.toLowerCase()}`);
  return `
    <div class="overlay-page">
      <div class="alert-stage" id="alertStage"></div>
      <div class="overlay-controls">
        <button class="btn primary" data-action="demo-alert">Test Alert</button>
        <a class="btn" href="#/overlay-settings">Settings</a>
      </div>
    </div>
  `;
}

function bankOptions(selected) {
  return optionList(
    ["Kasikorn Bank", "SCB", "Bangkok Bank", "Krungthai Bank", "Krungsri", "TTB", "PromptPay Only"],
    selected,
  );
}

function optionList(items, selected) {
  return items.map((item) => `<option ${item === selected ? "selected" : ""}>${item}</option>`).join("");
}

function donationList(donations) {
  if (!donations.length) return `<p class="muted">ยังไม่มี donation</p>`;
  return donations
    .map(
      (donation) => `
        <div class="donation-item">
          <strong>${escapeHtml(donation.anonymous ? "Anonymous" : donation.donor_name)}</strong>
          <span>${money(donation.amount)}</span>
          <p>${escapeHtml(donation.message)}</p>
        </div>
      `,
    )
    .join("");
}

function donationTable(donations) {
  return `
    <table class="table">
      <thead><tr><th>Donor</th><th>Amount</th><th>Status</th><th>Created</th></tr></thead>
      <tbody>
        ${donations
          .map(
            (donation) => `
              <tr>
                <td>${escapeHtml(donation.anonymous ? "Anonymous" : donation.donor_name)}</td>
                <td>${money(donation.amount)}</td>
                <td><span class="badge ${donation.payment_status === "paid" ? "" : "danger"}">${donation.payment_status}</span></td>
                <td>${dateTime(donation.created_at)}</td>
              </tr>
            `,
          )
          .join("")}
      </tbody>
    </table>
  `;
}

function qrSvg(text) {
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
  const cells = 25;
  const rects = [];
  for (let y = 0; y < cells; y += 1) {
    for (let x = 0; x < cells; x += 1) {
      const finder =
        (x < 7 && y < 7) ||
        (x > cells - 8 && y < 7) ||
        (x < 7 && y > cells - 8);
      const value = finder || ((x * 13 + y * 17 + hash) % 7 < 3 && x > 1 && y > 1);
      if (value) rects.push(`<rect x="${x}" y="${y}" width="1" height="1" />`);
    }
  }
  return `<svg viewBox="0 0 ${cells} ${cells}" role="img" aria-label="PromptPay QR"><rect width="${cells}" height="${cells}" fill="#fff"/><g fill="#071012">${rects.join("")}</g></svg>`;
}

function publishDonation(payload) {
  const message = { type: "new_donation", payload };
  if (channel) channel.postMessage(message);
  localStorage.setItem(ALERT_KEY, JSON.stringify({ ...message, nonce: Date.now() }));
}

function createDonation(form) {
  const settings = getSettings();
  const data = new FormData(form);
  const amount = Number(data.get("amount") || 0);
  if (amount < settings.minAmount) {
    toast(`ยอดขั้นต่ำคือ ${money(settings.minAmount)}`);
    return;
  }
  const anonymous = data.get("anonymous") === "on";
  const donation = {
    id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
    donor_name: anonymous ? "Anonymous" : String(data.get("donorName") || "Anonymous").trim(),
    amount,
    message: String(data.get("message") || "").trim(),
    anonymous,
    payment_status: "paid",
    transaction_ref: `TH-${Date.now()}`,
    avatar: settings.avatar,
    sound: "default.mp3",
    created_at: new Date().toISOString(),
  };
  saveDonations([donation, ...getDonations()]);
  publishDonation(donation);
  toast("ชำระเงินสำเร็จและส่ง realtime alert แล้ว");
  render();
}

function showAlert(payload) {
  const stage = document.getElementById("alertStage");
  if (!stage) return;
  const settings = getSettings();
  const el = document.createElement("div");
  el.className = `stream-alert ${settings.overlayTheme.toLowerCase().replaceAll(" ", "-")}`;
  el.innerHTML = `
    <div class="avatar">${escapeHtml(payload.avatar || settings.avatar || "TH")}</div>
    <div>
      <span class="badge">NEW DONATION</span>
      <h1>${escapeHtml(payload.donor_name || "Anonymous")} donated ${money(payload.amount || 0)}</h1>
      <p>${escapeHtml(payload.message || "Thank you!")}</p>
    </div>
  `;
  stage.replaceChildren(el);
  if (settings.ttsEnabled) speak(payload.message || "ขอบคุณสำหรับโดเนท");
  setTimeout(() => {
    if (stage.contains(el)) stage.replaceChildren();
  }, Number(settings.alertDuration || 7) * 1000);
}

function speak(text) {
  if (!("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = /[ก-๙]/.test(text) ? "th-TH" : "en-US";
  utterance.rate = 1;
  window.speechSynthesis.speak(utterance);
}

function demoAlert() {
  const settings = getSettings();
  const payload = {
    donor_name: "Anonymous",
    amount: Math.max(100, settings.minAmount),
    message: "สู้ๆนะ",
    anonymous: true,
    payment_status: "paid",
    avatar: settings.avatar,
    created_at: new Date().toISOString(),
  };
  publishDonation(payload);
  showAlert(payload);
}

function toast(message) {
  const current = document.querySelector(".toast");
  if (current) current.remove();
  const el = document.createElement("div");
  el.className = "toast";
  el.textContent = message;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2600);
}

function exportCsv() {
  const rows = [
    ["id", "donor_name", "amount", "message", "payment_status", "created_at"],
    ...getDonations().map((d) => [d.id, d.donor_name, d.amount, d.message, d.payment_status, d.created_at]),
  ];
  const csv = rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "tiphouse-donations.csv";
  link.click();
  URL.revokeObjectURL(url);
}

function simulateWebhook() {
  const donations = getDonations();
  const pending = donations.find((donation) => donation.payment_status === "pending");
  if (!pending) {
    toast("ไม่มี payment pending ให้ validate");
    return;
  }
  pending.payment_status = "paid";
  pending.transaction_ref = `WEBHOOK-${Date.now()}`;
  saveDonations(donations);
  publishDonation(pending);
  toast("Webhook validated และส่ง alert แล้ว");
  render();
}

function formObject(form) {
  const data = new FormData(form);
  return Object.fromEntries(data.entries());
}

function bindForms() {
  const registerForm = document.getElementById("registerForm");
  if (registerForm) {
    registerForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const data = formObject(registerForm);
      localStorage.setItem(USER_KEY, JSON.stringify({ ...data, created_at: new Date().toISOString() }));
      saveSettings({ creator: data.creator, slug: data.slug, handle: `@${data.username}` });
      toast("สมัครใช้งานสำเร็จ");
      setTimeout(() => {
        window.location.hash = "/bank";
      }, 500);
    });
  }

  const bankForm = document.getElementById("bankForm");
  if (bankForm) {
    bankForm.addEventListener("submit", (event) => {
      event.preventDefault();
      localStorage.setItem(BANK_KEY, JSON.stringify({ ...formObject(bankForm), kycStatus: "pending" }));
      toast("บันทึกบัญชีรับเงินแล้ว");
    });
  }

  const overlayForm = document.getElementById("overlaySettingsForm");
  if (overlayForm) {
    overlayForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const data = formObject(overlayForm);
      saveSettings({
        streamerKey: data.streamerKey,
        overlayTheme: data.overlayTheme,
        overlayPosition: data.overlayPosition,
        alertDuration: Number(data.alertDuration || 7),
        ttsEnabled: data.ttsEnabled === "on",
        soundEnabled: data.soundEnabled === "on",
      });
      toast("บันทึก Overlay แล้ว");
      render();
    });
  }

  const designForm = document.getElementById("donationDesignForm");
  if (designForm) {
    designForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const data = formObject(designForm);
      const presetAmounts = String(data.presetAmounts || "")
        .split(",")
        .map((value) => Number(value.trim()))
        .filter((value) => Number.isFinite(value) && value > 0);
      saveSettings({
        creator: data.creator,
        handle: data.handle,
        slug: data.slug,
        avatar: data.avatar,
        banner: data.banner,
        pageTheme: data.pageTheme,
        goal: Number(data.goal || defaults.goal),
        minAmount: Number(data.minAmount || defaults.minAmount),
        presetAmounts: presetAmounts.length ? presetAmounts : defaults.presetAmounts,
      });
      toast("บันทึกหน้าโดเนทแล้ว");
      render();
    });
  }
}

function bindEvents() {
  document.querySelectorAll("[data-action='demo-alert']").forEach((button) => {
    button.addEventListener("click", demoAlert);
  });
  document.querySelectorAll("[data-action='export-csv']").forEach((button) => {
    button.addEventListener("click", exportCsv);
  });
  document.querySelectorAll("[data-action='simulate-webhook']").forEach((button) => {
    button.addEventListener("click", simulateWebhook);
  });
  document.querySelectorAll("[data-action='copy-overlay']").forEach((button) => {
    button.addEventListener("click", async () => {
      const input = document.getElementById("overlayUrl");
      await navigator.clipboard.writeText(input.value);
      toast("คัดลอก OBS Overlay URL แล้ว");
    });
  });

  const amountInput = document.getElementById("amount");
  const qrAmount = document.getElementById("qrAmount");
  document.querySelectorAll("[data-amount]").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll("[data-amount]").forEach((item) => item.classList.remove("active"));
      button.classList.add("active");
      amountInput.value = button.dataset.amount;
      qrAmount.textContent = money(Number(button.dataset.amount));
    });
  });
  if (amountInput) {
    amountInput.addEventListener("input", () => {
      if (qrAmount) qrAmount.textContent = money(Number(amountInput.value || 0));
    });
  }

  const form = document.getElementById("donateForm");
  if (form) {
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      createDonation(form);
    });
  }

  bindForms();

  if (channel) {
    channel.onmessage = (event) => {
      if (event.data?.type === "new_donation") showAlert(event.data.payload);
    };
  }
}

window.addEventListener("storage", (event) => {
  if (event.key !== ALERT_KEY || !event.newValue) return;
  const data = JSON.parse(event.newValue);
  if (data.type === "new_donation") showAlert(data.payload);
});

window.addEventListener("hashchange", render);

function render() {
  document.body.className = "";
  const path = currentPath();
  const renderer =
    routes[path] ||
    (path.startsWith("/overlay/") ? renderOverlay : path.startsWith("/donate/") ? renderDonateOnly : renderHome);
  document.getElementById("app").innerHTML = renderer();
  bindEvents();
}

render();
