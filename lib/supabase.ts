// lib/supabase.ts
//
// WHY THIS FILE EXISTS:
// Rather than creating a new Supabase connection every time we need the database,
// we create it once here and import it wherever we need it. This is called the
// "singleton pattern" — one instance, shared everywhere.
//
// WHY IT LIVES IN /lib:
// The /lib folder is a Next.js convention for utility functions and shared logic
// that isn't a UI component or a page. Think of it as the "engine room" of your app.
//
// WHY TWO CLIENTS:
// Next.js has two environments — the browser (client) and the server.
// - The BROWSER client uses the anon key and is safe to ship to users.
// - The SERVER client uses the service_role key, which has full database access
//   and must NEVER be used in browser code. We use it only in API routes and
//   server-side functions (like cron jobs) where the code never reaches the browser.

import { createClient } from "@supabase/supabase-js";

// ---------------------------------------------------------------------------
// BROWSER CLIENT
// Used in client components (anything with "use client" at the top).
// The anon key is safe here — Supabase RLS policies are your security layer.
// ---------------------------------------------------------------------------
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// The "!" after the env var tells TypeScript "trust me, this won't be undefined".
// If it IS undefined (i.e. you forgot to set .env.local), you'll get a clear
// runtime error rather than a confusing crash elsewhere.
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// ---------------------------------------------------------------------------
// SERVER CLIENT
// Used ONLY in API routes, server components, and cron jobs.
// The service_role key bypasses RLS — it can read/write anything.
// NEVER import this in a client component.
// ---------------------------------------------------------------------------
export function createServerSupabaseClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  if (!serviceRoleKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not set. This client can only be used server-side.",
    );
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      // Disable automatic session management for server-side usage.
      // The server doesn't have a browser to store cookies in.
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

// ---------------------------------------------------------------------------
// TYPESCRIPT: Database types (we'll expand this as we add tables)
// ---------------------------------------------------------------------------
export type ActivityType =
  | "running"
  | "cycling_indoor"
  | "cycling_outdoor"
  | "fishing"
  | "kung_fu";

export type Activity = {
  id: string;
  type: ActivityType;
  date: string;
  duration_minutes: number;
  notes?: string;
  distance_km?: number;
  created_at: string;
};

export type MoodLog = {
  id: string;
  log_date: string;
  mood_score: number; // 1–5
  energy_score: number; // 1–5
  notes?: string;
  created_at: string;
};

export type AgentSuggestion = {
  id: string;
  suggestion_date: string;
  suggested_activity: ActivityType;
  suggestion_text: string;
  reasoning?: string;
  was_followed?: boolean;
  email_sent: boolean;
  created_at: string;
};

export type DietLog = {
  id: string;
  log_date: string;
  created_at: string;
  weight_kg?: number | null;
  kcal?: number | null;
  fat_g?: number | null;
  sat_fat_g?: number | null;
  carbs_g?: number | null;
  sugar_g?: number | null;
  fibre_g?: number | null;
  protein_g?: number | null;
  salt_g?: number | null;
  kcal_pct?: number | null;
  protein_pct?: number | null;
};
