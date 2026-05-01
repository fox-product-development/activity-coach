"use client";

import { useState, useEffect } from "react";
import { Activity, ActivityType, MoodLog } from "@/lib/supabase";

// -------------------------------------------------------------------------
// COLOUR TOKENS
// Defined once here so everything stays consistent and is easy to change
// -------------------------------------------------------------------------
const colours = {
  pageBg: "#FFFDF0",
  primary: "#F5C842",
  primaryLight: "#FEF9C3",
  primaryDark: "#92660A",
  border: "#F0D878",
  text: "#1A1A1A",
  textMuted: "#888",
  cardBg: "#FEF9C3",
  cardBorder: "#F5C842",
  white: "#FFFFFF",
};

// -------------------------------------------------------------------------
// COLLAPSIBLE SECTION
// -------------------------------------------------------------------------
function Section({
  title,
  emoji,
  children,
}: {
  title: string;
  emoji: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div
      style={{
        marginBottom: 12,
        borderRadius: 12,
        overflow: "hidden",
        border: `1px solid ${colours.border}`,
      }}
    >
      <button
        onClick={() => setOpen(!open)}
        style={{
          width: "100%",
          background: open ? colours.primary : colours.primaryLight,
          border: "none",
          padding: "16px 20px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          cursor: "pointer",
          fontSize: 16,
          fontWeight: 700,
          color: colours.primaryDark,
          transition: "background 0.2s",
        }}
      >
        <span>
          {emoji} {title}
        </span>
        <span style={{ fontSize: 12 }}>{open ? "▲ Hide" : "▼ Show"}</span>
      </button>
      {open && (
        <div style={{ padding: "20px", background: colours.white }}>
          {children}
        </div>
      )}
    </div>
  );
}

