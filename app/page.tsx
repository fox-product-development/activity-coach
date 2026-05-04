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
  primaryMotivation: "#F7F70C",
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
  // SETTINGS STATE
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [kungFuEnabled, setKungFuEnabled] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState(false);

  // KUNG FU STATE
  const [kungFuSash, setKungFuSash] = useState("red");
  const [kungFuRecommendation, setKungFuRecommendation] = useState<{
    element: string;
    suggestion: string;
  } | null>(null);
  const [kungFuElements, setKungFuElements] = useState<any[]>([]);
  const [levelUpOpen, setLevelUpOpen] = useState(false);
  const [levelUpSaving, setLevelUpSaving] = useState(false);
  const [markDoneOpen, setMarkDoneOpen] = useState(false);

  const sashColours: Record<string, string> = {
    red: "#FF2400",
    yellow: "#F7F70C",
    next: "#00CC44",
  };

  const sashNextLevel: Record<string, string> = {
    red: "yellow",
    yellow: "next",
    next: "next",
  };

  const sashLabels: Record<string, string> = {
    red: "Red Sash",
    yellow: "Yellow Sash",
    next: "Next Level",
  };

  // GOAL STATE
  const [goal, setGoal] = useState("");
  const [goalEditing, setGoalEditing] = useState(false);
  const [goalInput, setGoalInput] = useState("");
  const [goalSaving, setGoalSaving] = useState(false);

  // DAILY MOTIVATION STATE
  const [motivation, setMotivation] = useState("");

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
  const [userActivityTypes, setUserActivityTypes] = useState<any[]>([]);
  const [availableActivityTypes, setAvailableActivityTypes] = useState<any[]>(
    [],
  );
  const [activityTypesOpen, setActivityTypesOpen] = useState(false);
  const [removeActivityOpen, setRemoveActivityOpen] = useState(false);
  const [activityToRemove, setActivityToRemove] = useState<any>(null);
  const [customActivityName, setCustomActivityName] = useState("");
  const [customActivityOutdoor, setCustomActivityOutdoor] = useState(false);
  const [activityTypesSaving, setActivityTypesSaving] = useState(false);

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
    fetchGoal();
    fetchSettings();
    fetchKungFuData();
    fetchMotivation();
    fetchActivityTypes();
  }, []);

  async function fetchActivityTypes() {
    const res = await fetch("/api/activity-types");
    const data = await res.json();
    setUserActivityTypes(data.current || []);
    setAvailableActivityTypes(data.available || []);
  }

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
  async function fetchSettings() {
    const res = await fetch("/api/settings?key=kung_fu_enabled");
    const data = await res.json();
    setKungFuEnabled(data.value === "true");
  }
  async function fetchKungFuData() {
    // Get sash level
    const sashRes = await fetch("/api/settings?key=kung_fu_sash");
    const sashData = await sashRes.json();
    setKungFuSash(sashData.value || "red");

    // Get today's kung fu recommendation
    const todayRes = await fetch("/api/agent/today");
    const todayData = await todayRes.json();
    if (todayData.kung_fu_suggestion) {
      setKungFuRecommendation({
        element: todayData.kung_fu_element || "",
        suggestion: todayData.kung_fu_suggestion,
      });
    }

    // Get kung fu elements from database
    const elementsRes = await fetch("/api/kungfu/elements");
    const elementsData = await elementsRes.json();
    setKungFuElements(elementsData.elements || []);
  }

  async function handleLevelUp() {
    setLevelUpSaving(true);
    const nextLevel = sashNextLevel[kungFuSash];

    await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: "kung_fu_sash", value: nextLevel }),
    });

    setKungFuSash(nextLevel);
    setLevelUpSaving(false);
    setLevelUpOpen(false);
  }

  async function handleSettingsSave() {
    setSettingsSaving(true);
    await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        key: "kung_fu_enabled",
        value: String(kungFuEnabled),
      }),
    });
    setSettingsSaving(false);
    setSettingsOpen(false);
  }

  async function fetchGoal() {
    const res = await fetch("/api/settings?key=goal");
    const data = await res.json();
    setGoal(data.value || "");
    setGoalInput(data.value || "");
  }

  async function fetchMotivation() {
    const res = await fetch("/api/agent/today");
    const data = await res.json();
    setMotivation(data.motivation || "");
  }

  async function checkDietStatus() {
    const res = await fetch("/api/diet");
    const data = await res.json();
    setDietLog(data.todayLog);
    setYesterdayStr(data.yesterdayStr);

    if (!data.hasWeight) {
      setPopupStep("weight");
    } else if (!data.hasDiet) {
      setPopupStep("diet");
    } else {
      setPopupStep("none");
    }
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

  async function handleGoalSave() {
    if (!goalInput.trim()) return;
    setGoalSaving(true);

    const res = await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: "goal", value: goalInput.trim() }),
    });

    if (res.ok) {
      setGoal(goalInput.trim());
      setGoalEditing(false);
    }
    setGoalSaving(false);
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
      body: JSON.stringify({ weight_kg: weight }),
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
      setPopupStep("none");
      setDietImage(null);
      // Refresh from API to get correct today's data rather than the uploaded entry
      await checkDietStatus();
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
      {/* SETTINGS POPUP */}
      {settingsOpen && (
        <Popup>
          <h2 style={{ margin: "0 0 20px", color: colours.primaryDark }}>
            ⚙️ Settings
          </h2>

          <div
            style={{
              background: colours.primaryLight,
              border: `1px solid ${colours.border}`,
              borderRadius: 8,
              padding: "16px",
              marginBottom: 20,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div>
              <p
                style={{
                  margin: "0 0 4px",
                  fontWeight: 700,
                  color: colours.primaryDark,
                }}
              >
                🥋 Kung Fu Training
              </p>
              <p style={{ margin: 0, fontSize: 12, color: colours.textMuted }}>
                {kungFuEnabled
                  ? "Daily Kung Fu recommendations enabled"
                  : "Kung Fu recommendations disabled"}
              </p>
            </div>
            <button
              onClick={() => setKungFuEnabled(!kungFuEnabled)}
              style={{
                background: kungFuEnabled ? colours.primary : "#e5e5e5",
                border: "none",
                borderRadius: 20,
                padding: "6px 16px",
                fontSize: 13,
                fontWeight: 700,
                color: kungFuEnabled ? colours.primaryDark : colours.textMuted,
                cursor: "pointer",
                minWidth: 60,
              }}
            >
              {kungFuEnabled ? "On" : "Off"}
            </button>
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <button
              onClick={handleSettingsSave}
              disabled={settingsSaving}
              style={buttonStyle}
            >
              {settingsSaving ? "Saving..." : "Save"}
            </button>
            <button onClick={() => setSettingsOpen(false)} style={skipStyle}>
              Cancel
            </button>
          </div>
        </Popup>
      )}

      {/* WEIGHT POPUP */}
      {checkComplete && popupStep === "weight" && (
        <Popup>
          <h2 style={{ margin: "0 0 8px", color: colours.primaryDark }}>
            ⚖️ Morning Weigh-in
          </h2>
          <p
            style={{
              color: colours.textMuted,
              fontSize: 14,
              margin: "0 0 20px",
            }}
          >
            Log your weight for today — best done first thing for consistency.
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
            🥗 Today's Diet
          </h2>
          <p
            style={{
              color: colours.textMuted,
              fontSize: 14,
              margin: "0 0 20px",
            }}
          >
            Upload your Nutra Check summary screenshot for{" "}
            {formatDate(new Date().toISOString().split("T")[0])}.
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

      {/* REMOVE ACTIVITY CONFIRMATION */}
      {removeActivityOpen && activityToRemove && (
        <Popup>
          <h2 style={{ margin: "0 0 8px", color: colours.primaryDark }}>
            Remove Activity
          </h2>
          <p
            style={{
              color: colours.textMuted,
              fontSize: 14,
              margin: "0 0 20px",
            }}
          >
            Remove{" "}
            <strong>
              {activityToRemove.emoji} {activityToRemove.name}
            </strong>{" "}
            from your list?
          </p>
          <div style={{ display: "flex", gap: 10 }}>
            <button
              onClick={async () => {
                await fetch("/api/activity-types", {
                  method: "DELETE",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ type_key: activityToRemove.type_key }),
                });
                setRemoveActivityOpen(false);
                setActivityToRemove(null);
                fetchActivityTypes();
              }}
              style={{ ...buttonStyle, background: "#DC2626", color: "white" }}
            >
              Yes, remove
            </button>
            <button
              onClick={() => {
                setRemoveActivityOpen(false);
                setActivityToRemove(null);
              }}
              style={skipStyle}
            >
              Cancel
            </button>
          </div>
        </Popup>
      )}

      {/* ACTIVITY TYPES MANAGEMENT POPUP */}
      {activityTypesOpen && (
        <Popup>
          <h2 style={{ margin: "0 0 20px", color: colours.primaryDark }}>
            ⚙️ Manage Activities
          </h2>

          {/* CURRENT ACTIVITIES */}
          <p
            style={{
              fontWeight: 700,
              color: colours.primaryDark,
              margin: "0 0 8px",
              fontSize: 14,
            }}
          >
            Your Activities
          </p>
          {userActivityTypes.map((activity) => (
            <div
              key={activity.type_key}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                background: colours.cardBg,
                border: `1px solid ${colours.cardBorder}`,
                borderRadius: 8,
                padding: "10px 14px",
                marginBottom: 8,
              }}
            >
              <span
                style={{
                  color: colours.primaryDark,
                  fontWeight: 600,
                  fontSize: 14,
                }}
              >
                {activity.emoji} {activity.name}
              </span>
              <button
                onClick={() => {
                  setActivityToRemove(activity);
                  setRemoveActivityOpen(true);
                }}
                style={{
                  background: "none",
                  border: `1px solid #DC2626`,
                  borderRadius: 6,
                  padding: "4px 10px",
                  color: "#DC2626",
                  fontSize: 12,
                  cursor: "pointer",
                }}
              >
                Remove
              </button>
            </div>
          ))}

          <hr style={{ margin: "16px 0", borderColor: colours.border }} />

          {/* AVAILABLE TO ADD */}
          {availableActivityTypes.length > 0 && (
            <>
              <p
                style={{
                  fontWeight: 700,
                  color: colours.primaryDark,
                  margin: "0 0 8px",
                  fontSize: 14,
                }}
              >
                Add from library
              </p>
              {availableActivityTypes.map((activity) => (
                <div
                  key={activity.type_key}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    background: colours.pageBg,
                    border: `1px solid ${colours.border}`,
                    borderRadius: 8,
                    padding: "10px 14px",
                    marginBottom: 8,
                  }}
                >
                  <span style={{ color: colours.text, fontSize: 14 }}>
                    {activity.emoji} {activity.name}
                  </span>
                  <button
                    onClick={async () => {
                      await fetch("/api/activity-types", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          type_key: activity.type_key,
                          name: activity.name,
                          is_outdoor: activity.is_outdoor,
                          emoji: activity.emoji,
                        }),
                      });
                      fetchActivityTypes();
                    }}
                    style={{
                      ...buttonStyle,
                      fontSize: 12,
                      padding: "4px 12px",
                    }}
                  >
                    Add
                  </button>
                </div>
              ))}
              <hr style={{ margin: "16px 0", borderColor: colours.border }} />
            </>
          )}

          {/* CUSTOM ACTIVITY */}
          <p
            style={{
              fontWeight: 700,
              color: colours.primaryDark,
              margin: "0 0 8px",
              fontSize: 14,
            }}
          >
            Add custom activity
          </p>
          <input
            type="text"
            value={customActivityName}
            onChange={(e) => setCustomActivityName(e.target.value)}
            placeholder="e.g. Rock Climbing"
            style={{ ...inputStyle, marginBottom: 10 }}
          />
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 16,
              fontSize: 14,
            }}
          >
            <input
              type="checkbox"
              checked={customActivityOutdoor}
              onChange={(e) => setCustomActivityOutdoor(e.target.checked)}
            />
            Outdoor activity (weather will be considered)
          </label>

          <div style={{ display: "flex", gap: 10 }}>
            <button
              onClick={async () => {
                if (!customActivityName.trim()) return;
                setActivityTypesSaving(true);
                const typeKey = customActivityName
                  .trim()
                  .toLowerCase()
                  .replace(/\s+/g, "_");
                await fetch("/api/activity-types", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    type_key: typeKey,
                    name: customActivityName.trim(),
                    is_outdoor: customActivityOutdoor,
                    emoji: customActivityOutdoor ? "🌿" : "🏃",
                  }),
                });
                setCustomActivityName("");
                setCustomActivityOutdoor(false);
                setActivityTypesSaving(false);
                fetchActivityTypes();
              }}
              disabled={activityTypesSaving || !customActivityName.trim()}
              style={{
                ...buttonStyle,
                opacity: !customActivityName.trim() ? 0.5 : 1,
              }}
            >
              {activityTypesSaving ? "Adding..." : "Add Activity"}
            </button>
            <button
              onClick={() => setActivityTypesOpen(false)}
              style={skipStyle}
            >
              Close
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
                    {userActivityTypes.map((activity) => (
                      <option key={activity.type_key} value={activity.type_key}>
                        {activity.emoji} {activity.name}
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
          maxWidth: 400,
          margin: "0 auto",
          padding: "40px 20px",
          fontFamily: "sans-serif",
          background: colours.pageBg,
          minHeight: "100vh",
          color: colours.text,
        }}
      >
        <div style={{ marginBottom: 32 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <h1 style={{ margin: 0, fontSize: 28, color: colours.primaryDark }}>
              ☀️ Activity Coach
            </h1>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={() => setSettingsOpen(true)}
                style={{
                  background: "none",
                  border: `1px solid ${colours.border}`,
                  borderRadius: 8,
                  padding: "6px 12px",
                  fontSize: 10,
                  color: colours.textMuted,
                  cursor: "pointer",
                }}
              >
                Settings
              </button>
              <button
                onClick={async () => {
                  const { createBrowserClient } = await import("@supabase/ssr");
                  const supabase = createBrowserClient(
                    process.env.NEXT_PUBLIC_SUPABASE_URL!,
                    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
                  );
                  await supabase.auth.signOut();
                  window.location.href = "/login";
                }}
                style={{
                  background: "none",
                  border: `1px solid ${colours.border}`,
                  borderRadius: 8,
                  padding: "6px 12px",
                  fontSize: 10,
                  color: colours.textMuted,
                  cursor: "pointer",
                }}
              >
                Sign out
              </button>
            </div>
          </div>
          <p
            style={{
              color: colours.textMuted,
              margin: "6px 0 0 0",
              fontSize: 14,
            }}
          >
            Log your evening mood so your morning suggestion is personalised.
          </p>

          {/* DAILY MOTIVATION */}
          {motivation && (
            <div
              style={{
                marginTop: 5,
                background: colours.primaryMotivation,
                border: `1px solid ${colours.primary}`,
                borderRadius: 8,
                padding: "10px 14px",
                fontWeight: 400,
                maxWidth: 380,
                textAlign: "center",
              }}
            >
              <p
                style={{
                  margin: 0,
                  color: colours.primaryDark,
                  fontSize: 16,
                  fontStyle: "italic",
                }}
              >
                {motivation}
              </p>
            </div>
          )}
        </div>

        {/* GOAL */}
        <div style={{ marginBottom: 55 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span
              style={{
                fontWeight: 700,
                color: colours.primaryDark,
                fontSize: 16,
                textAlign: "center",
              }}
            >
              Goal
            </span>
            {goalEditing ? (
              <div style={{ flex: 1 }}>
                <textarea
                  value={goalInput}
                  onChange={(e) => setGoalInput(e.target.value)}
                  rows={2}
                  placeholder="e.g. Improve overall fitness and lose weight"
                  style={{ ...inputStyle, marginBottom: 8 }}
                />
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    onClick={handleGoalSave}
                    disabled={goalSaving}
                    style={{
                      ...buttonStyle,
                      padding: "6px 14px",
                      fontSize: 16,
                    }}
                  >
                    {goalSaving ? "Saving..." : "Save"}
                  </button>
                  <button
                    onClick={() => {
                      setGoalEditing(false);
                      setGoalInput(goal);
                    }}
                    style={{
                      background: "none",
                      border: "none",
                      color: colours.textMuted,
                      fontSize: 12,
                      cursor: "pointer",
                      textDecoration: "underline",
                      padding: 0,
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div
                style={{
                  background: colours.primaryMotivation,
                  border: `1px solid ${colours.border}`,
                  borderRadius: 8,
                  padding: "8px 12px",
                  color: colours.primaryDark,
                  fontSize: 18,
                  fontWeight: 600,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  maxWidth: 380,
                }}
              >
                <span style={{ flex: 1, textAlign: "center" }}>
                  {goal || (
                    <span
                      style={{
                        color: colours.textMuted,
                        fontWeight: 400,
                        fontStyle: "italic",
                      }}
                    >
                      No goal set
                    </span>
                  )}
                </span>
                <button
                  onClick={() => setGoalEditing(true)}
                  style={{
                    background: "none",
                    border: "none",
                    color: colours.textMuted,
                    fontSize: 10,
                    cursor: "pointer",
                    textDecoration: "underline",
                    padding: 0,
                  }}
                >
                  edit
                </button>
              </div>
            )}
          </div>
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
              {/* ADD BUTTON */}
              <button
                onClick={openAddActivity}
                style={{
                  ...buttonStyle,
                  width: "100%",
                  marginTop: 8,
                  marginBottom: 16,
                }}
              >
                ➕ Add Activity
              </button>
              <button
                onClick={() => setActivityTypesOpen(true)}
                style={{
                  ...buttonStyle,
                  width: "100%",
                  marginTop: 8,
                  background: colours.primaryLight,
                  color: colours.primaryDark,
                }}
              >
                ⚙️ Manage Activities
              </button>
            </>
          )}

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
        {/* KUNG FU SECTION — only show if enabled */}
        {kungFuEnabled && (
          <>
            {/* LEVEL UP POPUP */}
            {levelUpOpen && (
              <Popup>
                <h2 style={{ margin: "0 0 8px", color: colours.primaryDark }}>
                  🥋 Level Up!
                </h2>
                <p
                  style={{
                    color: colours.textMuted,
                    fontSize: 14,
                    margin: "0 0 20px",
                  }}
                >
                  Progress from <strong>{sashLabels[kungFuSash]}</strong> to{" "}
                  <strong>{sashLabels[sashNextLevel[kungFuSash]]}</strong>?
                </p>
                <div
                  style={{
                    background: sashColours[sashNextLevel[kungFuSash]],
                    borderRadius: 8,
                    padding: "12px 16px",
                    marginBottom: 20,
                    textAlign: "center",
                  }}
                >
                  <p
                    style={{
                      margin: 0,
                      color: "white",
                      fontWeight: 700,
                      fontSize: 16,
                    }}
                  >
                    {sashLabels[sashNextLevel[kungFuSash]]}
                  </p>
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                  <button
                    onClick={handleLevelUp}
                    disabled={levelUpSaving}
                    style={buttonStyle}
                  >
                    {levelUpSaving ? "Saving..." : "Yes, level up!"}
                  </button>
                  <button
                    onClick={() => setLevelUpOpen(false)}
                    style={skipStyle}
                  >
                    Not yet
                  </button>
                </div>
              </Popup>
            )}

            {/* MARK AS DONE POPUP */}
            {markDoneOpen && (
              <Popup>
                <h2 style={{ margin: "0 0 4px", color: colours.primaryDark }}>
                  🥋 Log Kung Fu Session
                </h2>
                <p
                  style={{
                    color: colours.textMuted,
                    fontSize: 14,
                    margin: "0 0 20px",
                  }}
                >
                  How long was your session?
                </p>
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
                <div style={{ marginBottom: 16 }}>
                  <label style={{ fontWeight: 600 }}>
                    Notes
                    <br />
                    <textarea
                      value={activityNotes}
                      onChange={(e) => setActivityNotes(e.target.value)}
                      rows={2}
                      style={{ ...inputStyle, marginTop: 4 }}
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
                  <button
                    onClick={async () => {
                      setActivitySubmitting(true);
                      const res = await fetch("/api/activities", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          type: "kung_fu",
                          date: new Date().toISOString().split("T")[0],
                          duration_minutes: activityDuration,
                          notes:
                            activityNotes ||
                            (kungFuRecommendation
                              ? `${kungFuRecommendation.element}`
                              : "Kung Fu session"),
                        }),
                      });
                      const data = await res.json();
                      if (res.ok) {
                        setMarkDoneOpen(false);
                        setActivityDuration("");
                        setActivityNotes("");
                        fetchActivities();
                      } else {
                        setActivityMessage(
                          data.error || "Something went wrong",
                        );
                      }
                      setActivitySubmitting(false);
                    }}
                    disabled={activitySubmitting || !activityDuration}
                    style={{
                      ...buttonStyle,
                      opacity: !activityDuration ? 0.5 : 1,
                    }}
                  >
                    {activitySubmitting ? "Saving..." : "Log Session"}
                  </button>
                  <button
                    onClick={() => {
                      setMarkDoneOpen(false);
                      setActivityDuration("");
                      setActivityNotes("");
                      setActivityMessage("");
                    }}
                    style={skipStyle}
                  >
                    Cancel
                  </button>
                </div>
              </Popup>
            )}

            {/* KUNG FU SASH SECTION */}
            <div
              style={{
                marginBottom: 12,
                borderRadius: 12,
                overflow: "hidden",
                border: `1px solid ${sashColours[kungFuSash]}`,
              }}
            >
              {/* SASH HEADER */}
              <button
                onClick={() => {
                  const el = document.getElementById("kungfu-content");
                  if (el)
                    el.style.display =
                      el.style.display === "none" ? "block" : "none";
                }}
                style={{
                  width: "100%",
                  background: sashColours[kungFuSash],
                  border: "none",
                  padding: "16px 20px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  cursor: "pointer",
                  fontSize: 16,
                  fontWeight: 700,
                  color: "white",
                }}
              >
                <span>🥋 Kung Fu — {sashLabels[kungFuSash]}</span>
                <span style={{ fontSize: 12 }}>▼ Show</span>
              </button>

              {/* CONTENT */}
              <div
                id="kungfu-content"
                style={{ display: "none", background: colours.white }}
              >
                {/* DAILY TRAINING */}
                <div style={{ padding: "20px 20px 0" }}>
                  <h3
                    style={{ margin: "0 0 12px", color: colours.primaryDark }}
                  >
                    Daily Training
                  </h3>
                  {kungFuRecommendation ? (
                    <div
                      style={{
                        background: colours.cardBg,
                        border: `1px solid ${colours.cardBorder}`,
                        borderLeft: `4px solid ${sashColours[kungFuSash]}`,
                        borderRadius: 8,
                        padding: "12px 16px",
                        marginBottom: 12,
                      }}
                    >
                      <p
                        style={{
                          margin: "0 0 4px",
                          fontWeight: 700,
                          color: colours.primaryDark,
                        }}
                      >
                        Qi Gong + {kungFuRecommendation.element}
                      </p>
                      <p
                        style={{
                          margin: 0,
                          fontSize: 13,
                          color: "#555",
                          lineHeight: 1.5,
                        }}
                      >
                        {kungFuRecommendation.suggestion.replace(
                          /\*\*(.*?)\*\*/g,
                          "$1",
                        )}
                      </p>
                    </div>
                  ) : (
                    <p
                      style={{
                        color: colours.textMuted,
                        fontStyle: "italic",
                        fontSize: 14,
                      }}
                    >
                      Today's recommendation will appear after your morning
                      email.
                    </p>
                  )}
                  <button
                    onClick={() => {
                      setActivityNotes(
                        kungFuRecommendation
                          ? `Qi Gong + ${kungFuRecommendation.element}`
                          : "Kung Fu session",
                      );
                      setMarkDoneOpen(true);
                    }}
                    style={{
                      ...buttonStyle,
                      fontSize: 13,
                      padding: "8px 16px",
                      marginBottom: 20,
                    }}
                  >
                    ✅ Mark as Done
                  </button>
                </div>

                <hr style={{ margin: "0 20px", borderColor: colours.border }} />

                {/* TRAINING GUIDE */}
                <div
                  style={{
                    borderTop: `1px solid ${colours.border}`,
                    borderRadius: 8,
                    marginTop: 12,
                    marginLeft: 20,
                    marginRight: 20,
                    marginBottom: 0,
                    overflow: "hidden",
                  }}
                >
                  <button
                    onClick={() => {
                      const el = document.getElementById(
                        "training-guide-content",
                      );
                      if (el)
                        el.style.display =
                          el.style.display === "none" ? "block" : "none";
                    }}
                    style={{
                      width: "100%",
                      background: colours.primaryLight,
                      border: "none",
                      padding: "16px 20px",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      cursor: "pointer",
                      fontSize: 15,
                      fontWeight: 700,
                      color: colours.primaryDark,
                    }}
                  >
                    <span>📖 Training Guide</span>
                    <span style={{ fontSize: 12, color: colours.textMuted }}>
                      ▼ Show
                    </span>
                  </button>

                  <div
                    id="training-guide-content"
                    style={{
                      display: "none",
                      padding: "0 20px 20px",
                      marginBottom: 16,
                    }}
                  >
                    {kungFuElements
                      .filter((element) => {
                        const sashOrder: Record<string, number> = {
                          red: 1,
                          yellow: 2,
                          next: 3,
                        };
                        const currentOrder = sashOrder[kungFuSash] || 1;
                        const elementOrder = sashOrder[element.min_sash] || 1;
                        return elementOrder <= currentOrder + 1;
                      })
                      .map((element) => {
                        const isQiGong = element.name === "Qi Gong";
                        return (
                          <div
                            key={element.id}
                            style={{
                              padding: "10px 14px",
                              marginBottom: 8,
                              marginTop: 8,
                              borderRadius: 8,
                              background: colours.cardBg,
                              border: `1px solid ${colours.cardBorder}`,
                            }}
                          >
                            <p
                              style={{
                                margin: "0 0 2px",
                                fontWeight: 700,
                                color: colours.primaryDark,
                                fontSize: 14,
                              }}
                            >
                              {isQiGong ? "🧘 " : ""}
                              {element.name}
                              {isQiGong && (
                                <span
                                  style={{
                                    fontSize: 11,
                                    marginLeft: 8,
                                    color: colours.textMuted,
                                  }}
                                >
                                  Daily
                                </span>
                              )}
                            </p>
                            {element.description && (
                              <p
                                style={{
                                  margin: 0,
                                  fontSize: 12,
                                  color: "#555",
                                }}
                              >
                                {element.description}
                              </p>
                            )}
                          </div>
                        );
                      })}
                  </div>
                </div>

                {/* LEVEL UP BUTTON */}
                {kungFuSash !== "next" && (
                  <div style={{ padding: "0 20px 20px" }}>
                    <button
                      onClick={() => setLevelUpOpen(true)}
                      style={{
                        width: "100%",
                        padding: "10px",
                        background: sashColours[sashNextLevel[kungFuSash]],
                        border: "none",
                        borderRadius: 8,
                        color: "white",
                        fontWeight: 700,
                        fontSize: 14,
                        cursor: "pointer",
                      }}
                    >
                      🎖️ Level Up to {sashLabels[sashNextLevel[kungFuSash]]}!
                    </button>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </main>
    </>
  );
}
