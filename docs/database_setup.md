# Database Setup Guide

ApplyFlow supports local offline storage using `chrome.storage.local` and optional real-time cloud synchronization using a Supabase PostgreSQL database. This guide details how to set up the remote database schema and Row Level Security (RLS) policies.

---

## 1. Local Storage

By default, all user data (profile information, application history, and assistant configurations) is saved locally in the browser's sandbox using the `chrome.storage.local` API.
- No database setup is required for local offline usage.
- Data persists across browser sessions and extension updates.

---

## 2. Remote Database Setup (Supabase / PostgreSQL)

To enable cloud backup and multi-device sync, you must provision a PostgreSQL database. We recommend **Supabase** for its out-of-the-box REST API and Row Level Security support.

### Step 1: Create the Tables

Run the following SQL DDL commands in the Supabase SQL Editor to initialize the database tables:

```sql
-- ─── 1. USER PROFILE TABLE ───────────────────────────────────────────────────
CREATE TABLE public.profile (
    id TEXT PRIMARY KEY, -- Maps to settings.userEmail or 'anonymous_profile'
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    college TEXT,
    degree TEXT,
    graduation_year TEXT,
    skills TEXT[],
    resume_link TEXT,
    linkedin_url TEXT,
    portfolio_url TEXT,
    resume_text TEXT,
    custom_answers JSONB DEFAULT '[]'::jsonb,
    projects JSONB DEFAULT '[]'::jsonb,
    work_experience JSONB DEFAULT '[]'::jsonb,
    created_at BIGINT,
    updated_at BIGINT
);

-- Enable RLS
ALTER TABLE public.profile ENABLE ROW LEVEL SECURITY;

-- ─── 2. APPLICATIONS TRACKER TABLE ───────────────────────────────────────────
CREATE TABLE public.applications (
    id TEXT PRIMARY KEY, -- Unique application UUID
    user_email TEXT NOT NULL, -- User email partition key
    company TEXT NOT NULL,
    role TEXT NOT NULL,
    url TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('bookmarked', 'applied', 'interviewing', 'offer', 'rejected')),
    salary TEXT,
    location TEXT,
    platform TEXT,
    applied_at BIGINT NOT NULL,
    remind_at BIGINT,
    notes TEXT,
    submission_confirmed BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Enable RLS
ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;

-- ─── 3. USER BILLING & CREDIT BALANCE TABLE ──────────────────────────────────
CREATE TABLE public.user_billing (
    user_email TEXT PRIMARY KEY,
    plan TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'pro_monthly', 'pro_quarterly', 'ultimate_yearly')),
    credits_allocated INTEGER NOT NULL DEFAULT 10,
    credits_used INTEGER NOT NULL DEFAULT 0,
    credits_purchased INTEGER NOT NULL DEFAULT 0,
    premium_until BIGINT,
    razorpay_customer_id TEXT,
    razorpay_subscription_id TEXT,
    subscription_status TEXT DEFAULT 'active' CHECK (subscription_status IN ('active', 'paused', 'cancelled', 'expired')),
    updated_at BIGINT NOT NULL
);

-- Enable RLS
ALTER TABLE public.user_billing ENABLE ROW LEVEL SECURITY;

-- ─── 4. CREDIT TRANSACTION LOGS (AUDITING) ───────────────────────────────────
CREATE TABLE public.credit_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_email TEXT NOT NULL,
    feature TEXT NOT NULL,
    credits_deducted INTEGER NOT NULL,
    timestamp BIGINT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Enable RLS
ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;

-- ─── 5. ATOMIC DEDUCTION FUNCTION ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION atomic_deduct_credits(p_email TEXT, p_cost INTEGER)
RETURNS BOOLEAN AS $$
DECLARE
    v_allocated INT;
    v_used INT;
    v_purchased INT;
    v_remaining INT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

## 3. Configuring Row Level Security (RLS) Policies

To protect user privacy and prevent unauthorized data access, you must configure policies that restrict read/write access to the owner of the record.

### Profile Policies
```sql
-- Allow users to insert/update their own profile
CREATE POLICY "Users can manage their own profile" ON public.profile
    FOR ALL
    USING (auth.jwt() ->> 'email' = id)
    WITH CHECK (auth.jwt() ->> 'email' = id);
```

### Applications Policies
```sql
-- Allow users to manage only their own application listings
CREATE POLICY "Users can manage their own applications" ON public.applications
    FOR ALL
    USING (auth.jwt() ->> 'email' = user_email)
    WITH CHECK (auth.jwt() ->> 'email' = user_email);
```

### User Billing Policies
```sql
-- Allow users to view their own billing metrics
CREATE POLICY "Users can view own billing" ON public.user_billing
    FOR SELECT
    USING (auth.jwt() ->> 'email' = user_email);
```

### Credit Transaction Policies
```sql
-- Allow users to view their own transactions
CREATE POLICY "Users can view own transactions" ON public.credit_transactions
    FOR SELECT
    USING (auth.jwt() ->> 'email' = user_email);
```

---

## 4. Connection Settings

Once tables and RLS are configured, configure the environment variables in your extension build environment:
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key
```
Upon a user signing in with Google, the extension background service worker will automatically synchronize local data to these tables.