// -------------------------------------------------------------------------
// MAIN PAGE
// -------------------------------------------------------------------------
export default function Home() {
  // ACTIVITY FORM STATE
  const [type, setType] = useState<ActivityType>("running");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [duration, setDuration] = useState("");
  const [notes, setNotes] = useState("");
  const [distance, setDistance] = useState("");
  const [activitySubmitting, setActivitySubmitting] = useState(false);
  const [activityMessage, setActivityMessage] = useState("");
  const [activities, setActivities] = useState<Activity[]>([]);
  const [activitiesLoading, setActivitiesLoading] = useState(true);

  // MOOD FORM STATE
  const [moodScore, setMoodScore] = useState(3);
  const [energyScore, setEnergyScore] = useState(3);
  const [moodNotes, setMoodNotes] = useState("");
  const [moodSubmitting, setMoodSubmitting] = useState(false);
  const [moodMessage, setMoodMessage] = useState("");
  const [todayMood, setTodayMood] = useState<MoodLog | null>(null);
  const [moodLoading, setMoodLoading] = useState(true);

  useEffect(() => {
    fetchActivities();
    fetchMood();
  }, []);

  async function fetchActivities() {
    setActivitiesLoading(true);
    const res = await fetch("/api/activities");
    const data = await res.json();
    setActivities(data.activities || []);
    setActivitiesLoading(false);
  }

  async function fetchMood() {
    setMoodLoading(true);
    const res = await fetch("/api/mood");
    const data = await res.json();
    setTodayMood(data.todayLog);
    setMoodLoading(false);
  }

  async function handleActivitySubmit(e: React.FormEvent) {
    e.preventDefault();
    setActivitySubmitting(true);
    setActivityMessage("");

    const res = await fetch("/api/activities", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type,
        date,
        duration_minutes: duration,
        notes: notes || null,
        distance_km: distance || null,
      }),
    });

    const data = await res.json();

    if (res.ok) {
      setActivityMessage("✅ Activity logged!");
      setDuration("");
      setNotes("");
      setDistance("");
      fetchActivities();
    } else {
      setActivityMessage(`❌ Error: ${data.error}`);
    }

    setActivitySubmitting(false);
  }

  async function handleMoodSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMoodSubmitting(true);
    setMoodMessage("");

    const res = await fetch("/api/mood", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mood_score: moodScore,
        energy_score: energyScore,
        notes: moodNotes || null,
      }),
    });

    const data = await res.json();

    if (res.ok) {
      setMoodMessage("✅ Mood logged!");
      setMoodNotes("");
      fetchMood();
    } else {
      setMoodMessage(`❌ Error: ${data.error}`);
    }

    setMoodSubmitting(false);
  }

  const activityLabels: Record<ActivityType, string> = {
    running: "🏃 Running",
    cycling_indoor: "🚴 Cycling (Indoor)",
    cycling_outdoor: "🚴 Cycling (Outdoor)",
    fishing: "🎣 Fishing",
    kung_fu: "🥋 Kung Fu",
  };

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString("en-GB", {
      weekday: "short",
      day: "numeric",
      month: "short",
    });
  }

  function scoreLabel(score: number) {
    return ["", "😔", "😕", "😐", "🙂", "😄"][score];
  }

  function energyLabel(score: number) {
    return ["", "🪫", "😴", "⚡", "⚡⚡", "⚡⚡⚡"][score];
  }

  const inputStyle = {
    width: "100%",
    padding: 8,
    border: `1px solid ${colours.border}`,
    borderRadius: 6,
    fontSize: 14,
    background: colours.pageBg,
    boxSizing: "border-box" as const,
  };

  const buttonStyle = {
    padding: "10px 24px",
    background: colours.primary,
    color: colours.primaryDark,
    border: "none",
    borderRadius: 8,
    fontWeight: 700,
    fontSize: 14,
    cursor: "pointer",
  };

  return (
    <main
      style={{
        maxWidth: 600,
        margin: "0 auto",
        padding: "40px 20px",
        fontFamily: "sans-serif",
        background: colours.pageBg,
        minHeight: "100vh",
        color: colours.text,
      }}
    >
      {/* HEADER */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ margin: 0, fontSize: 28, color: colours.primaryDark }}>
          ☀️ Activity Coach
        </h1>
        <p
          style={{ color: colours.textMuted, margin: "6px 0 0", fontSize: 14 }}
        >
          Log your evening mood so your morning suggestion is personalised.
        </p>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* MOOD SECTION                                                         */}
      {/* ------------------------------------------------------------------ */}
      <Section title="Mood" emoji="😊">
        {moodLoading ? (
          <p>Loading...</p>
        ) : todayMood ? (
          <div
            style={{
              background: colours.cardBg,
              border: `1px solid ${colours.cardBorder}`,
              padding: 16,
              borderRadius: 8,
            }}
          >
            <p style={{ margin: 0, color: colours.primaryDark }}>
              <strong>Mood:</strong> {scoreLabel(todayMood.mood_score)}{" "}
              {todayMood.mood_score}/5 &nbsp;|&nbsp;
              <strong>Energy:</strong> {energyLabel(todayMood.energy_score)}{" "}
              {todayMood.energy_score}/5
            </p>
            {todayMood.notes && (
              <p style={{ margin: "8px 0 0", color: "#555" }}>
                {todayMood.notes}
              </p>
            )}
            <button
              onClick={() => setTodayMood(null)}
              style={{
                background: "none",
                border: "none",
                color: colours.primaryDark,
                fontSize: 12,
                cursor: "pointer",
                padding: 0,
                marginTop: 8,
                textDecoration: "underline",
              }}
            >
              Update today's log
            </button>
          </div>
        ) : (
          <form onSubmit={handleMoodSubmit}>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontWeight: 600 }}>
                Mood — how are you feeling? {scoreLabel(moodScore)}
                <br />
                <input
                  type="range"
                  min={1}
                  max={5}
                  value={moodScore}
                  onChange={(e) => setMoodScore(Number(e.target.value))}
                  style={{ width: "100%", accentColor: colours.primary }}
                />
                <small
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    color: colours.textMuted,
                  }}
                >
                  <span>😔 Bad</span>
                  <span>😄 Great</span>
                </small>
              </label>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ fontWeight: 600 }}>
                Energy — physical energy level {energyLabel(energyScore)}
                <br />
                <input
                  type="range"
                  min={1}
                  max={5}
                  value={energyScore}
                  onChange={(e) => setEnergyScore(Number(e.target.value))}
                  style={{ width: "100%", accentColor: colours.primary }}
                />
                <small
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    color: colours.textMuted,
                  }}
                >
                  <span>🪫 Exhausted</span>
                  <span>⚡ Energised</span>
                </small>
              </label>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ fontWeight: 600 }}>
                Notes — optional
                <br />
                <textarea
                  value={moodNotes}
                  onChange={(e) => setMoodNotes(e.target.value)}
                  rows={2}
                  placeholder="e.g. tired after work, feeling good after a walk..."
                  style={{ ...inputStyle, marginTop: 4 }}
                />
              </label>
            </div>

            <button type="submit" disabled={moodSubmitting} style={buttonStyle}>
              {moodSubmitting ? "Saving..." : "Log Mood"}
            </button>

            {moodMessage && <p style={{ marginTop: 12 }}>{moodMessage}</p>}
          </form>
        )}
      </Section>

      {/* ------------------------------------------------------------------ */}
      {/* ACTIVITIES SECTION                                                   */}
      {/* ------------------------------------------------------------------ */}
      <Section title="Activities" emoji="🏃">
        <form onSubmit={handleActivitySubmit}>
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontWeight: 600 }}>
              Activity
              <br />
              <select
                value={type}
                onChange={(e) => setType(e.target.value as ActivityType)}
                style={{ ...inputStyle, marginTop: 4 }}
              >
                {Object.entries(activityLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={{ fontWeight: 600 }}>
              Date
              <br />
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                style={{ ...inputStyle, marginTop: 4 }}
              />
            </label>
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={{ fontWeight: 600 }}>
              Duration (minutes)
              <br />
              <input
                type="number"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                min={1}
                required
                style={{ ...inputStyle, marginTop: 4 }}
              />
            </label>
          </div>

          {(type === "running" || type === "cycling_outdoor") && (
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontWeight: 600 }}>
                Distance (km) — optional
                <br />
                <input
                  type="number"
                  value={distance}
                  onChange={(e) => setDistance(e.target.value)}
                  step="0.1"
                  min={0}
                  style={{ ...inputStyle, marginTop: 4 }}
                />
              </label>
            </div>
          )}

          <div style={{ marginBottom: 16 }}>
            <label style={{ fontWeight: 600 }}>
              Notes — optional
              <br />
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                style={{ ...inputStyle, marginTop: 4 }}
              />
            </label>
          </div>

          <button
            type="submit"
            disabled={activitySubmitting}
            style={buttonStyle}
          >
            {activitySubmitting ? "Saving..." : "Log Activity"}
          </button>

          {activityMessage && (
            <p style={{ marginTop: 12 }}>{activityMessage}</p>
          )}
        </form>

        <hr style={{ margin: "24px 0", borderColor: colours.border }} />

        <h3 style={{ marginBottom: 12, color: colours.primaryDark }}>
          Recent Activities
        </h3>
        {activitiesLoading ? (
          <p>Loading...</p>
        ) : activities.length === 0 ? (
          <p style={{ color: colours.textMuted }}>No activities logged yet.</p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {activities.map((activity) => (
              <li
                key={activity.id}
                style={{
                  background: colours.cardBg,
                  border: `1px solid ${colours.cardBorder}`,
                  borderLeft: `4px solid ${colours.primary}`,
                  borderRadius: 8,
                  padding: "12px 16px",
                  marginBottom: 8,
                }}
              >
                <strong style={{ color: colours.primaryDark }}>
                  {activityLabels[activity.type]}
                </strong>
                <span style={{ color: colours.text }}>
                  {" "}
                  — {activity.duration_minutes} mins
                </span>
                <br />
                <small style={{ color: colours.textMuted }}>
                  {formatDate(activity.date)}
                </small>
                {activity.distance_km && (
                  <span style={{ color: colours.textMuted }}>
                    {" "}
                    · {activity.distance_km}km
                  </span>
                )}
                {activity.notes && (
                  <p style={{ margin: "4px 0 0", color: "#555", fontSize: 13 }}>
                    {activity.notes}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </Section>

      {/* ------------------------------------------------------------------ */}
      {/* DIET SECTION — placeholder                                           */}
      {/* ------------------------------------------------------------------ */}
      <Section title="Diet" emoji="🥗">
        <p style={{ color: colours.textMuted, fontStyle: "italic", margin: 0 }}>
          Diet tracking coming soon. This will feed into the agent's suggestions
          alongside mood and activity data.
        </p>
      </Section>
    </main>
  );
}
