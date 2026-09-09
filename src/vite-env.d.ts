/// <reference types="vite/client" />
declare module '*?script' {
  const src: string
  export default src
}

interface ImportMetaEnv {
  readonly VITE_OPENROUTER_API_KEY?: string
  readonly VITE_GROQ_API_KEY?: string
  readonly VITE_GEMINI_API_KEY?: string
  readonly VITE_AI_MODEL?: string
  readonly VITE_OPENROUTER_BASE_URL?: string
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_ANON_KEY?: string
  readonly VITE_GOOGLE_CLIENT_ID?: string
  readonly VITE_RAZORPAY_MONTHLY_URL?: string
  readonly VITE_RAZORPAY_QUARTERLY_URL?: string
  readonly VITE_RAZORPAY_YEARLY_URL?: string
  readonly VITE_KOFI_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}