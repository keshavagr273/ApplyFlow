# Third-Party Configurations Guide

ApplyFlow integrates with several third-party services to deliver AI-powered resume parsing, job analysis, autofilling, and sync features. This document details how to configure these integrations.

---

## 1. Groq Cloud (AI Services)

ApplyFlow uses the Groq API (running `llama-3.3-70b-versatile`) for lightning-fast cover letter generation, resume scoring, and interview prep.

### Configuration
1. Sign up at [Groq Console](https://console.groq.com/).
2. Navigate to **API Keys** and generate a new API key.
3. Add the API key to your environment configurations:
   - Locally, create a `.env` file in the project root:
     ```env
     VITE_GROQ_API_KEY=your_groq_api_key_here
     ```
   - In production, set `VITE_GROQ_API_KEY` as a build environment variable in your pipeline.
4. Users can also enter their own Groq/Gemini API keys directly in the **General Settings** tab of the extension options page.

---

## 2. Gemini API (Google AI)

As a backup or alternative model for parsing and smart matching:
1. Obtain a Gemini API Key from [Google AI Studio](https://aistudio.google.com/).
2. Configure it via:
   - Environment variables:
     ```env
     VITE_GEMINI_API_KEY=your_gemini_api_key_here
     ```
   - Or directly inside the extension settings panel.

---

## 3. Google OAuth & Chrome Identity API

To allow users to login securely and sync data to their cloud accounts, ApplyFlow uses the Chrome Identity API with Google OAuth.

### Configuration in Google Cloud Console
1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Create a new project or select an existing one.
3. Navigate to **APIs & Services > Credentials**.
4. Configure the **OAuth Consent Screen** (User type External, add scopes `.../auth/userinfo.email` and `.../auth/userinfo.profile`).
5. Click **Create Credentials > OAuth Client ID**:
   - **Application Type**: Select `Chrome Extension`.
   - **Item ID**: Enter your Chrome Extension's unique 32-character ID (you can find this in `chrome://extensions` when developer mode is enabled and the extension is loaded).
6. Copy the generated Client ID.

### Configuration in `manifest.json`
Add the OAuth configuration block to your `public/manifest.json`:
```json
"oauth2": {
  "client_id": "YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com",
  "scopes": [
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/userinfo.profile"
  ]
}
```

---

## 4. Supabase (Database Backup)

To store and synchronize applications and user profile configurations across devices:
1. Create a project at [Supabase](https://supabase.com/).
2. Navigate to **Project Settings > API** to find your **Project URL** and **anon public key**.
3. Configure the environment variables:
   ```env
   VITE_SUPABASE_URL=https://your-project-id.supabase.co
   VITE_SUPABASE_ANON_KEY=your_anon_public_key
   ```
4. Secure your database tables (`profile` and `applications`) using **Row Level Security (RLS)** in Supabase to ensure users can only read and write their own data.
