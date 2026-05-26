// lib/gym-bridge.ts
//
// Shared helpers for fetching data from the Gym App bridge API.
// All functions return null gracefully on any failure — agents continue
// without gym context if the Gym App is unreachable.

export interface GymContext {
  training_phase: string;
  week_number: number;
  sessions_planned: number;
  sessions_completed: number;
  overload_flags: string[];
  recent_1rm_highlights: string[];
}

export interface GymWeightEntry {
  date: string;
  weight_kg: number;
}

async function gymFetch(path: string): Promise<any> {
  const gymApiUrl = process.env.GYM_APP_API_URL;
  const bridgeSecret = process.env.BRIDGE_SECRET;

  if (!gymApiUrl || !bridgeSecret) return null;

  const res = await fetch(`${gymApiUrl}${path}`, {
    headers: { Authorization: `Bearer ${bridgeSecret}` },
    next: { revalidate: 0 },
  });

  if (!res.ok) return null;
  return res.json();
}

export async function fetchGymContext(): Promise<GymContext | null> {
  try {
    const data = await gymFetch("/bridge/context");
    if (!data) return null;
    return data as GymContext;
  } catch {
    return null;
  }
}

export async function fetchGymWeight(): Promise<GymWeightEntry[] | null> {
  try {
    const data = await gymFetch("/bridge/weight");
    if (!data || !Array.isArray(data)) return null;
    return data as GymWeightEntry[];
  } catch {
    return null;
  }
}
