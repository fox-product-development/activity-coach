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
          maxHeight: "90vh",
          overflowY: "auto",
        }}
      >
        {children}
      </div>
    </div>
  );
}

// -------------------------------------------------------------------------
// TYPES
// -------------------------------------------------------------------------
type PopupStep = "none" | "weight" | "diet";
type ActivityPopupMode = "none" | "add" | "edit" | "confirm";
type ActivityTab = "manual" | "screenshot";

const activityLabels: Record<string, string> = {
  running: "🏃 Running",
  cycling_indoor: "🚴 Cycling (Indoor)",
  cycling_outdoor: "🚴 Cycling (Outdoor)",
  fishing: "🎣 Fishing",
  kung_fu: "🥋 Kung Fu",
  gym: "🏋️ Gym",
  other: "✏️ Other",
};

// -------------------------------------------------------------------------
// MAIN PAGE
// -------------------------------------------------------------------------
export default function Home() {
  // DIET/WEIGHT POPUP STATE
  const [popupStep, setPopupStep] = useState<PopupStep>("none");
  const [dietLog, setDietLog] = useState<DietLog | null>(null);
  const [yesterdayStr, setYesterdayStr] = useState("");
  const [checkComplete, setCheckComplete] = useState(false);
  const [weight, setWeight] = useState("");
  const [weightSubmitting, setWeightSubmitting] = useState(false);
  const [weightMessage, setWeightMessage] = useState("");
  const [dietImage, setDietImage] = useState<File | null>(null);
  const [dietSubmitting, setDietSubmitting] = useState(false);
  const [dietMessage, setDietMessage] = useState("");
  const dietFileInputRef = useRef<HTMLInputElement>(null);

  // ACTIVITY STATE
  const [days, setDays] = useState<Record<string, Activity[]>>({});
  const [activitiesLoading, setActivitiesLoading] = useState(true);
  const [activityPopupMode, setActivityPopupMode] =
    useState<ActivityPopupMode>("none");
  const [activityTab, setActivityTab] = useState<ActivityTab>("manual");
  const [editingActivity, setEditingActivity] = useState<Activity | null>(null);
  const [activityType, setActivityType] = useState<string>("running");
  const [activityDate, setActivityDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [activityDuration, setActivityDuration] = useState("");
  const [activityNotes, setActivityNotes] = useState("");
  const [activityDistance, setActivityDistance] = useState("");
  const [activitySubmitting, setActivitySubmitting] = useState(false);
  const [activityMessage, setActivityMessage] = useState("");
  const [activityImage, setActivityImage] = useState<File | null>(null);
  const [activityImageSubmitting, setActivityImageSubmitting] = useState(false);
  const [activityImageMessage, setActivityImageMessage] = useState("");
  const activityFileInputRef = useRef<HTMLInputElement>(null);

  // MOOD STATE
  const [moodScore, setMoodScore] = useState(3);
  const [energyScore, setEnergyScore] = useState(3);
  const [moodNotes, setMoodNotes] = useState("");
  const [moodSubmitting, setMoodSubmitting] = useState(false);
  const [moodMessage, setMoodMessage] = useState("");
  const [todayMood, setTodayMood] = useState<MoodLog | null>(null);
  const [moodLoading, setMoodLoading] = useState(true);

  // -------------------------------------------------------------------------
  // LOAD DATA
  // -------------------------------------------------------------------------
  useEffect(() => {
    fetchActivities();
    fetchMood();
    checkDietStatus();
  }, []);

  async function fetchActivities() {
    setActivitiesLoading(true);
    const res = await fetch("/api/activities");
    const data = await res.json();
    setDays(data.days || {});
    setActivitiesLoading(false);
  }

  async function fetchMood() {
    const res = await fetch("/api/mood");
    const data = await res.json();
    setTodayMood(data.todayLog);
    setMoodLoading(false);
  }

  async function checkDietStatus() {
    const res = await fetch("/api/diet");
    const data = await res.json();
    setDietLog(data.log);
    setYesterdayStr(data.yesterdayStr);
    if (!data.hasWeight) setPopupStep("weight");
    else if (!data.hasDiet) setPopupStep("diet");
    else setPopupStep("none");
    setCheckComplete(true);
  }

  // -------------------------------------------------------------------------
  // ACTIVITY POPUP HELPERS
  // -------------------------------------------------------------------------
  function openAddActivity() {
    setEditingActivity(null);
    setActivityType("running");
    setActivityDate(new Date().toISOString().split("T")[0]);
    setActivityDuration("");
    setActivityNotes("");
    setActivityDistance("");
    setActivityMessage("");
    setActivityImage(null);
    setActivityImageMessage("");
    setActivityTab("manual");
    setActivityPopupMode("add");
  }

  function openEditActivity(activity: Activity) {
    setEditingActivity(activity);
    setActivityType(activity.type);
    setActivityDate(activity.date.split("T")[0]);
    setActivityDuration(String(activity.duration_minutes));
    setActivityNotes(activity.notes || "");
    setActivityDistance(
      activity.distance_km ? String(activity.distance_km) : "",
    );
    setActivityMessage("");
    setActivityTab("manual");
    setActivityPopupMode("edit");
  }

  function closeActivityPopup() {
    setActivityPopupMode("none");
    setEditingActivity(null);
    setActivityImage(null);
    setActivityMessage("");
    setActivityImageMessage("");
  }

  // -------------------------------------------------------------------------
  // ACTIVITY SUBMIT — MANUAL
  // -------------------------------------------------------------------------
  async function handleActivityManualSubmit() {
    if (!activityType || !activityDate || !activityDuration) return;
    setActivitySubmitting(true);
    setActivityMessage("");

    // Use editingActivity being set as the indicator, not the popup mode
    // because by confirm step the mode is 'confirm' not 'edit'
    const isEdit = editingActivity != null;

    const res = await fetch(
      isEdit ? `/api/activities/${editingActivity!.id}` : "/api/activities",
      {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: activityType,
          date: activityDate,
          duration_minutes: activityDuration,
          notes: activityNotes || null,
          distance_km: activityDistance || null,
        }),
      },
    );

    const data = await res.json();

    if (res.ok) {
      await fetchActivities();
      closeActivityPopup();
    } else {
      setActivityMessage(data.error || "Something went wrong");
    }
    setActivitySubmitting(false);
  }
  // -------------------------------------------------------------------------
  // ACTIVITY SUBMIT — SCREENSHOT
  // -------------------------------------------------------------------------
  async function handleActivityImageSubmit() {
    if (!activityImage) return;
    setActivityImageSubmitting(true);
    setActivityImageMessage("");

    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve((reader.result as string).split(",")[1]);
      reader.onerror = reject;
      reader.readAsDataURL(activityImage);
    });

    const res = await fetch("/api/activities", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        imageBase64: base64,
        mediaType: activityImage.type,
      }),
    });

    const data = await res.json();

    if (res.ok) {
      await fetchActivities();
      closeActivityPopup();
    } else {
      setActivityImageMessage(data.error || "Something went wrong");
    }
    setActivityImageSubmitting(false);
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

    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve((reader.result as string).split(",")[1]);
      reader.onerror = reject;
      reader.readAsDataURL(dietImage);
    });

    const res = await fetch("/api/diet", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imageBase64: base64, mediaType: dietImage.type }),
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
  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString("en-GB", {
      weekday: "long",
      day: "numeric",
      month: "long",
    });
  }

  function formatDateShort(dateStr: string) {
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
      {/* WEIGHT POPUP */}
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

      {/* DIET POPUP */}
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
            onClick={() => dietFileInputRef.current?.click()}
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
            ref={dietFileInputRef}
            type="file"
            accept="image/*"
            style={{ display: "none" }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) setDietImage(f);
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

      {/* ACTIVITY ADD/EDIT POPUP */}
      {(activityPopupMode === "add" || activityPopupMode === "edit") && (
        <Popup>
          <h2 style={{ margin: "0 0 4px", color: colours.primaryDark }}>
            {activityPopupMode === "edit"
              ? "✏️ Edit Activity"
              : "➕ Add Activity"}
          </h2>
          <p
            style={{
              color: colours.textMuted,
              fontSize: 14,
              margin: "0 0 20px",
            }}
          >
            {activityPopupMode === "edit"
              ? "Update the details below."
              : "Log manually or upload a screenshot."}
          </p>

          {/* Tabs — only show on add mode */}
          {activityPopupMode === "add" && (
            <div
              style={{
                display: "flex",
                marginBottom: 20,
                borderBottom: `2px solid ${colours.border}`,
              }}
            >
              {(["manual", "screenshot"] as ActivityTab[]).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActivityTab(tab)}
                  style={{
                    background: "none",
                    border: "none",
                    padding: "8px 16px",
                    fontWeight: activityTab === tab ? 700 : 400,
                    color:
                      activityTab === tab
                        ? colours.primaryDark
                        : colours.textMuted,
                    borderBottom:
                      activityTab === tab
                        ? `2px solid ${colours.primaryDark}`
                        : "2px solid transparent",
                    cursor: "pointer",
                    fontSize: 14,
                    marginBottom: -2,
                  }}
                >
                  {tab === "manual" ? "✍️ Manual" : "📸 Screenshot"}
                </button>
              ))}
            </div>
          )}

          {/* MANUAL FORM */}
          {(activityTab === "manual" || activityPopupMode === "edit") && (
            <div>
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontWeight: 600 }}>
                  Activity
                  <br />
                  <select
                    value={activityType}
                    onChange={(e) => setActivityType(e.target.value)}
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
                    value={activityDate}
                    onChange={(e) => setActivityDate(e.target.value)}
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
                    value={activityDuration}
                    onChange={(e) => setActivityDuration(e.target.value)}
                    min={1}
                    style={{ ...inputStyle, marginTop: 4 }}
                  />
                </label>
              </div>

              {(activityType === "running" ||
                activityType === "cycling_outdoor") && (
                <div style={{ marginBottom: 12 }}>
                  <label style={{ fontWeight: 600 }}>
                    Distance (km) — optional
                    <br />
                    <input
                      type="number"
                      value={activityDistance}
                      onChange={(e) => setActivityDistance(e.target.value)}
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
                    value={activityNotes}
                    onChange={(e) => setActivityNotes(e.target.value)}
                    rows={2}
                    style={{ ...inputStyle, marginTop: 4 }}
                    placeholder={
                      activityType === "other"
                        ? "Describe the activity e.g. Yoga, Pilates..."
                        : ""
                    }
                  />
                </label>
              </div>

              {activityMessage && (
                <p
                  style={{
                    color: colours.error,
                    fontSize: 13,
                    margin: "0 0 12px",
                  }}
                >
                  {activityMessage}
                </p>
              )}

              <div style={{ display: "flex", gap: 10 }}>
                {activityPopupMode === "edit" ? (
                  <button
                    onClick={() => setActivityPopupMode("confirm")}
                    disabled={!activityDuration}
                    style={{
                      ...buttonStyle,
                      opacity: !activityDuration ? 0.5 : 1,
                    }}
                  >
                    Review Changes
                  </button>
                ) : (
                  <button
                    onClick={handleActivityManualSubmit}
                    disabled={activitySubmitting || !activityDuration}
                    style={{
                      ...buttonStyle,
                      opacity: !activityDuration ? 0.5 : 1,
                    }}
                  >
                    {activitySubmitting ? "Saving..." : "Add Activity"}
                  </button>
                )}
                <button onClick={closeActivityPopup} style={skipStyle}>
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* SCREENSHOT TAB */}
          {activityTab === "screenshot" && activityPopupMode === "add" && (
            <div>
              <p
                style={{
                  color: colours.textMuted,
                  fontSize: 13,
                  margin: "0 0 16px",
                }}
              >
                Upload a Garmin or Strava activity screenshot — we'll extract
                the details automatically.
              </p>
              <div
                onClick={() => activityFileInputRef.current?.click()}
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
                {activityImage ? (
                  <p
                    style={{
                      margin: 0,
                      color: colours.primaryDark,
                      fontWeight: 600,
                    }}
                  >
                    ✅ {activityImage.name}
                  </p>
                ) : (
                  <p style={{ margin: 0, color: colours.textMuted }}>
                    Tap to select Garmin or Strava screenshot
                  </p>
                )}
              </div>
              <input
                ref={activityFileInputRef}
                type="file"
                accept="image/*"
                style={{ display: "none" }}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) setActivityImage(f);
                }}
              />

              {activityImageMessage && (
                <p
                  style={{
                    color: colours.error,
                    fontSize: 13,
                    margin: "0 0 12px",
                  }}
                >
                  {activityImageMessage}
                </p>
              )}

              <div style={{ display: "flex", alignItems: "center" }}>
                <button
                  onClick={handleActivityImageSubmit}
                  disabled={activityImageSubmitting || !activityImage}
                  style={{ ...buttonStyle, opacity: !activityImage ? 0.5 : 1 }}
                >
                  {activityImageSubmitting
                    ? "Reading image..."
                    : "Upload & Extract"}
                </button>
                <button onClick={closeActivityPopup} style={skipStyle}>
                  Cancel
                </button>
              </div>
            </div>
          )}
        </Popup>
      )}

      {/* CONFIRM AMENDMENT POPUP */}
      {activityPopupMode === "confirm" && editingActivity && (
        <Popup>
          <h2 style={{ margin: "0 0 8px", color: colours.primaryDark }}>
            ⚠️ Confirm Changes
          </h2>
          <p
            style={{
              color: colours.textMuted,
              fontSize: 14,
              margin: "0 0 20px",
            }}
          >
            Are you sure you want to update this activity?
          </p>

          <div
            style={{
              background: colours.cardBg,
              border: `1px solid ${colours.cardBorder}`,
              borderRadius: 8,
              padding: 16,
              marginBottom: 20,
            }}
          >
            <p style={{ margin: "0 0 4px" }}>
              <strong>Type:</strong> {activityLabels[activityType]}
            </p>
            <p style={{ margin: "0 0 4px" }}>
              <strong>Date:</strong> {formatDateShort(activityDate)}
            </p>
            <p style={{ margin: "0 0 4px" }}>
              <strong>Duration:</strong> {activityDuration} mins
            </p>
            {activityDistance && (
              <p style={{ margin: "0 0 4px" }}>
                <strong>Distance:</strong> {activityDistance}km
              </p>
            )}
            {activityNotes && (
              <p style={{ margin: 0 }}>
                <strong>Notes:</strong> {activityNotes}
              </p>
            )}
          </div>

          {activityMessage && (
            <p
              style={{ color: colours.error, fontSize: 13, margin: "0 0 12px" }}
            >
              {activityMessage}
            </p>
          )}

          <div style={{ display: "flex", gap: 10 }}>
            <button
              onClick={handleActivityManualSubmit}
              disabled={activitySubmitting}
              style={buttonStyle}
            >
              {activitySubmitting ? "Saving..." : "Yes, update"}
            </button>
            <button
              onClick={() => setActivityPopupMode("edit")}
              style={skipStyle}
            >
              Go back
            </button>
          </div>
        </Popup>
      )}

      {/* MAIN PAGE */}
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
          {activitiesLoading ? (
            <p>Loading...</p>
          ) : (
            <>
              {/* 7 DAY VIEW */}
              {Object.entries(days).map(([dateKey, dayActivities]) => (
                <div key={dateKey} style={{ marginBottom: 16 }}>
                  <p
                    style={{
                      margin: "0 0 8px",
                      fontWeight: 700,
                      color: colours.primaryDark,
                      fontSize: 14,
                    }}
                  >
                    {formatDate(dateKey)}
                  </p>
                  {dayActivities.length === 0 ? (
                    <p
                      style={{
                        color: colours.textMuted,
                        fontSize: 13,
                        fontStyle: "italic",
                        margin: "0 0 0 4px",
                      }}
                    >
                      Rest day
                    </p>
                  ) : (
                    dayActivities.map((activity) => (
                      <div
                        key={activity.id}
                        onClick={() => openEditActivity(activity)}
                        style={{
                          background: colours.cardBg,
                          border: `1px solid ${colours.cardBorder}`,
                          borderLeft: `4px solid ${colours.primary}`,
                          borderRadius: 8,
                          padding: "10px 14px",
                          marginBottom: 6,
                          cursor: "pointer",
                        }}
                      >
                        <strong style={{ color: colours.primaryDark }}>
                          {activityLabels[activity.type] || activity.type}
                        </strong>
                        <span> — {activity.duration_minutes} mins</span>
                        {activity.distance_km && (
                          <span style={{ color: colours.textMuted }}>
                            {" "}
                            · {activity.distance_km}km
                          </span>
                        )}
                        {activity.notes && (
                          <p
                            style={{
                              margin: "4px 0 0",
                              fontSize: 13,
                              color: "#555",
                            }}
                          >
                            {activity.notes}
                          </p>
                        )}
                        <p
                          style={{
                            margin: "4px 0 0",
                            fontSize: 11,
                            color: colours.textMuted,
                          }}
                        >
                          Tap to edit
                        </p>
                      </div>
                    ))
                  )}
                </div>
              ))}

              {/* ADD BUTTON */}
              <button
                onClick={openAddActivity}
                style={{ ...buttonStyle, width: "100%", marginTop: 8 }}
              >
                ➕ Add Activity
              </button>
            </>
          )}
        </Section>

        {/* DIET SECTION */}
        <Section title="Diet" emoji="🥗">
          {dietLog ? (
            <div>
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
