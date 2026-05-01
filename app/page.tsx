"use client";

import { useState, useEffect, useRef } from "react";
import { Activity, ActivityType, MoodLog, DietLog } from "@/lib/supabase";

// -------------------------------------------------------------------------
// COLOUR TOKENS
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
  error: "#DC2626",
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
// POPUP OVERLAY
// -------------------------------------------------------------------------
function Popup({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: 20,
      }}
    >
      <div
        style={{
          background: colours.white,
          borderRadius: 16,
          padding: 28,
          maxWidth: 420,
          width: "100%",
          boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
        }}
      >
        {children}
      </div>
    </div>
  );
}

// -------------------------------------------------------------------------
// MAIN PAGE
// -------------------------------------------------------------------------
type PopupStep = "none" | "weight" | "diet";

export default function Home() {
  // POPUP STATE
  const [popupStep, setPopupStep] = useState<PopupStep>("none");
  const [dietLog, setDietLog] = useState<DietLog | null>(null);
  const [yesterdayStr, setYesterdayStr] = useState("");
  const [checkComplete, setCheckComplete] = useState(false);

  // WEIGHT POPUP STATE
  const [weight, setWeight] = useState("");
  const [weightSubmitting, setWeightSubmitting] = useState(false);
  const [weightMessage, setWeightMessage] = useState("");

  // DIET POPUP STATE
  const [dietImage, setDietImage] = useState<File | null>(null);
  const [dietSubmitting, setDietSubmitting] = useState(false);
  const [dietMessage, setDietMessage] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  // MOOD STATE
  const [moodScore, setMoodScore] = useState(3);
  const [energyScore, setEnergyScore] = useState(3);
  const [moodNotes, setMoodNotes] = useState("");
  const [moodSubmitting, setMoodSubmitting] = useState(false);
  const [moodMessage, setMoodMessage] = useState("");
  const [todayMood, setTodayMood] = useState<MoodLog | null>(null);
  const [moodLoading, setMoodLoading] = useState(true);

  // -------------------------------------------------------------------------
  // ON APP OPEN — check diet status and decide popup flow
  // -------------------------------------------------------------------------
  useEffect(() => {
    fetchActivities();
    fetchMood();
    checkDietStatus();
  }, []);

  async function checkDietStatus() {
    const res = await fetch("/api/diet");
    const data = await res.json();
    setDietLog(data.log);
    setYesterdayStr(data.yesterdayStr);

    // Decide which popup to show first
    if (!data.hasWeight) {
      setPopupStep("weight");
    } else if (!data.hasDiet) {
      setPopupStep("diet");
    } else {
      setPopupStep("none");
    }
    setCheckComplete(true);
  }

  async function fetchActivities() {
    const res = await fetch("/api/activities");
    const data = await res.json();
    setActivities(data.activities || []);
    setActivitiesLoading(false);
  }

  async function fetchMood() {
    const res = await fetch("/api/mood");
    const data = await res.json();
    setTodayMood(data.todayLog);
    setMoodLoading(false);
  }

  // -------------------------------------------------------------------------
  // WEIGHT SUBMIT
  // -------------------------------------------------------------------------
  async function handleWeightSubmit() {
    if (!weight) return;
    setWeightSubmitting(true);
    setWeightMessage("");

    const res = await fetch("/api/diet", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ weight_kg: weight, log_date: yesterdayStr }),
    });

    const data = await res.json();

    if (res.ok) {
      setDietLog(data.log);
      // Move to diet popup next
      setPopupStep("diet");
      setWeight("");
    } else {
      setWeightMessage(data.error || "Something went wrong");
    }
    setWeightSubmitting(false);
  }

  // -------------------------------------------------------------------------
  // DIET IMAGE SUBMIT
  // -------------------------------------------------------------------------
  async function handleDietSubmit() {
    if (!dietImage) return;
    setDietSubmitting(true);
    setDietMessage("");

    // Convert image to base64
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result.split(",")[1]); // Strip the data:image/png;base64, prefix
      };
      reader.onerror = reject;
      reader.readAsDataURL(dietImage);
    });

    const res = await fetch("/api/diet", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        imageBase64: base64,
        mediaType: dietImage.type,
      }),
    });

    const data = await res.json();

    if (res.ok) {
      setDietLog(data.log);
      setPopupStep("none");
      setDietImage(null);
    } else {
      setDietMessage(data.error || "Something went wrong");
    }
    setDietSubmitting(false);
  }

  // -------------------------------------------------------------------------
  // ACTIVITY SUBMIT
  // -------------------------------------------------------------------------
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

  // -------------------------------------------------------------------------
  // MOOD SUBMIT
  // -------------------------------------------------------------------------
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

  // -------------------------------------------------------------------------
  // HELPERS
  // -------------------------------------------------------------------------
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

  const skipStyle = {
    background: "none",
    border: "none",
    color: colours.textMuted,
    fontSize: 13,
    cursor: "pointer",
    textDecoration: "underline",
    padding: "0 0 0 16px",
  };

  // -------------------------------------------------------------------------
  // RENDER
  // -------------------------------------------------------------------------
  return (
    <>
      {/* ------------------------------------------------------------------ */}
      {/* WEIGHT POPUP                                                         */}
      {/* ------------------------------------------------------------------ */}
      {checkComplete && popupStep === "weight" && (
        <Popup>
          <h2 style={{ margin: "0 0 8px", color: colours.primaryDark }}>
            ⚖️ Today's Weight
          </h2>
          <p
            style={{
              color: colours.textMuted,
              fontSize: 14,
              margin: "0 0 20px",
            }}
          >
            Log your weight for {formatDate(yesterdayStr)}.
          </p>

          <input
            type="number"
            step="0.1"
            min={20}
            max={300}
            placeholder="e.g. 82.5"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            style={{ ...inputStyle, marginBottom: 16, fontSize: 18 }}
          />

          {weightMessage && (
            <p
              style={{ color: colours.error, fontSize: 13, margin: "0 0 12px" }}
            >
              {weightMessage}
            </p>
          )}

          <div style={{ display: "flex", alignItems: "center" }}>
            <button
              onClick={handleWeightSubmit}
              disabled={weightSubmitting || !weight}
              style={{ ...buttonStyle, opacity: !weight ? 0.5 : 1 }}
            >
              {weightSubmitting ? "Saving..." : "Submit"}
            </button>
            <button onClick={() => setPopupStep("diet")} style={skipStyle}>
              Skip for now
            </button>
          </div>
        </Popup>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* DIET POPUP                                                           */}
      {/* ------------------------------------------------------------------ */}
      {checkComplete && popupStep === "diet" && (
        <Popup>
          <h2 style={{ margin: "0 0 8px", color: colours.primaryDark }}>
            🥗 Yesterday's Diet
          </h2>
          <p
            style={{
              color: colours.textMuted,
              fontSize: 14,
              margin: "0 0 20px",
            }}
          >
            Upload your Nutra Check summary screenshot for{" "}
            {formatDate(yesterdayStr)}.
          </p>

          <div
            onClick={() => fileInputRef.current?.click()}
            style={{
              border: `2px dashed ${colours.border}`,
              borderRadius: 10,
              padding: "24px",
              textAlign: "center",
              cursor: "pointer",
              background: colours.primaryLight,
              marginBottom: 16,
            }}
          >
            {dietImage ? (
              <p
                style={{
                  margin: 0,
                  color: colours.primaryDark,
                  fontWeight: 600,
                }}
              >
                ✅ {dietImage.name}
              </p>
            ) : (
              <p style={{ margin: 0, color: colours.textMuted }}>
                Tap to select screenshot
              </p>
            )}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            style={{ display: "none" }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) setDietImage(file);
            }}
          />

          {dietMessage && (
            <p
              style={{ color: colours.error, fontSize: 13, margin: "0 0 12px" }}
            >
              {dietMessage}
            </p>
          )}

          <div style={{ display: "flex", alignItems: "center" }}>
            <button
              onClick={handleDietSubmit}
              disabled={dietSubmitting || !dietImage}
              style={{ ...buttonStyle, opacity: !dietImage ? 0.5 : 1 }}
            >
              {dietSubmitting ? "Reading image..." : "Submit"}
            </button>
            <button onClick={() => setPopupStep("none")} style={skipStyle}>
              Skip for now
            </button>
          </div>
        </Popup>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* MAIN PAGE                                                            */}
      {/* ------------------------------------------------------------------ */}
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
        <div style={{ marginBottom: 32 }}>
          <h1 style={{ margin: 0, fontSize: 28, color: colours.primaryDark }}>
            ☀️ Activity Coach
          </h1>
          <p
            style={{
              color: colours.textMuted,
              margin: "6px 0 0",
              fontSize: 14,
            }}
          >
            Log your evening mood so your morning suggestion is personalised.
          </p>
        </div>

        {/* MOOD SECTION */}
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

              <button
                type="submit"
                disabled={moodSubmitting}
                style={buttonStyle}
              >
                {moodSubmitting ? "Saving..." : "Log Mood"}
              </button>

              {moodMessage && <p style={{ marginTop: 12 }}>{moodMessage}</p>}
            </form>
          )}
        </Section>

        {/* ACTIVITIES SECTION */}
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
            <p style={{ color: colours.textMuted }}>
              No activities logged yet.
            </p>
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
                  <span> — {activity.duration_minutes} mins</span>
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
                    <p
                      style={{ margin: "4px 0 0", color: "#555", fontSize: 13 }}
                    >
                      {activity.notes}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Section>

        {/* DIET SECTION */}
        <Section title="Diet" emoji="🥗">
          {dietLog ? (
            <div>
              {/* Summary */}
              <div
                style={{
                  background: colours.cardBg,
                  border: `1px solid ${colours.cardBorder}`,
                  borderRadius: 8,
                  padding: 16,
                  marginBottom: 16,
                }}
              >
                <p
                  style={{
                    margin: "0 0 8px",
                    fontWeight: 700,
                    color: colours.primaryDark,
                  }}
                >
                  {formatDate(dietLog.log_date)}
                </p>

                {dietLog.weight_kg && (
                  <p style={{ margin: "0 0 8px", fontSize: 14 }}>
                    ⚖️ <strong>Weight:</strong> {dietLog.weight_kg}kg
                  </p>
                )}

                {dietLog.kcal ? (
                  <div style={{ fontSize: 14 }}>
                    <p style={{ margin: "0 0 4px" }}>
                      🔥 <strong>Calories:</strong> {dietLog.kcal} kcal{" "}
                      {dietLog.kcal_pct != null
                        ? `(${dietLog.kcal_pct}% of guide)`
                        : ""}
                    </p>
                    <p style={{ margin: "0 0 4px" }}>
                      🥩 <strong>Protein:</strong> {dietLog.protein_g}g{" "}
                      {dietLog.protein_pct != null
                        ? `(${dietLog.protein_pct}%)`
                        : ""}
                    </p>
                    <p style={{ margin: "0 0 4px" }}>
                      🍞 <strong>Carbs:</strong> {dietLog.carbs_g}g
                    </p>
                    <p style={{ margin: "0 0 4px" }}>
                      🧈 <strong>Fat:</strong> {dietLog.fat_g}g
                    </p>
                    <p style={{ margin: 0 }}>
                      🌿 <strong>Fibre:</strong> {dietLog.fibre_g}g
                    </p>
                  </div>
                ) : (
                  <p
                    style={{
                      color: colours.textMuted,
                      fontSize: 14,
                      margin: 0,
                    }}
                  >
                    No diet data logged yet.
                  </p>
                )}
              </div>

              {/* Update buttons */}
              <div style={{ display: "flex", gap: 10 }}>
                <button
                  onClick={() => setPopupStep("weight")}
                  style={{ ...buttonStyle, fontSize: 13, padding: "8px 16px" }}
                >
                  ⚖️ Update Weight
                </button>
                <button
                  onClick={() => setPopupStep("diet")}
                  style={{ ...buttonStyle, fontSize: 13, padding: "8px 16px" }}
                >
                  🥗 Update Diet
                </button>
              </div>
            </div>
          ) : (
            <p
              style={{
                color: colours.textMuted,
                fontStyle: "italic",
                margin: 0,
              }}
            >
              No data logged yet. Open the app tomorrow morning to log today's
              diet and weight.
            </p>
          )}
        </Section>
      </main>
    </>
  );
}
