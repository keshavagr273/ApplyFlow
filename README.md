# 🧠 ApplyFlow: AI-Powered Job Application Assistant

[![React](https://img.shields.io/badge/React-19.2-61DAFB?style=for-the-badge&logo=react)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-6.0-3178C6?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org)
[![Vite](https://img.shields.io/badge/Vite-8.0-646CFF?style=for-the-badge&logo=vite)](https://vite.dev)
[![Supabase](https://img.shields.io/badge/Supabase-Cloud%20Sync-3ECF8E?style=for-the-badge&logo=supabase)](https://supabase.com)
[![Testing](https://img.shields.io/badge/Tests-100%25%20Green-22c55e?style=for-the-badge&logo=vitest)](file:///d:/Projects/applyflow/tests)

**ApplyFlow** is a premium Chrome extension and application tracker built to speed up and simplify the job application process. By using advanced form-field scanning heuristics combined with Google Gemini's AI capabilities, ApplyFlow automatically fills complex job application forms, generates tailored professional materials (cover letters/essays), clips job details in one-click, and tracks your job hunt progress on a visual pipeline board.

---

## ✨ Key Capabilities

*   **⚡ Smart Intelligent Autofill**: Automatically scans application forms and matches text inputs, textareas, select dropdowns, checkboxes, and radio buttons to your professional profile using robust keyword heuristics.
*   **🤖 Native SPA Event Simulation**: Simulates internal React/Vue state changes and dispatches synthetic input, change, and focus events during autofill, ensuring frameworks capture the filled values correctly and prevent them from being wiped out upon submission.
*   **📌 One-Click Web Clipper**: A floating "Save Job" button that automatically parses job postings on major boards (LinkedIn, Internshala, Unstop) and custom sites, logging titles, companies, salary ranges, and descriptions straight to your tracker.
*   **📊 Kanban Pipeline Board**: Track all your applications visually across columns (Saved → Applied → Assessment → Interview → Offer) using interactive drag-and-drop cards.
*   **🔒 Secure Cloud Sync**: Optional cloud backup utilizing Google Sign-In (Chrome Identity) and a private Supabase database protected by Row Level Security (RLS) policies.
*   **📋 Cover Letter Vault**: Store and manage multiple AI-generated cover letters, dynamically tailoring them to specific roles, companies, and requirements.
*   **🎯 Automated EEO Filling**: Pre-configure answers to Equal Employment Opportunity (EEO) questionnaires (gender, ethnicity, disability, veteran status) and work authorization requirements to skip tedious radio buttons.
*   **⌨️ Customizable Shortcuts**: Fully customizable keyboard mapping to open the side panel, scan pages, trigger autofill, or clip jobs.

---

## 🛠️ Technology Stack

| Layer | Technology |
|---|---|
| **Core Extension** | Chrome Extension MV3 + Vite 8 + `@crxjs/vite-plugin` |
| **Frontend UI** | React 19 + TypeScript 6 + TailwindCSS 3 + Lucide Icons |
| **State Management** | Zustand (with local chrome storage syncing) |
| **Cloud Synchronization** | Supabase REST Client + Chrome Identity (Google OAuth) |
| **AI Intelligence Engine** | Google Gemini API (for smart profiling, matching, and generation) |
| **Visual Charts** | Recharts (for application statistics) |

---

## 🚀 Quick Start in 5 Minutes

### Prerequisites
*   Node.js 18+
*   Google Chrome, Brave, or any Chromium-based browser
*   Supabase Project URL and Anon API Key *(optional, for cloud sync)*

### 1. Set Up Environment Variables
Create a `.env` file in the root directory:
```env
VITE_GEMINI_API_KEY=your_gemini_api_key_here
VITE_SUPABASE_URL=your_supabase_project_url_here
```

### 2. Install Dependencies & Build Extension
Install the dependencies and run the build process:
```bash
# Install npm dependencies
npm install

# Run the extension build
npm run build
```
This compiles the application and outputs the final unpacked extension into the `dist/` directory.

### 3. Load the Chrome Extension
1.  Open Google Chrome or Brave and navigate to `chrome://extensions/`.
2.  Enable **Developer mode** (toggle in the top-right corner).
3.  Click **Load unpacked** in the top-left corner.
4.  Select the `dist/` (or `dist-firefox/` if testing for Firefox) directory within the workspace.

### 4. Open Control Center
*   Click the **ApplyFlow Extension** icon in your browser toolbar.
*   Click **Open Settings** to access the Options dashboard where you can manage your profile, view shortcuts, and upgrade tiers.

---

## 🧪 Testing Suite

ApplyFlow features a comprehensive unit, component, and End-to-End browser test suite to ensure scraper and fill performance.

```bash
# Run unit and component tests (using Vitest)
npm test

# Build and run Playwright End-to-End browser tests
npm run test:e2e
```

---

## 📂 Centralized Project Documentation

*   📝 **[database_setup.md](file:///d:/Projects/applyflow/docs/database_setup.md)**: Details on Supabase table configurations, profiles, and Row-Level Security (RLS) policies.
*   🔌 **[third_party_setup.md](file:///d:/Projects/applyflow/docs/third_party_setup.md)**: Guides on OAuth client setup, Chrome Identity APIs, and Gemini configuration.
*   📐 **[extension_comparison_report.md](file:///d:/Projects/applyflow/docs/extension_comparison_report.md)**: Comparative analysis of DOM parsing and selector resolving strategies between Jobscan, Simplify Copilot, Teal, and ApplyFlow.
