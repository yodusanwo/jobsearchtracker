"use client";
// @ts-nocheck

import { applyBackup, collectBackupData, downloadBackup, parseBackupText, summarizeBackup } from "@/lib/backup";
import { storage, setStorageUserId } from "@/lib/storage";
import { useAuth } from "@/components/auth-provider";
import { UsageBadge } from "@/components/usage-badge";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  Briefcase, Inbox, Send, Calendar, LayoutGrid, Plus, X, Sparkles,
  Search, Mail, ExternalLink, Trash2, MapPin, DollarSign, Clock, Tag,
  RefreshCw, ArrowRight, Camera, Upload, Download, Check, AlertCircle,
  MessageCircle, Image as ImageIcon, FileText,
  Home, TrendingUp, TrendingDown, Users, Activity, ChevronRight,
  UserPlus, Edit3, Settings, Bell, CheckCircle2, LogOut, PenLine, Table
} from "lucide-react";

function Linkedin({ size = 24, strokeWidth = 2, ...props }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
      <rect width="4" height="12" x="2" y="9" />
      <circle cx="4" cy="4" r="2" />
    </svg>
  );
}

/* ============================================================
   THEME — editorial / warm paper
   ============================================================ */
const STYLE = `
:root {
  --paper: #F5F1EA;
  --paper-deep: #ECE5D7;
  --surface: #FFFFFF;
  --ink: #1F1B16;
  --ink-2: #4A4138;
  --ink-3: #8A8175;
  --ink-4: #BFB6A8;
  --line: #E2D9C8;
  --line-soft: #EFEAE0;
  --accent: #B8543A;
  --accent-soft: #F2E3DC;
  --accent-deep: #8A3D2B;
  --moss: #5C6F4F;
  --moss-soft: #E3E8DA;
  --amber: #B8843A;
  --amber-soft: #F4E8D4;
  --rose: #A8456A;
  --rose-soft: #F2DEE6;
}
.jl { font-family: 'DM Sans', system-ui, -apple-system, sans-serif; color: var(--ink); background: var(--paper); }
.jl-display { font-family: 'Fraunces', Georgia, serif; letter-spacing: -0.01em; }
.jl-mono { font-family: 'JetBrains Mono', monospace; }
.jl input::placeholder, .jl textarea::placeholder { color: var(--ink-4); }
.jl button, .jl input, .jl textarea, .jl select { font-family: inherit; }
.jl-scroll::-webkit-scrollbar { width: 8px; height: 8px; }
.jl-scroll::-webkit-scrollbar-thumb { background: var(--line); border-radius: 4px; }
.jl-scroll::-webkit-scrollbar-track { background: transparent; }
@keyframes jl-spin { to { transform: rotate(360deg); } }
.jl-spin { animation: jl-spin 1s linear infinite; }
@keyframes jl-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
.jl-pulse { animation: jl-pulse 1.6s ease-in-out infinite; }
@keyframes jl-fade { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
.jl-nav-scroll::-webkit-scrollbar { height: 4px; }
.jl-nav-scroll::-webkit-scrollbar-thumb { background: var(--line); border-radius: 2px; }
@media (max-width: 900px) {
  .jl-header-tagline { display: none; }
}
@keyframes jl-shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
.jl-shimmer { background: linear-gradient(90deg, var(--paper-deep) 0%, var(--line-soft) 50%, var(--paper-deep) 100%); background-size: 200% 100%; animation: jl-shimmer 1.8s linear infinite; }
`;

/* ============================================================
   SHARED STYLE OBJECTS
   ============================================================ */
const primaryBtn = {
  padding: "9px 16px", borderRadius: 8, border: "none", cursor: "pointer",
  background: "var(--ink)", color: "var(--paper)", fontSize: 13, fontWeight: 500,
  display: "inline-flex", alignItems: "center", gap: 7, transition: "all 0.15s",
};
const ghostBtn = {
  padding: "9px 16px", borderRadius: 8, border: "1px solid var(--line)", cursor: "pointer",
  background: "transparent", color: "var(--ink-2)", fontSize: 13, fontWeight: 500,
  display: "inline-flex", alignItems: "center", gap: 7,
};
const ghostBtnSm = { ...ghostBtn, padding: "5px 10px", fontSize: 12 };
const iconBtn = {
  width: 34, height: 34, borderRadius: 8, border: "1px solid var(--line)", cursor: "pointer",
  background: "transparent", color: "var(--ink-2)", display: "inline-flex",
  alignItems: "center", justifyContent: "center",
};
const inputBase = {
  width: "100%", padding: "9px 12px", border: "1px solid var(--line)", borderRadius: 8,
  background: "var(--surface)", color: "var(--ink)", fontSize: 14, outline: "none",
};
const drawerOverlay = {
  position: "fixed", inset: 0, background: "rgba(31,27,22,0.45)", zIndex: 50,
};

/* ============================================================
   STORAGE & UTILITIES
   ============================================================ */
const STORAGE_KEYS = {
  applications: "applications",
  outreach: "outreach",
  meetings: "meetings",
  inboxState: "inboxState",
  contacts: "contacts",
  campaignSettings: "campaignSettings",
  companies: "companies",
  briefing: "briefing",
  activities: "activities",
  resume: "resume",
};

async function loadKey(key, fallback) {
  try {
    const r = await storage.get(key);
    if (r && r.value) return JSON.parse(r.value);
  } catch {}
  return fallback;
}
async function saveKey(key, value) {
  try { await storage.set(key, JSON.stringify(value)); }
  catch (e) { console.error("storage:", e); }
}

const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
const todayISO = () => new Date().toISOString().slice(0, 10);
const niceDate = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d)) return iso;
  return d.toLocaleDateString("en-US", {
    month: "short", day: "numeric",
    year: d.getFullYear() === new Date().getFullYear() ? undefined : "numeric",
  });
};
const daysSince = (iso) => {
  if (!iso) return null;
  const ms = Date.now() - new Date(iso).getTime();
  return Math.floor(ms / 86400000);
};

/* ============================================================
   API HELPERS
   ============================================================ */
async function callAI({ system, content, mcp = [], tools = [], maxTokens = 2000, feature = "general" }) {
  const body = {
    model: "claude-sonnet-4-20250514",
    max_tokens: maxTokens,
    messages: [{ role: "user", content }],
    feature,
  };
  if (system) body.system = system;
  if (mcp.length) {
    body.mcp_servers = mcp;
    const toolsets = mcp
      .filter((s) => s.name)
      .map((s) => ({ type: "mcp_toolset", mcp_server_name: s.name }));
    body.tools = [...tools, ...toolsets];
  } else if (tools.length) {
    body.tools = tools;
  }
  const res = await fetch("/api/anthropic", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (res.status === 402) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Add billing to continue using AI features");
  }
  const data = await res.json().catch(() => ({}));
  if (res.status === 403 || res.status === 401) {
    if (data.code === "gmail_not_connected") {
      throw new Error("GMAIL_NOT_CONNECTED");
    }
    const msg = typeof data.error === "string" ? data.error : data.error?.message;
    throw new Error(msg || "API " + res.status);
  }
  if (res.status === 503 && data.code === "gmail_storage_not_ready") {
    throw new Error("GMAIL_STORAGE_NOT_READY");
  }
  if (res.status === 413) {
    throw new Error("PAYLOAD_TOO_LARGE");
  }
  if (!res.ok) {
    const msg =
      (typeof data.error === "object" && data.error?.message) ||
      (typeof data.error === "string" && data.error) ||
      data.message ||
      `API ${res.status}`;
    throw new Error(msg);
  }
  const text = (data.content || [])
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("\n");
  return { text, raw: data };
}

function extractJSON(text) {
  if (!text) return null;
  const cleaned = text.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
  const first = cleaned.search(/[\[\{]/);
  if (first === -1) return null;
  let depth = 0, end = -1, inStr = false, esc = false;
  const open = cleaned[first];
  const close = open === "[" ? "]" : "}";
  for (let i = first; i < cleaned.length; i++) {
    const c = cleaned[i];
    if (esc) { esc = false; continue; }
    if (c === "\\") { esc = true; continue; }
    if (c === '"') { inStr = !inStr; continue; }
    if (inStr) continue;
    if (c === open) depth++;
    else if (c === close) { depth--; if (depth === 0) { end = i; break; } }
  }
  const slice = end !== -1 ? cleaned.slice(first, end + 1) : cleaned.slice(first);
  try { return JSON.parse(slice); } catch { return null; }
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result.split(",")[1]);
    r.onerror = () => reject(new Error("Read failed"));
    r.readAsDataURL(file);
  });
}

const CAPTURE_MAX_IMAGE_DIM = 2400;
const CAPTURE_MAX_IMAGE_BYTES = 1.4 * 1024 * 1024;
const CAPTURE_MAX_PDF_BYTES = 3 * 1024 * 1024;

/** Resize/compress screenshots so Capture stays under Vercel's ~4.5 MB request limit. */
async function prepareCaptureImage(file) {
  if (!file.type.startsWith("image/")) {
    throw new Error("Not an image");
  }
  let bitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    const base64 = await fileToBase64(file);
    return { base64, mime: file.type, previewUrl: URL.createObjectURL(file), wasCompressed: false };
  }

  let { width, height } = bitmap;
  const scale = Math.min(1, CAPTURE_MAX_IMAGE_DIM / Math.max(width, height));
  const w = Math.max(1, Math.round(width * scale));
  const h = Math.max(1, Math.round(height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  canvas.getContext("2d").drawImage(bitmap, 0, 0, w, h);
  if (bitmap.close) bitmap.close();

  let quality = 0.88;
  let blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
  while (blob && blob.size > CAPTURE_MAX_IMAGE_BYTES && quality > 0.52) {
    quality -= 0.08;
    blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
  }
  if (!blob) throw new Error("Could not process image");

  const base64 = await fileToBase64(blob);
  return {
    base64,
    mime: "image/jpeg",
    previewUrl: URL.createObjectURL(blob),
    wasCompressed: scale < 1 || file.size > blob.size,
    sizeLabel: formatBytes(blob.size),
  };
}

async function prepareCapturePdf(file) {
  if (file.size > CAPTURE_MAX_PDF_BYTES) {
    throw new Error(`PDF too large (${formatBytes(file.size)}). Max ${formatBytes(CAPTURE_MAX_PDF_BYTES)} — try a screenshot instead.`);
  }
  return {
    base64: await fileToBase64(file),
    mime: file.type,
    previewUrl: null,
    wasCompressed: false,
    sizeLabel: formatBytes(file.size),
  };
}

function formatAiError(err) {
  const msg = err?.message || String(err);
  if (msg === "PAYLOAD_TOO_LARGE" || msg.includes("413")) {
    return "File too large to analyze — try a smaller screenshot or crop to the relevant part.";
  }
  return msg;
}

const MAX_RESUME_BYTES = 2 * 1024 * 1024;
const RESUME_ACCEPT = ".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document";

function formatBytes(bytes) {
  if (!bytes) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function downloadResumeFile(resume) {
  if (!resume?.data) return;
  const mime = resume.mimeType || "application/octet-stream";
  const blob = Uint8Array.from(atob(resume.data), (c) => c.charCodeAt(0));
  const url = URL.createObjectURL(new Blob([blob], { type: mime }));
  const a = document.createElement("a");
  a.href = url;
  a.download = resume.fileName || "resume";
  a.click();
  URL.revokeObjectURL(url);
}

/* ============================================================
   STATUSES
   ============================================================ */
const STATUSES = [
  { id: "saved", label: "Saved" },
  { id: "applied", label: "Applied" },
  { id: "screen", label: "Screening" },
  { id: "interview", label: "Interviewing" },
  { id: "offer", label: "Offer" },
  { id: "closed", label: "Closed" },
];

const APPLIED_PLUS_STATUSES = new Set(["applied", "screen", "interview", "offer"]);

function isAppliedApplication(a) {
  if (!a) return false;
  if (a.dateApplied) return true;
  return APPLIED_PLUS_STATUSES.has(a.status || "saved");
}

function applicationAppliedTimestamp(a) {
  if (!a) return 0;
  if (a.dateApplied) {
    const t = new Date(a.dateApplied).getTime();
    if (!isNaN(t) && t > 0) return t;
  }
  if (APPLIED_PLUS_STATUSES.has(a.status || "saved")) {
    if (a.updatedAt) return a.updatedAt;
    if (a.createdAt) return a.createdAt;
    if (a.dateSaved) {
      const t = new Date(a.dateSaved).getTime();
      if (!isNaN(t) && t > 0) return t;
    }
  }
  return 0;
}

function ensureDateApplied(app) {
  const status = app.status || "saved";
  if (APPLIED_PLUS_STATUSES.has(status) && !app.dateApplied) {
    return { ...app, dateApplied: todayISO() };
  }
  return app;
}

const statusDot = (id) => {
  if (id === "saved") return "var(--ink-3)";
  if (id === "applied") return "var(--amber)";
  if (id === "screen") return "var(--amber)";
  if (id === "interview") return "var(--accent)";
  if (id === "offer") return "var(--moss)";
  if (id === "closed") return "var(--ink-4)";
  return "var(--ink-3)";
};

/* ============================================================
   ROOT
   ============================================================ */
export default function JobSearchTracker() {
  const { user, loading: authLoading, configured, signOut } = useAuth();
  const [tab, setTab] = useState("dashboard");
  const [applications, setApplications] = useState([]);
  const [outreach, setOutreach] = useState([]);
  const [meetings, setMeetings] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [activities, setActivities] = useState([]);
  const [campaignSettings, setCampaignSettings] = useState({
    userName: "",
    userBackground: "",
    outreachAngle: "",
    defaultGoal: "ask for a brief 20-minute chat to learn about their team and explore potential roles",
    signOff: "",
    dailyQueueSize: 5,
    followUpDays: 5,
  });
  const [loaded, setLoaded] = useState(false);
  const [toast, setToast] = useState(null);
  const [shotOpen, setShotOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [backupOpen, setBackupOpen] = useState(false);
  const [resume, setResume] = useState(null);

  useEffect(() => {
    if (configured && authLoading) return;
    setLoaded(false);
    setStorageUserId(user?.id ?? null);
    (async () => {
      const [apps, out, meets, cts, set, cos, acts, res] = await Promise.all([
        loadKey(STORAGE_KEYS.applications, []),
        loadKey(STORAGE_KEYS.outreach, []),
        loadKey(STORAGE_KEYS.meetings, []),
        loadKey(STORAGE_KEYS.contacts, []),
        loadKey(STORAGE_KEYS.campaignSettings, null),
        loadKey(STORAGE_KEYS.companies, []),
        loadKey(STORAGE_KEYS.activities, []),
        loadKey(STORAGE_KEYS.resume, null),
      ]);
      const appsFixed = apps.map((a) => ensureDateApplied(a));
      const appsChanged = appsFixed.some((a, i) => a.dateApplied !== apps[i]?.dateApplied);
      if (appsChanged) saveKey(STORAGE_KEYS.applications, appsFixed);
      setApplications(appsFixed);
      setOutreach(out);
      setMeetings(meets);
      let mergedContacts = cts;
      for (const o of out) {
        mergedContacts = mergeOutreachContact(mergedContacts, o);
      }
      if (mergedContacts !== cts) {
        saveKey(STORAGE_KEYS.contacts, mergedContacts);
      }
      setContacts(mergedContacts);
      setCompanies(cos);
      setActivities(acts);
      setResume(res);
      if (set) setCampaignSettings((prev) => ({ ...prev, ...set }));
      setLoaded(true);
    })();
  }, [configured, authLoading, user?.id]);

  useEffect(() => {
    const id = "jl-fonts";
    if (document.getElementById(id)) return;
    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,300;9..144,400;9..144,500;9..144,600&family=DM+Sans:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap";
    document.head.appendChild(link);
  }, []);

  const flash = useCallback((msg, kind = "ok") => {
    setToast({ msg, kind });
    setTimeout(() => setToast(null), 2500);
  }, []);

  const upsertApp = useCallback((app) => {
    setApplications((prev) => {
      const exists = prev.find((p) => p.id === app.id);
      let merged = exists
        ? { ...exists, ...app, updatedAt: Date.now() }
        : { ...app, id: app.id || uid(), createdAt: Date.now(), updatedAt: Date.now() };
      merged = ensureDateApplied(merged);
      const next = exists
        ? prev.map((p) => p.id === merged.id ? merged : p)
        : [merged, ...prev];
      saveKey(STORAGE_KEYS.applications, next);
      return next;
    });
  }, []);

  const deleteApp = useCallback((id) => {
    setApplications((prev) => {
      const next = prev.filter((p) => p.id !== id);
      saveKey(STORAGE_KEYS.applications, next);
      return next;
    });
  }, []);

  const upsertOutreach = useCallback((item) => {
    setOutreach((prev) => {
      const exists = prev.find((p) => p.id === item.id);
      const next = exists
        ? prev.map((p) => p.id === item.id ? { ...p, ...item } : p)
        : [{ ...item, id: item.id || uid() }, ...prev];
      saveKey(STORAGE_KEYS.outreach, next);
      return next;
    });
    setContacts((prev) => {
      const next = mergeOutreachContact(prev, item);
      if (next === prev) return prev;
      saveKey(STORAGE_KEYS.contacts, next);
      return next;
    });
  }, []);

  const deleteOutreach = useCallback((id) => {
    setOutreach((prev) => {
      const next = prev.filter((p) => p.id !== id);
      saveKey(STORAGE_KEYS.outreach, next);
      return next;
    });
  }, []);

  const upsertMeeting = useCallback((m) => {
    setMeetings((prev) => {
      const exists = prev.find((p) => p.id === m.id);
      const next = exists
        ? prev.map((p) => p.id === m.id ? { ...p, ...m } : p)
        : [{ ...m, id: m.id || uid() }, ...prev];
      saveKey(STORAGE_KEYS.meetings, next);
      return next;
    });
  }, []);

  const deleteMeeting = useCallback((id) => {
    setMeetings((prev) => {
      const next = prev.filter((p) => p.id !== id);
      saveKey(STORAGE_KEYS.meetings, next);
      return next;
    });
  }, []);

  const upsertContact = useCallback((c) => {
    setContacts((prev) => {
      const exists = prev.find((p) => p.id === c.id);
      const next = exists
        ? prev.map((p) => p.id === c.id ? { ...p, ...c, updatedAt: Date.now() } : p)
        : [{ ...c, id: c.id || uid(), addedAt: Date.now(), updatedAt: Date.now() }, ...prev];
      saveKey(STORAGE_KEYS.contacts, next);
      return next;
    });
  }, []);

  const upsertContacts = useCallback((items) => {
    setContacts((prev) => {
      // dedupe by email
      const byEmail = new Map();
      prev.forEach((c) => { if (c.email) byEmail.set(c.email.toLowerCase(), c); });
      const added = [];
      items.forEach((c) => {
        const key = (c.email || "").toLowerCase();
        if (!key) return;
        if (byEmail.has(key)) return; // skip duplicates
        const item = { ...c, id: uid(), addedAt: Date.now(), status: "new", source: c.source || "csv" };
        byEmail.set(key, item);
        added.push(item);
      });
      const next = [...added, ...prev];
      saveKey(STORAGE_KEYS.contacts, next);
      return next;
    });
  }, []);

  const deleteContact = useCallback((id) => {
    setContacts((prev) => {
      const next = prev.filter((p) => p.id !== id);
      saveKey(STORAGE_KEYS.contacts, next);
      return next;
    });
  }, []);

  const updateSettings = useCallback((patch) => {
    setCampaignSettings((prev) => {
      const next = { ...prev, ...patch };
      saveKey(STORAGE_KEYS.campaignSettings, next);
      return next;
    });
  }, []);

  const upsertCompany = useCallback((c) => {
    setCompanies((prev) => {
      const key = (c.name || "").toLowerCase().trim();
      if (!key) return prev;
      const exists = prev.find((p) => p.id === c.id || (p.name || "").toLowerCase().trim() === key);
      const next = exists
        ? prev.map((p) => (p === exists ? { ...p, ...c, name: c.name || p.name, updatedAt: Date.now() } : p))
        : [{ ...c, id: c.id || uid(), addedAt: Date.now(), updatedAt: Date.now() }, ...prev];
      saveKey(STORAGE_KEYS.companies, next);
      return next;
    });
  }, []);

  const deleteCompany = useCallback((id) => {
    setCompanies((prev) => {
      const next = prev.filter((p) => p.id !== id);
      saveKey(STORAGE_KEYS.companies, next);
      return next;
    });
  }, []);

  const upsertActivity = useCallback((item) => {
    setActivities((prev) => {
      const exists = prev.find((p) => p.id === item.id);
      const next = exists
        ? prev.map((p) => p.id === item.id ? { ...p, ...item, updatedAt: Date.now() } : p)
        : [{ ...item, id: item.id || uid(), category: item.category ?? null, createdAt: Date.now(), updatedAt: Date.now() }, ...prev];
      saveKey(STORAGE_KEYS.activities, next);
      return next;
    });
  }, []);

  const deleteActivity = useCallback((id) => {
    setActivities((prev) => {
      const next = prev.filter((p) => p.id !== id);
      saveKey(STORAGE_KEYS.activities, next);
      return next;
    });
  }, []);

  const saveResume = useCallback(async (file) => {
    if (file.size > MAX_RESUME_BYTES) {
      throw new Error(`File too large (${formatBytes(file.size)}). Max ${formatBytes(MAX_RESUME_BYTES)}.`);
    }
    const data = await fileToBase64(file);
    const next = {
      fileName: file.name,
      mimeType: file.type || "application/octet-stream",
      size: file.size,
      data,
      uploadedAt: Date.now(),
    };
    await saveKey(STORAGE_KEYS.resume, next);
    setResume(next);
  }, []);

  const removeResume = useCallback(async () => {
    try { await storage.delete(STORAGE_KEYS.resume); } catch {}
    setResume(null);
  }, []);

  if (!loaded) {
    return (
      <div className="jl" style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>
        <style>{STYLE}</style>
        <div className="jl-pulse" style={{ color: "var(--ink-3)" }}>Loading your ledger…</div>
      </div>
    );
  }

  return (
    <div className="jl" style={{ minHeight: "100vh" }}>
      <style>{STYLE}</style>

      <header style={{
        borderBottom: "1px solid var(--line)", background: "var(--paper)",
        position: "sticky", top: 0, zIndex: 30,
        paddingLeft: "max(28px, env(safe-area-inset-left))",
        paddingRight: "max(36px, env(safe-area-inset-right))",
      }}>
        <div style={{ maxWidth: 1280, margin: "0 auto", padding: "14px 0 12px" }}>
          {/* Top row: brand + actions — Capture always visible */}
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            gap: 16, marginBottom: 12,
          }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 14, minWidth: 0 }}>
              <div className="jl-display" style={{ fontSize: 28, fontWeight: 500, letterSpacing: "-0.02em", flexShrink: 0 }}>
                Ledger
              </div>
              <div className="jl-display jl-header-tagline" style={{ fontSize: 13, color: "var(--ink-3)", fontStyle: "italic" }}>
                a quiet space for your search
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
              {configured && user && (
                <>
                  <UsageBadge />
                  <button onClick={signOut} title="Sign out" style={iconBtn}>
                    <LogOut size={16} />
                  </button>
                </>
              )}
              <button onClick={() => setShotOpen(true)} style={{
                ...primaryBtn, background: "var(--accent)", color: "white", whiteSpace: "nowrap",
              }}>
                <Camera size={15} /> Capture
              </button>
            </div>
          </div>
          {/* Nav row — scrolls horizontally when tabs overflow */}
          <div className="jl-scroll jl-nav-scroll" style={{ overflowX: "auto", margin: "0 -4px", padding: "0 4px 2px" }}>
            <Nav tab={tab} setTab={setTab} counts={{
              pipeline: applications.length,
              outreach: outreach.length,
              meetings: meetings.length,
              campaign: contacts.length,
              contacts: contacts.length,
              companies: (() => {
                const names = new Set();
                companies.forEach((c) => c.name && names.add(c.name.toLowerCase().trim()));
                applications.forEach((a) => a.company && names.add(a.company.toLowerCase().trim()));
                contacts.forEach((c) => c.company && names.add(c.company.toLowerCase().trim()));
                return names.size;
              })(),
              activity: activities.length,
            }} />
          </div>
        </div>
      </header>

      <main style={{
        maxWidth: 1280, margin: "0 auto",
        padding: "32px max(36px, env(safe-area-inset-right)) 32px max(28px, env(safe-area-inset-left))",
      }}>
        {tab === "dashboard" && (
          <Dashboard
            applications={applications}
            outreach={outreach}
            meetings={meetings}
            contacts={contacts}
            activities={activities}
            settings={campaignSettings}
            setTab={setTab}
          />
        )}
        {tab === "pipeline" && (
          <Pipeline
            applications={applications}
            upsertApp={upsertApp}
            deleteApp={deleteApp}
            upsertCompany={upsertCompany}
            flash={flash}
          />
        )}
        {tab === "contacts" && (
          <ContactsSpreadsheetView
            contacts={contacts}
            upsertContact={upsertContact}
            deleteContact={deleteContact}
            flash={flash}
          />
        )}
        {tab === "companies" && (
          <CompaniesView
            companies={companies}
            applications={applications}
            contacts={contacts}
            upsertCompany={upsertCompany}
            deleteCompany={deleteCompany}
            upsertApp={upsertApp}
            setTab={setTab}
            flash={flash}
          />
        )}
        {tab === "campaign" && (
          <CampaignView
            contacts={contacts}
            upsertContact={upsertContact}
            upsertContacts={upsertContacts}
            deleteContact={deleteContact}
            upsertOutreach={upsertOutreach}
            settings={campaignSettings}
            updateSettings={updateSettings}
            resume={resume}
            saveResume={saveResume}
            removeResume={removeResume}
            flash={flash}
          />
        )}
        {tab === "inbox" && (
          <InboxView
            upsertApp={upsertApp}
            upsertOutreach={upsertOutreach}
            upsertMeeting={upsertMeeting}
            contacts={contacts}
            upsertContact={upsertContact}
            flash={flash}
          />
        )}
        {tab === "outreach" && (
          <OutreachView
            outreach={outreach}
            upsertOutreach={upsertOutreach}
            upsertCompany={upsertCompany}
            deleteOutreach={deleteOutreach}
            flash={flash}
          />
        )}
        {tab === "activity" && (
          <ActivityView
            activities={activities}
            upsertActivity={upsertActivity}
            deleteActivity={deleteActivity}
            flash={flash}
          />
        )}
        {tab === "meetings" && (
          <MeetingsView
            meetings={meetings}
            upsertMeeting={upsertMeeting}
            deleteMeeting={deleteMeeting}
            contacts={contacts}
            upsertContact={upsertContact}
            flash={flash}
          />
        )}
      </main>

      <footer style={{
        borderTop: "1px solid var(--line)", marginTop: 40,
        background: "var(--paper)",
      }}>
        <div style={{
          maxWidth: 1280, margin: "0 auto", padding: "22px 28px",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          gap: 14, flexWrap: "wrap",
        }}>
          <div className="jl-display" style={{ fontSize: 13, color: "var(--ink-3)", fontStyle: "italic" }}>
            Ledger · a quiet space for your search
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            <button onClick={() => setBackupOpen(true)} style={{
              background: "transparent", border: "none", cursor: "pointer",
              color: "var(--ink-3)", fontSize: 13, fontWeight: 500,
              fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 5,
              padding: 0,
            }}>
              <Download size={13} /> Backup & restore
            </button>
            <button onClick={() => setHelpOpen(true)} style={{
              background: "transparent", border: "none", cursor: "pointer",
              color: "var(--accent)", fontSize: 13, fontWeight: 500,
              fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 5,
              padding: 0,
            }}>
              <FileText size={13} /> How to use Ledger →
            </button>
          </div>
        </div>
      </footer>

      {helpOpen && <HelpModal onClose={() => setHelpOpen(false)} setTab={(t) => { setTab(t); setHelpOpen(false); }} />}

      {backupOpen && (
        <BackupModal
          onClose={() => setBackupOpen(false)}
          flash={flash}
        />
      )}

      {shotOpen && (
        <CaptureModal
          onClose={() => setShotOpen(false)}
          onSaveApp={(d) => { upsertApp(d); flash(`Added ${d.company} to pipeline`); }}
          onSaveOutreach={(d) => { upsertOutreach(d); flash("Logged outreach"); }}
          onSaveMeeting={(d) => { upsertMeeting(d); flash("Added meeting"); }}
        />
      )}

      {toast && (
        <div className="jl-fade" style={{
          position: "fixed", bottom: 24, right: 24, zIndex: 100,
          background: toast.kind === "err" ? "var(--rose-soft)" : "var(--moss-soft)",
          color: toast.kind === "err" ? "var(--rose)" : "var(--moss)",
          padding: "12px 18px", borderRadius: 8, fontSize: 14, fontWeight: 500,
          border: `1px solid ${toast.kind === "err" ? "var(--rose)" : "var(--moss)"}`,
        }}>{toast.msg}</div>
      )}
    </div>
  );
}

/* ============================================================
   NAV
   ============================================================ */
function Nav({ tab, setTab, counts }) {
  const items = [
    { id: "dashboard", label: "Overview", icon: Home },
    { id: "pipeline", label: "Pipeline", icon: LayoutGrid, count: counts.pipeline },
    { id: "companies", label: "Companies", icon: Briefcase, count: counts.companies },
    { id: "inbox", label: "Inbox", icon: Inbox },
    { id: "outreach", label: "Outreach", icon: Send, count: counts.outreach },
    { id: "activity", label: "Activity", icon: PenLine, count: counts.activity },
    { id: "campaign", label: "Campaign", icon: Users, count: counts.campaign },
    { id: "contacts", label: "Contacts", icon: Table, count: counts.contacts },
    { id: "meetings", label: "Meetings", icon: Calendar, count: counts.meetings },
  ];
  return (
    <nav style={{ display: "flex", gap: 4, alignItems: "center", flexWrap: "nowrap", width: "max-content" }}>
      {items.map((it) => {
        const Icon = it.icon;
        const active = tab === it.id;
        return (
          <button key={it.id} onClick={() => setTab(it.id)} style={{
            padding: "7px 13px", borderRadius: 999, border: "none", cursor: "pointer",
            background: active ? "var(--ink)" : "transparent",
            color: active ? "var(--paper)" : "var(--ink-2)",
            fontSize: 13, fontWeight: 500,
            display: "flex", alignItems: "center", gap: 6,
            flexShrink: 0, whiteSpace: "nowrap",
          }}>
            <Icon size={14} strokeWidth={2} />
            {it.label}
            {it.count > 0 && (
              <span style={{
                fontSize: 11, padding: "1px 6px", borderRadius: 999, marginLeft: 1,
                background: active ? "rgba(245,241,234,0.18)" : "var(--paper-deep)",
                color: active ? "var(--paper)" : "var(--ink-3)",
              }}>{it.count}</span>
            )}
          </button>
        );
      })}
    </nav>
  );
}

/* ============================================================
   REJECTION UPLOAD
   ============================================================ */
const REJECTION_PARSE_PROMPT = `Extract details from this job rejection email. Return ONLY valid JSON:
{
  "company": "company name",
  "role": "job title if mentioned",
  "date": "YYYY-MM-DD if found, else empty string",
  "contact_name": "sender name if visible",
  "contact_email": "sender email if visible",
  "subject": "email subject line",
  "message": "full rejection message text"
}
Empty string for unknown fields. JSON only.`;

function RejectionUploadModal({ onClose, onSave, flash }) {
  const [processing, setProcessing] = useState(false);
  const [form, setForm] = useState(null);
  const [pasteText, setPasteText] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef(null);

  const analyzeBlocks = async (contentBlocks) => {
    setProcessing(true);
    try {
      const { text } = await callAI({
        system: "You extract structured data from job rejection emails. Return only valid JSON — no markdown.",
        content: [...contentBlocks, { type: "text", text: REJECTION_PARSE_PROMPT }],
        maxTokens: 2500,
        feature: "rejection_parse",
      });
      const parsed = extractJSON(text);
      if (!parsed) {
        flash("Couldn't read the rejection — try pasting the full email text", "err");
        return;
      }
      setForm({
        company: parsed.company || "",
        role: parsed.role || "",
        date: parsed.date || todayISO(),
        contact_name: parsed.contact_name || "",
        contact_email: parsed.contact_email || "",
        subject: parsed.subject || "",
        message: parsed.message || "",
      });
    } catch (e) {
      flash("Parse failed: " + e.message, "err");
    } finally {
      setProcessing(false);
    }
  };

  const ingestFile = async (file) => {
    if (!file) return;
    const isImage = file.type.startsWith("image/");
    const isPdf = file.type === "application/pdf";
    const isEmailText = file.type.startsWith("text/") || /\.(eml|txt|html?)$/i.test(file.name);
    try {
      if (isImage || isPdf) {
        const prep = isPdf ? await prepareCapturePdf(file) : await prepareCaptureImage(file);
        await analyzeBlocks([
          isPdf
            ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: prep.base64 } }
            : { type: "image", source: { type: "base64", media_type: prep.mime, data: prep.base64 } },
        ]);
      } else if (isEmailText) {
        const text = await file.text();
        await analyzeBlocks([{ type: "text", text: `Rejection email (.eml or text):\n\n${text.slice(0, 20000)}` }]);
      } else {
        flash("Use .eml, .txt, PDF, or an image/screenshot", "err");
      }
    } catch {
      flash("Couldn't read file", "err");
    }
  };

  const analyzePaste = async () => {
    if (!pasteText.trim()) return;
    await analyzeBlocks([{ type: "text", text: `Rejection email:\n\n${pasteText.slice(0, 20000)}` }]);
  };

  const u = (k, v) => setForm({ ...form, [k]: v });

  return (
    <div style={drawerOverlay} onClick={onClose}>
      <div className="jl-fade jl-scroll" onClick={(e) => e.stopPropagation()} style={{
        position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
        width: "min(680px, 94vw)", maxHeight: "90vh", overflowY: "auto",
        background: "var(--surface)", borderRadius: 14, padding: "26px 30px",
        border: "1px solid var(--line)",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <h2 className="jl-display" style={{ fontSize: 22, fontWeight: 500, margin: 0 }}>
            Upload rejection email
          </h2>
          <button onClick={onClose} style={iconBtn}><X size={18} /></button>
        </div>
        <p style={{ color: "var(--ink-3)", fontSize: 13, margin: "0 0 20px", lineHeight: 1.55 }}>
          Drop a forwarded rejection (.eml), paste the email text, or upload a screenshot/PDF. I'll extract the company and role and add it to your pipeline as closed.
        </p>

        {!form ? (
          <>
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => { e.preventDefault(); setDragOver(false); if (e.dataTransfer?.files?.[0]) ingestFile(e.dataTransfer.files[0]); }}
              onClick={() => !processing && fileRef.current?.click()}
              style={{
                padding: "40px 24px", textAlign: "center", cursor: processing ? "wait" : "pointer",
                border: `1.5px dashed ${dragOver ? "var(--rose)" : "var(--line)"}`,
                borderRadius: 12, background: dragOver ? "var(--rose-soft)" : "var(--paper-deep)",
                marginBottom: 16, opacity: processing ? 0.7 : 1,
              }}>
              {processing ? (
                <>
                  <RefreshCw size={28} className="jl-spin" style={{ color: "var(--rose)", marginBottom: 10 }} />
                  <div className="jl-display" style={{ fontSize: 16, fontWeight: 500 }}>Reading rejection…</div>
                </>
              ) : (
                <>
                  <Upload size={28} style={{ color: "var(--rose)", marginBottom: 10 }} />
                  <div className="jl-display" style={{ fontSize: 16, fontWeight: 500 }}>Drop file here</div>
                  <div style={{ fontSize: 12, color: "var(--ink-3)", marginTop: 6 }}>
                    .eml · .txt · PDF · screenshot
                  </div>
                </>
              )}
              <input ref={fileRef} type="file" accept=".eml,.txt,text/*,image/*,application/pdf" style={{ display: "none" }}
                onChange={(e) => { ingestFile(e.target.files?.[0]); e.target.value = ""; }} />
            </div>
            <Field label="Or paste email content">
              <textarea value={pasteText} onChange={(e) => setPasteText(e.target.value)} disabled={processing}
                style={{ ...inputBase, minHeight: 140, resize: "vertical", fontSize: 13 }}
                placeholder="Paste the full rejection email — headers and body…" />
            </Field>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 14 }}>
              <button onClick={onClose} style={ghostBtn}>Cancel</button>
              <button onClick={analyzePaste} disabled={!pasteText.trim() || processing}
                style={{ ...primaryBtn, background: "var(--rose)", opacity: !pasteText.trim() || processing ? 0.5 : 1 }}>
                {processing ? "Parsing…" : "Parse email"}
              </button>
            </div>
          </>
        ) : (
          <>
            <div style={{
              padding: "10px 14px", background: "var(--rose-soft)", color: "var(--rose)",
              fontSize: 13, borderRadius: 8, marginBottom: 16,
            }}>
              Review extracted details before saving to pipeline.
            </div>
            <div style={{ display: "grid", gap: 10 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <Field label="Company" required>
                  <input value={form.company} onChange={(e) => u("company", e.target.value)} style={inputBase} />
                </Field>
                <Field label="Role">
                  <input value={form.role} onChange={(e) => u("role", e.target.value)} style={inputBase} />
                </Field>
              </div>
              <Field label="Date received">
                <input type="date" value={form.date} onChange={(e) => u("date", e.target.value)} style={inputBase} />
              </Field>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <Field label="From (name)">
                  <input value={form.contact_name} onChange={(e) => u("contact_name", e.target.value)} style={inputBase} />
                </Field>
                <Field label="From (email)">
                  <input value={form.contact_email} onChange={(e) => u("contact_email", e.target.value)} style={inputBase} placeholder="optional" />
                </Field>
              </div>
              <Field label="Subject">
                <input value={form.subject} onChange={(e) => u("subject", e.target.value)} style={inputBase} />
              </Field>
              <Field label="Message">
                <textarea value={form.message} onChange={(e) => u("message", e.target.value)}
                  style={{ ...inputBase, minHeight: 100, resize: "vertical" }} />
              </Field>
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 18 }}>
              <button onClick={() => setForm(null)} style={ghostBtn}>Back</button>
              <button onClick={() => onSave(form)} disabled={!form.company.trim()}
                style={{ ...primaryBtn, background: "var(--rose)", opacity: !form.company.trim() ? 0.5 : 1 }}>
                Save to pipeline
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ============================================================
   PIPELINE
   ============================================================ */
function Pipeline({ applications, upsertApp, deleteApp, upsertCompany, flash }) {
  const [adding, setAdding] = useState(false);
  const [rejectionOpen, setRejectionOpen] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [pasteUrl, setPasteUrl] = useState("");
  const [selectedApp, setSelectedApp] = useState(null);
  const [filterText, setFilterText] = useState("");

  const filtered = useMemo(() => {
    if (!filterText.trim()) return applications;
    const q = filterText.toLowerCase();
    return applications.filter((a) =>
      (a.company || "").toLowerCase().includes(q) ||
      (a.role || "").toLowerCase().includes(q) ||
      (a.location || "").toLowerCase().includes(q) ||
      (a.notes || "").toLowerCase().includes(q)
    );
  }, [applications, filterText]);

  const grouped = useMemo(() => {
    const g = {};
    STATUSES.forEach((s) => g[s.id] = []);
    filtered.forEach((a) => {
      const s = a.status || "saved";
      (g[s] || g.saved).push(a);
    });
    return g;
  }, [filtered]);

  const extractFromURL = async () => {
    if (!pasteUrl.trim()) return;
    setExtracting(true);
    try {
      const { text } = await callAI({
        system: "You extract job details from postings. Return only valid JSON, no markdown.",
        content: `Search the web for this job posting and extract details: ${pasteUrl}

Return ONLY a JSON object with keys:
- company: string
- role: string
- location: string
- salary: string (range if listed)
- jobType: string (full-time, contract, etc)
- requirements: array of 3-5 short strings
- summary: string (2 sentence overview)

Empty string for unknown fields. JSON only.`,
        tools: [{ type: "web_search_20250305", name: "web_search" }],
        maxTokens: 2000,
        feature: "job_extract",
      });
      const parsed = extractJSON(text);
      if (parsed && (parsed.company || parsed.role)) {
        const notes = [
          parsed.summary,
          parsed.requirements?.length ? "Requirements:\n" + parsed.requirements.map(r => "• " + r).join("\n") : "",
        ].filter(Boolean).join("\n\n");
        upsertApp({
          company: parsed.company || "Unknown",
          role: parsed.role || "Unknown role",
          location: parsed.location || "",
          salary: parsed.salary || "",
          jobType: parsed.jobType || "",
          url: pasteUrl,
          notes,
          status: "saved",
          dateSaved: todayISO(),
        });
        setPasteUrl("");
        setAdding(false);
        flash(`Saved ${parsed.company || "job"}`);
      } else {
        flash("Couldn't extract — add it manually", "err");
      }
    } catch (e) {
      flash("Extraction failed: " + e.message, "err");
    } finally {
      setExtracting(false);
    }
  };

  return (
    <div className="jl-fade">
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        marginBottom: 28, gap: 16, flexWrap: "wrap",
      }}>
        <div>
          <h1 className="jl-display" style={{ fontSize: 38, fontWeight: 400, margin: 0, letterSpacing: "-0.02em" }}>
            Pipeline
          </h1>
          <p style={{ color: "var(--ink-3)", fontSize: 14, margin: "4px 0 0" }}>
            {applications.length === 0
              ? "Nothing tracked yet"
              : `${applications.length} ${applications.length === 1 ? "role" : "roles"} in motion`}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <div style={{ position: "relative" }}>
            <Search size={14} style={{ position: "absolute", left: 12, top: 11, color: "var(--ink-4)" }} />
            <input value={filterText} onChange={(e) => setFilterText(e.target.value)} placeholder="Filter…"
              style={{ ...inputBase, padding: "8px 12px 8px 32px", width: 180, fontSize: 13 }} />
          </div>
          <button onClick={() => setRejectionOpen(true)} style={{
            ...ghostBtn, color: "var(--rose)", borderColor: "var(--rose-soft)",
          }}>
            <Upload size={14} /> Log rejection
          </button>
          <button onClick={() => setAdding(true)} style={primaryBtn}>
            <Plus size={15} /> Add a job
          </button>
        </div>
      </div>

      {applications.length === 0 ? (
        <EmptyPipeline onAdd={() => setAdding(true)} onRejection={() => setRejectionOpen(true)} />
      ) : (
        <div className="jl-scroll" style={{
          display: "grid", gridTemplateColumns: "repeat(6, minmax(220px, 1fr))",
          gap: 14, overflowX: "auto", paddingBottom: 8,
        }}>
          {STATUSES.map((s) => (
            <Column key={s.id} status={s} apps={grouped[s.id]} onSelect={setSelectedApp} />
          ))}
        </div>
      )}

      {adding && (
        <Modal onClose={() => setAdding(false)} title="Add a job">
          <div style={{ display: "grid", gap: 18 }}>
            <div>
              <div style={{ fontSize: 13, color: "var(--ink-2)", marginBottom: 6, fontWeight: 500 }}>
                <Sparkles size={13} style={{ display: "inline", marginRight: 6, color: "var(--accent)", verticalAlign: -1 }} />
                Paste a job URL — I'll pull the details
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <input value={pasteUrl} onChange={(e) => setPasteUrl(e.target.value)}
                  placeholder="https://…" style={inputBase} disabled={extracting} />
                <button onClick={extractFromURL} disabled={!pasteUrl.trim() || extracting}
                  style={{ ...primaryBtn, opacity: !pasteUrl.trim() || extracting ? 0.5 : 1 }}>
                  {extracting ? <RefreshCw size={15} className="jl-spin" /> : <ArrowRight size={15} />}
                  {extracting ? "Reading…" : "Extract"}
                </button>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, color: "var(--ink-4)", fontSize: 12 }}>
              <div style={{ flex: 1, height: 1, background: "var(--line)" }} />
              <span>or fill it in yourself</span>
              <div style={{ flex: 1, height: 1, background: "var(--line)" }} />
            </div>
            <ManualJobForm onSave={(data) => {
              upsertApp({ ...data, status: "saved", dateSaved: todayISO() });
              setAdding(false);
              flash("Saved");
            }} onCancel={() => setAdding(false)} />
          </div>
        </Modal>
      )}

      {selectedApp && (
        <ApplicationDetail app={selectedApp} onClose={() => setSelectedApp(null)}
          onUpdate={(d) => {
            upsertApp({ ...selectedApp, ...d });
            setSelectedApp({ ...selectedApp, ...d });
          }}
          onDelete={() => { deleteApp(selectedApp.id); setSelectedApp(null); flash("Deleted"); }} />
      )}

      {rejectionOpen && (
        <RejectionUploadModal
          onClose={() => setRejectionOpen(false)}
          onSave={(form) => {
            const notes = [
              form.subject ? `Subject: ${form.subject}` : "",
              form.contact_name || form.contact_email
                ? `From: ${[form.contact_name, form.contact_email].filter(Boolean).join(" · ")}`
                : "",
              form.message,
            ].filter(Boolean).join("\n\n");
            upsertApp({
              company: form.company.trim(),
              role: form.role || "",
              status: "closed",
              dateSaved: form.date || todayISO(),
              notes,
              rejectionUploaded: true,
            });
            if (form.company.trim()) {
              upsertCompany({ name: form.company.trim(), source: "rejection" });
            }
            setRejectionOpen(false);
            flash(`Logged rejection — ${form.company}`);
          }}
          flash={flash}
        />
      )}
    </div>
  );
}

function Column({ status, apps, onSelect }) {
  return (
    <div style={{
      background: "var(--paper-deep)", borderRadius: 12, padding: 12,
      minHeight: 400, border: "1px solid var(--line-soft)",
    }}>
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        marginBottom: 12, padding: "0 4px",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: statusDot(status.id) }} />
          <span className="jl-display" style={{ fontSize: 14, fontWeight: 500, color: "var(--ink-2)" }}>
            {status.label}
          </span>
        </div>
        <span style={{ fontSize: 12, color: "var(--ink-3)" }}>{apps.length}</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {apps.map((app) => <Card key={app.id} app={app} onClick={() => onSelect(app)} />)}
        {apps.length === 0 && (
          <div style={{ padding: "16px 8px", fontSize: 12, color: "var(--ink-4)", textAlign: "center" }}>—</div>
        )}
      </div>
    </div>
  );
}

function Card({ app, onClick }) {
  const since = daysSince(app.dateApplied || app.dateSaved);
  return (
    <button onClick={onClick} style={{
      width: "100%", textAlign: "left", background: "var(--surface)",
      border: "1px solid var(--line)", borderRadius: 8, padding: "11px 12px",
      cursor: "pointer", transition: "all 0.15s",
      display: "flex", flexDirection: "column", gap: 6,
    }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = "var(--ink-3)";
        e.currentTarget.style.transform = "translateY(-1px)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = "var(--line)";
        e.currentTarget.style.transform = "translateY(0)";
      }}>
      <div className="jl-display" style={{ fontSize: 15, fontWeight: 500, color: "var(--ink)", lineHeight: 1.2 }}>
        {app.company || "—"}
      </div>
      <div style={{ fontSize: 13, color: "var(--ink-2)", lineHeight: 1.3 }}>{app.role}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 2, fontSize: 11, color: "var(--ink-3)" }}>
        {app.location && (
          <span style={{ display: "flex", alignItems: "center", gap: 3 }}>
            <MapPin size={10} /> {app.location}
          </span>
        )}
        {since !== null && (
          <span style={{ display: "flex", alignItems: "center", gap: 3 }}>
            <Clock size={10} /> {since === 0 ? "today" : `${since}d`}
          </span>
        )}
      </div>
    </button>
  );
}

function EmptyPipeline({ onAdd, onRejection }) {
  return (
    <div style={{
      padding: "80px 40px", textAlign: "center",
      border: "1px dashed var(--line)", borderRadius: 16,
      background: "var(--paper-deep)",
    }}>
      <div style={{
        width: 56, height: 56, borderRadius: "50%", background: "var(--accent-soft)",
        display: "grid", placeItems: "center", margin: "0 auto 18px", color: "var(--accent)",
      }}>
        <Briefcase size={24} strokeWidth={1.5} />
      </div>
      <h3 className="jl-display" style={{ fontSize: 22, fontWeight: 400, margin: "0 0 8px" }}>
        Begin your trail
      </h3>
      <p style={{
        color: "var(--ink-3)", fontSize: 14, margin: "0 auto 24px",
        maxWidth: 380, lineHeight: 1.55,
      }}>
        Paste a URL, screenshot a posting, or add by hand. Use <strong style={{ color: "var(--accent)", fontWeight: 600 }}>Capture</strong> in the top right for screenshots of LinkedIn jobs, application confirmations, recruiter DMs — anything on screen.
      </p>
      <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
        <button onClick={onAdd} style={primaryBtn}>
          <Plus size={15} /> Add your first job
        </button>
        {onRejection && (
          <button onClick={onRejection} style={{ ...ghostBtn, color: "var(--rose)", borderColor: "var(--rose-soft)" }}>
            <Upload size={14} /> Log a rejection
          </button>
        )}
      </div>
    </div>
  );
}

function ManualJobForm({ onSave, onCancel, initial = {} }) {
  const [form, setForm] = useState({
    company: initial.company || "",
    role: initial.role || "",
    location: initial.location || "",
    salary: initial.salary || "",
    url: initial.url || "",
    notes: initial.notes || "",
  });
  const u = (k, v) => setForm({ ...form, [k]: v });
  return (
    <div style={{ display: "grid", gap: 12 }}>
      <Field label="Company" required>
        <input value={form.company} onChange={(e) => u("company", e.target.value)} style={inputBase} />
      </Field>
      <Field label="Role" required>
        <input value={form.role} onChange={(e) => u("role", e.target.value)} style={inputBase} />
      </Field>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Field label="Location">
          <input value={form.location} onChange={(e) => u("location", e.target.value)} style={inputBase} />
        </Field>
        <Field label="Salary">
          <input value={form.salary} onChange={(e) => u("salary", e.target.value)} style={inputBase} placeholder="optional" />
        </Field>
      </div>
      <Field label="Posting URL">
        <input value={form.url} onChange={(e) => u("url", e.target.value)} style={inputBase} placeholder="optional" />
      </Field>
      <Field label="Notes">
        <textarea value={form.notes} onChange={(e) => u("notes", e.target.value)}
          style={{ ...inputBase, minHeight: 80, resize: "vertical" }} placeholder="optional" />
      </Field>
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 6 }}>
        <button onClick={onCancel} style={ghostBtn}>Cancel</button>
        <button onClick={() => form.company && form.role && onSave(form)}
          disabled={!form.company || !form.role}
          style={{ ...primaryBtn, opacity: !form.company || !form.role ? 0.5 : 1 }}>
          Save
        </button>
      </div>
    </div>
  );
}

function ApplicationDetail({ app, onClose, onUpdate, onDelete }) {
  const [notes, setNotes] = useState(app.notes || "");
  const [editing, setEditing] = useState(false);
  return (
    <div style={drawerOverlay} onClick={onClose}>
      <div className="jl-fade jl-scroll" onClick={(e) => e.stopPropagation()} style={{
        position: "absolute", top: 0, right: 0, bottom: 0,
        width: "min(560px, 92vw)", background: "var(--surface)",
        borderLeft: "1px solid var(--line)", padding: "28px 32px",
        overflowY: "auto",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 22 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{
              fontSize: 11, color: "var(--ink-3)", textTransform: "uppercase",
              letterSpacing: "0.12em", marginBottom: 6,
            }}>{app.location || "—"}</div>
            <h2 className="jl-display" style={{
              fontSize: 30, fontWeight: 400, margin: 0, lineHeight: 1.1, letterSpacing: "-0.02em",
            }}>{app.company}</h2>
            <div style={{ fontSize: 15, color: "var(--ink-2)", marginTop: 4 }}>{app.role}</div>
          </div>
          <button onClick={onClose} style={iconBtn}><X size={18} /></button>
        </div>

        <div style={{ marginBottom: 24 }}>
          <Label>Status</Label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
            {STATUSES.map((s) => {
              const active = (app.status || "saved") === s.id;
              return (
                <button key={s.id} onClick={() => {
                  const patch = { status: s.id };
                  if (APPLIED_PLUS_STATUSES.has(s.id) && !app.dateApplied) patch.dateApplied = todayISO();
                  onUpdate(patch);
                }} style={{
                  padding: "6px 12px", borderRadius: 999,
                  border: "1px solid " + (active ? "var(--ink)" : "var(--line)"),
                  background: active ? "var(--ink)" : "var(--surface)",
                  color: active ? "var(--paper)" : "var(--ink-2)",
                  fontSize: 12, fontWeight: 500, cursor: "pointer",
                }}>{s.label}</button>
              );
            })}
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 24 }}>
          {app.salary && <Fact icon={DollarSign} label="Comp" value={app.salary} />}
          {app.jobType && <Fact icon={Tag} label="Type" value={app.jobType} />}
          {app.dateApplied && <Fact icon={Calendar} label="Applied" value={niceDate(app.dateApplied)} />}
          {app.dateSaved && <Fact icon={Clock} label="Saved" value={niceDate(app.dateSaved)} />}
        </div>

        {app.url && (
          <a href={app.url} target="_blank" rel="noreferrer" style={{
            display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13,
            color: "var(--accent)", textDecoration: "none", marginBottom: 24,
            padding: "6px 10px", border: "1px solid var(--accent-soft)",
            borderRadius: 6, background: "var(--accent-soft)",
          }}>
            <ExternalLink size={13} /> Open posting
          </a>
        )}

        <div style={{ marginBottom: 24 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
            <Label>Notes</Label>
            {!editing && <button onClick={() => setEditing(true)} style={ghostBtnSm}>Edit</button>}
          </div>
          {editing ? (
            <div>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)}
                style={{ ...inputBase, minHeight: 140, resize: "vertical" }} />
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 8 }}>
                <button onClick={() => { setNotes(app.notes || ""); setEditing(false); }} style={ghostBtn}>Cancel</button>
                <button onClick={() => { onUpdate({ notes }); setEditing(false); }} style={primaryBtn}>Save</button>
              </div>
            </div>
          ) : (
            <div style={{
              padding: "12px 14px", background: "var(--paper)", borderRadius: 8,
              fontSize: 14, color: "var(--ink-2)", whiteSpace: "pre-wrap",
              lineHeight: 1.6, minHeight: 60, border: "1px solid var(--line-soft)",
            }}>
              {app.notes || <span style={{ color: "var(--ink-4)", fontStyle: "italic" }}>No notes yet — click edit to add some.</span>}
            </div>
          )}
        </div>

        <button onClick={() => { if (confirm("Delete this application?")) onDelete(); }} style={{
          color: "var(--rose)", background: "transparent", border: "1px solid var(--line)",
          padding: "8px 14px", borderRadius: 8, fontSize: 13, cursor: "pointer",
          display: "inline-flex", alignItems: "center", gap: 6,
        }}>
          <Trash2 size={13} /> Delete
        </button>
      </div>
    </div>
  );
}

/* ============================================================
   INBOX — Gmail summary (last 10 emails)
   ============================================================ */
function InboxView({ upsertApp, upsertOutreach, upsertMeeting, contacts = [], upsertContact, flash }) {
  const [summarizing, setSummarizing] = useState(false);
  const [findings, setFindings] = useState([]);
  const [overview, setOverview] = useState("");
  const [lastSummary, setLastSummary] = useState(null);
  const [gmailStatus, setGmailStatus] = useState({
    loading: true, configured: false, connected: false, email: null, storageReady: true, setupRequired: false,
  });
  const [oauthRedirectUri, setOauthRedirectUri] = useState(null);
  const [gmailApiError, setGmailApiError] = useState(null);

  useEffect(() => {
    fetch("/api/google/setup")
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d?.redirectUri) setOauthRedirectUri(d.redirectUri); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    (async () => {
      const s = await loadKey(STORAGE_KEYS.inboxState, null);
      if (s) {
        setFindings(s.findings || []);
        setOverview(s.overview || "");
        setLastSummary(s.lastScan || s.lastSummary || null);
      }
    })();
  }, []);

  const refreshGmailStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/google/status");
      if (!res.ok) {
        setGmailStatus({ loading: false, configured: false, connected: false, email: null, storageReady: true, setupRequired: false });
        return;
      }
      const data = await res.json();
      setGmailStatus({
        loading: false,
        configured: !!data.configured,
        connected: !!data.connected,
        email: data.email || null,
        storageReady: data.storageReady !== false,
        setupRequired: !!data.setupRequired,
      });
    } catch {
      setGmailStatus({ loading: false, configured: false, connected: false, email: null, storageReady: true, setupRequired: false });
    }
  }, []);

  useEffect(() => {
    refreshGmailStatus();
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("gmail") === "connected") {
      flash(`Gmail connected${params.get("gmail_email") ? ` — ${decodeURIComponent(params.get("gmail_email"))}` : ""}`);
      params.delete("gmail");
      params.delete("gmail_email");
      params.delete("gmail_error");
      const qs = params.toString();
      window.history.replaceState({}, "", qs ? `?${qs}` : window.location.pathname);
      refreshGmailStatus();
    }
    const err = params.get("gmail_error");
    if (err) {
      const decoded = decodeURIComponent(err);
      flash(decoded.includes("redirect_uri") || decoded === "redirect_uri_mismatch"
        ? "Google redirect URI mismatch — add the URI below to your Web OAuth client"
        : decoded, "err");
      params.delete("gmail_error");
      const qs = params.toString();
      window.history.replaceState({}, "", qs ? `?${qs}` : window.location.pathname);
    }
  }, [flash, refreshGmailStatus]);

  const disconnectGmail = async () => {
    await fetch("/api/google/disconnect", { method: "POST" });
    setGmailStatus({ loading: false, configured: gmailStatus.configured, connected: false, email: null });
    flash("Gmail disconnected");
  };

  const persist = (next, ts, ov) =>
    saveKey(STORAGE_KEYS.inboxState, { findings: next, lastScan: ts, lastSummary: ts, overview: ov ?? overview });

  const mergeSummaryWithRaw = (aiEmails, rawEmails) => {
    if (!rawEmails.length) return [];
    const ai = Array.isArray(aiEmails) ? aiEmails : [];
    return rawEmails.map((raw, i) => {
      const fromAi = ai[i] || {};
      return {
        subject: fromAi.subject || raw.subject,
        contact_name: fromAi.contact_name || fromAi.fromName || raw.fromName || raw.from,
        contact_email: fromAi.contact_email || fromAi.fromEmail || raw.fromEmail,
        date: fromAi.date || raw.date,
        summary: fromAi.summary || fromAi.snippet || raw.snippet || "(no preview)",
        job_relevant: !!fromAi.job_relevant,
        category: fromAi.category || null,
        company: fromAi.company || "",
        role: fromAi.role || "",
      };
    });
  };

  const summarizeInbox = async () => {
    if (!gmailStatus.connected) {
      flash("Connect Gmail first", "err");
      return;
    }
    setSummarizing(true);
    setGmailApiError(null);
    try {
      const recentRes = await fetch("/api/google/recent?limit=10");
      const recentData = await recentRes.json().catch(() => ({}));
      if (recentRes.status === 403 || recentData.code === "gmail_not_connected") {
        flash("Connect Gmail to summarize your inbox", "err");
        refreshGmailStatus();
        return;
      }
      if (recentRes.status === 503 && recentData.code === "gmail_storage_not_ready") {
        flash("Run user_integrations SQL in Supabase, then Connect Gmail again", "err");
        refreshGmailStatus();
        return;
      }
      if (recentRes.status === 503 && recentData.code === "gmail_api_disabled") {
        setGmailApiError({ message: recentData.error, enableUrl: recentData.enableUrl });
        flash("Enable Gmail API in Google Cloud (see banner below)", "err");
        return;
      }
      if (!recentRes.ok) {
        flash(recentData.error || "Couldn't load Gmail messages", "err");
        return;
      }

      const rawEmails = recentData.emails || [];
      if (!rawEmails.length) {
        flash("No messages found in the connected Gmail account", "err");
        return;
      }

      const trackedEmails = contacts
        .filter((c) => c.email && (c.status === "sent" || c.status === "drafted"))
        .map((c) => c.email.toLowerCase())
        .slice(0, 30);
      const trackedNote = trackedEmails.length
        ? `\nCampaign contacts (flag replies from these as job_relevant): ${trackedEmails.join(", ")}`
        : "";

      const { text } = await callAI({
        system: "You summarize email metadata. Use only the provided messages — do not invent any. Return only valid JSON, no markdown.",
        content: `Summarize these ${rawEmails.length} recent Gmail messages (newest first):

${JSON.stringify(rawEmails, null, 2)}

Return ONLY this JSON object:
{
  "overview": "2-3 sentence digest of these emails — themes, urgency, anything job-search related",
  "emails": [
    {
      "subject": "same as input",
      "contact_name": "sender display name",
      "contact_email": "sender email",
      "date": "ISO date",
      "summary": "1-2 sentence plain-English summary (expand on snippet, don't just copy it)",
      "job_relevant": true or false,
      "category": if job_relevant, one of "recruiter_outreach", "application_confirmation", "interview_scheduling", "offer", "rejection", "follow_up_needed", "other" — else null,
      "company": "",
      "role": ""
    }
  ]
}

Rules:
- Exactly ${rawEmails.length} items in emails[], same order as input.
- One entry per input message.${trackedNote}`,
        maxTokens: 4000,
        feature: "inbox_summary",
      });

      const parsed = extractJSON(text);
      let aiEmails = [];
      let digest = "";
      if (parsed && Array.isArray(parsed.emails)) {
        aiEmails = parsed.emails;
        digest = typeof parsed.overview === "string" ? parsed.overview : "";
      } else if (Array.isArray(parsed)) {
        aiEmails = parsed;
      }

      const merged = mergeSummaryWithRaw(aiEmails, rawEmails);
      const enriched = merged.map((f) => ({ ...f, id: uid() }));
      setFindings(enriched);
      setOverview(digest || `Your ${enriched.length} most recent emails from ${gmailStatus.email || "Gmail"}.`);
      const ts = Date.now();
      setLastSummary(ts);
      persist(enriched, ts, digest);
      flash(`Summarized ${enriched.length} email${enriched.length === 1 ? "" : "s"}`);
    } catch (e) {
      if (e.message === "GMAIL_NOT_CONNECTED") {
        flash("Connect Gmail to summarize your inbox", "err");
        refreshGmailStatus();
      } else if (e.message === "GMAIL_STORAGE_NOT_READY") {
        flash("Run user_integrations SQL in Supabase, then Connect Gmail again", "err");
        refreshGmailStatus();
      } else {
        flash("Summary failed: " + e.message, "err");
      }
    } finally {
      setSummarizing(false);
    }
  };

  const dismiss = (id) => {
    const next = findings.filter((f) => f.id !== id);
    setFindings(next);
    persist(next, lastSummary);
  };

  const toPipeline = (f) => {
    const status =
      f.category === "offer" ? "offer" :
      f.category === "rejection" ? "closed" :
      f.category === "interview_scheduling" ? "interview" :
      f.category === "application_confirmation" ? "applied" :
      f.category === "recruiter_outreach" ? "saved" : "applied";
    upsertApp({
      company: f.company || "Unknown",
      role: f.role || "",
      status,
      dateApplied: status !== "saved" && status !== "closed" ? (f.date || todayISO()) : undefined,
      dateSaved: todayISO(),
      notes: `From Gmail (${f.subject || ""})\n${f.summary || f.snippet || ""}\n\nContact: ${f.contact_name || ""} <${f.contact_email || ""}>`,
    });
    dismiss(f.id);
    flash(`Added ${f.company || "job"} to pipeline`);
  };

  const toOutreach = (f) => {
    upsertOutreach({
      channel: "Gmail",
      contact: f.contact_name || f.contact_email || "Unknown",
      contactTitle: f.contact_title || "",
      contactEmail: f.contact_email || "",
      company: f.company || "",
      subject: f.subject || "",
      date: f.date || todayISO(),
      direction: f.category === "recruiter_outreach" ? "inbound" : "outbound",
      notes: f.summary || f.snippet || "",
      status: "logged",
    });
    dismiss(f.id);
    flash("Logged to outreach");
  };

  return (
    <div className="jl-fade">
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        marginBottom: 28, gap: 16, flexWrap: "wrap",
      }}>
        <div>
          <h1 className="jl-display" style={{ fontSize: 38, fontWeight: 400, margin: 0, letterSpacing: "-0.02em" }}>
            Inbox
          </h1>
          <p style={{ color: "var(--ink-3)", fontSize: 14, margin: "4px 0 0" }}>
            {lastSummary ? `Last updated ${niceDate(new Date(lastSummary).toISOString())}` : "A quick digest of your 10 most recent emails"}
          </p>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          {!gmailStatus.loading && (
            gmailStatus.connected ? (
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{
                  fontSize: 12, color: "var(--moss)", background: "var(--moss-soft)",
                  padding: "6px 10px", borderRadius: 999, display: "inline-flex", alignItems: "center", gap: 6,
                }}>
                  <CheckCircle2 size={13} /> {gmailStatus.email || "Gmail connected"}
                </span>
                <button onClick={disconnectGmail} style={ghostBtnSm}>Disconnect</button>
              </div>
            ) : gmailStatus.configured ? (
              <a href="/api/google/auth" style={{ ...primaryBtn, textDecoration: "none", background: "var(--moss)" }}>
                <Mail size={14} /> Connect Gmail
              </a>
            ) : (
              <span style={{ fontSize: 12, color: "var(--ink-3)", maxWidth: 220, lineHeight: 1.4 }}>
                Gmail OAuth not configured — add GOOGLE_CLIENT_ID to .env.local
              </span>
            )
          )}
          <button onClick={summarizeInbox} disabled={summarizing || !gmailStatus.connected}
            style={{ ...primaryBtn, opacity: summarizing || !gmailStatus.connected ? 0.6 : 1 }}>
            {summarizing ? <RefreshCw size={15} className="jl-spin" /> : <Sparkles size={15} />}
            {summarizing ? "Summarizing…" : lastSummary ? "Refresh summary" : "Summarize inbox"}
          </button>
        </div>
      </div>

      {gmailApiError && (
        <div style={{
          padding: "14px 16px", marginBottom: 20, borderRadius: 10,
          background: "var(--rose-soft)", border: "1px solid var(--rose)",
          fontSize: 13, color: "var(--ink-2)", lineHeight: 1.55,
        }}>
          <strong style={{ fontWeight: 600, color: "var(--rose)" }}>Gmail API not enabled.</strong>{" "}
          {gmailApiError.message}
          {gmailApiError.enableUrl && (
            <div style={{ marginTop: 10 }}>
              <a href={gmailApiError.enableUrl} target="_blank" rel="noreferrer" style={{
                ...primaryBtn, display: "inline-flex", textDecoration: "none", background: "var(--rose)", fontSize: 13,
              }}>
                <ExternalLink size={14} /> Enable Gmail API in Google Cloud
              </a>
            </div>
          )}
        </div>
      )}

      {!gmailStatus.loading && gmailStatus.setupRequired && (
        <div style={{
          padding: "14px 16px", marginBottom: 20, borderRadius: 10,
          background: "var(--rose-soft)", border: "1px solid var(--rose)",
          fontSize: 13, color: "var(--ink-2)", lineHeight: 1.55,
        }}>
          <strong style={{ fontWeight: 600, color: "var(--rose)" }}>Database setup required.</strong>{" "}
          Open Supabase → SQL Editor and run the <code className="jl-mono" style={{ fontSize: 12 }}>user_integrations</code> block
          from <code className="jl-mono" style={{ fontSize: 12 }}>supabase/schema.sql</code>, then click Connect Gmail again.
        </div>
      )}

      {!gmailStatus.loading && !gmailStatus.connected && gmailStatus.configured && !gmailStatus.setupRequired && (
        <div style={{
          padding: "14px 16px", marginBottom: 20, borderRadius: 10,
          background: "var(--amber-soft)", border: "1px solid var(--line)",
          fontSize: 13, color: "var(--ink-2)", lineHeight: 1.55,
        }}>
          <strong style={{ fontWeight: 600 }}>Connect Gmail once</strong> — uses Google OAuth in Testing mode (no $500 audit for personal use).
          Add yourself as a test user in Google Cloud, then click Connect Gmail above.
          {oauthRedirectUri && (
            <div style={{ marginTop: 10, fontSize: 12 }}>
              <div style={{ color: "var(--ink-3)", marginBottom: 4 }}>Add this exact URI in Google → Clients → <strong>Web application</strong> → Authorized redirect URIs:</div>
              <code className="jl-mono" style={{
                display: "block", padding: "8px 10px", background: "var(--paper)",
                borderRadius: 6, wordBreak: "break-all", fontSize: 11,
              }}>{oauthRedirectUri}</code>
            </div>
          )}
        </div>
      )}

      {findings.length === 0 && !summarizing && (
        <div style={{
          padding: "60px 40px", textAlign: "center",
          border: "1px dashed var(--line)", borderRadius: 16,
          background: "var(--paper-deep)",
        }}>
          <Mail size={36} strokeWidth={1.3} style={{ color: "var(--ink-4)", marginBottom: 16 }} />
          <h3 className="jl-display" style={{ fontSize: 22, fontWeight: 400, margin: "0 0 8px" }}>
            {lastSummary ? "No emails to show" : "See what's in your inbox"}
          </h3>
          <p style={{ color: "var(--ink-3)", fontSize: 14, maxWidth: 420, margin: "0 auto 20px", lineHeight: 1.55 }}>
            {lastSummary
              ? "Try refreshing — your last summary came back empty."
              : gmailStatus.connected
                ? "I'll read your 10 most recent emails and summarize each one. Job-related messages are flagged so you can route them to Pipeline or Outreach."
                : "Connect Gmail above, then get a digest of your 10 most recent emails."}
          </p>
          {!gmailStatus.connected && gmailStatus.configured && (
            <a href="/api/google/auth" style={{ ...primaryBtn, textDecoration: "none", display: "inline-flex" }}>
              <Mail size={14} /> Connect Gmail
            </a>
          )}
        </div>
      )}

      {summarizing && findings.length === 0 && (
        <div style={{ padding: "60px 0", textAlign: "center" }}>
          <div className="jl-pulse" style={{ color: "var(--ink-3)", fontSize: 14 }}>
            Reading your 10 most recent emails…
          </div>
        </div>
      )}

      {overview && !summarizing && (
        <div style={{
          padding: "16px 18px", marginBottom: 20, borderRadius: 12,
          background: "var(--surface)", border: "1px solid var(--line)",
          fontSize: 14, color: "var(--ink-2)", lineHeight: 1.6,
        }}>
          <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--ink-3)", marginBottom: 8 }}>
            Inbox digest
          </div>
          {overview}
        </div>
      )}

      {findings.length > 0 && (() => {
        // Build map of tracked contact emails (sent or drafted) for reply detection
        const contactByEmail = new Map();
        contacts.forEach((c) => {
          if (c.email && (c.status === "sent" || c.status === "drafted" || c.status === "replied")) {
            contactByEmail.set(c.email.toLowerCase(), c);
          }
        });
        const markReplied = (matchedContact, f) => {
          const now = Date.now();
          upsertContact({
            ...matchedContact,
            status: "replied",
            repliedAt: now,
          });
          upsertOutreach({
            channel: "Gmail",
            contact: matchedContact.name || matchedContact.email,
            contactEmail: matchedContact.email,
            company: matchedContact.company || "",
            subject: f.subject || "Reply",
            direction: "inbound",
            date: f.date || new Date(now).toISOString().slice(0, 10),
            notes: f.summary || f.snippet || "",
            status: "replied",
            contactId: matchedContact.id,
          });
          dismiss(f.id);
          flash(`${matchedContact.name} marked as replied`);
        };
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {findings.map((f) => {
              const matched = contactByEmail.get((f.contact_email || "").toLowerCase());
              return (
                <FindingCard key={f.id} f={f} matchedContact={matched}
                  onPipeline={() => toPipeline(f)}
                  onOutreach={() => toOutreach(f)}
                  onMarkReplied={matched ? () => markReplied(matched, f) : null}
                  onDismiss={() => dismiss(f.id)} />
              );
            })}
          </div>
        );
      })()}
    </div>
  );
}

function FindingCard({ f, matchedContact, onPipeline, onOutreach, onMarkReplied, onDismiss }) {
  const catColors = {
    recruiter_outreach: { bg: "var(--moss-soft)", fg: "var(--moss)", label: "Recruiter reached out" },
    application_confirmation: { bg: "var(--amber-soft)", fg: "var(--amber)", label: "Application confirmed" },
    interview_scheduling: { bg: "var(--accent-soft)", fg: "var(--accent)", label: "Interview" },
    offer: { bg: "var(--moss-soft)", fg: "var(--moss)", label: "Offer" },
    rejection: { bg: "var(--rose-soft)", fg: "var(--rose)", label: "Rejection" },
    follow_up_needed: { bg: "var(--amber-soft)", fg: "var(--amber)", label: "Follow up" },
    other: { bg: "var(--paper-deep)", fg: "var(--ink-3)", label: "Job-related" },
    email: { bg: "var(--paper-deep)", fg: "var(--ink-3)", label: "Email" },
  };
  const catKey = f.category && catColors[f.category] ? f.category : (f.job_relevant ? "other" : "email");
  const cat = catColors[catKey];
  const body = f.summary || f.snippet || "";
  return (
    <div style={{
      background: "var(--surface)",
      border: `1px solid ${matchedContact ? "var(--moss)" : "var(--line)"}`,
      borderRadius: 10, padding: 16, display: "flex", gap: 14, alignItems: "start",
      boxShadow: matchedContact ? "0 0 0 3px var(--moss-soft)" : "none",
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        {matchedContact && (
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 6, marginBottom: 8,
            background: "var(--moss-soft)", color: "var(--moss)",
            fontSize: 11, fontWeight: 500, padding: "3px 9px", borderRadius: 999,
          }}>
            <CheckCircle2 size={11} /> Reply from {matchedContact.name} (campaign contact)
          </div>
        )}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
          <span style={{
            background: cat.bg, color: cat.fg, fontSize: 11, fontWeight: 500,
            padding: "2px 8px", borderRadius: 999,
          }}>{cat.label}</span>
          {f.company && (
            <span className="jl-display" style={{ fontSize: 15, fontWeight: 500, color: "var(--ink)" }}>
              {f.company}
            </span>
          )}
          {f.role && (
            <span style={{ fontSize: 13, color: "var(--ink-2)" }}>· {f.role}</span>
          )}
          <span style={{ fontSize: 12, color: "var(--ink-3)", marginLeft: "auto" }}>{niceDate(f.date)}</span>
        </div>
        <div style={{ fontSize: 13, color: "var(--ink-2)", marginBottom: 4, lineHeight: 1.4 }}>
          {f.subject}
        </div>
        <div style={{ fontSize: 13, color: "var(--ink-3)", lineHeight: 1.5 }}>
          {body}
        </div>
        <div style={{ fontSize: 11, color: "var(--ink-4)", marginTop: 6 }}>
          {f.contact_name} {f.contact_email && `<${f.contact_email}>`}
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, flexShrink: 0 }}>
        {onMarkReplied && (
          <button onClick={onMarkReplied} style={{
            ...primaryBtn, background: "var(--moss)", color: "white",
            padding: "5px 10px", fontSize: 12,
          }}>
            <Check size={12} /> Mark replied
          </button>
        )}
        <button onClick={onPipeline} style={{ ...ghostBtnSm, fontSize: 12 }}>
          → Pipeline
        </button>
        <button onClick={onOutreach} style={{ ...ghostBtnSm, fontSize: 12 }}>
          → Outreach
        </button>
        <button onClick={onDismiss} style={{ ...ghostBtnSm, fontSize: 12, color: "var(--ink-3)" }}>
          Dismiss
        </button>
      </div>
    </div>
  );
}

/* ============================================================
   OUTREACH
   ============================================================ */
function normContactKey(s) {
  return (s || "").toLowerCase().trim();
}

function isLikelyEmail(s) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((s || "").trim());
}

function outreachContactStatus(outreach) {
  if (outreach.direction === "inbound" || outreach.status === "replied") return "replied";
  if (outreach.status === "sent" || outreach.status === "sent_via_campaign") return "sent";
  if (outreach.direction === "outbound") return "sent";
  return "new";
}

const CONTACT_STATUS_RANK = {
  new: 0, researched: 1, drafted: 2, no_response: 2, sent: 3, replied: 4,
  meeting_scheduled: 5, not_interested: 6,
};

function mergeOutreachContact(contacts, outreach) {
  const name = (outreach.contact || "").trim();
  const rawEmail = (outreach.contactEmail || "").trim();
  const company = (outreach.company || "").trim();
  const role = (outreach.contactTitle || "").trim();

  if (!name && !rawEmail) return contacts;
  if (normContactKey(name) === "unknown" && !rawEmail) return contacts;

  let existing = null;
  if (outreach.contactId) {
    existing = contacts.find((c) => c.id === outreach.contactId) || null;
  }
  if (!existing && rawEmail && isLikelyEmail(rawEmail)) {
    existing = contacts.find((c) => normContactKey(c.email) === normContactKey(rawEmail)) || null;
  }
  if (!existing && name && company) {
    existing = contacts.find((c) =>
      normContactKey(c.name) === normContactKey(name) &&
      normContactKey(c.company) === normContactKey(company)
    ) || null;
  }
  if (!existing && name) {
    existing = contacts.find((c) => normContactKey(c.name) === normContactKey(name)) || null;
  }

  const channel = outreach.channel === "LinkedIn" ? "linkedin"
    : outreach.channel === "Gmail" ? "email" : "other";
  const email = rawEmail && isLikelyEmail(rawEmail) ? rawEmail : "";
  const linkedinUrl = rawEmail && !isLikelyEmail(rawEmail) ? rawEmail
    : (channel === "linkedin" ? (existing?.linkedin || existing?.linkedinUrl || "") : "");

  const suggestedStatus = outreachContactStatus(outreach);
  const currentStatus = existing?.status || "new";
  const nextStatus = (CONTACT_STATUS_RANK[suggestedStatus] ?? 0) > (CONTACT_STATUS_RANK[currentStatus] ?? 0)
    ? suggestedStatus
    : (existing ? currentStatus : suggestedStatus);

  const outreachDate = outreach.date ? Date.parse(outreach.date) : NaN;
  const ts = Number.isFinite(outreachDate) ? outreachDate : Date.now();

  const patch = {
    name: name || existing?.name || (email ? email.split("@")[0] : "Unknown"),
    email: email || existing?.email || "",
    company: company || existing?.company || "",
    role: role || existing?.role || "",
    channel: existing?.channel || channel,
    source: existing?.source || "outreach",
    status: nextStatus,
  };

  if (linkedinUrl) {
    patch.linkedin = linkedinUrl;
    patch.linkedinUrl = linkedinUrl;
  } else if (existing?.linkedin || existing?.linkedinUrl) {
    patch.linkedin = existing.linkedin || existing.linkedinUrl;
    patch.linkedinUrl = existing.linkedinUrl || existing.linkedin;
  }

  if (suggestedStatus === "replied" && !existing?.repliedAt) {
    patch.repliedAt = ts;
  }
  if (suggestedStatus === "sent" && !existing?.sentAt) {
    patch.sentAt = ts;
  }

  if (existing) {
    const merged = { ...existing, ...patch, updatedAt: Date.now() };
    return contacts.map((c) => (c.id === existing.id ? merged : c));
  }

  return [{
    ...patch,
    id: uid(),
    addedAt: Date.now(),
    updatedAt: Date.now(),
  }, ...contacts];
}

function syncCompanyFromOutreach(upsertCompany, companyName) {
  const name = (companyName || "").trim();
  if (name) upsertCompany({ name, source: "outreach" });
}

function OutreachView({ outreach, upsertOutreach, upsertCompany, deleteOutreach, flash }) {
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(null);
  return (
    <div className="jl-fade">
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        marginBottom: 28, gap: 16, flexWrap: "wrap",
      }}>
        <div>
          <h1 className="jl-display" style={{ fontSize: 38, fontWeight: 400, margin: 0, letterSpacing: "-0.02em" }}>
            Outreach
          </h1>
          <p style={{ color: "var(--ink-3)", fontSize: 14, margin: "4px 0 0" }}>
            {outreach.length === 0 ? "Log every message you send and receive" : `${outreach.length} ${outreach.length === 1 ? "thread" : "threads"}`}
          </p>
        </div>
        <button onClick={() => setAdding(true)} style={primaryBtn}>
          <Plus size={15} /> Log a message
        </button>
      </div>

      {outreach.length === 0 ? (
        <div style={{
          padding: "60px 40px", textAlign: "center",
          border: "1px dashed var(--line)", borderRadius: 16,
          background: "var(--paper-deep)",
        }}>
          <Send size={32} strokeWidth={1.3} style={{ color: "var(--ink-4)", marginBottom: 16 }} />
          <h3 className="jl-display" style={{ fontSize: 22, fontWeight: 400, margin: "0 0 8px" }}>
            No outreach logged yet
          </h3>
          <p style={{ color: "var(--ink-3)", fontSize: 14, maxWidth: 420, margin: "0 auto", lineHeight: 1.55 }}>
            Screenshot LinkedIn messages and use <strong style={{ color: "var(--accent)", fontWeight: 600 }}>Capture</strong>, summarize your Gmail in the Inbox tab, or log a message by hand.
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {outreach.map((o) => (
            <OutreachRow
              key={o.id}
              item={o}
              onDelete={() => deleteOutreach(o.id)}
              onEdit={() => { setAdding(false); setEditing(o); }}
            />
          ))}
        </div>
      )}

      {adding && (
        <Modal onClose={() => setAdding(false)} title="Log a message">
          <ManualOutreachForm onSave={(d) => {
            syncCompanyFromOutreach(upsertCompany, d.company);
            upsertOutreach(d);
            setAdding(false);
            flash("Logged");
          }} onCancel={() => setAdding(false)} />
        </Modal>
      )}

      {editing && (
        <Modal onClose={() => setEditing(null)} title="Edit message">
          <ManualOutreachForm
            initial={editing}
            onSave={(d) => {
              syncCompanyFromOutreach(upsertCompany, d.company);
              upsertOutreach({ ...editing, ...d });
              setEditing(null);
              flash("Updated");
            }}
            onCancel={() => setEditing(null)}
          />
        </Modal>
      )}
    </div>
  );
}

function OutreachRow({ item, onDelete, onEdit }) {
  const [expanded, setExpanded] = useState(false);
  const channelIcon = item.channel === "LinkedIn" ? Linkedin : item.channel === "Gmail" ? Mail : MessageCircle;
  const Ch = channelIcon;
  return (
    <div style={{
      background: "var(--surface)", border: "1px solid var(--line)",
      borderRadius: 10, padding: "12px 16px",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14, cursor: "pointer" }}
        onClick={() => setExpanded(!expanded)}>
        <div style={{
          width: 32, height: 32, borderRadius: 8, background: "var(--paper-deep)",
          display: "grid", placeItems: "center", color: "var(--ink-2)", flexShrink: 0,
        }}>
          <Ch size={15} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2, flexWrap: "wrap" }}>
            <span style={{ fontSize: 14, color: "var(--ink)", fontWeight: 500 }}>{item.contact || "Unknown"}</span>
            {item.contactTitle && <span style={{ fontSize: 12, color: "var(--ink-3)" }}>· {item.contactTitle}</span>}
            {item.company && <span style={{ fontSize: 12, color: "var(--ink-3)" }}>· {item.company}</span>}
            <span style={{
              fontSize: 10, padding: "1px 7px", borderRadius: 999,
              background: item.direction === "inbound" ? "var(--moss-soft)" : "var(--accent-soft)",
              color: item.direction === "inbound" ? "var(--moss)" : "var(--accent)",
              fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.05em",
            }}>{item.direction || "out"}</span>
          </div>
          <div style={{ fontSize: 13, color: "var(--ink-3)", lineHeight: 1.4 }}>
            {item.subject || item.notes?.slice(0, 80) || "—"}
          </div>
        </div>
        <div style={{ fontSize: 12, color: "var(--ink-3)", flexShrink: 0 }}>{niceDate(item.date)}</div>
      </div>
      {expanded && (
        <div style={{
          marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--line-soft)",
          fontSize: 13, color: "var(--ink-2)", lineHeight: 1.6, whiteSpace: "pre-wrap",
        }}>
          {item.notes || <em style={{ color: "var(--ink-4)" }}>No content captured</em>}
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 12 }}>
            <button onClick={(e) => { e.stopPropagation(); onEdit(); }} style={ghostBtnSm}>
              <Edit3 size={12} /> Edit
            </button>
            <button onClick={(e) => { e.stopPropagation(); if (confirm("Delete this?")) onDelete(); }} style={{
              ...ghostBtnSm, color: "var(--rose)",
            }}>
              <Trash2 size={12} /> Delete
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ManualOutreachForm({ onSave, onCancel, initial }) {
  const [form, setForm] = useState({
    channel: initial?.channel || "LinkedIn",
    contact: initial?.contact || "",
    contactEmail: initial?.contactEmail || "",
    contactTitle: initial?.contactTitle || "",
    company: initial?.company || "",
    subject: initial?.subject || "",
    direction: initial?.direction || "outbound",
    date: initial?.date || todayISO(),
    notes: initial?.notes || "",
  });
  const u = (k, v) => setForm({ ...form, [k]: v });
  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Field label="Channel">
          <select value={form.channel} onChange={(e) => u("channel", e.target.value)} style={inputBase}>
            <option>LinkedIn</option>
            <option>Gmail</option>
            <option>Other</option>
          </select>
        </Field>
        <Field label="Direction">
          <select value={form.direction} onChange={(e) => u("direction", e.target.value)} style={inputBase}>
            <option value="outbound">I sent it</option>
            <option value="inbound">They sent it</option>
          </select>
        </Field>
      </div>
      <Field label="Contact name" required>
        <input value={form.contact} onChange={(e) => u("contact", e.target.value)} style={inputBase} />
      </Field>
      <Field label="Email">
        <input value={form.contactEmail} onChange={(e) => u("contactEmail", e.target.value)} style={inputBase}
          placeholder="optional — adds to Contacts spreadsheet" type="email" />
      </Field>
      <Field label="Title">
        <input value={form.contactTitle} onChange={(e) => u("contactTitle", e.target.value)} style={inputBase}
          placeholder="e.g. Head of Talent, Recruiter" />
      </Field>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Field label="Company"><input value={form.company} onChange={(e) => u("company", e.target.value)} style={inputBase} /></Field>
        <Field label="Date"><input type="date" value={form.date} onChange={(e) => u("date", e.target.value)} style={inputBase} /></Field>
      </div>
      <Field label="Subject / one-line summary">
        <input value={form.subject} onChange={(e) => u("subject", e.target.value)} style={inputBase} />
      </Field>
      <Field label="Message / notes">
        <textarea value={form.notes} onChange={(e) => u("notes", e.target.value)}
          style={{ ...inputBase, minHeight: 100, resize: "vertical" }} />
      </Field>
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 6 }}>
        <button onClick={onCancel} style={ghostBtn}>Cancel</button>
        <button onClick={() => form.contact && onSave({ ...form, ...(initial?.id ? { id: initial.id } : {}) })}
          disabled={!form.contact} style={{ ...primaryBtn, opacity: !form.contact ? 0.5 : 1 }}>
          {initial?.id ? "Save changes" : "Save"}
        </button>
      </div>
    </div>
  );
}

/* ============================================================
   ACTIVITY — unstructured log
   ============================================================ */
function ActivityView({ activities, upsertActivity, deleteActivity, flash }) {
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(null);
  const [filterText, setFilterText] = useState("");

  const sorted = useMemo(() => {
    let list = [...activities];
    if (filterText.trim()) {
      const q = filterText.toLowerCase();
      list = list.filter((a) =>
        (a.title || "").toLowerCase().includes(q) ||
        (a.notes || "").toLowerCase().includes(q)
      );
    }
    return list.sort((a, b) => {
      const da = new Date(a.date || a.createdAt || 0).getTime();
      const db = new Date(b.date || b.createdAt || 0).getTime();
      return db - da;
    });
  }, [activities, filterText]);

  const save = (form) => {
    upsertActivity(form);
    setAdding(false);
    setEditing(null);
    flash(editing ? "Activity updated" : "Activity logged");
  };

  return (
    <div className="jl-fade">
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        marginBottom: 28, gap: 16, flexWrap: "wrap",
      }}>
        <div>
          <h1 className="jl-display" style={{ fontSize: 38, fontWeight: 400, margin: 0, letterSpacing: "-0.02em" }}>
            Activity
          </h1>
          <p style={{ color: "var(--ink-3)", fontSize: 14, margin: "4px 0 0", maxWidth: 520, lineHeight: 1.5 }}>
            {activities.length === 0
              ? "Log anything that doesn't fit a job, message, or meeting yet"
              : `${activities.length} ${activities.length === 1 ? "entry" : "entries"} · uncategorized for now`}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {activities.length > 0 && (
            <div style={{ position: "relative" }}>
              <Search size={14} style={{ position: "absolute", left: 12, top: 11, color: "var(--ink-4)" }} />
              <input value={filterText} onChange={(e) => setFilterText(e.target.value)} placeholder="Search…"
                style={{ ...inputBase, padding: "8px 12px 8px 32px", width: 180, fontSize: 13 }} />
            </div>
          )}
          <button onClick={() => { setEditing(null); setAdding(true); }} style={primaryBtn}>
            <Plus size={15} /> Log activity
          </button>
        </div>
      </div>

      {activities.length === 0 ? (
        <div style={{
          padding: "60px 40px", textAlign: "center",
          border: "1px dashed var(--line)", borderRadius: 16,
          background: "var(--paper-deep)",
        }}>
          <PenLine size={32} strokeWidth={1.3} style={{ color: "var(--ink-4)", marginBottom: 16 }} />
          <h3 className="jl-display" style={{ fontSize: 22, fontWeight: 400, margin: "0 0 8px" }}>
            Capture the in-between work
          </h3>
          <p style={{ color: "var(--ink-3)", fontSize: 14, maxWidth: 440, margin: "0 auto 20px", lineHeight: 1.55 }}>
            Created a profile on a job board? Joined a community? Researched a company? Log it here — you can categorize later.
          </p>
          <button onClick={() => setAdding(true)} style={{ ...primaryBtn, background: "var(--accent)", color: "white" }}>
            <Plus size={15} /> Log your first activity
          </button>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {sorted.map((item) => (
            <ActivityCard
              key={item.id}
              item={item}
              onEdit={() => { setAdding(false); setEditing(item); }}
              onDelete={() => { deleteActivity(item.id); flash("Deleted"); }}
            />
          ))}
          {sorted.length === 0 && filterText && (
            <p style={{ color: "var(--ink-3)", fontSize: 14, textAlign: "center", padding: 24 }}>
              No entries match "{filterText}"
            </p>
          )}
        </div>
      )}

      {(adding || editing) && (
        <div style={drawerOverlay} onClick={() => { setAdding(false); setEditing(null); }}>
          <div className="jl-fade jl-scroll" onClick={(e) => e.stopPropagation()} style={{
            position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
            width: "min(560px, 94vw)", maxHeight: "90vh", overflowY: "auto",
            background: "var(--surface)", borderRadius: 14, padding: "26px 30px",
            border: "1px solid var(--line)",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <h2 className="jl-display" style={{ fontSize: 22, fontWeight: 500, margin: 0 }}>
                {editing ? "Edit activity" : "Log activity"}
              </h2>
              <button onClick={() => { setAdding(false); setEditing(null); }} style={iconBtn}><X size={18} /></button>
            </div>
            <p style={{ color: "var(--ink-3)", fontSize: 13, margin: "0 0 18px", lineHeight: 1.5 }}>
              Free-form notes about something you did. No category required — organize later if you want.
            </p>
            <ActivityForm
              initial={editing}
              onSave={save}
              onCancel={() => { setAdding(false); setEditing(null); }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function ActivityCard({ item, onEdit, onDelete }) {
  const [expanded, setExpanded] = useState(false);
  const preview = (item.notes || "").split("\n")[0].slice(0, 120);
  return (
    <div style={{
      background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 12,
      padding: "14px 16px",
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, cursor: "pointer" }}
        onClick={() => setExpanded(!expanded)}>
        <div style={{
          width: 32, height: 32, borderRadius: 8, background: "var(--paper-deep)",
          display: "grid", placeItems: "center", color: "var(--ink-2)", flexShrink: 0,
        }}>
          <PenLine size={15} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 500, color: "var(--ink)", marginBottom: 4 }}>
            {item.title || "Untitled activity"}
          </div>
          {!expanded && item.notes && (
            <div style={{ fontSize: 13, color: "var(--ink-3)", lineHeight: 1.45 }}>
              {preview}{item.notes.length > preview.length ? "…" : ""}
            </div>
          )}
        </div>
        <div style={{ fontSize: 12, color: "var(--ink-3)", flexShrink: 0 }}>
          {niceDate(item.date || item.createdAt)}
        </div>
      </div>
      {expanded && (
        <div style={{
          marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--line-soft)",
          fontSize: 13, color: "var(--ink-2)", lineHeight: 1.65, whiteSpace: "pre-wrap",
        }}>
          {item.notes || <em style={{ color: "var(--ink-4)" }}>No details added</em>}
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 12 }}>
            <button onClick={(e) => { e.stopPropagation(); onEdit(); }} style={ghostBtnSm}>
              <Edit3 size={12} /> Edit
            </button>
            <button onClick={(e) => { e.stopPropagation(); if (confirm("Delete this entry?")) onDelete(); }} style={{
              ...ghostBtnSm, color: "var(--rose)",
            }}>
              <Trash2 size={12} /> Delete
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ActivityForm({ initial, onSave, onCancel }) {
  const [form, setForm] = useState({
    id: initial?.id,
    title: initial?.title || "",
    notes: initial?.notes || "",
    date: initial?.date || todayISO(),
    category: initial?.category ?? null,
  });
  const u = (k, v) => setForm({ ...form, [k]: v });
  const canSave = form.title.trim() || form.notes.trim();

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <Field label="What did you do?" required>
        <input
          value={form.title}
          onChange={(e) => u("title", e.target.value)}
          style={inputBase}
          placeholder="Created a profile on Wellfound"
          autoFocus
        />
      </Field>
      <Field label="Date">
        <input type="date" value={form.date} onChange={(e) => u("date", e.target.value)} style={inputBase} />
      </Field>
      <Field label="Details">
        <textarea
          value={form.notes}
          onChange={(e) => u("notes", e.target.value)}
          style={{ ...inputBase, minHeight: 140, resize: "vertical" }}
          placeholder="What is this site? Why did you sign up? Anything to remember for later…"
        />
      </Field>
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 6 }}>
        <button onClick={onCancel} style={ghostBtn}>Cancel</button>
        <button onClick={() => canSave && onSave(form)}
          disabled={!canSave} style={{ ...primaryBtn, opacity: !canSave ? 0.5 : 1 }}>
          <Check size={15} /> {initial ? "Save changes" : "Log activity"}
        </button>
      </div>
    </div>
  );
}

/* ============================================================
   MEETINGS
   ============================================================ */
function MeetingsView({ meetings, upsertMeeting, deleteMeeting, contacts = [], upsertContact, flash }) {
  const [adding, setAdding] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const sync = async () => {
    setSyncing(true);
    try {
      const { text } = await callAI({
        system: "You identify job-search related calendar events. Return only JSON.",
        content: `Use Google Calendar to list events in the next 30 days. Identify which ones look job-search related (keywords: interview, screen, chat, intro, coffee, recruiter, hiring, [company name] interview).

For each relevant event, return:
- title: event title
- start: ISO datetime
- end: ISO datetime
- attendees: array of attendee emails
- company: inferred company name (best guess)
- type: "interview" | "recruiter_chat" | "networking" | "other"

Return ONLY a JSON array. If none found, return []. No commentary.`,
        mcp: [{ type: "url", url: "https://calendarmcp.googleapis.com/mcp/v1", name: "calendar" }],
        maxTokens: 3000,
        feature: "calendar_sync",
      });
      const parsed = extractJSON(text);
      if (Array.isArray(parsed) && parsed.length) {
        // Build email → contact map for auto-linking
        const contactByEmail = new Map();
        contacts.forEach((c) => {
          if (c.email) contactByEmail.set(c.email.toLowerCase(), c);
        });
        let autoLinked = 0;
        parsed.forEach((m) => {
          const atts = (m.attendees || []).map((a) => (a || "").toLowerCase());
          // find first matching contact
          let matchedContact = null;
          for (const a of atts) {
            if (contactByEmail.has(a)) { matchedContact = contactByEmail.get(a); break; }
          }
          const meetingId = uid();
          upsertMeeting({
            id: meetingId,
            title: m.title || "",
            company: m.company || (matchedContact ? matchedContact.company : ""),
            type: m.type || "other",
            when: m.start || "",
            end: m.end || "",
            attendees: (m.attendees || []).join(", "),
            notes: "Synced from Google Calendar" + (matchedContact ? ` · linked to ${matchedContact.name}` : ""),
            contactId: matchedContact?.id || null,
          });
          if (matchedContact && matchedContact.status !== "meeting_scheduled") {
            upsertContact({
              ...matchedContact,
              status: "meeting_scheduled",
              meetingId,
            });
            autoLinked++;
          }
        });
        flash(`Synced ${parsed.length} meeting${parsed.length === 1 ? "" : "s"}${autoLinked ? ` · linked ${autoLinked} to contacts` : ""}`);
      } else {
        flash("No job-related events found");
      }
    } catch (e) {
      flash("Sync failed: " + e.message, "err");
    } finally {
      setSyncing(false);
    }
  };

  const sorted = useMemo(() => {
    return [...meetings].sort((a, b) => (b.when || "").localeCompare(a.when || ""));
  }, [meetings]);

  return (
    <div className="jl-fade">
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        marginBottom: 28, gap: 16, flexWrap: "wrap",
      }}>
        <div>
          <h1 className="jl-display" style={{ fontSize: 38, fontWeight: 400, margin: 0, letterSpacing: "-0.02em" }}>
            Meetings
          </h1>
          <p style={{ color: "var(--ink-3)", fontSize: 14, margin: "4px 0 0" }}>
            {meetings.length === 0 ? "Interviews, calls, coffee chats" : `${meetings.length} ${meetings.length === 1 ? "meeting" : "meetings"}`}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={sync} disabled={syncing} style={{ ...ghostBtn, opacity: syncing ? 0.6 : 1 }}>
            {syncing ? <RefreshCw size={15} className="jl-spin" /> : <Sparkles size={15} />}
            {syncing ? "Syncing…" : "Sync Calendar"}
          </button>
          <button onClick={() => setAdding(true)} style={primaryBtn}>
            <Plus size={15} /> Add meeting
          </button>
        </div>
      </div>

      {sorted.length === 0 ? (
        <div style={{
          padding: "60px 40px", textAlign: "center",
          border: "1px dashed var(--line)", borderRadius: 16,
          background: "var(--paper-deep)",
        }}>
          <Calendar size={32} strokeWidth={1.3} style={{ color: "var(--ink-4)", marginBottom: 16 }} />
          <h3 className="jl-display" style={{ fontSize: 22, fontWeight: 400, margin: "0 0 8px" }}>
            No meetings yet
          </h3>
          <p style={{ color: "var(--ink-3)", fontSize: 14, maxWidth: 420, margin: "0 auto", lineHeight: 1.55 }}>
            Pull interviews from Google Calendar, screenshot a calendar invite, or add one by hand.
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {sorted.map((m) => (
            <MeetingRow key={m.id} m={m}
              onUpdate={(d) => upsertMeeting({ ...m, ...d })}
              onDelete={() => deleteMeeting(m.id)} />
          ))}
        </div>
      )}

      {adding && (
        <Modal onClose={() => setAdding(false)} title="Add a meeting">
          <ManualMeetingForm onSave={(d) => {
            upsertMeeting(d);
            setAdding(false);
            flash("Added");
          }} onCancel={() => setAdding(false)} />
        </Modal>
      )}
    </div>
  );
}

function MeetingRow({ m, onUpdate, onDelete }) {
  const [expanded, setExpanded] = useState(false);
  const when = m.when ? new Date(m.when) : null;
  const dateStr = when && !isNaN(when) ? when.toLocaleString("en-US", {
    month: "short", day: "numeric",
    hour: "numeric", minute: "2-digit",
  }) : (m.when || "—");
  const typeColors = {
    interview: { bg: "var(--accent-soft)", fg: "var(--accent)" },
    recruiter_chat: { bg: "var(--moss-soft)", fg: "var(--moss)" },
    networking: { bg: "var(--amber-soft)", fg: "var(--amber)" },
    other: { bg: "var(--paper-deep)", fg: "var(--ink-3)" },
  };
  const tc = typeColors[m.type] || typeColors.other;
  return (
    <div style={{
      background: "var(--surface)", border: "1px solid var(--line)",
      borderRadius: 10, padding: "12px 16px",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14, cursor: "pointer" }}
        onClick={() => setExpanded(!expanded)}>
        <div style={{
          width: 44, textAlign: "center", flexShrink: 0,
          color: "var(--ink-2)",
        }}>
          <div className="jl-display" style={{ fontSize: 18, fontWeight: 500, lineHeight: 1 }}>
            {when && !isNaN(when) ? when.getDate() : "—"}
          </div>
          <div style={{ fontSize: 10, color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: "0.1em", marginTop: 2 }}>
            {when && !isNaN(when) ? when.toLocaleString("en-US", { month: "short" }) : ""}
          </div>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2, flexWrap: "wrap" }}>
            <span className="jl-display" style={{ fontSize: 15, fontWeight: 500, color: "var(--ink)" }}>
              {m.title || m.company || "Untitled"}
            </span>
            <span style={{
              fontSize: 10, padding: "1px 7px", borderRadius: 999,
              background: tc.bg, color: tc.fg, fontWeight: 500,
              textTransform: "uppercase", letterSpacing: "0.05em",
            }}>{(m.type || "other").replace("_", " ")}</span>
          </div>
          <div style={{ fontSize: 12, color: "var(--ink-3)", lineHeight: 1.4 }}>
            {dateStr}{m.company && m.company !== m.title ? ` · ${m.company}` : ""}
            {m.attendees ? ` · ${m.attendees}` : ""}
          </div>
        </div>
      </div>
      {expanded && (
        <div style={{
          marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--line-soft)",
          fontSize: 13, color: "var(--ink-2)", lineHeight: 1.6, whiteSpace: "pre-wrap",
        }}>
          {m.notes || <em style={{ color: "var(--ink-4)" }}>No notes</em>}
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 12 }}>
            <button onClick={() => { if (confirm("Delete this?")) onDelete(); }} style={{
              ...ghostBtnSm, color: "var(--rose)",
            }}>
              <Trash2 size={12} /> Delete
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ManualMeetingForm({ onSave, onCancel }) {
  const now = new Date();
  const defaultWhen = new Date(now.getTime() + 86400000).toISOString().slice(0, 16);
  const [form, setForm] = useState({
    title: "", company: "", type: "interview",
    when: defaultWhen, attendees: "", notes: "",
  });
  const u = (k, v) => setForm({ ...form, [k]: v });
  return (
    <div style={{ display: "grid", gap: 12 }}>
      <Field label="Title" required>
        <input value={form.title} onChange={(e) => u("title", e.target.value)}
          style={inputBase} placeholder="e.g. Acme — initial chat" />
      </Field>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Field label="Company">
          <input value={form.company} onChange={(e) => u("company", e.target.value)} style={inputBase} />
        </Field>
        <Field label="Type">
          <select value={form.type} onChange={(e) => u("type", e.target.value)} style={inputBase}>
            <option value="interview">Interview</option>
            <option value="recruiter_chat">Recruiter chat</option>
            <option value="networking">Networking</option>
            <option value="other">Other</option>
          </select>
        </Field>
      </div>
      <Field label="When" required>
        <input type="datetime-local" value={form.when} onChange={(e) => u("when", e.target.value)} style={inputBase} />
      </Field>
      <Field label="Attendees">
        <input value={form.attendees} onChange={(e) => u("attendees", e.target.value)}
          style={inputBase} placeholder="optional, comma separated" />
      </Field>
      <Field label="Notes">
        <textarea value={form.notes} onChange={(e) => u("notes", e.target.value)}
          style={{ ...inputBase, minHeight: 80, resize: "vertical" }} />
      </Field>
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 6 }}>
        <button onClick={onCancel} style={ghostBtn}>Cancel</button>
        <button onClick={() => form.title && form.when && onSave(form)}
          disabled={!form.title || !form.when}
          style={{ ...primaryBtn, opacity: !form.title || !form.when ? 0.5 : 1 }}>
          Save
        </button>
      </div>
    </div>
  );
}

/* ============================================================
   CAPTURE MODAL — screenshot vision pipeline
   ============================================================ */
function CaptureModal({ onClose, onSaveApp, onSaveOutreach, onSaveMeeting }) {
  const [images, setImages] = useState([]); // [{ base64, mime, url, name }]
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef(null);
  const MAX_IMAGES = 3;

  const ingestFiles = useCallback(async (fileList) => {
    if (!fileList || !fileList.length) return;
    setError(null);
    setResult(null);
    const files = Array.from(fileList).filter((f) =>
      f.type.startsWith("image/") || f.type === "application/pdf"
    );
    if (!files.length) {
      setError("Please use image or PDF files");
      return;
    }
    setImages((current) => {
      const room = MAX_IMAGES - current.length;
      if (room <= 0) {
        setError(`You can add at most ${MAX_IMAGES} screenshots`);
        return current;
      }
      const accepted = files.slice(0, room);
      // Process accepted files
      (async () => {
        const processed = await Promise.all(accepted.map(async (file) => {
          try {
            const isPdf = file.type === "application/pdf";
            const prep = isPdf ? await prepareCapturePdf(file) : await prepareCaptureImage(file);
            return {
              base64: prep.base64,
              mime: prep.mime,
              kind: isPdf ? "pdf" : "image",
              url: prep.previewUrl,
              name: file.name,
              id: uid(),
            };
          } catch (e) {
            setError(e.message || "Could not read file");
            return null;
          }
        }));
        const valid = processed.filter(Boolean);
        if (valid.length) {
          setImages((prev) => {
            const next = [...prev, ...valid].slice(0, MAX_IMAGES);
            return next;
          });
        }
        if (files.length > room) {
          setError(`Only the first ${room} added — max is ${MAX_IMAGES}`);
        }
      })();
      return current; // immediate return; async update follows
    });
  }, []);

  const removeImage = (id) => {
    setImages((prev) => {
      const found = prev.find((i) => i.id === id);
      if (found?.url) URL.revokeObjectURL(found.url);
      return prev.filter((i) => i.id !== id);
    });
    setError(null);
  };

  // Paste-from-clipboard listener (handles multi-image pastes too)
  useEffect(() => {
    const onPaste = (e) => {
      const items = e.clipboardData?.items || [];
      const files = [];
      for (const it of items) {
        if (it.type && it.type.startsWith("image/")) {
          const file = it.getAsFile();
          if (file) files.push(file);
        }
      }
      if (files.length) ingestFiles(files);
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [ingestFiles]);

  // Cleanup object URLs on unmount
  useEffect(() => {
    return () => { images.forEach((i) => i.url && URL.revokeObjectURL(i.url)); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const analyze = async () => {
    if (!images.length) return;
    setProcessing(true);
    setError(null);
    try {
      const fileBlocks = images.map((f) => {
        if (f.kind === "pdf") {
          return {
            type: "document",
            source: { type: "base64", media_type: "application/pdf", data: f.base64 },
          };
        }
        return {
          type: "image",
          source: { type: "base64", media_type: f.mime, data: f.base64 },
        };
      });
      const kinds = images.map((f) => f.kind);
      const allPdf = kinds.every((k) => k === "pdf");
      const allImg = kinds.every((k) => k === "image");
      const mixedHint = allPdf ? "PDFs" : allImg ? "screenshots" : "files (screenshots and PDFs)";
      const promptText = images.length === 1
        ? `Analyze this ${images[0].kind === "pdf" ? "PDF" : "screenshot"}. Classify it and extract data.`
        : `Analyze these ${images.length} related ${mixedHint} — they show the same job, message thread, document, or event. Synthesize details across all of them into one combined record. Classify the overall content and extract data.`;

      const { text } = await callAI({
        system: "You analyze screenshots and PDFs from a job search. Identify what's shown and extract structured data. When given multiple files, treat them as one related set and merge details. Return only valid JSON — no markdown, no commentary.",
        content: [
          ...fileBlocks,
          { type: "text", text: `${promptText}

Possible types:
- job_posting: a job listing (LinkedIn, Indeed, company careers, etc, including PDF postings)
- linkedin_message: a LinkedIn DM thread (sent or received)
- application_confirmation: "you applied" confirmation
- email_recruiter: email from a recruiter
- email_interview: interview invitation email
- email_offer: offer email or offer letter PDF
- email_rejection: rejection email
- calendar_invite: calendar event for an interview/chat
- other: doesn't fit above

Return JSON in this shape:
{
  "type": "<one of the types above>",
  "confidence": 0.0-1.0,
  "destination": "pipeline" | "outreach" | "meeting",
  "summary": "one-sentence plain description of what the screenshots show",
  "data": {
    "company": "...",
    "role": "...",
    "location": "...",
    "salary": "...",
    "jobType": "...",
    "requirements": ["...", "..."],
    "contact_name": "...",
    "contact_email": "...",
    "contact_title": "...",
    "direction": "outbound" | "inbound",
    "message": "<full message text if visible, concatenated across screenshots in order>",
    "subject": "...",
    "date": "...",
    "when": "ISO datetime if dated event",
    "attendees": "...",
    "status_hint": "saved" | "applied" | "screen" | "interview" | "offer" | "closed"
  }
}

Routing rule:
- job_posting → "pipeline"
- linkedin_message, email_recruiter → "outreach"
- application_confirmation, email_offer, email_rejection → "pipeline"
- email_interview, calendar_invite → "meeting"
- other → "pipeline"

When multiple screenshots show parts of the same thing, merge: combine message text in order, take the most complete details for each field, deduplicate requirements. Transcribe message text verbatim when visible. JSON only.` }
        ],
        maxTokens: 3000,
        feature: "capture",
      });
      const parsed = extractJSON(text);
      if (parsed && parsed.type) {
        setResult(parsed);
      } else {
        setError("Couldn't read the screenshot. Try a clearer one or add manually.");
      }
    } catch (e) {
      setError("Analysis failed: " + formatAiError(e));
    } finally {
      setProcessing(false);
    }
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer?.files?.length) ingestFiles(e.dataTransfer.files);
  };

  const reset = () => {
    images.forEach((i) => i.url && URL.revokeObjectURL(i.url));
    setImages([]);
    setResult(null);
    setError(null);
  };

  const saveResult = (overrides = {}) => {
    if (!result) return;
    const d = { ...result.data, ...overrides };
    const dest = overrides.destination || result.destination;
    if (dest === "pipeline") {
      onSaveApp({
        company: d.company || "Unknown",
        role: d.role || "",
        location: d.location || "",
        salary: d.salary || "",
        jobType: d.jobType || "",
        status: d.status_hint || (result.type === "email_rejection" ? "closed" : result.type === "application_confirmation" ? "applied" : "saved"),
        dateSaved: todayISO(),
        dateApplied: undefined,
        notes: [result.summary, d.requirements?.length ? "Requirements:\n" + d.requirements.map(r => "• " + r).join("\n") : "", d.message ? `Message:\n${d.message}` : ""].filter(Boolean).join("\n\n"),
      });
    } else if (dest === "outreach") {
      onSaveOutreach({
        channel: result.type === "linkedin_message" ? "LinkedIn" : "Gmail",
        contact: d.contact_name || "Unknown",
        contactEmail: d.contact_email || "",
        contactTitle: d.contact_title || "",
        company: d.company || "",
        subject: d.subject || result.summary || "",
        direction: d.direction || "outbound",
        date: d.date || todayISO(),
        notes: d.message || result.summary || "",
        status: "logged",
      });
    } else if (dest === "meeting") {
      onSaveMeeting({
        title: d.subject || `${d.company || "Meeting"}${d.role ? " — " + d.role : ""}`,
        company: d.company || "",
        type: result.type === "calendar_invite" ? "interview" : "interview",
        when: d.when || d.date || "",
        attendees: d.attendees || "",
        notes: d.message || result.summary || "",
      });
    }
    onClose();
  };

  const canAddMore = images.length < MAX_IMAGES;

  return (
    <div style={drawerOverlay} onClick={onClose}>
      <div className="jl-fade jl-scroll" onClick={(e) => e.stopPropagation()} style={{
        position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
        width: "min(720px, 94vw)", maxHeight: "90vh", overflowY: "auto",
        background: "var(--surface)", borderRadius: 16, padding: "28px 32px",
        border: "1px solid var(--line)",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <h2 className="jl-display" style={{ fontSize: 24, fontWeight: 500, margin: 0, letterSpacing: "-0.01em" }}>
            Capture from screenshot or PDF
          </h2>
          <button onClick={onClose} style={iconBtn}><X size={18} /></button>
        </div>
        <p style={{ color: "var(--ink-3)", fontSize: 13, margin: "0 0 22px" }}>
          Paste, drop, or pick up to {MAX_IMAGES} related screenshots and/or PDFs. Great for long LinkedIn threads, multi-page job posts, downloaded offer letters, or an email with its attachment. I'll merge them into one record.
        </p>

        {/* Drop zone — shown when no images yet */}
        {images.length === 0 && (
          <div onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            onClick={() => fileRef.current?.click()}
            style={{
              padding: "56px 24px", textAlign: "center", cursor: "pointer",
              border: `1.5px dashed ${dragOver ? "var(--accent)" : "var(--line)"}`,
              borderRadius: 14, background: dragOver ? "var(--accent-soft)" : "var(--paper-deep)",
              transition: "all 0.15s",
            }}>
            <div style={{
              width: 52, height: 52, borderRadius: "50%", background: "var(--surface)",
              display: "grid", placeItems: "center", margin: "0 auto 14px",
              color: "var(--accent)", border: "1px solid var(--line)",
            }}>
              <Camera size={22} strokeWidth={1.5} />
            </div>
            <div className="jl-display" style={{ fontSize: 18, fontWeight: 500, marginBottom: 4 }}>
              Drop screenshots or PDFs here
            </div>
            <div style={{ fontSize: 13, color: "var(--ink-3)" }}>
              up to {MAX_IMAGES} files · click to choose · or <span className="jl-mono" style={{ fontSize: 12, padding: "1px 6px", background: "var(--surface)", borderRadius: 4, border: "1px solid var(--line)" }}>⌘V</span> to paste an image
            </div>
            <input ref={fileRef} type="file" accept="image/*,application/pdf,.pdf" multiple
              style={{ display: "none" }}
              onChange={(e) => ingestFiles(e.target.files)} />
          </div>
        )}

        {/* Image preview strip — shown when images present and no result yet */}
        {images.length > 0 && !result && (
          <div>
            <div style={{ marginBottom: 14 }}>
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                marginBottom: 8,
              }}>
                <Label>{images.length} of {MAX_IMAGES} {images.length === 1 ? "screenshot" : "screenshots"}</Label>
                {canAddMore && (
                  <button onClick={() => fileRef.current?.click()} style={ghostBtnSm}>
                    <Plus size={12} /> Add another
                  </button>
                )}
              </div>
              <div style={{
                display: "grid",
                gridTemplateColumns: `repeat(${Math.max(images.length, 1)}, 1fr)`,
                gap: 8,
              }}>
                {images.map((img, idx) => (
                  <div key={img.id} style={{
                    position: "relative",
                    borderRadius: 10, overflow: "hidden",
                    border: "1px solid var(--line)", background: "var(--paper-deep)",
                    aspectRatio: "4 / 3",
                  }}>
                    {img.kind === "pdf" ? (
                      <div style={{
                        width: "100%", height: "100%",
                        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                        padding: 12, gap: 6, background: "var(--paper-deep)",
                      }}>
                        <FileText size={28} strokeWidth={1.4} style={{ color: "var(--accent)" }} />
                        <div style={{
                          fontSize: 11, color: "var(--ink-2)", fontWeight: 500,
                          textAlign: "center", lineHeight: 1.3,
                          maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis",
                          wordBreak: "break-word",
                        }}>{img.name}</div>
                        <div style={{
                          fontSize: 10, color: "var(--ink-3)", textTransform: "uppercase",
                          letterSpacing: "0.1em", fontWeight: 500,
                        }}>PDF</div>
                      </div>
                    ) : (
                      <img src={img.url} alt={`screenshot ${idx + 1}`}
                        style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }} />
                    )}
                    <div style={{
                      position: "absolute", top: 6, left: 6,
                      background: "rgba(31,27,22,0.7)", color: "white",
                      fontSize: 11, padding: "1px 7px", borderRadius: 999,
                      fontWeight: 500,
                    }}>{idx + 1}</div>
                    <button onClick={(e) => { e.stopPropagation(); removeImage(img.id); }}
                      title="Remove" style={{
                        position: "absolute", top: 6, right: 6,
                        width: 24, height: 24, borderRadius: "50%",
                        background: "rgba(31,27,22,0.75)", color: "white",
                        border: "none", cursor: "pointer",
                        display: "grid", placeItems: "center",
                      }}>
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
              <input ref={fileRef} type="file" accept="image/*,application/pdf,.pdf" multiple
                style={{ display: "none" }}
                onChange={(e) => { ingestFiles(e.target.files); e.target.value = ""; }} />
            </div>

            <div style={{ display: "flex", gap: 8, justifyContent: "space-between", alignItems: "center" }}>
              <button onClick={reset} style={ghostBtn}>
                <RefreshCw size={14} /> Start over
              </button>
              <button onClick={analyze} disabled={processing}
                style={{ ...primaryBtn, background: "var(--accent)", color: "white", opacity: processing ? 0.7 : 1 }}>
                {processing ? <RefreshCw size={15} className="jl-spin" /> : <Sparkles size={15} />}
                {processing
                  ? (images.length > 1 ? "Reading the files…" : "Reading the file…")
                  : (images.length > 1 ? `Analyze ${images.length} files` : "Analyze with AI")}
              </button>
            </div>
            {processing && (
              <div className="jl-pulse" style={{ marginTop: 14, fontSize: 13, color: "var(--ink-3)", textAlign: "center" }}>
                {images.length > 1
                  ? "Merging details across files…"
                  : "Identifying type and pulling out details…"}
              </div>
            )}
          </div>
        )}

        {result && (
          <CaptureResult result={result} images={images}
            onSave={saveResult} onReset={reset} />
        )}

        {error && (
          <div style={{
            marginTop: 14, padding: "10px 14px", borderRadius: 8,
            background: "var(--rose-soft)", color: "var(--rose)",
            fontSize: 13, display: "flex", alignItems: "center", gap: 8,
          }}>
            <AlertCircle size={14} /> {error}
          </div>
        )}
      </div>
    </div>
  );
}

function CaptureResult({ result, images, onSave, onReset }) {
  const [destination, setDestination] = useState(result.destination || "pipeline");
  const [data, setData] = useState(() => ({
    ...(result.data || {}),
    status_hint: result.data?.status_hint || (result.type === "email_rejection" ? "closed" : "saved"),
  }));
  const update = (k, v) => setData({ ...data, [k]: v });

  const typeLabels = {
    job_posting: "Job posting",
    linkedin_message: "LinkedIn message",
    application_confirmation: "Application confirmation",
    email_recruiter: "Recruiter email",
    email_interview: "Interview email",
    email_offer: "Offer",
    email_rejection: "Rejection",
    calendar_invite: "Calendar invite",
    other: "Other",
  };

  return (
    <div>
      <div style={{
        display: "flex", gap: 14, marginBottom: 18,
        padding: "12px 14px", background: "var(--paper-deep)", borderRadius: 10,
      }}>
        <div style={{
          display: "flex", gap: 4, flexShrink: 0,
        }}>
          {images.map((img, idx) => {
            const common = {
              width: 60, height: 60, borderRadius: 6,
              border: "1px solid var(--line)",
              marginLeft: idx > 0 ? -16 : 0,
              boxShadow: idx > 0 ? "-2px 0 0 var(--paper-deep)" : "none",
              zIndex: images.length - idx,
              position: "relative",
            };
            if (img.kind === "pdf") {
              return (
                <div key={img.id} style={{
                  ...common, background: "var(--paper-deep)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: "var(--accent)",
                }}>
                  <FileText size={22} strokeWidth={1.4} />
                </div>
              );
            }
            return (
              <img key={img.id} src={img.url} alt=""
                style={{ ...common, objectFit: "cover" }} />
            );
          })}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
            <span style={{
              fontSize: 11, padding: "2px 8px", borderRadius: 999,
              background: "var(--accent-soft)", color: "var(--accent)", fontWeight: 500,
            }}>{typeLabels[result.type] || result.type}</span>
            <span style={{ fontSize: 11, color: "var(--ink-3)" }}>
              {Math.round((result.confidence || 0) * 100)}% confidence
            </span>
            {images.length > 1 && (
              <span style={{ fontSize: 11, color: "var(--ink-3)" }}>
                · merged from {images.length} files
              </span>
            )}
          </div>
          <div style={{ fontSize: 13, color: "var(--ink-2)", lineHeight: 1.5 }}>
            {result.summary}
          </div>
        </div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <Label>Save to</Label>
        <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
          {[
            { id: "pipeline", label: "Pipeline", icon: LayoutGrid },
            { id: "outreach", label: "Outreach", icon: Send },
            { id: "meeting", label: "Meeting", icon: Calendar },
          ].map((d) => {
            const Icon = d.icon;
            const active = destination === d.id;
            return (
              <button key={d.id} onClick={() => setDestination(d.id)} style={{
                flex: 1, padding: "9px 12px", borderRadius: 8,
                border: `1px solid ${active ? "var(--ink)" : "var(--line)"}`,
                background: active ? "var(--ink)" : "var(--surface)",
                color: active ? "var(--paper)" : "var(--ink-2)",
                fontSize: 13, fontWeight: 500, cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              }}>
                <Icon size={14} /> {d.label}
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ display: "grid", gap: 10 }}>
        {destination === "pipeline" && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <Field label="Company">
                <input value={data.company || ""} onChange={(e) => update("company", e.target.value)} style={inputBase} />
              </Field>
              <Field label="Role">
                <input value={data.role || ""} onChange={(e) => update("role", e.target.value)} style={inputBase} />
              </Field>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <Field label="Location">
                <input value={data.location || ""} onChange={(e) => update("location", e.target.value)} style={inputBase} />
              </Field>
              <Field label="Salary">
                <input value={data.salary || ""} onChange={(e) => update("salary", e.target.value)} style={inputBase} />
              </Field>
            </div>
            <Field label="Status">
              <select value={data.status_hint || "saved"} onChange={(e) => update("status_hint", e.target.value)} style={inputBase}>
                {STATUSES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            </Field>
          </>
        )}

        {destination === "outreach" && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <Field label="Contact">
                <input value={data.contact_name || ""} onChange={(e) => update("contact_name", e.target.value)} style={inputBase} />
              </Field>
              <Field label="Company">
                <input value={data.company || ""} onChange={(e) => update("company", e.target.value)} style={inputBase} />
              </Field>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <Field label="Direction">
                <select value={data.direction || "outbound"} onChange={(e) => update("direction", e.target.value)} style={inputBase}>
                  <option value="outbound">I sent it</option>
                  <option value="inbound">They sent it</option>
                </select>
              </Field>
              <Field label="Date">
                <input type="date" value={data.date || todayISO()} onChange={(e) => update("date", e.target.value)} style={inputBase} />
              </Field>
            </div>
            <Field label="Message">
              <textarea value={data.message || ""} onChange={(e) => update("message", e.target.value)}
                style={{ ...inputBase, minHeight: 110, resize: "vertical" }} />
            </Field>
          </>
        )}

        {destination === "meeting" && (
          <>
            <Field label="Title">
              <input value={data.subject || ""} onChange={(e) => update("subject", e.target.value)} style={inputBase} />
            </Field>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <Field label="Company">
                <input value={data.company || ""} onChange={(e) => update("company", e.target.value)} style={inputBase} />
              </Field>
              <Field label="When">
                <input type="datetime-local" value={data.when ? new Date(data.when).toISOString().slice(0, 16) : ""}
                  onChange={(e) => update("when", e.target.value)} style={inputBase} />
              </Field>
            </div>
            <Field label="Attendees">
              <input value={data.attendees || ""} onChange={(e) => update("attendees", e.target.value)} style={inputBase} />
            </Field>
            <Field label="Notes">
              <textarea value={data.message || ""} onChange={(e) => update("message", e.target.value)}
                style={{ ...inputBase, minHeight: 70, resize: "vertical" }} />
            </Field>
          </>
        )}
      </div>

      <div style={{ display: "flex", gap: 8, justifyContent: "space-between", alignItems: "center", marginTop: 20 }}>
        <button onClick={onReset} style={ghostBtn}>
          <RefreshCw size={14} /> Start over
        </button>
        <button onClick={() => onSave({ ...data, destination })} style={{ ...primaryBtn, background: "var(--accent)", color: "white" }}>
          <Check size={15} /> Save to {destination}
        </button>
      </div>
    </div>
  );
}


/* ============================================================
   COMPANIES — focused list of companies you're targeting
   ============================================================ */
function aggregateCompanies(stored, applications, contacts) {
  const map = new Map();
  const norm = (s) => (s || "").toLowerCase().trim();

  // Seed with stored manual + metadata entries
  stored.forEach((c) => {
    if (!c.name) return;
    map.set(norm(c.name), {
      ...c, name: c.name,
      applications: [], contacts: [],
    });
  });

  // Merge applications
  applications.forEach((a) => {
    if (!a.company) return;
    const key = norm(a.company);
    if (!map.has(key)) {
      map.set(key, {
        id: null, name: a.company, starred: false,
        notes: "", research: null, manuallyAdded: false,
        applications: [], contacts: [],
      });
    }
    map.get(key).applications.push(a);
  });

  // Merge contacts
  contacts.forEach((co) => {
    if (!co.company) return;
    const key = norm(co.company);
    if (!map.has(key)) {
      map.set(key, {
        id: null, name: co.company, starred: false,
        notes: "", research: null, manuallyAdded: false,
        applications: [], contacts: [],
      });
    }
    map.get(key).contacts.push(co);
  });

  // Compute derived fields
  return Array.from(map.values()).map((c) => {
    const lastActivity = Math.max(
      ...c.applications.map((a) => a.updatedAt || a.createdAt || new Date(a.dateApplied || a.dateSaved || 0).getTime() || 0),
      ...c.contacts.map((co) => co.updatedAt || co.sentAt || co.addedAt || 0),
      c.updatedAt || 0,
    );
    const stages = c.applications.map((a) => a.status).filter(Boolean);
    const stageOrder = ["offer", "interview", "screen", "applied", "saved", "closed"];
    const latestStage = stageOrder.find((s) => stages.includes(s)) || null;
    return {
      ...c,
      appCount: c.applications.length,
      contactCount: c.contacts.length,
      lastActivity,
      latestStage,
    };
  });
}

function CompaniesView({ companies, applications, contacts, upsertCompany, deleteCompany, upsertApp, setTab, flash }) {
  const [filter, setFilter] = useState("all"); // "all" | "starred" | "applied" | "contacts"
  const [sortBy, setSortBy] = useState("activity"); // "activity" | "name" | "apps"
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);
  const [adding, setAdding] = useState(false);

  const aggregated = useMemo(
    () => aggregateCompanies(companies, applications, contacts),
    [companies, applications, contacts]
  );

  const filteredSorted = useMemo(() => {
    let list = aggregated;
    if (filter === "starred") list = list.filter((c) => c.starred);
    else if (filter === "applied") list = list.filter((c) => c.appCount > 0);
    else if (filter === "contacts") list = list.filter((c) => c.contactCount > 0);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((c) => c.name.toLowerCase().includes(q) || (c.notes || "").toLowerCase().includes(q));
    }
    return [...list].sort((a, b) => {
      // Starred always first within group
      if (a.starred !== b.starred) return a.starred ? -1 : 1;
      if (sortBy === "name") return a.name.localeCompare(b.name);
      if (sortBy === "apps") return b.appCount - a.appCount;
      return (b.lastActivity || 0) - (a.lastActivity || 0);
    });
  }, [aggregated, filter, sortBy, search]);

  const toggleStar = (c) => {
    upsertCompany({ ...c, starred: !c.starred, name: c.name });
  };

  const starred = aggregated.filter((c) => c.starred).length;
  const appliedTo = aggregated.filter((c) => c.appCount > 0).length;

  return (
    <div className="jl-fade">
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        marginBottom: 22, gap: 16, flexWrap: "wrap",
      }}>
        <div>
          <h1 className="jl-display" style={{ fontSize: 38, fontWeight: 400, margin: 0, letterSpacing: "-0.02em" }}>
            Companies
          </h1>
          <p style={{ color: "var(--ink-3)", fontSize: 14, margin: "4px 0 0" }}>
            {aggregated.length === 0
              ? "Your target list builds itself as you apply and add contacts"
              : `${aggregated.length} total · ${appliedTo} applied to · ${starred} ${starred === 1 ? "focus target" : "focus targets"}`}
          </p>
        </div>
        <button onClick={() => setAdding(true)} style={primaryBtn}>
          <Plus size={15} /> Add a target
        </button>
      </div>

      {aggregated.length === 0 ? (
        <CompaniesEmpty onAdd={() => setAdding(true)} setTab={setTab} />
      ) : (
        <>
          <div style={{
            display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap",
            alignItems: "center", justifyContent: "space-between",
          }}>
            <div style={{ display: "flex", gap: 4, background: "var(--paper-deep)", padding: 4, borderRadius: 10 }}>
              {[
                { id: "all", label: "All", c: aggregated.length },
                { id: "starred", label: "★ Focus list", c: starred },
                { id: "applied", label: "Applied to", c: appliedTo },
                { id: "contacts", label: "Has contacts", c: aggregated.filter((c) => c.contactCount > 0).length },
              ].map((f) => {
                const active = filter === f.id;
                return (
                  <button key={f.id} onClick={() => setFilter(f.id)} style={{
                    padding: "6px 12px", borderRadius: 7, border: "none", cursor: "pointer",
                    background: active ? "var(--surface)" : "transparent",
                    color: active ? "var(--ink)" : "var(--ink-3)",
                    fontSize: 13, fontWeight: 500,
                    display: "flex", alignItems: "center", gap: 6,
                  }}>
                    {f.label}
                    <span style={{ fontSize: 11, color: "var(--ink-3)" }}>{f.c}</span>
                  </button>
                );
              })}
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <div style={{ position: "relative" }}>
                <Search size={14} style={{ position: "absolute", left: 12, top: 11, color: "var(--ink-4)" }} />
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Filter…"
                  style={{ ...inputBase, padding: "8px 12px 8px 32px", width: 170, fontSize: 13 }} />
              </div>
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}
                style={{ ...inputBase, width: "auto", padding: "8px 10px", fontSize: 13, cursor: "pointer" }}>
                <option value="activity">Recent activity</option>
                <option value="name">Name (A–Z)</option>
                <option value="apps">Most applications</option>
              </select>
            </div>
          </div>

          {filteredSorted.length === 0 ? (
            <div style={{ padding: "30px", textAlign: "center", color: "var(--ink-3)", fontSize: 13 }}>
              No matches.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {filteredSorted.map((c) => (
                <CompanyRow key={c.name.toLowerCase()} company={c}
                  onOpen={() => setSelected(c)}
                  onStar={(e) => { e.stopPropagation(); toggleStar(c); }} />
              ))}
            </div>
          )}
        </>
      )}

      {adding && (
        <Modal onClose={() => setAdding(false)} title="Add a target company">
          <AddCompanyForm onSave={(c) => {
            upsertCompany({ ...c, manuallyAdded: true, starred: true });
            setAdding(false);
            flash(`Added ${c.name} to focus list`);
          }} onCancel={() => setAdding(false)} />
        </Modal>
      )}

      {selected && (
        <CompanyDetailDrawer
          company={selected}
          onClose={() => setSelected(null)}
          upsertCompany={upsertCompany}
          deleteCompany={deleteCompany}
          upsertApp={upsertApp}
          setTab={setTab}
          flash={flash}
        />
      )}
    </div>
  );
}

function CompanyRow({ company, onOpen, onStar }) {
  const stageMeta = company.latestStage ? statusMeta(company.latestStage) : null;
  return (
    <div onClick={onOpen} style={{
      background: "var(--surface)", border: `1px solid ${company.starred ? "var(--accent)" : "var(--line)"}`,
      borderRadius: 10, padding: "12px 16px", cursor: "pointer",
      display: "flex", alignItems: "center", gap: 14,
    }}>
      <button onClick={onStar} title={company.starred ? "Remove from focus list" : "Add to focus list"}
        style={{
          width: 32, height: 32, borderRadius: 8, border: "none", cursor: "pointer",
          background: company.starred ? "var(--accent-soft)" : "var(--paper-deep)",
          color: company.starred ? "var(--accent)" : "var(--ink-4)",
          display: "grid", placeItems: "center", flexShrink: 0, fontSize: 16,
        }}>
        {company.starred ? "★" : "☆"}
      </button>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
          <span className="jl-display" style={{ fontSize: 16, fontWeight: 500, color: "var(--ink)" }}>
            {company.name}
          </span>
          {stageMeta && (
            <span style={{
              fontSize: 11, padding: "1px 8px", borderRadius: 999,
              background: "var(--paper-deep)", color: statusDot(company.latestStage),
              fontWeight: 500,
            }}>{stageMeta.label}</span>
          )}
        </div>
        <div style={{ fontSize: 13, color: "var(--ink-3)", marginTop: 3 }}>
          {company.appCount > 0 && (
            <span>{company.appCount} {company.appCount === 1 ? "role" : "roles"}</span>
          )}
          {company.appCount > 0 && company.contactCount > 0 && <span> · </span>}
          {company.contactCount > 0 && (
            <span>{company.contactCount} {company.contactCount === 1 ? "contact" : "contacts"}</span>
          )}
          {company.appCount === 0 && company.contactCount === 0 && (
            <span style={{ fontStyle: "italic" }}>Target — not contacted yet</span>
          )}
          {company.lastActivity > 0 && (
            <>
              <span> · </span>
              <span>last activity {daysSince(new Date(company.lastActivity).toISOString())}d ago</span>
            </>
          )}
        </div>
      </div>
      <ChevronRight size={14} style={{ color: "var(--ink-4)", flexShrink: 0 }} />
    </div>
  );
}

function statusMeta(id) {
  return STATUSES.find((s) => s.id === id) || STATUSES[0];
}

function AddCompanyForm({ onSave, onCancel }) {
  const [form, setForm] = useState({ name: "", notes: "", whyTarget: "" });
  const u = (k, v) => setForm({ ...form, [k]: v });
  return (
    <div style={{ display: "grid", gap: 12 }}>
      <Field label="Company name" required>
        <input value={form.name} onChange={(e) => u("name", e.target.value)} style={inputBase}
          placeholder="e.g. Vercel" autoFocus />
      </Field>
      <Field label="Why this company?">
        <textarea value={form.whyTarget} onChange={(e) => u("whyTarget", e.target.value)}
          style={{ ...inputBase, minHeight: 60, resize: "vertical" }}
          placeholder="What draws you to them — mission, team, products, growth stage…" />
      </Field>
      <Field label="Notes">
        <textarea value={form.notes} onChange={(e) => u("notes", e.target.value)}
          style={{ ...inputBase, minHeight: 50, resize: "vertical" }} placeholder="optional" />
      </Field>
      <div style={{
        padding: "10px 14px", borderRadius: 8, background: "var(--accent-soft)",
        color: "var(--accent-deep)", fontSize: 12, display: "flex", alignItems: "center", gap: 8,
      }}>
        <Sparkles size={13} />
        <span>This company will be starred (added to your focus list) by default.</span>
      </div>
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 6 }}>
        <button onClick={onCancel} style={ghostBtn}>Cancel</button>
        <button onClick={() => form.name && onSave(form)} disabled={!form.name}
          style={{ ...primaryBtn, opacity: !form.name ? 0.5 : 1 }}>
          Save
        </button>
      </div>
    </div>
  );
}

function CompanyDetailDrawer({ company, onClose, upsertCompany, deleteCompany, upsertApp, setTab, flash }) {
  const [notes, setNotes] = useState(company.notes || "");
  const [whyTarget, setWhyTarget] = useState(company.whyTarget || "");
  const [editing, setEditing] = useState(false);
  const [researching, setResearching] = useState(false);

  const doResearch = async () => {
    setResearching(true);
    try {
      const { text } = await callAI({
        system: "You research companies for a job search. Use web search. Return only JSON.",
        content: `Research this company for a job search context:
Company: ${company.name}

Return JSON:
{
  "summary": "3-4 sentences about what they do, business model, and culture (verified from search)",
  "size": "approximate employee count or revenue range if findable",
  "stage": "startup / growth / public / etc",
  "recent_news": ["2-4 specific recent items: funding, launches, leadership changes, layoffs — be concrete with dates if possible"],
  "why_target": ["3-5 specific reasons a job-seeker might target this company right now"],
  "watch_outs": ["1-2 things to be aware of, if any — recent layoffs, mission drift, glassdoor issues — only if there's real signal"],
  "careers_url": "best URL to their careers page if findable"
}

Be specific. JSON only.`,
        tools: [{ type: "web_search_20250305", name: "web_search" }],
        maxTokens: 2500,
        feature: "contact_research",
      });
      const parsed = extractJSON(text);
      if (parsed) {
        upsertCompany({
          ...company,
          name: company.name,
          research: { ...parsed, completed: true, completedAt: Date.now() },
        });
        flash(`Researched ${company.name}`);
      } else {
        flash("Couldn't extract research", "err");
      }
    } catch (e) {
      flash("Research failed: " + e.message, "err");
    } finally {
      setResearching(false);
    }
  };

  const saveText = () => {
    upsertCompany({ ...company, name: company.name, notes, whyTarget });
    setEditing(false);
    flash("Saved");
  };

  const canDelete = company.appCount === 0 && company.contactCount === 0 && company.manuallyAdded;
  const research = company.research;

  return (
    <div style={drawerOverlay} onClick={onClose}>
      <div className="jl-fade jl-scroll" onClick={(e) => e.stopPropagation()} style={{
        position: "absolute", top: 0, right: 0, bottom: 0,
        width: "min(620px, 94vw)", background: "var(--surface)",
        borderLeft: "1px solid var(--line)", padding: "28px 32px",
        overflowY: "auto",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 18 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
              <button onClick={() => upsertCompany({ ...company, name: company.name, starred: !company.starred })}
                style={{
                  background: company.starred ? "var(--accent-soft)" : "transparent",
                  color: company.starred ? "var(--accent)" : "var(--ink-3)",
                  border: `1px solid ${company.starred ? "var(--accent)" : "var(--line)"}`,
                  padding: "4px 10px", borderRadius: 8, cursor: "pointer", fontSize: 12,
                  fontWeight: 500, display: "inline-flex", alignItems: "center", gap: 4,
                  fontFamily: "inherit",
                }}>
                {company.starred ? "★ Focus list" : "☆ Add to focus list"}
              </button>
            </div>
            <h2 className="jl-display" style={{ fontSize: 30, fontWeight: 400, margin: 0, lineHeight: 1.1, letterSpacing: "-0.02em" }}>
              {company.name}
            </h2>
            {research?.careers_url && (
              <a href={research.careers_url} target="_blank" rel="noreferrer" style={{
                display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12,
                color: "var(--accent)", textDecoration: "none", marginTop: 6,
              }}>
                <ExternalLink size={11} /> Careers page
              </a>
            )}
          </div>
          <button onClick={onClose} style={iconBtn}><X size={18} /></button>
        </div>

        {/* Stats row */}
        <div style={{
          display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20,
        }}>
          <Fact icon={Briefcase} label="Applications" value={company.appCount} />
          <Fact icon={Users} label="Contacts" value={company.contactCount} />
        </div>

        {/* Research section */}
        <div style={{ marginBottom: 22 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <Label>Research</Label>
            <button onClick={doResearch} disabled={researching} style={{
              ...ghostBtnSm, fontSize: 12,
              opacity: researching ? 0.6 : 1,
            }}>
              {researching ? <RefreshCw size={11} className="jl-spin" /> : <Sparkles size={11} />}
              {researching ? "Researching…" : research ? "Re-research" : "Research with AI"}
            </button>
          </div>
          {research?.completed ? (
            <div style={{
              padding: "14px 16px", background: "var(--amber-soft)",
              borderRadius: 10, fontSize: 13, color: "var(--ink-2)", lineHeight: 1.6,
            }}>
              <p style={{ margin: "0 0 10px" }}>{research.summary}</p>
              {(research.size || research.stage) && (
                <div style={{ fontSize: 12, color: "var(--ink-3)", marginBottom: 10 }}>
                  {[research.size, research.stage].filter(Boolean).join(" · ")}
                </div>
              )}
              {research.recent_news?.length > 0 && (
                <div style={{ marginTop: 10 }}>
                  <div style={{ fontSize: 11, color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 4, fontWeight: 500 }}>Recent</div>
                  {research.recent_news.map((n, i) => (
                    <div key={i} style={{ fontSize: 12, paddingLeft: 12, position: "relative" }}>
                      <span style={{ position: "absolute", left: 0, color: "var(--amber)" }}>·</span>{n}
                    </div>
                  ))}
                </div>
              )}
              {research.why_target?.length > 0 && (
                <div style={{ marginTop: 10 }}>
                  <div style={{ fontSize: 11, color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 4, fontWeight: 500 }}>Why target</div>
                  {research.why_target.map((n, i) => (
                    <div key={i} style={{ fontSize: 12, paddingLeft: 12, position: "relative" }}>
                      <span style={{ position: "absolute", left: 0, color: "var(--moss)" }}>·</span>{n}
                    </div>
                  ))}
                </div>
              )}
              {research.watch_outs?.length > 0 && (
                <div style={{ marginTop: 10 }}>
                  <div style={{ fontSize: 11, color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 4, fontWeight: 500 }}>Watch-outs</div>
                  {research.watch_outs.map((n, i) => (
                    <div key={i} style={{ fontSize: 12, paddingLeft: 12, position: "relative" }}>
                      <span style={{ position: "absolute", left: 0, color: "var(--rose)" }}>·</span>{n}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div style={{
              padding: "16px", background: "var(--paper)", borderRadius: 10,
              fontSize: 13, color: "var(--ink-3)", textAlign: "center",
              border: "1px dashed var(--line)",
            }}>
              Hit "Research with AI" — I'll pull together what they do, recent news, and reasons to target them.
            </div>
          )}
        </div>

        {/* Your notes */}
        <div style={{ marginBottom: 22 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
            <Label>Your notes</Label>
            {!editing && <button onClick={() => setEditing(true)} style={ghostBtnSm}>Edit</button>}
          </div>
          {editing ? (
            <div style={{ display: "grid", gap: 10 }}>
              <Field label="Why this company">
                <textarea value={whyTarget} onChange={(e) => setWhyTarget(e.target.value)}
                  style={{ ...inputBase, minHeight: 60, resize: "vertical" }} />
              </Field>
              <Field label="Notes">
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)}
                  style={{ ...inputBase, minHeight: 80, resize: "vertical" }} />
              </Field>
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button onClick={() => { setNotes(company.notes || ""); setWhyTarget(company.whyTarget || ""); setEditing(false); }} style={ghostBtn}>Cancel</button>
                <button onClick={saveText} style={primaryBtn}>Save</button>
              </div>
            </div>
          ) : (
            <div style={{
              padding: "12px 14px", background: "var(--paper)", borderRadius: 8,
              fontSize: 13, color: "var(--ink-2)", whiteSpace: "pre-wrap",
              border: "1px solid var(--line-soft)", lineHeight: 1.6, minHeight: 40,
            }}>
              {whyTarget && (
                <div style={{ marginBottom: notes ? 10 : 0 }}>
                  <div style={{ fontSize: 11, color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 3, fontWeight: 500 }}>Why this company</div>
                  {whyTarget}
                </div>
              )}
              {notes && (
                <div>
                  {whyTarget && <div style={{ fontSize: 11, color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 3, fontWeight: 500 }}>Notes</div>}
                  {notes}
                </div>
              )}
              {!whyTarget && !notes && <span style={{ color: "var(--ink-4)", fontStyle: "italic" }}>No notes yet</span>}
            </div>
          )}
        </div>

        {/* Linked applications */}
        {company.applications.length > 0 && (
          <div style={{ marginBottom: 18 }}>
            <Label>Applications ({company.applications.length})</Label>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 6 }}>
              {company.applications.map((a) => {
                const sm = statusMeta(a.status);
                return (
                  <div key={a.id} style={{
                    padding: "8px 12px", background: "var(--paper)", borderRadius: 6,
                    border: "1px solid var(--line-soft)",
                    display: "flex", alignItems: "center", gap: 10,
                  }}>
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: statusDot(a.status) }} />
                    <span style={{ fontSize: 13, color: "var(--ink)", flex: 1 }}>{a.role || "—"}</span>
                    <span style={{ fontSize: 11, color: "var(--ink-3)" }}>{sm.label}</span>
                  </div>
                );
              })}
            </div>
            <button onClick={() => setTab("pipeline")} style={{
              ...ghostBtnSm, fontSize: 12, marginTop: 8,
            }}>
              View in pipeline <ChevronRight size={10} />
            </button>
          </div>
        )}

        {/* Linked contacts */}
        {company.contacts.length > 0 && (
          <div style={{ marginBottom: 18 }}>
            <Label>Contacts ({company.contacts.length})</Label>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 6 }}>
              {company.contacts.map((co) => (
                <div key={co.id} style={{
                  padding: "8px 12px", background: "var(--paper)", borderRadius: 6,
                  border: "1px solid var(--line-soft)",
                  display: "flex", alignItems: "center", gap: 10,
                }}>
                  <div style={{
                    width: 24, height: 24, borderRadius: "50%", background: "var(--paper-deep)",
                    display: "grid", placeItems: "center", color: "var(--ink-2)",
                    fontSize: 10, fontWeight: 500,
                  }}>
                    {(co.name || "?").split(/\s+/).map((n) => n[0]).slice(0, 2).join("").toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, color: "var(--ink)" }}>{co.name}</div>
                    {co.role && <div style={{ fontSize: 11, color: "var(--ink-3)" }}>{co.role}</div>}
                  </div>
                  <span style={{
                    fontSize: 10, padding: "1px 6px", borderRadius: 999,
                    background: "var(--paper-deep)", color: "var(--ink-3)", fontWeight: 500,
                  }}>{co.status}</span>
                </div>
              ))}
            </div>
            <button onClick={() => setTab("campaign")} style={{
              ...ghostBtnSm, fontSize: 12, marginTop: 8,
            }}>
              View in campaign <ChevronRight size={10} />
            </button>
          </div>
        )}

        {canDelete && (
          <button onClick={() => { if (confirm("Remove this company?")) { deleteCompany(company.id); onClose(); flash("Removed"); } }} style={{
            color: "var(--rose)", background: "transparent", border: "1px solid var(--line)",
            padding: "8px 14px", borderRadius: 8, fontSize: 13, cursor: "pointer",
            display: "inline-flex", alignItems: "center", gap: 6, marginTop: 10,
          }}>
            <Trash2 size={13} /> Remove company
          </button>
        )}
      </div>
    </div>
  );
}

function CompaniesEmpty({ onAdd, setTab }) {
  return (
    <div style={{
      padding: "60px 40px", textAlign: "center",
      border: "1px dashed var(--line)", borderRadius: 16,
      background: "var(--paper-deep)",
    }}>
      <div style={{
        width: 56, height: 56, borderRadius: "50%", background: "var(--accent-soft)",
        display: "grid", placeItems: "center", margin: "0 auto 18px", color: "var(--accent)",
      }}>
        <Briefcase size={24} strokeWidth={1.5} />
      </div>
      <h3 className="jl-display" style={{ fontSize: 24, fontWeight: 400, margin: "0 0 8px", letterSpacing: "-0.01em" }}>
        Build your focus list
      </h3>
      <p style={{
        color: "var(--ink-3)", fontSize: 14, margin: "0 auto 24px",
        maxWidth: 460, lineHeight: 1.55,
      }}>
        Companies show up here automatically when you apply to a role or add a contact. You can also add targets directly — star the ones you want to go after seriously.
      </p>
      <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
        <button onClick={() => setTab("pipeline")} style={ghostBtn}>
          <LayoutGrid size={14} /> Apply to something
        </button>
        <button onClick={onAdd} style={primaryBtn}>
          <Plus size={15} /> Add a target now
        </button>
      </div>
    </div>
  );
}

/* ============================================================
   CAMPAIGN — bulk outreach with AI research and drafting
   ============================================================ */
const CONTACT_STATUSES = [
  { id: "new", label: "New", color: "var(--ink-3)" },
  { id: "researched", label: "Researched", color: "var(--amber)" },
  { id: "drafted", label: "Drafted", color: "var(--accent)" },
  { id: "sent", label: "Sent", color: "var(--moss)" },
  { id: "replied", label: "Replied", color: "var(--moss)" },
  { id: "meeting_scheduled", label: "Meeting set", color: "var(--moss)" },
  { id: "no_response", label: "No response", color: "var(--ink-4)" },
  { id: "not_interested", label: "Closed", color: "var(--ink-4)" },
];
const contactStatusMeta = (id) => CONTACT_STATUSES.find((s) => s.id === id) || CONTACT_STATUSES[0];

const SPREADSHEET_CELL = {
  ...inputBase,
  border: "none",
  borderRadius: 0,
  padding: "7px 10px",
  fontSize: 13,
  background: "transparent",
  minWidth: 0,
};

function exportContactsCSV(contacts) {
  const headers = ["name", "email", "company", "role", "linkedin", "status", "notes"];
  const escape = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const lines = [
    headers.join(","),
    ...contacts.map((c) => headers.map((h) => escape(c[h])).join(",")),
  ];
  const blob = new Blob([lines.join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `ledger-contacts-${todayISO()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function ContactsSpreadsheetView({ contacts, upsertContact, deleteContact, flash }) {
  const [filterText, setFilterText] = useState("");

  const filtered = useMemo(() => {
    if (!filterText.trim()) return contacts;
    const q = filterText.toLowerCase();
    return contacts.filter((c) =>
      (c.name || "").toLowerCase().includes(q) ||
      (c.email || "").toLowerCase().includes(q) ||
      (c.company || "").toLowerCase().includes(q) ||
      (c.role || "").toLowerCase().includes(q)
    );
  }, [contacts, filterText]);

  const updateField = (contact, field, value) => {
    upsertContact({ ...contact, [field]: value });
  };

  const addRow = () => {
    upsertContact({ name: "", email: "", company: "", role: "", linkedin: "", notes: "", status: "new", source: "spreadsheet" });
    flash("New row added — click a cell to edit");
  };

  const columns = [
    { key: "name", label: "Name", width: 160 },
    { key: "email", label: "Email", width: 220 },
    { key: "company", label: "Company", width: 150 },
    { key: "role", label: "Title / role", width: 150 },
    { key: "linkedin", label: "LinkedIn", width: 180 },
    { key: "status", label: "Status", width: 130 },
    { key: "notes", label: "Notes", width: 200 },
  ];

  return (
    <div className="jl-fade">
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        marginBottom: 22, gap: 16, flexWrap: "wrap",
      }}>
        <div>
          <h1 className="jl-display" style={{ fontSize: 38, fontWeight: 400, margin: 0, letterSpacing: "-0.02em" }}>
            Contacts
          </h1>
          <p style={{ color: "var(--ink-3)", fontSize: 14, margin: "4px 0 0" }}>
            {contacts.length === 0
              ? "Fills in automatically from outreach — or add rows by hand"
              : `${contacts.length} ${contacts.length === 1 ? "contact" : "contacts"} · synced from outreach · edits save automatically`}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ position: "relative" }}>
            <Search size={14} style={{ position: "absolute", left: 12, top: 11, color: "var(--ink-4)" }} />
            <input value={filterText} onChange={(e) => setFilterText(e.target.value)} placeholder="Filter…"
              style={{ ...inputBase, padding: "8px 12px 8px 32px", width: 180, fontSize: 13 }} />
          </div>
          {contacts.length > 0 && (
            <button onClick={() => { exportContactsCSV(contacts); flash("Exported CSV"); }} style={ghostBtn}>
              <Download size={14} /> Export CSV
            </button>
          )}
          <button onClick={addRow} style={primaryBtn}>
            <Plus size={15} /> Add row
          </button>
        </div>
      </div>

      {contacts.length === 0 ? (
        <div style={{
          padding: "60px 40px", textAlign: "center",
          border: "1px dashed var(--line)", borderRadius: 16,
          background: "var(--paper-deep)",
        }}>
          <Table size={32} strokeWidth={1.3} style={{ color: "var(--ink-4)", marginBottom: 16 }} />
          <h3 className="jl-display" style={{ fontSize: 22, fontWeight: 400, margin: "0 0 8px" }}>
            Start your contact list
          </h3>
          <p style={{ color: "var(--ink-3)", fontSize: 14, maxWidth: 440, margin: "0 auto 20px", lineHeight: 1.55 }}>
            Log outreach in the Outreach tab or Campaign — contacts appear here automatically. Add emails and details manually anytime, or import a CSV from Campaign.
          </p>
          <button onClick={addRow} style={primaryBtn}>
            <Plus size={15} /> Add first contact
          </button>
        </div>
      ) : (
        <div className="jl-scroll" style={{
          border: "1px solid var(--line)", borderRadius: 10,
          overflow: "auto", background: "var(--surface)",
        }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 1100 }}>
            <thead>
              <tr style={{ background: "var(--paper-deep)", borderBottom: "1px solid var(--line)" }}>
                {columns.map((col) => (
                  <th key={col.key} style={{
                    textAlign: "left", padding: "10px 10px", fontSize: 11,
                    fontWeight: 600, color: "var(--ink-3)", textTransform: "uppercase",
                    letterSpacing: "0.08em", width: col.width, minWidth: col.width,
                    position: "sticky", top: 0, background: "var(--paper-deep)", zIndex: 1,
                  }}>
                    {col.label}
                  </th>
                ))}
                <th style={{
                  width: 44, minWidth: 44, position: "sticky", top: 0,
                  background: "var(--paper-deep)", zIndex: 1,
                }} />
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={columns.length + 1} style={{ padding: 24, textAlign: "center", color: "var(--ink-3)", fontSize: 13 }}>
                    No matches for your filter.
                  </td>
                </tr>
              ) : filtered.map((c) => (
                <tr key={c.id} style={{ borderBottom: "1px solid var(--line-soft)" }}>
                  {columns.map((col) => (
                    <td key={col.key} style={{ padding: 0, verticalAlign: "middle" }}>
                      {col.key === "status" ? (
                        <select
                          value={c.status || "new"}
                          onChange={(e) => updateField(c, "status", e.target.value)}
                          style={{ ...SPREADSHEET_CELL, cursor: "pointer" }}
                        >
                          {CONTACT_STATUSES.map((s) => (
                            <option key={s.id} value={s.id}>{s.label}</option>
                          ))}
                        </select>
                      ) : (
                        <input
                          value={c[col.key] || ""}
                          onChange={(e) => updateField(c, col.key, e.target.value)}
                          placeholder={col.key === "email" ? "add email…" : ""}
                          style={SPREADSHEET_CELL}
                        />
                      )}
                    </td>
                  ))}
                  <td style={{ padding: "4px 8px", textAlign: "center" }}>
                    <button
                      onClick={() => { if (confirm(`Delete ${c.name || c.email || "this row"}?`)) { deleteContact(c.id); flash("Deleted"); } }}
                      title="Delete row"
                      style={{ ...iconBtn, width: 28, height: 28, border: "none", color: "var(--ink-4)" }}
                    >
                      <Trash2 size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function CampaignView({
  contacts, upsertContact, upsertContacts, deleteContact,
  upsertOutreach, settings, updateSettings, flash,
  resume, saveResume, removeResume,
}) {
  const [view, setView] = useState("queue"); // "queue" | "all" | "followups" | "linkedin"
  const [importOpen, setImportOpen] = useState(false);
  const [linkedinOpen, setLinkedinOpen] = useState(false);
  const [connectionsShotOpen, setConnectionsShotOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [selectedContact, setSelectedContact] = useState(null);
  const [draftingId, setDraftingId] = useState(null);
  const [filterText, setFilterText] = useState("");

  const profileComplete = !!(settings.userName && settings.signOff);

  const linkedinContacts = useMemo(
    () => contacts.filter((c) => c.channel === "linkedin"),
    [contacts]
  );

  // Daily queue: next N contacts that haven't been drafted/sent yet
  const queue = useMemo(() => {
    const eligible = contacts
      .filter((c) => c.status === "new" || c.status === "researched")
      .sort((a, b) => (b.research?.completed ? 1 : 0) - (a.research?.completed ? 1 : 0) || (a.addedAt || 0) - (b.addedAt || 0));
    return eligible.slice(0, settings.dailyQueueSize || 5);
  }, [contacts, settings.dailyQueueSize]);

  // Follow-ups: sent more than N days ago, no reply
  const followUps = useMemo(() => {
    const cutoff = Date.now() - (settings.followUpDays || 5) * 86400000;
    return contacts.filter((c) => c.status === "sent" && c.sentAt && c.sentAt < cutoff);
  }, [contacts, settings.followUpDays]);

  // All contacts list (with filter)
  const filteredAll = useMemo(() => {
    if (!filterText.trim()) return contacts;
    const q = filterText.toLowerCase();
    return contacts.filter((c) =>
      (c.name || "").toLowerCase().includes(q) ||
      (c.email || "").toLowerCase().includes(q) ||
      (c.company || "").toLowerCase().includes(q) ||
      (c.role || "").toLowerCase().includes(q)
    );
  }, [contacts, filterText]);

  return (
    <div className="jl-fade">
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        marginBottom: 22, gap: 16, flexWrap: "wrap",
      }}>
        <div>
          <h1 className="jl-display" style={{ fontSize: 38, fontWeight: 400, margin: 0, letterSpacing: "-0.02em" }}>
            Campaign
          </h1>
          <p style={{ color: "var(--ink-3)", fontSize: 14, margin: "4px 0 0" }}>
            {contacts.length === 0
              ? "Import a contact list and let AI draft personalized outreach"
              : `${contacts.length} ${contacts.length === 1 ? "contact" : "contacts"} · ${queue.length} ready to draft today`}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button onClick={() => setSettingsOpen(true)} style={ghostBtn}>
            <Settings size={14} /> {profileComplete ? "Settings" : "Set up profile"}
          </button>
          <button onClick={() => setImportOpen(true)} style={primaryBtn}>
            <Upload size={15} /> Import contacts
          </button>
        </div>
      </div>

      {/* Sub-nav */}
      {contacts.length > 0 && (
        <div style={{ display: "flex", gap: 4, marginBottom: 22, borderBottom: "1px solid var(--line)", flexWrap: "wrap" }}>
          {[
            { id: "queue", label: "Today's queue", count: queue.length },
            { id: "linkedin", label: "LinkedIn", count: linkedinContacts.length },
            { id: "followups", label: "Needs follow-up", count: followUps.length, accent: followUps.length > 0 },
            { id: "all", label: "All contacts", count: contacts.length },
          ].map((s) => {
            const active = view === s.id;
            return (
              <button key={s.id} onClick={() => setView(s.id)} style={{
                padding: "10px 14px", background: "transparent", border: "none", cursor: "pointer",
                color: active ? "var(--ink)" : "var(--ink-3)",
                fontSize: 14, fontWeight: 500,
                borderBottom: `2px solid ${active ? "var(--accent)" : "transparent"}`,
                marginBottom: -1, display: "flex", alignItems: "center", gap: 7,
              }}>
                {s.label}
                <span style={{
                  fontSize: 11, padding: "1px 7px", borderRadius: 999,
                  background: s.accent && s.count > 0 ? "var(--rose-soft)" : "var(--paper-deep)",
                  color: s.accent && s.count > 0 ? "var(--rose)" : "var(--ink-3)",
                  fontWeight: 500,
                }}>{s.count}</span>
              </button>
            );
          })}
        </div>
      )}

      {contacts.length === 0 ? (
        <CampaignEmpty
          onImport={() => setImportOpen(true)}
          onSettings={() => setSettingsOpen(true)}
          onAddLinkedIn={() => setLinkedinOpen(true)}
          profileComplete={profileComplete}
        />
      ) : !profileComplete ? (
        <ProfileNudge onSettings={() => setSettingsOpen(true)} />
      ) : view === "queue" ? (
        <DailyQueueView
          queue={queue}
          settings={settings}
          upsertContact={upsertContact}
          upsertOutreach={upsertOutreach}
          onOpenContact={setSelectedContact}
          draftingId={draftingId}
          setDraftingId={setDraftingId}
          flash={flash}
        />
      ) : view === "followups" ? (
        <FollowUpsView
          followUps={followUps}
          followUpDays={settings.followUpDays || 5}
          onOpenContact={setSelectedContact}
          upsertContact={upsertContact}
          flash={flash}
        />
      ) : view === "linkedin" ? (
        <LinkedInView
          linkedinContacts={linkedinContacts}
          settings={settings}
          upsertContact={upsertContact}
          upsertOutreach={upsertOutreach}
          onOpenContact={setSelectedContact}
          onAddProfiles={() => setLinkedinOpen(true)}
          onUploadConnections={() => setConnectionsShotOpen(true)}
          flash={flash}
        />
      ) : (
        <AllContactsView
          contacts={filteredAll}
          filterText={filterText}
          setFilterText={setFilterText}
          onOpenContact={setSelectedContact}
        />
      )}

      {importOpen && (
        <ContactImportModal
          onClose={() => setImportOpen(false)}
          onImport={(items) => {
            upsertContacts(items);
            setImportOpen(false);
            flash(`Imported ${items.length} ${items.length === 1 ? "contact" : "contacts"}`);
          }}
        />
      )}

      {settingsOpen && (
        <CampaignSettingsModal
          settings={settings}
          updateSettings={updateSettings}
          resume={resume}
          saveResume={saveResume}
          removeResume={removeResume}
          flash={flash}
          onClose={() => setSettingsOpen(false)}
          onSave={() => { setSettingsOpen(false); flash("Settings saved"); }}
        />
      )}

      {selectedContact && (
        <ContactDetailDrawer
          contact={selectedContact}
          settings={settings}
          onClose={() => setSelectedContact(null)}
          onUpdate={(d) => { upsertContact({ ...selectedContact, ...d }); setSelectedContact({ ...selectedContact, ...d }); }}
          onDelete={() => { deleteContact(selectedContact.id); setSelectedContact(null); flash("Contact removed"); }}
          upsertOutreach={upsertOutreach}
          flash={flash}
        />
      )}

      {linkedinOpen && (
        <AddLinkedInProfilesModal
          onClose={() => setLinkedinOpen(false)}
          onAdd={(items) => {
            upsertContacts(items);
            setLinkedinOpen(false);
            setView("linkedin");
            flash(`Added ${items.length} LinkedIn ${items.length === 1 ? "profile" : "profiles"}`);
          }}
        />
      )}

      {connectionsShotOpen && (
        <NewConnectionsScreenshotModal
          linkedinContacts={linkedinContacts}
          onClose={() => setConnectionsShotOpen(false)}
          onMatched={(matched) => {
            const now = Date.now();
            matched.forEach((c) => {
              upsertContact({ ...c, linkedinStage: "connected", connectedAt: now });
            });
            setConnectionsShotOpen(false);
            flash(`Marked ${matched.length} ${matched.length === 1 ? "contact" : "contacts"} as connected`);
          }}
        />
      )}
    </div>
  );
}

function CampaignEmpty({ onImport, onSettings, onAddLinkedIn, profileComplete }) {
  return (
    <div style={{
      padding: "60px 40px", textAlign: "center",
      border: "1px dashed var(--line)", borderRadius: 16,
      background: "var(--paper-deep)",
    }}>
      <div style={{
        width: 56, height: 56, borderRadius: "50%", background: "var(--accent-soft)",
        display: "grid", placeItems: "center", margin: "0 auto 18px", color: "var(--accent)",
      }}>
        <Users size={24} strokeWidth={1.5} />
      </div>
      <h3 className="jl-display" style={{ fontSize: 24, fontWeight: 400, margin: "0 0 8px", letterSpacing: "-0.01em" }}>
        Bring your list
      </h3>
      <p style={{
        color: "var(--ink-3)", fontSize: 14, margin: "0 auto 24px",
        maxWidth: 460, lineHeight: 1.55,
      }}>
        Upload a CSV of people you want to reach by email, or paste LinkedIn URLs for a connection-and-coffee flow. I'll research each one, draft personalized outreach, and you review and send.
      </p>
      <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
        {!profileComplete && (
          <button onClick={onSettings} style={ghostBtn}>
            <Settings size={14} /> Set up profile first
          </button>
        )}
        <button onClick={onImport} style={primaryBtn}>
          <Upload size={15} /> Import a CSV
        </button>
        {onAddLinkedIn && (
          <button onClick={onAddLinkedIn} style={{ ...primaryBtn, background: "var(--accent)", color: "white" }}>
            <Linkedin size={15} /> Add LinkedIn profiles
          </button>
        )}
      </div>
    </div>
  );
}

function ProfileNudge({ onSettings }) {
  return (
    <div style={{
      padding: "32px 28px", textAlign: "center",
      border: "1px solid var(--amber)", borderRadius: 12,
      background: "var(--amber-soft)",
    }}>
      <Bell size={20} style={{ color: "var(--amber)", marginBottom: 10 }} />
      <h3 className="jl-display" style={{ fontSize: 18, fontWeight: 500, margin: "0 0 6px" }}>
        Tell me about you before we draft anything
      </h3>
      <p style={{ color: "var(--ink-2)", fontSize: 14, margin: "0 auto 16px", maxWidth: 440, lineHeight: 1.5 }}>
        I need your name, a bit about your background, and how you sign off — so every email sounds like you, not a template.
      </p>
      <button onClick={onSettings} style={{ ...primaryBtn, background: "var(--ink)", color: "var(--paper)" }}>
        <Settings size={14} /> Set up profile
      </button>
    </div>
  );
}

/* ----- Daily queue ----- */
function DailyQueueView({ queue, settings, upsertContact, upsertOutreach, onOpenContact, draftingId, setDraftingId, flash }) {
  const [editingDraft, setEditingDraft] = useState(null); // contact object with .lastDraft

  const research = async (contact) => {
    upsertContact({ ...contact, status: "new", research: { ...(contact.research || {}), running: true } });
    try {
      const { text } = await callAI({
        system: "You research people for personalized outreach. Use web search. Return only JSON.",
        content: `Research this person for a job-search outreach email:
Name: ${contact.name}
Email: ${contact.email}
Company: ${contact.company || "unknown"}
Role: ${contact.role || "unknown"}
${contact.linkedin ? `LinkedIn: ${contact.linkedin}` : ""}

Return JSON:
{
  "summary": "2-3 sentences about who they are and what they do (verified from search)",
  "talking_points": ["3-5 specific things to reference: recent posts, projects, talks, mutual interests, notable work — be concrete"],
  "verified_role": "their current role from search",
  "verified_company": "their current company from search"
}

If you can't find them, return {"summary": "Couldn't find specific information about this person from public sources.", "talking_points": []}.

JSON only.`,
        tools: [{ type: "web_search_20250305", name: "web_search" }],
        maxTokens: 1500,
        feature: "contact_research",
      });
      const parsed = extractJSON(text);
      if (parsed) {
        upsertContact({
          ...contact,
          status: "researched",
          role: parsed.verified_role || contact.role,
          company: parsed.verified_company || contact.company,
          research: {
            completed: true,
            completedAt: Date.now(),
            summary: parsed.summary || "",
            talking_points: parsed.talking_points || [],
          },
        });
        flash(`Researched ${contact.name}`);
      } else {
        upsertContact({ ...contact, research: { ...(contact.research || {}), running: false } });
        flash("Couldn't extract research", "err");
      }
    } catch (e) {
      upsertContact({ ...contact, research: { ...(contact.research || {}), running: false } });
      flash("Research failed: " + e.message, "err");
    }
  };

  const draft = async (contact) => {
    setDraftingId(contact.id);
    try {
      const research = contact.research || {};
      const firstName = (contact.name || "").split(/\s+/)[0] || "there";
      const { text } = await callAI({
        system: "You write warm, concise, personalized cold outreach emails for job searches. Return only JSON.",
        content: `Write a short personalized cold email.

ABOUT THE SENDER:
Name: ${settings.userName}
Background: ${settings.userBackground || "—"}
What they're looking for / outreach angle: ${settings.outreachAngle || "—"}
Sign off as: ${settings.signOff || settings.userName}

ABOUT THE RECIPIENT:
Name: ${contact.name} (first name: ${firstName})
Email: ${contact.email}
Role: ${contact.role || "—"}
Company: ${contact.company || "—"}
${research.summary ? `Research summary: ${research.summary}` : ""}
${research.talking_points?.length ? `Specific things known about them: ${research.talking_points.join(" | ")}` : ""}

GOAL OF THE EMAIL: ${settings.defaultGoal}

WRITING RULES:
- 4-6 sentences total. Concise.
- Open with a specific, genuine reference to ONE of the talking points (or their work/role if no talking points). Not generic.
- Briefly introduce who you are (1 sentence using sender background + outreach angle).
- State the ask clearly (the goal). No begging, no over-apologizing.
- Warm, professional, peer-to-peer. Not stiff. Not gushy.
- Sign off with sender's sign-off line.
- Plain text only. No markdown, no formatting, no signature block beyond the sign-off line.

Return JSON:
{ "subject": "<5-8 word subject line>", "body": "Hi ${firstName},\\n\\n<email body with paragraph breaks>" }

JSON only.`,
        maxTokens: 1200,
        feature: "campaign_draft",
      });
      const parsed = extractJSON(text);
      if (parsed && parsed.body) {
        const draftObj = { subject: parsed.subject || "", body: parsed.body, generatedAt: Date.now() };
        upsertContact({ ...contact, status: "drafted", lastDraft: draftObj });
        setEditingDraft({ ...contact, status: "drafted", lastDraft: draftObj });
      } else {
        flash("Couldn't generate draft", "err");
      }
    } catch (e) {
      flash("Drafting failed: " + e.message, "err");
    } finally {
      setDraftingId(null);
    }
  };

  return (
    <div>
      {queue.length === 0 ? (
        <div style={{
          padding: "50px 30px", textAlign: "center",
          border: "1px dashed var(--line)", borderRadius: 14, background: "var(--paper-deep)",
        }}>
          <CheckCircle2 size={28} style={{ color: "var(--moss)", marginBottom: 10 }} />
          <h3 className="jl-display" style={{ fontSize: 20, fontWeight: 400, margin: "0 0 6px" }}>
            Queue's clear
          </h3>
          <p style={{ color: "var(--ink-3)", fontSize: 14, margin: 0, maxWidth: 400, marginLeft: "auto", marginRight: "auto", lineHeight: 1.5 }}>
            Every contact has been drafted or sent. Import more, or come back tomorrow.
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {queue.map((c) => (
            <QueueRow key={c.id} contact={c}
              onResearch={() => research(c)}
              onDraft={() => draft(c)}
              onOpen={() => onOpenContact(c)}
              drafting={draftingId === c.id}
            />
          ))}
        </div>
      )}

      {editingDraft && (
        <DraftEditorModal
          contact={editingDraft}
          settings={settings}
          onClose={() => setEditingDraft(null)}
          upsertContact={upsertContact}
          upsertOutreach={upsertOutreach}
          flash={flash}
        />
      )}
    </div>
  );
}

function QueueRow({ contact, onResearch, onDraft, onOpen, drafting }) {
  const researched = contact.research?.completed;
  const researching = contact.research?.running;
  const drafted = contact.status === "drafted";
  return (
    <div style={{
      background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 10,
      padding: "14px 16px", display: "flex", gap: 14, alignItems: "center",
    }}>
      <button onClick={onOpen} style={{
        width: 40, height: 40, borderRadius: "50%", background: "var(--paper-deep)",
        border: "none", cursor: "pointer", display: "grid", placeItems: "center",
        color: "var(--ink-2)", fontSize: 14, fontWeight: 500, flexShrink: 0,
        fontFamily: "inherit",
      }}>
        {(contact.name || "?").split(/\s+/).map((n) => n[0]).slice(0, 2).join("").toUpperCase()}
      </button>
      <div style={{ flex: 1, minWidth: 0, cursor: "pointer" }} onClick={onOpen}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2, flexWrap: "wrap" }}>
          <span className="jl-display" style={{ fontSize: 15, fontWeight: 500, color: "var(--ink)" }}>
            {contact.name || "—"}
          </span>
          {researched && (
            <span style={{
              fontSize: 10, padding: "1px 6px", borderRadius: 999,
              background: "var(--amber-soft)", color: "var(--amber)", fontWeight: 500,
            }}>
              <Sparkles size={9} style={{ verticalAlign: -1, marginRight: 2 }} />researched
            </span>
          )}
        </div>
        <div style={{ fontSize: 13, color: "var(--ink-3)", lineHeight: 1.4 }}>
          {contact.role ? `${contact.role}` : ""}{contact.role && contact.company ? " · " : ""}{contact.company || ""}
          {!contact.role && !contact.company && contact.email}
        </div>
        {researched && contact.research?.summary && (
          <div style={{
            fontSize: 12, color: "var(--ink-2)", marginTop: 6,
            background: "var(--paper)", borderRadius: 6, padding: "6px 10px",
            border: "1px solid var(--line-soft)", lineHeight: 1.5,
          }}>
            {contact.research.summary}
          </div>
        )}
      </div>
      <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
        {!researched && !researching && (
          <button onClick={onResearch} style={ghostBtnSm}>
            <Sparkles size={12} /> Research
          </button>
        )}
        {researching && (
          <span className="jl-pulse" style={{ fontSize: 12, color: "var(--ink-3)", padding: "5px 10px" }}>
            Researching…
          </span>
        )}
        <button onClick={onDraft} disabled={drafting}
          style={{
            ...primaryBtn, background: "var(--accent)", color: "white",
            opacity: drafting ? 0.6 : 1, padding: "6px 12px", fontSize: 13,
          }}>
          {drafting ? <RefreshCw size={13} className="jl-spin" /> : <Edit3 size={13} />}
          {drafting ? "Drafting…" : drafted ? "Re-draft" : "Draft email"}
        </button>
      </div>
    </div>
  );
}

/* ----- Draft editor with Gmail draft creation ----- */
function DraftEditorModal({ contact, settings, onClose, upsertContact, upsertOutreach, flash }) {
  const [subject, setSubject] = useState(contact.lastDraft?.subject || "");
  const [body, setBody] = useState(contact.lastDraft?.body || "");
  const [sending, setSending] = useState(false);

  const createGmailDraft = async () => {
    if (!subject.trim() || !body.trim()) {
      flash("Subject and body required", "err");
      return;
    }
    setSending(true);
    try {
      const { raw } = await callAI({
        system: "You create Gmail drafts through the Gmail tool. After creating the draft, briefly confirm with the draft ID.",
        content: `Create a Gmail draft email with these details:
To: ${contact.email}
Subject: ${subject}
Body:
${body}

After creating the draft, return the draft ID and thread ID in JSON: {"draft_id": "...", "thread_id": "..."}.`,
        mcp: [{ type: "url", url: "https://gmailmcp.googleapis.com/mcp/v1", name: "gmail" }],
        maxTokens: 1500,
        feature: "gmail_draft",
      });

      // Extract draft/thread IDs from tool results or text
      let draftId = null, threadId = null;
      const blocks = raw?.content || [];
      for (const b of blocks) {
        if (b.type === "mcp_tool_result" && b.content) {
          const tt = (b.content[0]?.text || "");
          const dm = tt.match(/draft[_\s-]?id["'\s:]+([A-Za-z0-9_-]+)/i);
          const tm = tt.match(/thread[_\s-]?id["'\s:]+([A-Za-z0-9_-]+)/i);
          if (dm) draftId = dm[1];
          if (tm) threadId = tm[1];
        }
        if (b.type === "text") {
          const parsed = extractJSON(b.text);
          if (parsed?.draft_id) draftId = parsed.draft_id;
          if (parsed?.thread_id) threadId = parsed.thread_id;
        }
      }

      // Save to contact + log to outreach regardless of whether we extracted IDs
      const now = Date.now();
      upsertContact({
        ...contact,
        status: "sent",
        lastDraft: { subject, body, generatedAt: contact.lastDraft?.generatedAt || now },
        draftId, threadId,
        sentAt: now,
      });
      upsertOutreach({
        channel: "Gmail",
        contact: contact.name || contact.email,
        contactTitle: contact.role || "",
        contactEmail: contact.email,
        company: contact.company || "",
        subject,
        direction: "outbound",
        date: new Date(now).toISOString().slice(0, 10),
        notes: body,
        status: "sent_via_campaign",
        contactId: contact.id,
        threadId,
      });
      flash(`Draft created in Gmail — finish sending from your inbox`);
      onClose();
    } catch (e) {
      flash("Gmail draft failed: " + e.message, "err");
    } finally {
      setSending(false);
    }
  };

  return (
    <div style={drawerOverlay} onClick={onClose}>
      <div className="jl-fade jl-scroll" onClick={(e) => e.stopPropagation()} style={{
        position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
        width: "min(680px, 94vw)", maxHeight: "90vh", overflowY: "auto",
        background: "var(--surface)", borderRadius: 14, padding: "26px 30px",
        border: "1px solid var(--line)",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 11, color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 4 }}>
              Draft email
            </div>
            <h2 className="jl-display" style={{ fontSize: 22, fontWeight: 500, margin: 0 }}>
              To {contact.name}
            </h2>
            <div style={{ fontSize: 13, color: "var(--ink-3)", marginTop: 2 }}>
              {contact.email}{contact.role || contact.company ? ` · ${[contact.role, contact.company].filter(Boolean).join(" at ")}` : ""}
            </div>
          </div>
          <button onClick={onClose} style={iconBtn}><X size={18} /></button>
        </div>

        <div style={{ display: "grid", gap: 12 }}>
          <Field label="Subject">
            <input value={subject} onChange={(e) => setSubject(e.target.value)} style={inputBase} />
          </Field>
          <Field label="Body">
            <textarea value={body} onChange={(e) => setBody(e.target.value)}
              style={{ ...inputBase, minHeight: 280, resize: "vertical", lineHeight: 1.6, fontSize: 14 }} />
          </Field>
        </div>

        <div style={{
          marginTop: 16, padding: "10px 14px", borderRadius: 8,
          background: "var(--paper)", border: "1px solid var(--line-soft)",
          fontSize: 12, color: "var(--ink-3)", display: "flex", alignItems: "center", gap: 8,
        }}>
          <AlertCircle size={13} style={{ color: "var(--amber)", flexShrink: 0 }} />
          <span>
            <strong style={{ color: "var(--ink-2)", fontWeight: 500 }}>Send creates a Gmail draft</strong> — review one more time and hit send in your inbox. Safer than auto-sending.
          </span>
        </div>

        <div style={{ display: "flex", gap: 8, justifyContent: "space-between", alignItems: "center", marginTop: 18 }}>
          <button onClick={onClose} style={ghostBtn}>Save and close</button>
          <button onClick={createGmailDraft} disabled={sending || !subject.trim() || !body.trim()}
            style={{
              ...primaryBtn, background: "var(--accent)", color: "white",
              opacity: sending || !subject.trim() || !body.trim() ? 0.6 : 1,
            }}>
            {sending ? <RefreshCw size={15} className="jl-spin" /> : <Send size={15} />}
            {sending ? "Creating draft…" : "Create Gmail draft"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ----- Follow-ups ----- */
function FollowUpsView({ followUps, followUpDays, onOpenContact, upsertContact, flash }) {
  if (followUps.length === 0) {
    return (
      <div style={{
        padding: "50px 30px", textAlign: "center",
        border: "1px dashed var(--line)", borderRadius: 14, background: "var(--paper-deep)",
      }}>
        <CheckCircle2 size={28} style={{ color: "var(--moss)", marginBottom: 10 }} />
        <h3 className="jl-display" style={{ fontSize: 20, fontWeight: 400, margin: "0 0 6px" }}>
          All caught up
        </h3>
        <p style={{ color: "var(--ink-3)", fontSize: 14, margin: 0, maxWidth: 400, marginLeft: "auto", marginRight: "auto", lineHeight: 1.5 }}>
          No outreach is overdue. The window is <strong style={{ color: "var(--ink-2)", fontWeight: 500 }}>{followUpDays} days</strong> — anything sent longer ago without a reply shows here.
        </p>
      </div>
    );
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ fontSize: 13, color: "var(--ink-3)", marginBottom: 4 }}>
        Sent {followUpDays}+ days ago with no reply detected. Click to open and decide your next move.
      </div>
      {followUps.map((c) => {
        const days = Math.floor((Date.now() - (c.sentAt || 0)) / 86400000);
        return (
          <div key={c.id} style={{
            background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 10,
            padding: "12px 16px", display: "flex", alignItems: "center", gap: 14,
            cursor: "pointer",
          }} onClick={() => onOpenContact(c)}>
            <div style={{
              width: 40, height: 40, borderRadius: "50%", background: "var(--rose-soft)",
              display: "grid", placeItems: "center", color: "var(--rose)",
              fontSize: 14, fontWeight: 500, flexShrink: 0,
            }}>
              {(c.name || "?").split(/\s+/).map((n) => n[0]).slice(0, 2).join("").toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="jl-display" style={{ fontSize: 15, fontWeight: 500, color: "var(--ink)" }}>
                {c.name}
              </div>
              <div style={{ fontSize: 13, color: "var(--ink-3)" }}>
                {[c.role, c.company].filter(Boolean).join(" at ")}
              </div>
            </div>
            <div style={{ textAlign: "right", flexShrink: 0 }}>
              <div style={{ fontSize: 12, color: "var(--rose)", fontWeight: 500 }}>
                {days}d since send
              </div>
              <div style={{ fontSize: 11, color: "var(--ink-3)" }}>
                {niceDate(new Date(c.sentAt || 0).toISOString())}
              </div>
            </div>
            <ChevronRight size={14} style={{ color: "var(--ink-4)", flexShrink: 0 }} />
          </div>
        );
      })}
    </div>
  );
}

/* ----- All contacts list ----- */
function AllContactsView({ contacts, filterText, setFilterText, onOpenContact }) {
  return (
    <div>
      <div style={{ marginBottom: 12, position: "relative", maxWidth: 280 }}>
        <Search size={14} style={{ position: "absolute", left: 12, top: 11, color: "var(--ink-4)" }} />
        <input value={filterText} onChange={(e) => setFilterText(e.target.value)} placeholder="Filter by name, company…"
          style={{ ...inputBase, padding: "8px 12px 8px 32px", fontSize: 13 }} />
      </div>
      {contacts.length === 0 ? (
        <div style={{ padding: "30px", textAlign: "center", color: "var(--ink-3)", fontSize: 13 }}>
          No matches.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {contacts.map((c) => {
            const meta = contactStatusMeta(c.status);
            return (
              <div key={c.id} onClick={() => onOpenContact(c)} style={{
                background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 8,
                padding: "10px 14px", display: "flex", alignItems: "center", gap: 12,
                cursor: "pointer",
              }}>
                <div style={{
                  width: 32, height: 32, borderRadius: "50%", background: "var(--paper-deep)",
                  display: "grid", placeItems: "center", color: "var(--ink-2)",
                  fontSize: 12, fontWeight: 500, flexShrink: 0,
                }}>
                  {(c.name || "?").split(/\s+/).map((n) => n[0]).slice(0, 2).join("").toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, color: "var(--ink)", fontWeight: 500 }}>{c.name}</div>
                  <div style={{ fontSize: 12, color: "var(--ink-3)" }}>
                    {[c.role, c.company].filter(Boolean).join(" at ") || c.email}
                  </div>
                </div>
                <span style={{
                  fontSize: 11, padding: "2px 8px", borderRadius: 999,
                  background: "var(--paper-deep)", color: meta.color, fontWeight: 500,
                  flexShrink: 0,
                }}>{meta.label}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ----- Contact detail drawer ----- */
function ContactDetailDrawer({ contact, settings, onClose, onUpdate, onDelete, upsertOutreach, flash }) {
  const [notesEditing, setNotesEditing] = useState(false);
  const [notes, setNotes] = useState(contact.notes || "");
  const meta = contactStatusMeta(contact.status);

  return (
    <div style={drawerOverlay} onClick={onClose}>
      <div className="jl-fade jl-scroll" onClick={(e) => e.stopPropagation()} style={{
        position: "absolute", top: 0, right: 0, bottom: 0,
        width: "min(560px, 92vw)", background: "var(--surface)",
        borderLeft: "1px solid var(--line)", padding: "28px 32px",
        overflowY: "auto",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 18 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{
              width: 48, height: 48, borderRadius: "50%", background: "var(--paper-deep)",
              display: "grid", placeItems: "center", color: "var(--ink-2)",
              fontSize: 16, fontWeight: 500,
            }}>
              {(contact.name || "?").split(/\s+/).map((n) => n[0]).slice(0, 2).join("").toUpperCase()}
            </div>
            <div>
              <h2 className="jl-display" style={{ fontSize: 24, fontWeight: 500, margin: 0, letterSpacing: "-0.01em" }}>
                {contact.name}
              </h2>
              <div style={{ fontSize: 13, color: "var(--ink-3)" }}>
                {[contact.role, contact.company].filter(Boolean).join(" at ") || contact.email}
              </div>
            </div>
          </div>
          <button onClick={onClose} style={iconBtn}><X size={18} /></button>
        </div>

        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 20 }}>
          {CONTACT_STATUSES.map((s) => {
            const active = (contact.status || "new") === s.id;
            return (
              <button key={s.id} onClick={() => onUpdate({ status: s.id })} style={{
                padding: "5px 10px", borderRadius: 999,
                border: `1px solid ${active ? "var(--ink)" : "var(--line)"}`,
                background: active ? "var(--ink)" : "var(--surface)",
                color: active ? "var(--paper)" : "var(--ink-2)",
                fontSize: 11, fontWeight: 500, cursor: "pointer",
              }}>{s.label}</button>
            );
          })}
        </div>

        <div style={{ display: "grid", gap: 8, marginBottom: 20, fontSize: 13 }}>
          <DetailRow label="Email" value={<a href={`mailto:${contact.email}`} style={{ color: "var(--accent)", textDecoration: "none" }}>{contact.email}</a>} />
          {contact.linkedin && <DetailRow label="LinkedIn" value={<a href={contact.linkedin} target="_blank" rel="noreferrer" style={{ color: "var(--accent)", textDecoration: "none" }}>open profile <ExternalLink size={11} style={{ display: "inline", verticalAlign: -1 }} /></a>} />}
          {contact.sentAt && <DetailRow label="Sent" value={`${niceDate(new Date(contact.sentAt).toISOString())} · ${Math.floor((Date.now() - contact.sentAt) / 86400000)}d ago`} />}
          {contact.repliedAt && <DetailRow label="Replied" value={niceDate(new Date(contact.repliedAt).toISOString())} />}
        </div>

        {contact.research?.completed && (
          <div style={{ marginBottom: 20 }}>
            <Label>Research</Label>
            <div style={{
              marginTop: 6, padding: "12px 14px", background: "var(--amber-soft)",
              borderRadius: 8, fontSize: 13, lineHeight: 1.6, color: "var(--ink-2)",
            }}>
              <div style={{ marginBottom: contact.research.talking_points?.length ? 10 : 0 }}>
                {contact.research.summary}
              </div>
              {contact.research.talking_points?.map((tp, i) => (
                <div key={i} style={{ fontSize: 12, color: "var(--ink-2)", paddingLeft: 14, position: "relative" }}>
                  <span style={{ position: "absolute", left: 0, color: "var(--amber)" }}>·</span>
                  {tp}
                </div>
              ))}
            </div>
          </div>
        )}

        {contact.lastDraft && (
          <div style={{ marginBottom: 20 }}>
            <Label>Last draft</Label>
            <div style={{
              marginTop: 6, padding: "12px 14px", background: "var(--paper)",
              borderRadius: 8, border: "1px solid var(--line-soft)",
              fontSize: 13, lineHeight: 1.6,
            }}>
              <div style={{ fontWeight: 500, marginBottom: 6 }}>{contact.lastDraft.subject}</div>
              <div style={{ whiteSpace: "pre-wrap", color: "var(--ink-2)" }}>{contact.lastDraft.body}</div>
            </div>
          </div>
        )}

        <div style={{ marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
            <Label>Notes</Label>
            {!notesEditing && <button onClick={() => setNotesEditing(true)} style={ghostBtnSm}>Edit</button>}
          </div>
          {notesEditing ? (
            <div>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)}
                style={{ ...inputBase, minHeight: 100, resize: "vertical" }} />
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 8 }}>
                <button onClick={() => { setNotes(contact.notes || ""); setNotesEditing(false); }} style={ghostBtn}>Cancel</button>
                <button onClick={() => { onUpdate({ notes }); setNotesEditing(false); }} style={primaryBtn}>Save</button>
              </div>
            </div>
          ) : (
            <div style={{
              padding: "10px 12px", background: "var(--paper)", borderRadius: 8,
              fontSize: 13, color: "var(--ink-2)", whiteSpace: "pre-wrap",
              border: "1px solid var(--line-soft)", minHeight: 40,
            }}>
              {contact.notes || <span style={{ color: "var(--ink-4)", fontStyle: "italic" }}>No notes yet</span>}
            </div>
          )}
        </div>

        <button onClick={() => { if (confirm("Remove this contact?")) onDelete(); }} style={{
          color: "var(--rose)", background: "transparent", border: "1px solid var(--line)",
          padding: "8px 14px", borderRadius: 8, fontSize: 13, cursor: "pointer",
          display: "inline-flex", alignItems: "center", gap: 6,
        }}>
          <Trash2 size={13} /> Remove contact
        </button>
      </div>
    </div>
  );
}

function DetailRow({ label, value }) {
  return (
    <div style={{ display: "flex", gap: 16, padding: "4px 0" }}>
      <span style={{ fontSize: 11, color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: "0.1em", width: 80, flexShrink: 0, paddingTop: 1 }}>{label}</span>
      <span style={{ fontSize: 13, color: "var(--ink)", flex: 1 }}>{value}</span>
    </div>
  );
}

/* ----- Contact import (CSV) ----- */
function ContactImportModal({ onClose, onImport }) {
  const [text, setText] = useState("");
  const [preview, setPreview] = useState(null); // { rows: [], headers: [], mapping: {} }
  const [error, setError] = useState(null);
  const fileRef = useRef(null);

  const ingest = async (file) => {
    if (!file) return;
    setError(null);
    try {
      const t = await file.text();
      setText(t);
      parseAndPreview(t);
    } catch (e) {
      setError("Couldn't read file");
    }
  };

  const parseAndPreview = (csvText) => {
    const rows = parseCSV(csvText);
    if (rows.length < 2) {
      setError("Need a header row plus at least one contact");
      return;
    }
    const headers = rows[0].map((h) => h.trim().toLowerCase());
    const dataRows = rows.slice(1).filter((r) => r.some((v) => v && v.trim()));
    const mapping = autoMapColumns(headers);
    if (!mapping.email) {
      setError("No email column found. Include a column called 'email' or 'email_address'.");
      return;
    }
    setPreview({ headers, rows: dataRows, mapping });
  };

  const importNow = () => {
    if (!preview) return;
    const { headers, rows, mapping } = preview;
    const items = rows.map((r) => {
      const get = (key) => {
        const idx = mapping[key];
        if (idx === undefined) return "";
        return (r[idx] || "").trim();
      };
      const firstName = get("first_name");
      const lastName = get("last_name");
      const fullName = get("name") || [firstName, lastName].filter(Boolean).join(" ").trim() || get("email").split("@")[0];
      return {
        name: fullName,
        email: get("email"),
        company: get("company"),
        role: get("role"),
        linkedin: get("linkedin"),
        notes: get("notes"),
        source: "csv",
      };
    }).filter((c) => c.email);
    onImport(items);
  };

  return (
    <div style={drawerOverlay} onClick={onClose}>
      <div className="jl-fade jl-scroll" onClick={(e) => e.stopPropagation()} style={{
        position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
        width: "min(680px, 94vw)", maxHeight: "90vh", overflowY: "auto",
        background: "var(--surface)", borderRadius: 14, padding: "26px 30px",
        border: "1px solid var(--line)",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <h2 className="jl-display" style={{ fontSize: 22, fontWeight: 500, margin: 0 }}>
            Import contacts
          </h2>
          <button onClick={onClose} style={iconBtn}><X size={18} /></button>
        </div>
        <p style={{ color: "var(--ink-3)", fontSize: 13, margin: "0 0 20px" }}>
          CSV with a header row. Required column: <span className="jl-mono" style={{ background: "var(--paper-deep)", padding: "1px 6px", borderRadius: 4 }}>email</span>. Recognized: <span className="jl-mono" style={{ fontSize: 12 }}>name, first_name, last_name, company, role / title, linkedin, notes</span>. From Excel: File → Save As → CSV.
        </p>

        {!preview && (
          <>
            <div onClick={() => fileRef.current?.click()} style={{
              padding: "36px 24px", textAlign: "center", cursor: "pointer",
              border: "1.5px dashed var(--line)", borderRadius: 12,
              background: "var(--paper-deep)", marginBottom: 16,
            }}>
              <FileText size={28} style={{ color: "var(--ink-3)", marginBottom: 8 }} />
              <div className="jl-display" style={{ fontSize: 16, fontWeight: 500 }}>Choose a CSV file</div>
              <div style={{ fontSize: 12, color: "var(--ink-3)", marginTop: 4 }}>or paste content below</div>
              <input ref={fileRef} type="file" accept=".csv,text/csv,text/plain" style={{ display: "none" }}
                onChange={(e) => ingest(e.target.files?.[0])} />
            </div>
            <Field label="Or paste CSV content">
              <textarea value={text} onChange={(e) => setText(e.target.value)}
                style={{ ...inputBase, minHeight: 140, resize: "vertical", fontFamily: "JetBrains Mono, monospace", fontSize: 12 }}
                placeholder="name,email,company,role&#10;Jane Doe,jane@acme.com,Acme,VP Engineering&#10;…" />
            </Field>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 14 }}>
              <button onClick={onClose} style={ghostBtn}>Cancel</button>
              <button onClick={() => parseAndPreview(text)} disabled={!text.trim()} style={{ ...primaryBtn, opacity: !text.trim() ? 0.5 : 1 }}>
                <ArrowRight size={14} /> Preview
              </button>
            </div>
          </>
        )}

        {preview && (
          <>
            <div style={{
              padding: "10px 14px", background: "var(--moss-soft)", color: "var(--moss)",
              fontSize: 13, borderRadius: 8, marginBottom: 14, display: "flex", alignItems: "center", gap: 8,
            }}>
              <CheckCircle2 size={14} /> Found {preview.rows.length} {preview.rows.length === 1 ? "contact" : "contacts"} · column mapping looks good
            </div>
            <Label>Preview (first 5 rows)</Label>
            <div style={{
              marginTop: 6, borderRadius: 8, border: "1px solid var(--line)",
              overflow: "auto", maxHeight: 240,
            }}>
              <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "var(--paper-deep)" }}>
                    {["Name", "Email", "Company", "Role"].map((h) => (
                      <th key={h} style={{ padding: "8px 10px", textAlign: "left", fontWeight: 500, color: "var(--ink-2)", borderBottom: "1px solid var(--line)" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.slice(0, 5).map((r, i) => {
                    const get = (k) => {
                      const idx = preview.mapping[k];
                      if (idx === undefined) return "";
                      return r[idx] || "";
                    };
                    const fullName = get("name") || [get("first_name"), get("last_name")].filter(Boolean).join(" ");
                    return (
                      <tr key={i} style={{ borderBottom: "1px solid var(--line-soft)" }}>
                        <td style={{ padding: "8px 10px" }}>{fullName}</td>
                        <td style={{ padding: "8px 10px", color: "var(--ink-3)" }}>{get("email")}</td>
                        <td style={{ padding: "8px 10px", color: "var(--ink-3)" }}>{get("company")}</td>
                        <td style={{ padding: "8px 10px", color: "var(--ink-3)" }}>{get("role")}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "space-between", marginTop: 16 }}>
              <button onClick={() => setPreview(null)} style={ghostBtn}>
                <RefreshCw size={14} /> Start over
              </button>
              <button onClick={importNow} style={primaryBtn}>
                <Check size={15} /> Import {preview.rows.length}
              </button>
            </div>
          </>
        )}

        {error && (
          <div style={{
            marginTop: 14, padding: "10px 14px", borderRadius: 8,
            background: "var(--rose-soft)", color: "var(--rose)", fontSize: 13,
            display: "flex", alignItems: "center", gap: 8,
          }}>
            <AlertCircle size={14} /> {error}
          </div>
        )}
      </div>
    </div>
  );
}

// Lightweight CSV parser (handles quoted fields with commas and embedded quotes)
function parseCSV(text) {
  const rows = [];
  let row = [], field = "", inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ",") { row.push(field); field = ""; }
      else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
      else if (c === "\r") { /* skip */ }
      else field += c;
    }
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.length && r.some((v) => v !== ""));
}

function autoMapColumns(headers) {
  const m = {};
  const find = (...keys) => {
    for (const k of keys) {
      const idx = headers.findIndex((h) => h === k || h.replace(/[\s_-]/g, "") === k.replace(/[\s_-]/g, ""));
      if (idx !== -1) return idx;
    }
    return undefined;
  };
  m.email = find("email", "email_address", "e-mail", "emailaddress");
  m.name = find("name", "full_name", "fullname", "contact", "contact_name");
  m.first_name = find("first_name", "firstname", "first");
  m.last_name = find("last_name", "lastname", "last", "surname");
  m.company = find("company", "organization", "org", "employer", "company_name");
  m.role = find("role", "title", "job_title", "jobtitle", "position");
  m.linkedin = find("linkedin", "linkedin_url", "linkedinurl", "linkedin_profile");
  m.notes = find("notes", "comments", "note");
  return m;
}

/* ----- Backup & restore ----- */
function BackupModal({ onClose, flash }) {
  const [exporting, setExporting] = useState(false);
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState(null);
  const [restoring, setRestoring] = useState(false);
  const fileRef = useRef(null);

  const exportNow = async () => {
    setExporting(true);
    try {
      const backup = await collectBackupData();
      downloadBackup(backup);
      flash("Backup downloaded");
    } catch (e) {
      flash("Export failed: " + e.message, "err");
    } finally {
      setExporting(false);
    }
  };

  const ingestFile = async (file) => {
    if (!file) return;
    setError(null);
    try {
      const text = await file.text();
      const backup = parseBackupText(text);
      setPreview({ backup, summary: summarizeBackup(backup) });
    } catch (e) {
      setError(e.message || "Invalid backup file");
      setPreview(null);
    }
  };

  const restoreNow = async () => {
    if (!preview) return;
    setRestoring(true);
    try {
      await applyBackup(preview.backup);
      flash("Backup restored — reloading…");
      setTimeout(() => window.location.reload(), 600);
    } catch (e) {
      flash("Restore failed: " + e.message, "err");
      setRestoring(false);
    }
  };

  const s = preview?.summary;

  return (
    <div style={drawerOverlay} onClick={onClose}>
      <div className="jl-fade jl-scroll" onClick={(e) => e.stopPropagation()} style={{
        position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
        width: "min(520px, 94vw)", maxHeight: "90vh", overflowY: "auto",
        background: "var(--surface)", borderRadius: 14, padding: "26px 30px",
        border: "1px solid var(--line)",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <h2 className="jl-display" style={{ fontSize: 22, fontWeight: 500, margin: 0 }}>
            Backup & restore
          </h2>
          <button onClick={onClose} style={iconBtn}><X size={18} /></button>
        </div>
        <p style={{ color: "var(--ink-3)", fontSize: 13, margin: "0 0 22px", lineHeight: 1.5 }}>
          Download a JSON snapshot of all your data, or restore from a previous backup. Restoring replaces everything currently stored.
        </p>

        <div style={{ display: "grid", gap: 20 }}>
          <div style={{ padding: 16, borderRadius: 10, background: "var(--paper-deep)", border: "1px solid var(--line-soft)" }}>
            <div style={{ fontWeight: 500, marginBottom: 8, fontSize: 14 }}>Export</div>
            <p style={{ margin: "0 0 12px", fontSize: 13, color: "var(--ink-3)" }}>
              Saves jobs, outreach, meetings, contacts, companies, activity log, resume, profile, inbox summary state, and briefing.
            </p>
            <button onClick={exportNow} disabled={exporting} style={primaryBtn}>
              <Download size={15} /> {exporting ? "Exporting…" : "Download backup"}
            </button>
          </div>

          <div style={{ padding: 16, borderRadius: 10, background: "var(--paper-deep)", border: "1px solid var(--line-soft)" }}>
            <div style={{ fontWeight: 500, marginBottom: 8, fontSize: 14 }}>Import</div>
            <input ref={fileRef} type="file" accept=".json,application/json" style={{ display: "none" }}
              onChange={(e) => ingestFile(e.target.files?.[0])} />
            <button onClick={() => fileRef.current?.click()} style={ghostBtn}>
              <Upload size={15} /> Choose backup file
            </button>
            {error && <p style={{ margin: "10px 0 0", color: "var(--rose)", fontSize: 13 }}>{error}</p>}
            {s && (
              <div style={{ marginTop: 14, fontSize: 13, color: "var(--ink-2)", lineHeight: 1.6 }}>
                <div>Exported {niceDate(s.exportedAt)}</div>
                <div>{s.applications} jobs · {s.outreach} outreach · {s.meetings} meetings · {s.contacts} contacts · {s.companies} companies · {s.activities} activity</div>
                <button onClick={restoreNow} disabled={restoring}
                  style={{ ...primaryBtn, marginTop: 12, background: "var(--accent)", color: "white" }}>
                  {restoring ? "Restoring…" : "Restore backup"}
                </button>
                <p style={{ margin: "8px 0 0", fontSize: 12, color: "var(--rose)" }}>
                  This replaces all current data.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ----- Campaign settings modal ----- */
function CampaignSettingsModal({ settings, updateSettings, resume, saveResume, removeResume, flash, onClose, onSave }) {
  const [local, setLocal] = useState(settings);
  const [uploading, setUploading] = useState(false);
  const resumeRef = useRef(null);
  const u = (k, v) => setLocal({ ...local, [k]: v });
  const save = () => {
    updateSettings(local);
    onSave();
  };

  const handleResumePick = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      await saveResume(file);
      flash("Resume uploaded");
    } catch (e) {
      flash(e.message || "Upload failed", "err");
    } finally {
      setUploading(false);
      if (resumeRef.current) resumeRef.current.value = "";
    }
  };

  const handleRemoveResume = async () => {
    if (!confirm("Remove your uploaded resume?")) return;
    await removeResume();
    flash("Resume removed");
  };

  return (
    <div style={drawerOverlay} onClick={onClose}>
      <div className="jl-fade jl-scroll" onClick={(e) => e.stopPropagation()} style={{
        position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
        width: "min(580px, 94vw)", maxHeight: "90vh", overflowY: "auto",
        background: "var(--surface)", borderRadius: 14, padding: "26px 30px",
        border: "1px solid var(--line)",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <h2 className="jl-display" style={{ fontSize: 22, fontWeight: 500, margin: 0 }}>
            Your profile
          </h2>
          <button onClick={onClose} style={iconBtn}><X size={18} /></button>
        </div>
        <p style={{ color: "var(--ink-3)", fontSize: 13, margin: "0 0 20px" }}>
          This is what AI uses to write emails that sound like you. Be specific — the more detail, the better the drafts.
        </p>

        <div style={{ display: "grid", gap: 14 }}>
          <Field label="Your name" required>
            <input value={local.userName} onChange={(e) => u("userName", e.target.value)} style={inputBase} placeholder="Yewande Odusanwo" />
          </Field>
          <Field label="Sign off as" required>
            <input value={local.signOff} onChange={(e) => u("signOff", e.target.value)} style={inputBase} placeholder="Yewande" />
          </Field>
          <Field label="Your background">
            <textarea value={local.userBackground} onChange={(e) => u("userBackground", e.target.value)}
              style={{ ...inputBase, minHeight: 70, resize: "vertical" }}
              placeholder="Founder of ZORA Digital, 10 years in brand and digital strategy, recently led..." />
          </Field>

          <Field label="Resume">
            <input ref={resumeRef} type="file" accept={RESUME_ACCEPT} style={{ display: "none" }}
              onChange={(e) => handleResumePick(e.target.files?.[0])} />
            {resume ? (
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
                padding: "12px 14px", borderRadius: 8, border: "1px solid var(--line)",
                background: "var(--paper-deep)",
              }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 500, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {resume.fileName}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--ink-3)", marginTop: 2 }}>
                    {formatBytes(resume.size)} · uploaded {niceDate(new Date(resume.uploadedAt).toISOString())}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                  <button type="button" onClick={() => downloadResumeFile(resume)} style={ghostBtnSm}>
                    <Download size={13} /> Download
                  </button>
                  <button type="button" onClick={() => resumeRef.current?.click()} disabled={uploading} style={ghostBtnSm}>
                    <Upload size={13} /> Replace
                  </button>
                  <button type="button" onClick={handleRemoveResume} style={{ ...ghostBtnSm, color: "var(--rose)" }}>
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ) : (
              <button type="button" onClick={() => resumeRef.current?.click()} disabled={uploading} style={{
                ...ghostBtn, width: "100%", justifyContent: "center", padding: "14px",
                border: "1px dashed var(--line)", borderRadius: 8,
              }}>
                <Upload size={15} /> {uploading ? "Uploading…" : "Upload resume (PDF or Word, max 2 MB)"}
              </button>
            )}
          </Field>

          <Field label="What you're looking for / why you're reaching out">
            <textarea value={local.outreachAngle} onChange={(e) => u("outreachAngle", e.target.value)}
              style={{ ...inputBase, minHeight: 70, resize: "vertical" }}
              placeholder="Exploring head-of-marketing roles at purpose-driven Series B companies. Especially interested in teams blending brand and product." />
          </Field>
          <Field label="Default ask in each email">
            <textarea value={local.defaultGoal} onChange={(e) => u("defaultGoal", e.target.value)}
              style={{ ...inputBase, minHeight: 56, resize: "vertical" }} />
          </Field>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label="Emails per day">
              <input type="number" min={1} max={20} value={local.dailyQueueSize}
                onChange={(e) => u("dailyQueueSize", parseInt(e.target.value) || 5)}
                style={inputBase} />
            </Field>
            <Field label="Follow-up window (days)">
              <input type="number" min={1} max={30} value={local.followUpDays}
                onChange={(e) => u("followUpDays", parseInt(e.target.value) || 5)}
                style={inputBase} />
            </Field>
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 22 }}>
          <button onClick={onClose} style={ghostBtn}>Cancel</button>
          <button onClick={save} disabled={!local.userName || !local.signOff}
            style={{ ...primaryBtn, opacity: !local.userName || !local.signOff ? 0.5 : 1 }}>
            <Check size={15} /> Save profile
          </button>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   DASHBOARD
   ============================================================ */
function Dashboard({ applications, outreach, meetings, contacts = [], activities = [], settings = {}, setTab }) {
  const [period, setPeriod] = useState("week"); // "week" | "month" | "all"

  const periodMeta = {
    week: { days: 7, label: "past 7 days", short: "wk" },
    month: { days: 30, label: "past 30 days", short: "mo" },
    all: { days: Infinity, label: "all time", short: "all" },
  };

  const { stats, recent, byStatus } = useMemo(() => {
    const now = Date.now();
    const days = periodMeta[period].days;
    const cutoff = period === "all" ? 0 : now - days * 86400000;
    const prevCutoff = period === "all" ? 0 : cutoff - days * 86400000;

    const tsOf = (val) => {
      if (!val) return 0;
      const t = new Date(val).getTime();
      return isNaN(t) ? 0 : t;
    };
    const inPeriod = (t) => period === "all" ? t > 0 : t >= cutoff && t <= now;
    const inPrev = (t) => period === "all" ? false : t >= prevCutoff && t < cutoff;

    // Applications applied to in window
    const appliedCur = applications.filter((a) => {
      const t = applicationAppliedTimestamp(a);
      return isAppliedApplication(a) && inPeriod(t);
    }).length;
    const appliedPrev = applications.filter((a) => {
      const t = applicationAppliedTimestamp(a);
      return isAppliedApplication(a) && inPrev(t);
    }).length;

    // Outreach in window
    const outreachCur = outreach.filter((o) => inPeriod(tsOf(o.date) || o.id ? tsOf(o.date) : 0)).length;
    const outreachPrev = outreach.filter((o) => inPrev(tsOf(o.date))).length;

    // New contacts (unique names) in window
    const contactsInCur = new Set(
      outreach
        .filter((o) => inPeriod(tsOf(o.date)))
        .map((o) => (o.contact || "").trim().toLowerCase())
        .filter(Boolean)
    );
    const contactsInPrev = new Set(
      outreach
        .filter((o) => inPrev(tsOf(o.date)))
        .map((o) => (o.contact || "").trim().toLowerCase())
        .filter(Boolean)
    );
    const newContacts = contactsInCur.size;
    const prevContacts = contactsInPrev.size;

    // Meetings — on the calendar in window (by `when`)
    const meetingsCur = meetings.filter((m) => inPeriod(tsOf(m.when))).length;
    const meetingsPrev = meetings.filter((m) => inPrev(tsOf(m.when))).length;
    const upcoming = meetings.filter((m) => {
      const t = tsOf(m.when);
      return t > now;
    }).length;

    // Pipeline breakdown — uses status of ALL applications regardless of period
    const counts = {};
    STATUSES.forEach((s) => counts[s.id] = 0);
    applications.forEach((a) => {
      const s = a.status || "saved";
      if (counts[s] !== undefined) counts[s]++;
      else counts.saved++;
    });
    const totalApps = applications.length;

    // Recent activity — merge all sources, take last 7
    const activity = [];
    applications.forEach((a) => {
      const appliedTs = applicationAppliedTimestamp(a);
      if (isAppliedApplication(a) && appliedTs) {
        activity.push({
          kind: "applied", ts: appliedTs,
          title: a.company || "Unknown",
          subtitle: a.role || "",
          onClick: () => setTab("pipeline"),
        });
      } else if (a.createdAt) {
        activity.push({
          kind: "saved", ts: a.createdAt,
          title: a.company || "Unknown",
          subtitle: a.role || "",
          onClick: () => setTab("pipeline"),
        });
      }
    });
    outreach.forEach((o) => {
      const t = tsOf(o.date);
      if (t > 0) {
        activity.push({
          kind: o.direction === "inbound" ? "outreach_in" : "outreach_out",
          ts: t,
          title: o.contact || "Unknown",
          subtitle: [o.contactTitle, o.company].filter(Boolean).join(" at ") || (o.channel || "—"),
          onClick: () => setTab("outreach"),
        });
      }
    });
    meetings.forEach((m) => {
      const t = tsOf(m.when);
      if (t > 0) {
        activity.push({
          kind: "meeting", ts: t,
          title: m.title || m.company || "Meeting",
          subtitle: m.company && m.title !== m.company ? m.company : "",
          future: t > now,
          onClick: () => setTab("meetings"),
        });
      }
    });
    activities.forEach((a) => {
      const t = tsOf(a.date) || a.createdAt || 0;
      if (t > 0) {
        activity.push({
          kind: "activity_log",
          ts: t,
          title: a.title || "Activity",
          subtitle: (a.notes || "").split("\n")[0].slice(0, 60) || "",
          onClick: () => setTab("activity"),
        });
      }
    });
    const recentSorted = activity
      .sort((a, b) => b.ts - a.ts)
      .slice(0, 7);

    return {
      stats: {
        applied: { current: appliedCur, prev: appliedPrev },
        meetings: { current: meetingsCur, prev: meetingsPrev, upcoming },
        outreach: { current: outreachCur, prev: outreachPrev },
        contacts: { current: newContacts, prev: prevContacts },
      },
      recent: recentSorted,
      byStatus: { counts, total: totalApps },
    };
  }, [applications, outreach, meetings, activities, period, setTab]);

  const isEmpty = applications.length === 0 && outreach.length === 0 && meetings.length === 0 && activities.length === 0;

  return (
    <div className="jl-fade">
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        marginBottom: 28, gap: 16, flexWrap: "wrap",
      }}>
        <div>
          <h1 className="jl-display" style={{ fontSize: 38, fontWeight: 400, margin: 0, letterSpacing: "-0.02em" }}>
            Overview
          </h1>
          <p style={{ color: "var(--ink-3)", fontSize: 14, margin: "4px 0 0" }}>
            {isEmpty ? "Your search at a glance" : `Where things stand · ${periodMeta[period].label}`}
          </p>
        </div>
        <div style={{ display: "flex", gap: 4, background: "var(--paper-deep)", padding: 4, borderRadius: 10 }}>
          {[
            { id: "week", label: "Week" },
            { id: "month", label: "Month" },
            { id: "all", label: "All time" },
          ].map((p) => {
            const active = period === p.id;
            return (
              <button key={p.id} onClick={() => setPeriod(p.id)} style={{
                padding: "6px 14px", borderRadius: 7, border: "none", cursor: "pointer",
                background: active ? "var(--surface)" : "transparent",
                color: active ? "var(--ink)" : "var(--ink-3)",
                fontSize: 13, fontWeight: 500,
                boxShadow: active ? "0 1px 2px rgba(31,27,22,0.06)" : "none",
              }}>{p.label}</button>
            );
          })}
        </div>
      </div>

      {isEmpty ? (
        <DashboardEmpty setTab={setTab} />
      ) : (
        <>
          {/* Daily briefing — AI coach */}
          <DailyBriefing
            applications={applications}
            outreach={outreach}
            meetings={meetings}
            contacts={contacts}
            settings={settings}
            setTab={setTab}
          />

          {/* Metric cards */}
          <div style={{
            display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 14, marginBottom: 28,
          }}>
            <MetricCard
              label="Jobs applied"
              value={stats.applied.current}
              delta={period === "all" ? null : stats.applied.current - stats.applied.prev}
              icon={Briefcase}
              accent="var(--accent)"
              accentSoft="var(--accent-soft)"
              hint={period === "all" ? "all time" : `vs prior ${periodMeta[period].short}`}
              onClick={() => setTab("pipeline")}
            />
            <MetricCard
              label="Meetings"
              value={stats.meetings.current}
              delta={period === "all" ? null : stats.meetings.current - stats.meetings.prev}
              icon={Calendar}
              accent="var(--moss)"
              accentSoft="var(--moss-soft)"
              hint={stats.meetings.upcoming > 0 ? `${stats.meetings.upcoming} upcoming` : (period === "all" ? "all time" : `vs prior ${periodMeta[period].short}`)}
              onClick={() => setTab("meetings")}
            />
            <MetricCard
              label="Messages logged"
              value={stats.outreach.current}
              delta={period === "all" ? null : stats.outreach.current - stats.outreach.prev}
              icon={Send}
              accent="var(--amber)"
              accentSoft="var(--amber-soft)"
              hint={period === "all" ? "all time" : `vs prior ${periodMeta[period].short}`}
              onClick={() => setTab("outreach")}
            />
            <MetricCard
              label="New contacts"
              value={stats.contacts.current}
              delta={period === "all" ? null : stats.contacts.current - stats.contacts.prev}
              icon={Users}
              accent="var(--rose)"
              accentSoft="var(--rose-soft)"
              hint={period === "all" ? "unique people" : "unique this period"}
              onClick={() => setTab("outreach")}
            />
          </div>

          {/* Campaign funnel — only if contacts exist */}
          {contacts.length > 0 && (
            <CampaignFunnel contacts={contacts} settings={settings} onJump={() => setTab("campaign")} />
          )}

          {/* Two-column: Pipeline breakdown + Recent activity */}
          <div style={{
            display: "grid", gridTemplateColumns: "minmax(0, 1.1fr) minmax(0, 1fr)",
            gap: 20,
          }}>
            <PipelineBreakdown byStatus={byStatus} onJump={() => setTab("pipeline")} />
            <RecentActivity recent={recent} />
          </div>
        </>
      )}
    </div>
  );
}

function MetricCard({ label, value, delta, icon: Icon, accent, accentSoft, hint, onClick }) {
  const positive = delta !== null && delta > 0;
  const negative = delta !== null && delta < 0;
  return (
    <button onClick={onClick} style={{
      background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 12,
      padding: "18px 18px 16px", cursor: "pointer", textAlign: "left",
      transition: "all 0.15s", display: "flex", flexDirection: "column", gap: 12,
    }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--ink-3)"; e.currentTarget.style.transform = "translateY(-1px)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--line)"; e.currentTarget.style.transform = "translateY(0)"; }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{
          width: 32, height: 32, borderRadius: 8, background: accentSoft,
          display: "grid", placeItems: "center", color: accent,
        }}>
          <Icon size={16} strokeWidth={1.8} />
        </div>
        {delta !== null && (
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 3,
            fontSize: 11, fontWeight: 500, padding: "2px 7px", borderRadius: 999,
            background: positive ? "var(--moss-soft)" : negative ? "var(--rose-soft)" : "var(--paper-deep)",
            color: positive ? "var(--moss)" : negative ? "var(--rose)" : "var(--ink-3)",
          }}>
            {positive && <TrendingUp size={10} />}
            {negative && <TrendingDown size={10} />}
            {delta > 0 ? "+" : ""}{delta}
          </span>
        )}
      </div>
      <div>
        <div className="jl-display" style={{
          fontSize: 36, fontWeight: 400, lineHeight: 1, letterSpacing: "-0.03em",
          color: "var(--ink)",
        }}>{value}</div>
        <div style={{ fontSize: 13, color: "var(--ink-2)", marginTop: 6, fontWeight: 500 }}>
          {label}
        </div>
        {hint && (
          <div style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 2 }}>{hint}</div>
        )}
      </div>
    </button>
  );
}

function PipelineBreakdown({ byStatus, onJump }) {
  const total = byStatus.total;
  return (
    <div style={{
      background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 12,
      padding: "20px 22px",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 16 }}>
        <h3 className="jl-display" style={{ fontSize: 17, fontWeight: 500, margin: 0 }}>
          Pipeline breakdown
        </h3>
        <button onClick={onJump} style={{
          fontSize: 12, color: "var(--accent)", background: "transparent", border: "none",
          cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 2,
        }}>
          View all <ChevronRight size={12} />
        </button>
      </div>

      {total === 0 ? (
        <p style={{ color: "var(--ink-3)", fontSize: 13, margin: 0 }}>
          No applications yet — add one to see this populate.
        </p>
      ) : (
        <>
          {/* Stacked bar */}
          <div style={{
            display: "flex", width: "100%", height: 10, borderRadius: 999,
            overflow: "hidden", background: "var(--paper-deep)", marginBottom: 14,
          }}>
            {STATUSES.map((s) => {
              const c = byStatus.counts[s.id];
              if (!c) return null;
              const pct = (c / total) * 100;
              return (
                <div key={s.id} title={`${s.label}: ${c}`} style={{
                  width: `${pct}%`, background: statusDot(s.id),
                  borderRight: "1px solid var(--paper)",
                }} />
              );
            })}
          </div>

          {/* Legend */}
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {STATUSES.map((s) => {
              const c = byStatus.counts[s.id];
              return (
                <div key={s.id} style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  fontSize: 13, padding: "3px 0",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{
                      width: 8, height: 8, borderRadius: "50%",
                      background: statusDot(s.id),
                    }} />
                    <span style={{ color: c > 0 ? "var(--ink)" : "var(--ink-3)" }}>{s.label}</span>
                  </div>
                  <span className="jl-mono" style={{
                    fontSize: 12, color: c > 0 ? "var(--ink-2)" : "var(--ink-4)",
                  }}>{c}</span>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function RecentActivity({ recent }) {
  const kindMeta = {
    applied: { icon: Briefcase, color: "var(--accent)", bg: "var(--accent-soft)", verb: "Applied to" },
    saved: { icon: Plus, color: "var(--ink-3)", bg: "var(--paper-deep)", verb: "Saved" },
    outreach_out: { icon: Send, color: "var(--amber)", bg: "var(--amber-soft)", verb: "Sent message to" },
    outreach_in: { icon: Mail, color: "var(--moss)", bg: "var(--moss-soft)", verb: "Heard from" },
    meeting: { icon: Calendar, color: "var(--rose)", bg: "var(--rose-soft)", verb: "Meeting with" },
    activity_log: { icon: PenLine, color: "var(--ink-2)", bg: "var(--paper-deep)", verb: "Logged" },
  };

  const relTime = (ts) => {
    const diff = Date.now() - ts;
    const future = diff < 0;
    const abs = Math.abs(diff);
    const day = 86400000;
    if (abs < 3600000) {
      const m = Math.max(1, Math.round(abs / 60000));
      return future ? `in ${m}m` : `${m}m ago`;
    }
    if (abs < day) {
      const h = Math.round(abs / 3600000);
      return future ? `in ${h}h` : `${h}h ago`;
    }
    const d = Math.round(abs / day);
    if (d < 30) return future ? `in ${d}d` : `${d}d ago`;
    const mo = Math.round(d / 30);
    return future ? `in ${mo}mo` : `${mo}mo ago`;
  };

  return (
    <div style={{
      background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 12,
      padding: "20px 22px",
    }}>
      <h3 className="jl-display" style={{ fontSize: 17, fontWeight: 500, margin: "0 0 14px" }}>
        Recent activity
      </h3>

      {recent.length === 0 ? (
        <p style={{ color: "var(--ink-3)", fontSize: 13, margin: 0 }}>
          Nothing here yet.
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column" }}>
          {recent.map((item, i) => {
            const meta = kindMeta[item.kind] || kindMeta.saved;
            const Icon = meta.icon;
            return (
              <button key={i} onClick={item.onClick} style={{
                display: "flex", alignItems: "center", gap: 12, padding: "10px 0",
                borderTop: i === 0 ? "none" : "1px solid var(--line-soft)",
                background: "transparent", border: "none", borderTop: i === 0 ? "none" : "1px solid var(--line-soft)",
                cursor: "pointer", textAlign: "left", width: "100%",
              }}>
                <div style={{
                  width: 28, height: 28, borderRadius: 8, background: meta.bg,
                  display: "grid", placeItems: "center", color: meta.color, flexShrink: 0,
                }}>
                  <Icon size={13} strokeWidth={2} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, color: "var(--ink)", lineHeight: 1.3 }}>
                    <span style={{ color: "var(--ink-3)" }}>{meta.verb}</span>{" "}
                    <span style={{ fontWeight: 500 }}>{item.title}</span>
                    {item.future && item.kind === "meeting" && (
                      <span style={{ fontSize: 10, marginLeft: 6, padding: "1px 6px", borderRadius: 999, background: "var(--rose-soft)", color: "var(--rose)", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                        upcoming
                      </span>
                    )}
                  </div>
                  {item.subtitle && (
                    <div style={{ fontSize: 12, color: "var(--ink-3)", marginTop: 1 }}>
                      {item.subtitle}
                    </div>
                  )}
                </div>
                <div style={{ fontSize: 11, color: "var(--ink-3)", flexShrink: 0 }}>
                  {relTime(item.ts)}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function DashboardEmpty({ setTab }) {
  const actions = [
    { id: "pipeline", label: "Add your first job", icon: Briefcase, hint: "Paste a URL, screenshot a posting, or fill it in" },
    { id: "activity", label: "Log an activity", icon: PenLine, hint: "Profile on a job board, research, anything uncategorized" },
    { id: "outreach", label: "Log outreach", icon: Send, hint: "Record LinkedIn DMs, emails, every conversation" },
    { id: "meetings", label: "Track a meeting", icon: Calendar, hint: "Sync from Calendar or add interviews by hand" },
    { id: "inbox", label: "Summarize Gmail", icon: Inbox, hint: "Digest your 10 most recent emails" },
  ];
  return (
    <div style={{
      padding: "48px 40px", textAlign: "center",
      border: "1px dashed var(--line)", borderRadius: 16,
      background: "var(--paper-deep)",
    }}>
      <div style={{
        width: 56, height: 56, borderRadius: "50%", background: "var(--accent-soft)",
        display: "grid", placeItems: "center", margin: "0 auto 18px", color: "var(--accent)",
      }}>
        <Activity size={24} strokeWidth={1.5} />
      </div>
      <h3 className="jl-display" style={{ fontSize: 24, fontWeight: 400, margin: "0 0 8px", letterSpacing: "-0.01em" }}>
        Your dashboard is waiting
      </h3>
      <p style={{
        color: "var(--ink-3)", fontSize: 14, margin: "0 auto 28px",
        maxWidth: 420, lineHeight: 1.55,
      }}>
        Once you start tracking jobs, meetings, and conversations, this is where you'll see your effort at a glance.
      </p>
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
        gap: 10, maxWidth: 560, margin: "0 auto",
      }}>
        {actions.map((a) => {
          const Icon = a.icon;
          return (
            <button key={a.id} onClick={() => setTab(a.id)} style={{
              background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 10,
              padding: "14px 14px", cursor: "pointer", textAlign: "left",
              display: "flex", flexDirection: "column", gap: 6,
              transition: "all 0.15s",
            }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--ink-3)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--line)"; }}>
              <Icon size={16} style={{ color: "var(--accent)" }} />
              <div style={{ fontSize: 13, fontWeight: 500, color: "var(--ink)" }}>{a.label}</div>
              <div style={{ fontSize: 11, color: "var(--ink-3)", lineHeight: 1.4 }}>{a.hint}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function CampaignFunnel({ contacts, settings, onJump }) {
  const stats = useMemo(() => {
    const counts = { total: contacts.length, researched: 0, drafted: 0, sent: 0, replied: 0, meeting: 0, followUp: 0 };
    const cutoff = Date.now() - (settings.followUpDays || 5) * 86400000;
    contacts.forEach((c) => {
      if (c.research?.completed) counts.researched++;
      if (c.status === "drafted") counts.drafted++;
      if (c.status === "sent" || c.status === "replied" || c.status === "meeting_scheduled") counts.sent++;
      if (c.status === "replied" || c.status === "meeting_scheduled") counts.replied++;
      if (c.status === "meeting_scheduled") counts.meeting++;
      if (c.status === "sent" && c.sentAt && c.sentAt < cutoff) counts.followUp++;
    });
    return counts;
  }, [contacts, settings.followUpDays]);

  const responseRate = stats.sent > 0 ? Math.round((stats.replied / stats.sent) * 100) : 0;

  return (
    <div style={{
      background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 12,
      padding: "20px 22px", marginBottom: 20,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 16 }}>
        <h3 className="jl-display" style={{ fontSize: 17, fontWeight: 500, margin: 0 }}>
          Campaign funnel
        </h3>
        <button onClick={onJump} style={{
          fontSize: 12, color: "var(--accent)", background: "transparent", border: "none",
          cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 2,
        }}>
          Open campaign <ChevronRight size={12} />
        </button>
      </div>

      {stats.followUp > 0 && (
        <div style={{
          padding: "10px 14px", borderRadius: 8, background: "var(--rose-soft)",
          color: "var(--rose)", fontSize: 13, marginBottom: 14,
          display: "flex", alignItems: "center", gap: 8,
        }}>
          <Bell size={14} />
          <span style={{ flex: 1 }}>
            <strong style={{ fontWeight: 500 }}>{stats.followUp}</strong> {stats.followUp === 1 ? "contact needs" : "contacts need"} a follow-up — sent over {settings.followUpDays || 5} days ago, no reply yet.
          </span>
          <button onClick={onJump} style={{
            background: "var(--rose)", color: "white", border: "none", cursor: "pointer",
            padding: "4px 10px", borderRadius: 6, fontSize: 12, fontWeight: 500,
            fontFamily: "inherit",
          }}>
            Open list →
          </button>
        </div>
      )}

      <div style={{
        display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))",
        gap: 10,
      }}>
        <FunnelStat label="Total" value={stats.total} sub="in list" color="var(--ink-3)" />
        <FunnelStat label="Researched" value={stats.researched} sub="briefed" color="var(--amber)" />
        <FunnelStat label="Sent" value={stats.sent} sub="emails out" color="var(--accent)" />
        <FunnelStat label="Replied" value={stats.replied} sub={`${responseRate}% rate`} color="var(--moss)" />
        <FunnelStat label="Meetings" value={stats.meeting} sub="booked" color="var(--moss)" />
      </div>
    </div>
  );
}

function FunnelStat({ label, value, sub, color }) {
  return (
    <div style={{
      background: "var(--paper)", borderRadius: 8, padding: "12px 14px",
      border: "1px solid var(--line-soft)",
    }}>
      <div style={{
        fontSize: 10, color: "var(--ink-3)", textTransform: "uppercase",
        letterSpacing: "0.1em", marginBottom: 4, fontWeight: 500,
      }}>{label}</div>
      <div className="jl-display" style={{
        fontSize: 22, fontWeight: 500, lineHeight: 1, color: color,
      }}>{value}</div>
      <div style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 3 }}>{sub}</div>
    </div>
  );
}

/* ============================================================
   DAILY BRIEFING — AI coach recommendations
   ============================================================ */
function DailyBriefing({ applications, outreach, meetings, contacts, settings, setTab }) {
  const [briefing, setBriefing] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState(null);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    (async () => {
      const b = await loadKey(STORAGE_KEYS.briefing, null);
      if (b) setBriefing(b);
    })();
  }, []);

  const profileMissing = !settings.userName;
  const stale = briefing && (Date.now() - briefing.generatedAt > 24 * 3600 * 1000);

  const generate = async () => {
    setGenerating(true);
    setError(null);
    try {
      const now = Date.now();
      const tsOf = (v) => { if (!v) return 0; const t = new Date(v).getTime(); return isNaN(t) ? 0 : t; };
      const last7 = now - 7 * 86400000;
      const last14 = now - 14 * 86400000;
      const followUpDays = settings.followUpDays || 5;

      // Application stats
      const byStatus = {};
      STATUSES.forEach((s) => byStatus[s.id] = 0);
      applications.forEach((a) => { byStatus[a.status || "saved"] = (byStatus[a.status || "saved"] || 0) + 1; });
      const appliedLast7 = applications.filter((a) => isAppliedApplication(a) && applicationAppliedTimestamp(a) >= last7).length;
      const stuckInApplied = applications.filter((a) => a.status === "applied" && applicationAppliedTimestamp(a) > 0 && applicationAppliedTimestamp(a) < last14);

      // Outreach stats
      const outboundLast7 = outreach.filter((o) => o.direction === "outbound" && tsOf(o.date) >= last7).length;
      const inboundLast7 = outreach.filter((o) => o.direction === "inbound" && tsOf(o.date) >= last7).length;

      // Campaign stats
      const campStats = { total: contacts.length, researched: 0, drafted: 0, sent: 0, replied: 0, meeting: 0, followUps: [] };
      const followUpCutoff = now - followUpDays * 86400000;
      contacts.forEach((c) => {
        if (c.research?.completed) campStats.researched++;
        if (c.status === "drafted") campStats.drafted++;
        if (["sent", "replied", "meeting_scheduled"].includes(c.status)) campStats.sent++;
        if (["replied", "meeting_scheduled"].includes(c.status)) campStats.replied++;
        if (c.status === "meeting_scheduled") campStats.meeting++;
        if (c.status === "sent" && c.sentAt && c.sentAt < followUpCutoff) {
          campStats.followUps.push(c.name || c.email);
        }
      });
      const responseRate = campStats.sent > 0 ? Math.round((campStats.replied / campStats.sent) * 100) : 0;

      // Meeting stats
      const upcoming = meetings.filter((m) => tsOf(m.when) > now).length;
      const thisWeek = meetings.filter((m) => tsOf(m.when) >= last7 && tsOf(m.when) <= now).length;
      const upcomingDetails = meetings
        .filter((m) => tsOf(m.when) > now)
        .sort((a, b) => tsOf(a.when) - tsOf(b.when))
        .slice(0, 3)
        .map((m) => ({ title: m.title, when: m.when, company: m.company, type: m.type }));

      // Activity check — is the user actually active?
      const totalActivity = appliedLast7 + outboundLast7 + thisWeek;
      const isInactive = totalActivity === 0 && applications.length > 0;

      const stateBlob = {
        user: {
          name: settings.userName,
          background: settings.userBackground || "(not provided)",
          angle: settings.outreachAngle || "(not provided)",
        },
        applications: {
          total: applications.length,
          by_status: byStatus,
          applied_last_7_days: appliedLast7,
          stuck_in_applied_over_14_days: stuckInApplied.length,
          stuck_companies: stuckInApplied.slice(0, 5).map((a) => a.company),
        },
        outreach: {
          outbound_last_7_days: outboundLast7,
          inbound_last_7_days: inboundLast7,
        },
        campaign: campStats,
        meetings: {
          upcoming_count: upcoming,
          this_week_past_count: thisWeek,
          next_3: upcomingDetails,
        },
        flags: {
          inactive: isInactive,
          no_outreach: outboundLast7 === 0 && applications.length > 0,
          high_response_rate: responseRate >= 25 && campStats.sent >= 5,
          low_response_rate: responseRate < 10 && campStats.sent >= 10,
        },
      };

      const { text } = await callAI({
        system: "You are a candid job-search coach. Honest, specific, no platitudes. Speak directly to the user. Return only valid JSON.",
        content: `Review this user's last 7 days of job-search activity and write today's briefing.

STATE:
${JSON.stringify(stateBlob, null, 2)}

Return JSON in this shape:
{
  "summary": "2-3 sentences honestly assessing momentum and effort. Specific.",
  "today_focus": "ONE concrete thing to do today that moves the needle most — proper nouns when possible (specific company, contact, action)",
  "recommendations": [
    {
      "priority": "high" | "medium" | "low",
      "action": "specific action — name companies, contacts, stages when possible",
      "rationale": "1 sentence — why this matters right now"
    }
    // 3-5 items, sorted by priority
  ]
}

GUIDELINES:
- Be direct. No "you've got this!" energy. No platitudes.
- Reference proper nouns where you can (specific companies stuck in applied, specific follow-ups due, specific upcoming meetings).
- If they're inactive, say so plainly and suggest one easy unlock.
- If response rate is low, suggest tactical changes (subject lines, more specific personalization, different angle).
- If pipeline is heavy on saved/applied but light on interviews, recommend converting saves to applies or doubling down on outreach for those companies.
- If they have offers or interviews, suggest interview prep or negotiation prep, not more applying.
- Prioritize moving warm threads (interviews, replies) over starting cold ones, unless inactive.
- 3-5 recommendations max. Quality over quantity.

JSON only. No markdown fences.`,
        maxTokens: 1800,
        feature: "briefing",
      });
      const parsed = extractJSON(text);
      if (parsed && parsed.summary) {
        const next = { ...parsed, generatedAt: Date.now() };
        setBriefing(next);
        saveKey(STORAGE_KEYS.briefing, next);
      } else {
        setError("Couldn't parse briefing");
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setGenerating(false);
    }
  };

  if (profileMissing && !briefing) {
    return (
      <div style={{
        background: "var(--surface)", border: "1px solid var(--accent)",
        borderRadius: 14, padding: "20px 24px", marginBottom: 22,
        boxShadow: "0 0 0 4px var(--accent-soft)",
        display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap",
      }}>
        <div style={{
          width: 36, height: 36, borderRadius: 8, background: "var(--accent-soft)",
          display: "grid", placeItems: "center", color: "var(--accent)", flexShrink: 0,
        }}>
          <Sparkles size={17} strokeWidth={1.8} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3 className="jl-display" style={{ fontSize: 17, fontWeight: 500, margin: 0, letterSpacing: "-0.01em" }}>
            Today's briefing
          </h3>
          <div style={{ fontSize: 13, color: "var(--ink-3)", marginTop: 3, lineHeight: 1.5 }}>
            Set up your profile in Campaign so I know who you are and what you're looking for. Then I can analyze your activity and suggest specific next moves.
          </div>
        </div>
        <button onClick={() => setTab && setTab("campaign")} style={{
          ...primaryBtn, background: "var(--accent)", color: "white",
        }}>
          <Settings size={14} /> Set up profile
        </button>
      </div>
    );
  }

  const priorityColors = {
    high: { bg: "var(--rose-soft)", fg: "var(--rose)" },
    medium: { bg: "var(--amber-soft)", fg: "var(--amber)" },
    low: { bg: "var(--moss-soft)", fg: "var(--moss)" },
  };

  return (
    <div style={{
      background: "var(--surface)", border: "1px solid var(--accent)",
      borderRadius: 14, padding: "20px 24px", marginBottom: 22,
      boxShadow: "0 0 0 4px var(--accent-soft)",
    }}>
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        marginBottom: briefing && !collapsed ? 16 : 0, gap: 12, flexWrap: "wrap",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8, background: "var(--accent-soft)",
            display: "grid", placeItems: "center", color: "var(--accent)",
          }}>
            <Sparkles size={16} strokeWidth={1.8} />
          </div>
          <div>
            <h3 className="jl-display" style={{ fontSize: 18, fontWeight: 500, margin: 0, letterSpacing: "-0.01em" }}>
              Today's briefing
            </h3>
            {briefing && (
              <div style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 1 }}>
                Generated {Math.floor((Date.now() - briefing.generatedAt) / 3600000) < 1
                  ? "just now"
                  : `${Math.floor((Date.now() - briefing.generatedAt) / 3600000)}h ago`}
                {stale && <span style={{ color: "var(--amber)", marginLeft: 6 }}>· stale, consider refreshing</span>}
              </div>
            )}
          </div>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {briefing && (
            <button onClick={() => setCollapsed(!collapsed)} style={ghostBtnSm}>
              {collapsed ? "Expand" : "Collapse"}
            </button>
          )}
          <button onClick={generate} disabled={generating}
            style={{
              ...primaryBtn, background: stale || !briefing ? "var(--accent)" : "transparent",
              color: stale || !briefing ? "white" : "var(--ink-2)",
              border: stale || !briefing ? "none" : "1px solid var(--line)",
              padding: "6px 12px", fontSize: 13,
              opacity: generating ? 0.6 : 1,
            }}>
            {generating ? <RefreshCw size={13} className="jl-spin" /> : <Sparkles size={13} />}
            {generating ? "Analyzing…" : briefing ? "Refresh" : "Generate briefing"}
          </button>
        </div>
      </div>

      {error && (
        <div style={{
          padding: "10px 14px", borderRadius: 8, background: "var(--rose-soft)",
          color: "var(--rose)", fontSize: 13, marginTop: 12,
          display: "flex", alignItems: "center", gap: 8,
        }}>
          <AlertCircle size={14} /> {error}
        </div>
      )}

      {briefing && !collapsed && (
        <div className="jl-fade">
          <p style={{ fontSize: 15, lineHeight: 1.6, color: "var(--ink)", margin: "0 0 14px" }}>
            {briefing.summary}
          </p>

          {briefing.today_focus && (
            <div style={{
              padding: "12px 16px", background: "var(--paper)", borderRadius: 10,
              border: "1px solid var(--accent-soft)", marginBottom: 16,
              display: "flex", alignItems: "start", gap: 10,
            }}>
              <div style={{
                width: 24, height: 24, borderRadius: "50%", background: "var(--accent)",
                color: "white", display: "grid", placeItems: "center", flexShrink: 0,
                fontSize: 12, fontWeight: 500,
              }}>
                <ArrowRight size={13} />
              </div>
              <div>
                <div style={{
                  fontSize: 11, color: "var(--ink-3)", textTransform: "uppercase",
                  letterSpacing: "0.1em", fontWeight: 500, marginBottom: 2,
                }}>Today's focus</div>
                <div style={{ fontSize: 14, color: "var(--ink)", lineHeight: 1.5 }}>
                  {briefing.today_focus}
                </div>
              </div>
            </div>
          )}

          {briefing.recommendations?.length > 0 && (
            <div>
              <div style={{
                fontSize: 11, color: "var(--ink-3)", textTransform: "uppercase",
                letterSpacing: "0.1em", fontWeight: 500, marginBottom: 8,
              }}>Recommendations</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {briefing.recommendations.map((r, i) => {
                  const pc = priorityColors[r.priority] || priorityColors.medium;
                  return (
                    <div key={i} style={{
                      padding: "12px 14px", background: "var(--paper)", borderRadius: 8,
                      border: "1px solid var(--line-soft)",
                      display: "flex", gap: 10, alignItems: "start",
                    }}>
                      <span style={{
                        fontSize: 10, padding: "2px 7px", borderRadius: 999,
                        background: pc.bg, color: pc.fg, fontWeight: 500,
                        textTransform: "uppercase", letterSpacing: "0.05em",
                        flexShrink: 0, marginTop: 2,
                      }}>{r.priority || "med"}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, color: "var(--ink)", lineHeight: 1.5, fontWeight: 500 }}>
                          {r.action}
                        </div>
                        {r.rationale && (
                          <div style={{ fontSize: 12, color: "var(--ink-3)", lineHeight: 1.5, marginTop: 4 }}>
                            {r.rationale}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {!briefing && !generating && !error && (
        <p style={{ fontSize: 13, color: "var(--ink-3)", margin: "12px 0 0", lineHeight: 1.55 }}>
          Hit "Generate briefing" — I'll review your last 7 days of activity and tell you what would actually move things forward today.
        </p>
      )}
    </div>
  );
}


/* ============================================================
   LINKEDIN OUTREACH FLOW
   ============================================================ */
const LINKEDIN_STAGES = [
  { id: "to_invite", label: "To invite", color: "var(--ink-3)" },
  { id: "invite_drafted", label: "Draft ready", color: "var(--amber)" },
  { id: "invite_sent", label: "Invite sent", color: "var(--accent)" },
  { id: "connected", label: "Connected", color: "var(--moss)" },
  { id: "coffee_drafted", label: "Coffee draft ready", color: "var(--amber)" },
  { id: "coffee_sent", label: "Coffee sent", color: "var(--accent)" },
  { id: "coffee_replied", label: "Replied", color: "var(--moss)" },
  { id: "meeting_scheduled", label: "Meeting set", color: "var(--moss)" },
];
const liStageMeta = (id) => LINKEDIN_STAGES.find((s) => s.id === id) || LINKEDIN_STAGES[0];

function LinkedInView({ linkedinContacts, settings, upsertContact, upsertOutreach, onOpenContact, onAddProfiles, onUploadConnections, flash }) {
  const [editingDraft, setEditingDraft] = useState(null); // { contact, kind: "connection" | "coffee" }
  const [drafting, setDrafting] = useState(null); // contact id being drafted

  // Group by stage
  const byStage = useMemo(() => {
    const g = {};
    LINKEDIN_STAGES.forEach((s) => g[s.id] = []);
    linkedinContacts.forEach((c) => {
      const s = c.linkedinStage || "to_invite";
      (g[s] || g.to_invite).push(c);
    });
    return g;
  }, [linkedinContacts]);

  const draftConnection = async (contact) => {
    setDrafting(contact.id);
    try {
      const firstName = (contact.name || "").split(/\s+/)[0] || "there";
      const { text } = await callAI({
        system: "You write warm, concise LinkedIn connection requests. Strict 300 character limit. Return only JSON.",
        content: `Write a LinkedIn connection request note from ${settings.userName} to this person.

ABOUT THE SENDER:
Name: ${settings.userName}
Background: ${settings.userBackground || "—"}
Why reaching out / angle: ${settings.outreachAngle || "—"}

ABOUT THE RECIPIENT:
Name: ${contact.name} (first name: ${firstName})
Headline: ${contact.headline || "—"}
Role: ${contact.role || "—"}
Company: ${contact.company || "—"}
${contact.research?.summary ? `Research summary: ${contact.research.summary}` : ""}
${contact.research?.talking_points?.length ? `Specific things known: ${contact.research.talking_points.join(" | ")}` : ""}

WRITING RULES:
- HARD CAP: 300 characters total. Count them. Stay under.
- Warm, professional, peer-to-peer. Not stiff, not salesy.
- Reference ONE specific thing from their work/headline/research if available. If nothing specific, lead with a respectful note about why you'd like to connect.
- Briefly mention who you are (one phrase).
- DO NOT ask for a meeting, coffee, or anything else. This is JUST a connection request.
- Sign with sender's first name only.
- Plain text. No links. No formatting.

Return JSON: { "message": "<300 char message>" }`,
        maxTokens: 600,
        feature: "linkedin_message",
      });
      const parsed = extractJSON(text);
      if (parsed && parsed.message) {
        // Enforce 300 char limit
        const trimmed = parsed.message.length > 300 ? parsed.message.slice(0, 297) + "..." : parsed.message;
        const draft = { subject: "", body: trimmed, generatedAt: Date.now() };
        const updated = { ...contact, linkedinStage: "invite_drafted", connectionMessage: trimmed, lastDraft: draft };
        upsertContact(updated);
        setEditingDraft({ contact: updated, kind: "connection" });
      } else {
        flash("Couldn't generate connection draft", "err");
      }
    } catch (e) {
      flash("Draft failed: " + e.message, "err");
    } finally {
      setDrafting(null);
    }
  };

  const draftCoffee = async (contact) => {
    setDrafting(contact.id);
    try {
      const firstName = (contact.name || "").split(/\s+/)[0] || "there";
      const { text } = await callAI({
        system: "You write short, warm LinkedIn DMs asking for a virtual coffee chat. Return only JSON.",
        content: `Write a LinkedIn direct message from ${settings.userName} to ${contact.name}, who just accepted the connection request. The goal: ask for a 20-minute virtual coffee chat to learn about their experience with AI in their work.

ABOUT THE SENDER:
Name: ${settings.userName}
Background: ${settings.userBackground || "—"}
Angle: ${settings.outreachAngle || "—"}

ABOUT THEM:
Name: ${contact.name} (first name: ${firstName})
Headline: ${contact.headline || "—"}
Role: ${contact.role || "—"}
Company: ${contact.company || "—"}
${contact.research?.summary ? `Research summary: ${contact.research.summary}` : ""}
${contact.research?.talking_points?.length ? `Specific things known: ${contact.research.talking_points.join(" | ")}` : ""}

WRITING RULES:
- 3-5 sentences. Plain text. No formatting.
- Open by briefly thanking them for connecting (one sentence).
- Reference something specific from their profile or work — ideally connecting to AI in their role or industry.
- Make the ask clearly: a 20-minute virtual coffee to learn from their experience with AI.
- Suggest flexibility on timing ("happy to work around your schedule" or similar).
- Sign with sender's first name only.
- No links, no calendar invites yet, no scheduling tools mentioned.

Return JSON: { "message": "<3-5 sentence message starting with 'Hi ${firstName}, '>" }`,
        maxTokens: 800,
        feature: "linkedin_message",
      });
      const parsed = extractJSON(text);
      if (parsed && parsed.message) {
        const draft = { subject: "", body: parsed.message, generatedAt: Date.now() };
        const updated = { ...contact, linkedinStage: "coffee_drafted", coffeeMessage: parsed.message, lastDraft: draft };
        upsertContact(updated);
        setEditingDraft({ contact: updated, kind: "coffee" });
      } else {
        flash("Couldn't generate coffee draft", "err");
      }
    } catch (e) {
      flash("Draft failed: " + e.message, "err");
    } finally {
      setDrafting(null);
    }
  };

  const markSent = (contact, kind) => {
    const now = Date.now();
    if (kind === "connection") {
      upsertContact({ ...contact, linkedinStage: "invite_sent", connectionSentAt: now });
      upsertOutreach({
        channel: "LinkedIn", contact: contact.name, contactEmail: contact.linkedinUrl || "",
        company: contact.company || "", subject: "Connection request",
        direction: "outbound", date: new Date(now).toISOString().slice(0, 10),
        notes: contact.connectionMessage || "", status: "sent", contactId: contact.id,
      });
      flash(`Connection request marked sent`);
    } else {
      upsertContact({ ...contact, linkedinStage: "coffee_sent", coffeeSentAt: now, sentAt: now });
      upsertOutreach({
        channel: "LinkedIn", contact: contact.name, contactEmail: contact.linkedinUrl || "",
        company: contact.company || "", subject: "Virtual coffee request",
        direction: "outbound", date: new Date(now).toISOString().slice(0, 10),
        notes: contact.coffeeMessage || "", status: "sent", contactId: contact.id,
      });
      flash(`Coffee message marked sent`);
    }
    setEditingDraft(null);
  };

  if (linkedinContacts.length === 0) {
    return (
      <div style={{
        padding: "60px 30px", textAlign: "center",
        border: "1px dashed var(--line)", borderRadius: 14, background: "var(--paper-deep)",
      }}>
        <div style={{
          width: 52, height: 52, borderRadius: "50%", background: "var(--accent-soft)",
          display: "grid", placeItems: "center", margin: "0 auto 16px", color: "var(--accent)",
        }}>
          <Linkedin size={22} strokeWidth={1.5} />
        </div>
        <h3 className="jl-display" style={{ fontSize: 22, fontWeight: 400, margin: "0 0 8px" }}>
          LinkedIn outreach flow
        </h3>
        <p style={{ color: "var(--ink-3)", fontSize: 14, margin: "0 auto 20px", maxWidth: 480, lineHeight: 1.55 }}>
          Paste 5-10 LinkedIn profile URLs. I'll try to research each person, draft a 300-character connection request for you to send, and once they accept, draft a virtual coffee request to learn from their AI experience.
        </p>
        <button onClick={onAddProfiles} style={{ ...primaryBtn, background: "var(--accent)", color: "white" }}>
          <Linkedin size={15} /> Add LinkedIn profiles
        </button>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 18, flexWrap: "wrap" }}>
        <button onClick={onAddProfiles} style={{ ...primaryBtn, background: "var(--accent)", color: "white" }}>
          <Plus size={14} /> Add profiles
        </button>
        <button onClick={onUploadConnections} style={ghostBtn}>
          <Camera size={14} /> Mark connected via screenshot
        </button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {LINKEDIN_STAGES.map((s) => {
          const cs = byStage[s.id];
          if (!cs || cs.length === 0) return null;
          return (
            <div key={s.id}>
              <div style={{
                display: "flex", alignItems: "center", gap: 8, marginBottom: 8,
                padding: "0 4px",
              }}>
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: s.color }} />
                <span className="jl-display" style={{ fontSize: 13, fontWeight: 500, color: "var(--ink-2)" }}>
                  {s.label}
                </span>
                <span style={{ fontSize: 12, color: "var(--ink-3)" }}>· {cs.length}</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {cs.map((c) => (
                  <LinkedInRow key={c.id} contact={c}
                    drafting={drafting === c.id}
                    onOpen={() => onOpenContact(c)}
                    onDraftConnection={() => draftConnection(c)}
                    onDraftCoffee={() => draftCoffee(c)}
                    onViewDraft={(kind) => setEditingDraft({ contact: c, kind })}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {editingDraft && (
        <LinkedInMessageEditor
          contact={editingDraft.contact}
          kind={editingDraft.kind}
          onClose={() => setEditingDraft(null)}
          onUpdate={(patch) => {
            const updated = { ...editingDraft.contact, ...patch };
            upsertContact(updated);
            setEditingDraft({ ...editingDraft, contact: updated });
          }}
          onMarkSent={() => markSent(editingDraft.contact, editingDraft.kind)}
          flash={flash}
        />
      )}
    </div>
  );
}

function LinkedInRow({ contact, drafting, onOpen, onDraftConnection, onDraftCoffee, onViewDraft }) {
  const stage = contact.linkedinStage || "to_invite";

  const renderAction = () => {
    if (drafting) {
      return <span className="jl-pulse" style={{ fontSize: 12, color: "var(--ink-3)", padding: "5px 10px" }}>Drafting…</span>;
    }
    if (stage === "to_invite") {
      return (
        <button onClick={onDraftConnection} style={{ ...primaryBtn, background: "var(--accent)", color: "white", padding: "5px 12px", fontSize: 12 }}>
          <Edit3 size={12} /> Draft connection
        </button>
      );
    }
    if (stage === "invite_drafted") {
      return (
        <button onClick={() => onViewDraft("connection")} style={{ ...primaryBtn, padding: "5px 12px", fontSize: 12 }}>
          <FileText size={12} /> Open draft
        </button>
      );
    }
    if (stage === "invite_sent") {
      return <span style={{ fontSize: 11, color: "var(--ink-3)", padding: "4px 10px", fontStyle: "italic" }}>waiting on accept</span>;
    }
    if (stage === "connected") {
      return (
        <button onClick={onDraftCoffee} style={{ ...primaryBtn, background: "var(--accent)", color: "white", padding: "5px 12px", fontSize: 12 }}>
          <Edit3 size={12} /> Draft coffee ask
        </button>
      );
    }
    if (stage === "coffee_drafted") {
      return (
        <button onClick={() => onViewDraft("coffee")} style={{ ...primaryBtn, padding: "5px 12px", fontSize: 12 }}>
          <FileText size={12} /> Open draft
        </button>
      );
    }
    return <span style={{ fontSize: 11, color: "var(--ink-3)", padding: "4px 10px", fontStyle: "italic" }}>{liStageMeta(stage).label}</span>;
  };

  return (
    <div style={{
      background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 10,
      padding: "12px 16px", display: "flex", alignItems: "center", gap: 12,
    }}>
      <button onClick={onOpen} style={{
        width: 36, height: 36, borderRadius: "50%", background: "var(--paper-deep)",
        border: "none", cursor: "pointer", display: "grid", placeItems: "center",
        color: "var(--ink-2)", fontSize: 12, fontWeight: 500, flexShrink: 0,
        fontFamily: "inherit",
      }}>
        {(contact.name || "?").split(/\s+/).map((n) => n[0]).slice(0, 2).join("").toUpperCase()}
      </button>
      <div style={{ flex: 1, minWidth: 0, cursor: "pointer" }} onClick={onOpen}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 1, flexWrap: "wrap" }}>
          <span style={{ fontSize: 14, color: "var(--ink)", fontWeight: 500 }}>{contact.name}</span>
          {contact.linkedinUrl && (
            <a href={contact.linkedinUrl} target="_blank" rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              style={{ color: "var(--ink-3)", display: "inline-flex", alignItems: "center" }}>
              <ExternalLink size={11} />
            </a>
          )}
        </div>
        <div style={{ fontSize: 12, color: "var(--ink-3)", lineHeight: 1.4 }}>
          {contact.headline || [contact.role, contact.company].filter(Boolean).join(" at ") || "—"}
        </div>
      </div>
      <div style={{ flexShrink: 0 }}>{renderAction()}</div>
    </div>
  );
}

function LinkedInMessageEditor({ contact, kind, onClose, onUpdate, onMarkSent, flash }) {
  const isConnection = kind === "connection";
  const initialBody = isConnection ? (contact.connectionMessage || "") : (contact.coffeeMessage || "");
  const [body, setBody] = useState(initialBody);
  const charCount = body.length;
  const overLimit = isConnection && charCount > 300;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(body);
      flash("Copied to clipboard — paste into LinkedIn");
    } catch {
      flash("Couldn't copy — select all and copy manually", "err");
    }
  };

  const save = () => {
    const patch = isConnection ? { connectionMessage: body } : { coffeeMessage: body };
    onUpdate(patch);
  };

  return (
    <div style={drawerOverlay} onClick={onClose}>
      <div className="jl-fade jl-scroll" onClick={(e) => e.stopPropagation()} style={{
        position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
        width: "min(620px, 94vw)", maxHeight: "90vh", overflowY: "auto",
        background: "var(--surface)", borderRadius: 14, padding: "26px 30px",
        border: "1px solid var(--line)",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 11, color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 4 }}>
              {isConnection ? "LinkedIn connection request" : "Virtual coffee message"}
            </div>
            <h2 className="jl-display" style={{ fontSize: 22, fontWeight: 500, margin: 0 }}>
              To {contact.name}
            </h2>
            <div style={{ fontSize: 13, color: "var(--ink-3)", marginTop: 2 }}>
              {contact.headline || [contact.role, contact.company].filter(Boolean).join(" at ")}
            </div>
          </div>
          <button onClick={onClose} style={iconBtn}><X size={18} /></button>
        </div>

        <Field label="Message">
          <textarea value={body} onChange={(e) => setBody(e.target.value)}
            style={{
              ...inputBase, minHeight: isConnection ? 120 : 200, resize: "vertical",
              lineHeight: 1.6, fontSize: 14,
              borderColor: overLimit ? "var(--rose)" : "var(--line)",
            }} />
          {isConnection && (
            <div style={{
              fontSize: 11, marginTop: 4, textAlign: "right",
              color: overLimit ? "var(--rose)" : charCount > 280 ? "var(--amber)" : "var(--ink-3)",
              fontWeight: overLimit ? 500 : 400,
            }}>
              {charCount} / 300 characters {overLimit && "— LinkedIn will reject this"}
            </div>
          )}
        </Field>

        <div style={{
          marginTop: 14, padding: "10px 14px", borderRadius: 8,
          background: "var(--paper)", border: "1px solid var(--line-soft)",
          fontSize: 12, color: "var(--ink-3)", lineHeight: 1.5,
        }}>
          <strong style={{ color: "var(--ink-2)", fontWeight: 500 }}>How to send:</strong> Copy this message, open {contact.name}'s LinkedIn profile, {isConnection ? "click Connect → Add a note → paste" : "open the message thread → paste"}, send. Then come back here and click "Mark as sent" to track it.
        </div>

        <div style={{ display: "flex", gap: 8, justifyContent: "space-between", alignItems: "center", marginTop: 18, flexWrap: "wrap" }}>
          <button onClick={save} style={ghostBtn}>
            <Check size={14} /> Save changes
          </button>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={copy} style={ghostBtn}>
              <FileText size={14} /> Copy message
            </button>
            <button onClick={onMarkSent} disabled={overLimit}
              style={{
                ...primaryBtn, background: "var(--accent)", color: "white",
                opacity: overLimit ? 0.5 : 1,
              }}>
              <Send size={14} /> Mark as sent
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function AddLinkedInProfilesModal({ onClose, onAdd }) {
  const [input, setInput] = useState("");
  const [parsing, setParsing] = useState(false);
  const [parsed, setParsed] = useState(null); // [{ url, name, headline, role, company, summary, talking_points }]
  const [error, setError] = useState(null);

  const parseUrls = (text) => {
    return text.split(/[\n,]/)
      .map((s) => s.trim())
      .filter((s) => s && /linkedin\.com\/(?:in|pub)\//i.test(s))
      .slice(0, 10);
  };

  const lookup = async () => {
    const urls = parseUrls(input);
    if (urls.length === 0) {
      setError("No valid LinkedIn URLs found. Each should look like linkedin.com/in/name");
      return;
    }
    setParsing(true);
    setError(null);
    try {
      // Research each profile via web search (in parallel, capped)
      const results = await Promise.all(urls.map(async (url) => {
        try {
          // Try to extract a slug for fallback name
          const slug = (url.match(/\/in\/([^/?]+)/i)?.[1] || "")
            .replace(/-/g, " ").replace(/\d+/g, "").trim();
          const fallbackName = slug.split(" ").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");

          const { text } = await callAI({
            system: "You research LinkedIn profiles from public web sources. LinkedIn profiles are often gated, but search results can surface info. Return only valid JSON.",
            content: `Use web search to find public information about the person at this LinkedIn URL: ${url}

Try to identify:
- Full name (may be inferable from URL slug)
- Current job title/headline
- Company
- A short summary of their professional focus
- 2-4 specific talking points (recent posts, talks, projects, especially anything AI-related)

Return JSON:
{
  "name": "<full name>",
  "headline": "<title/headline>",
  "role": "<role>",
  "company": "<company>",
  "summary": "<1-2 sentences>",
  "talking_points": ["...", "..."]
}

If you can't find them, return:
{ "name": "${fallbackName}", "headline": "", "role": "", "company": "", "summary": "", "talking_points": [] }

JSON only. No commentary.`,
            tools: [{ type: "web_search_20250305", name: "web_search" }],
            maxTokens: 1500,
            feature: "linkedin_profile",
          });
          const obj = extractJSON(text);
          return {
            url,
            name: obj?.name || fallbackName || "Unknown",
            headline: obj?.headline || "",
            role: obj?.role || "",
            company: obj?.company || "",
            summary: obj?.summary || "",
            talking_points: obj?.talking_points || [],
            researched: !!(obj?.summary || obj?.talking_points?.length),
          };
        } catch {
          return { url, name: "Unknown", headline: "", role: "", company: "", summary: "", talking_points: [], researched: false };
        }
      }));
      setParsed(results);
    } catch (e) {
      setError("Lookup failed: " + e.message);
    } finally {
      setParsing(false);
    }
  };

  const editName = (i, name) => {
    setParsed(parsed.map((p, idx) => idx === i ? { ...p, name } : p));
  };

  const importAll = () => {
    const items = parsed.map((p) => ({
      name: p.name,
      email: "", // LinkedIn-only contacts may have no email
      linkedin: p.url,
      linkedinUrl: p.url,
      headline: p.headline,
      role: p.role,
      company: p.company,
      channel: "linkedin",
      linkedinStage: "to_invite",
      status: "new",
      source: "linkedin_url",
      research: p.researched ? {
        completed: true,
        completedAt: Date.now(),
        summary: p.summary,
        talking_points: p.talking_points,
      } : undefined,
    }));
    onAdd(items);
  };

  return (
    <div style={drawerOverlay} onClick={onClose}>
      <div className="jl-fade jl-scroll" onClick={(e) => e.stopPropagation()} style={{
        position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
        width: "min(680px, 94vw)", maxHeight: "92vh", overflowY: "auto",
        background: "var(--surface)", borderRadius: 14, padding: "26px 30px",
        border: "1px solid var(--line)",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <h2 className="jl-display" style={{ fontSize: 22, fontWeight: 500, margin: 0 }}>
            Add LinkedIn profiles
          </h2>
          <button onClick={onClose} style={iconBtn}><X size={18} /></button>
        </div>
        <p style={{ color: "var(--ink-3)", fontSize: 13, margin: "0 0 20px", lineHeight: 1.55 }}>
          Paste up to 10 LinkedIn URLs (one per line). I'll search the public web for what I can find about each person. Profiles are often gated by login, so results vary — you'll review and edit names before saving.
        </p>

        {!parsed && (
          <>
            <Field label="LinkedIn URLs">
              <textarea value={input} onChange={(e) => setInput(e.target.value)}
                style={{ ...inputBase, minHeight: 180, fontSize: 13, fontFamily: "JetBrains Mono, monospace" }}
                placeholder="https://www.linkedin.com/in/jane-doe&#10;https://www.linkedin.com/in/john-smith&#10;..." />
            </Field>
            {error && (
              <div style={{
                marginTop: 12, padding: "10px 14px", borderRadius: 8,
                background: "var(--rose-soft)", color: "var(--rose)", fontSize: 13,
                display: "flex", alignItems: "center", gap: 8,
              }}>
                <AlertCircle size={14} /> {error}
              </div>
            )}
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16 }}>
              <button onClick={onClose} style={ghostBtn}>Cancel</button>
              <button onClick={lookup} disabled={parsing || !input.trim()}
                style={{ ...primaryBtn, background: "var(--accent)", color: "white", opacity: parsing || !input.trim() ? 0.6 : 1 }}>
                {parsing ? <RefreshCw size={14} className="jl-spin" /> : <Sparkles size={14} />}
                {parsing ? "Researching profiles…" : "Look them up"}
              </button>
            </div>
          </>
        )}

        {parsed && (
          <>
            <div style={{
              padding: "10px 14px", background: "var(--moss-soft)", color: "var(--moss)",
              fontSize: 13, borderRadius: 8, marginBottom: 14,
              display: "flex", alignItems: "center", gap: 8,
            }}>
              <CheckCircle2 size={14} /> Found {parsed.length} {parsed.length === 1 ? "profile" : "profiles"} · {parsed.filter((p) => p.researched).length} researched, {parsed.filter((p) => !p.researched).length} need manual review
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16, maxHeight: 360, overflowY: "auto" }}>
              {parsed.map((p, i) => (
                <div key={i} style={{
                  padding: "10px 12px", background: "var(--paper)",
                  border: "1px solid var(--line-soft)", borderRadius: 8,
                }}>
                  <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 4 }}>
                    <input value={p.name} onChange={(e) => editName(i, e.target.value)}
                      style={{ ...inputBase, padding: "5px 8px", fontSize: 13, fontWeight: 500 }} />
                    {p.researched ? (
                      <span style={{
                        fontSize: 10, padding: "2px 7px", borderRadius: 999,
                        background: "var(--amber-soft)", color: "var(--amber)", flexShrink: 0,
                      }}>
                        <Sparkles size={9} style={{ verticalAlign: -1, marginRight: 2 }} /> found
                      </span>
                    ) : (
                      <span style={{
                        fontSize: 10, padding: "2px 7px", borderRadius: 999,
                        background: "var(--paper-deep)", color: "var(--ink-3)", flexShrink: 0,
                      }}>
                        no info
                      </span>
                    )}
                  </div>
                  {p.headline && (
                    <div style={{ fontSize: 12, color: "var(--ink-2)", lineHeight: 1.4 }}>{p.headline}</div>
                  )}
                  {p.summary && (
                    <div style={{ fontSize: 12, color: "var(--ink-3)", marginTop: 4, lineHeight: 1.5 }}>
                      {p.summary}
                    </div>
                  )}
                  <div style={{ fontSize: 11, color: "var(--ink-4)", marginTop: 4, wordBreak: "break-all" }}>
                    {p.url}
                  </div>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "space-between" }}>
              <button onClick={() => { setParsed(null); setError(null); }} style={ghostBtn}>
                <RefreshCw size={14} /> Start over
              </button>
              <button onClick={importAll} style={{ ...primaryBtn, background: "var(--accent)", color: "white" }}>
                <Check size={15} /> Save {parsed.length} {parsed.length === 1 ? "contact" : "contacts"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function NewConnectionsScreenshotModal({ linkedinContacts, onClose, onMatched }) {
  const [image, setImage] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [matches, setMatches] = useState(null); // [{ contact, extractedName }]
  const [error, setError] = useState(null);
  const fileRef = useRef(null);

  const ingest = async (file) => {
    if (!file || !file.type.startsWith("image/")) {
      setError("Please use an image file");
      return;
    }
    setError(null);
    setMatches(null);
    try {
      const base64 = await fileToBase64(file);
      setImage({ base64, mime: file.type, url: URL.createObjectURL(file), name: file.name });
    } catch {
      setError("Couldn't read file");
    }
  };

  const analyze = async () => {
    if (!image) return;
    setProcessing(true);
    setError(null);
    try {
      const { text } = await callAI({
        system: "You extract names of people from screenshots of LinkedIn. Return only JSON arrays of names.",
        content: [
          { type: "image", source: { type: "base64", media_type: image.mime, data: image.base64 } },
          { type: "text", text: `This is a screenshot from LinkedIn — likely the "My Network" page showing recent connection acceptances or the user's connections list. Extract the FULL NAMES of every person visible.

Return ONLY a JSON array of strings: ["Name One", "Name Two", ...]

No commentary, no objects, just a flat array of names. If no people visible, return [].` }
        ],
        maxTokens: 1500,
        feature: "connections_scan",
      });
      const names = extractJSON(text);
      if (!Array.isArray(names)) {
        setError("Couldn't read names from screenshot");
        setProcessing(false);
        return;
      }

      // Fuzzy match against contacts who are in invite_sent stage
      const norm = (s) => (s || "").toLowerCase().replace(/[^a-z\s]/g, "").replace(/\s+/g, " ").trim();
      const eligible = linkedinContacts.filter((c) =>
        c.linkedinStage === "invite_sent" || c.linkedinStage === "invite_drafted" || c.linkedinStage === "to_invite"
      );
      const matched = [];
      names.forEach((extractedName) => {
        const nName = norm(extractedName);
        if (!nName) return;
        // Try exact full-name match, then last-name match
        const exact = eligible.find((c) => norm(c.name) === nName);
        if (exact && !matched.find((m) => m.contact.id === exact.id)) {
          matched.push({ contact: exact, extractedName });
          return;
        }
        // Last word (last name) match as fallback
        const lastWord = nName.split(" ").pop();
        if (lastWord && lastWord.length > 2) {
          const byLast = eligible.find((c) => {
            const cn = norm(c.name);
            return cn.split(" ").includes(lastWord) && !matched.find((m) => m.contact.id === c.id);
          });
          if (byLast) matched.push({ contact: byLast, extractedName });
        }
      });

      setMatches({ extracted: names, matched });
    } catch (e) {
      setError("Analysis failed: " + e.message);
    } finally {
      setProcessing(false);
    }
  };

  const confirm = () => {
    if (!matches) return;
    onMatched(matches.matched.map((m) => m.contact));
  };

  return (
    <div style={drawerOverlay} onClick={onClose}>
      <div className="jl-fade jl-scroll" onClick={(e) => e.stopPropagation()} style={{
        position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
        width: "min(640px, 94vw)", maxHeight: "92vh", overflowY: "auto",
        background: "var(--surface)", borderRadius: 14, padding: "26px 30px",
        border: "1px solid var(--line)",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <h2 className="jl-display" style={{ fontSize: 22, fontWeight: 500, margin: 0 }}>
            Mark connected via screenshot
          </h2>
          <button onClick={onClose} style={iconBtn}><X size={18} /></button>
        </div>
        <p style={{ color: "var(--ink-3)", fontSize: 13, margin: "0 0 18px", lineHeight: 1.55 }}>
          Screenshot your LinkedIn "My Network" page or new connections list. I'll extract the names visible and match them against contacts you've sent connection requests to.
        </p>

        {!image && (
          <div onClick={() => fileRef.current?.click()} style={{
            padding: "40px 24px", textAlign: "center", cursor: "pointer",
            border: "1.5px dashed var(--line)", borderRadius: 12,
            background: "var(--paper-deep)",
          }}>
            <Camera size={28} style={{ color: "var(--accent)", marginBottom: 8 }} />
            <div className="jl-display" style={{ fontSize: 16, fontWeight: 500, marginBottom: 2 }}>
              Choose a screenshot
            </div>
            <div style={{ fontSize: 12, color: "var(--ink-3)" }}>PNG or JPG · LinkedIn "My Network" works best</div>
            <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }}
              onChange={(e) => ingest(e.target.files?.[0])} />
          </div>
        )}

        {image && !matches && (
          <>
            <div style={{
              borderRadius: 10, overflow: "hidden", border: "1px solid var(--line)",
              background: "var(--paper-deep)", marginBottom: 16, maxHeight: 320,
              display: "flex", justifyContent: "center", alignItems: "center",
            }}>
              <img src={image.url} alt="screenshot"
                style={{ maxWidth: "100%", maxHeight: 320, objectFit: "contain", display: "block" }} />
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "space-between" }}>
              <button onClick={() => { setImage(null); setMatches(null); }} style={ghostBtn}>
                <RefreshCw size={14} /> Choose another
              </button>
              <button onClick={analyze} disabled={processing}
                style={{ ...primaryBtn, background: "var(--accent)", color: "white", opacity: processing ? 0.6 : 1 }}>
                {processing ? <RefreshCw size={14} className="jl-spin" /> : <Sparkles size={14} />}
                {processing ? "Reading names…" : "Extract & match"}
              </button>
            </div>
          </>
        )}

        {matches && (
          <>
            <div style={{
              padding: "10px 14px", background: matches.matched.length > 0 ? "var(--moss-soft)" : "var(--amber-soft)",
              color: matches.matched.length > 0 ? "var(--moss)" : "var(--amber)",
              fontSize: 13, borderRadius: 8, marginBottom: 14,
              display: "flex", alignItems: "center", gap: 8,
            }}>
              <CheckCircle2 size={14} />
              Read {matches.extracted.length} {matches.extracted.length === 1 ? "name" : "names"} · matched {matches.matched.length} to your contacts
            </div>
            {matches.matched.length > 0 && (
              <>
                <Label>Will be marked as connected</Label>
                <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8, marginBottom: 14 }}>
                  {matches.matched.map((m, i) => (
                    <div key={i} style={{
                      padding: "8px 12px", background: "var(--moss-soft)",
                      borderRadius: 6, fontSize: 13, color: "var(--ink-2)",
                      display: "flex", alignItems: "center", gap: 8,
                    }}>
                      <Check size={13} style={{ color: "var(--moss)" }} />
                      <strong style={{ color: "var(--ink)", fontWeight: 500 }}>{m.contact.name}</strong>
                      {m.extractedName !== m.contact.name && (
                        <span style={{ fontSize: 11, color: "var(--ink-3)" }}>
                          (matched from "{m.extractedName}")
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}
            <div style={{ display: "flex", gap: 8, justifyContent: "space-between" }}>
              <button onClick={() => { setImage(null); setMatches(null); }} style={ghostBtn}>
                <RefreshCw size={14} /> Start over
              </button>
              <button onClick={confirm} disabled={matches.matched.length === 0}
                style={{ ...primaryBtn, background: "var(--accent)", color: "white", opacity: matches.matched.length === 0 ? 0.5 : 1 }}>
                <Check size={15} /> Mark {matches.matched.length} connected
              </button>
            </div>
          </>
        )}

        {error && (
          <div style={{
            marginTop: 14, padding: "10px 14px", borderRadius: 8,
            background: "var(--rose-soft)", color: "var(--rose)", fontSize: 13,
            display: "flex", alignItems: "center", gap: 8,
          }}>
            <AlertCircle size={14} /> {error}
          </div>
        )}
      </div>
    </div>
  );
}

/* ============================================================
   HELP MODAL
   ============================================================ */
function HelpModal({ onClose, setTab }) {
  const Section = ({ title, children }) => (
    <section style={{ marginBottom: 28 }}>
      <h3 className="jl-display" style={{
        fontSize: 19, fontWeight: 500, margin: "0 0 10px",
        letterSpacing: "-0.01em", color: "var(--ink)",
      }}>{title}</h3>
      <div style={{ fontSize: 14, color: "var(--ink-2)", lineHeight: 1.65 }}>
        {children}
      </div>
    </section>
  );

  const Tag = ({ children }) => (
    <span className="jl-mono" style={{
      fontSize: 12, padding: "1px 7px", borderRadius: 4,
      background: "var(--paper-deep)", color: "var(--ink-2)",
    }}>{children}</span>
  );

  const Link = ({ tab, children }) => (
    <button onClick={() => setTab(tab)} style={{
      background: "transparent", border: "none", cursor: "pointer",
      color: "var(--accent)", padding: 0, fontFamily: "inherit",
      fontSize: "inherit", fontWeight: 500, textDecoration: "underline",
      textUnderlineOffset: 2, textDecorationColor: "var(--accent-soft)",
    }}>{children}</button>
  );

  return (
    <div style={drawerOverlay} onClick={onClose}>
      <div className="jl-fade jl-scroll" onClick={(e) => e.stopPropagation()} style={{
        position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
        width: "min(760px, 94vw)", maxHeight: "92vh", overflowY: "auto",
        background: "var(--surface)", borderRadius: 16, padding: "32px 40px",
        border: "1px solid var(--line)",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 24 }}>
          <div>
            <h2 className="jl-display" style={{ fontSize: 32, fontWeight: 400, margin: 0, letterSpacing: "-0.02em" }}>
              How to use Ledger
            </h2>
            <p className="jl-display" style={{
              fontSize: 14, color: "var(--ink-3)", fontStyle: "italic",
              margin: "4px 0 0",
            }}>
              a quiet guide for your job search
            </p>
          </div>
          <button onClick={onClose} style={iconBtn}><X size={18} /></button>
        </div>

        <Section title="What this is">
          Ledger is a workspace for running a focused job search. It tracks the four streams of activity that actually move things forward — applications, conversations with people, meetings, and the companies you're focused on — and lets AI handle the tedious parts: extracting details from screenshots, summarizing your Gmail, drafting personalized outreach, and giving you a daily briefing on what to do next.
        </Section>

        <Section title="The tabs at a glance">
          <ul style={{ paddingLeft: 18, margin: "6px 0", display: "flex", flexDirection: "column", gap: 8 }}>
            <li><Link tab="dashboard">Overview</Link> — your daily landing page. Briefing, metrics, pipeline status, recent activity.</li>
            <li><Link tab="pipeline">Pipeline</Link> — kanban of every job you're tracking, six stages from Saved to Closed.</li>
            <li><Link tab="companies">Companies</Link> — every company you've engaged with, aggregated and starrable. Use this to keep a focused list.</li>
            <li><Link tab="inbox">Inbox</Link> — AI summarizes your 10 most recent Gmail messages; job-related ones can be routed to Pipeline or Outreach.</li>
            <li><Link tab="outreach">Outreach</Link> — every message sent and received, threaded by contact and channel.</li>
            <li><Link tab="activity">Activity</Link> — free-form log for anything else: profiles you created, sites you joined, research notes. Categorize later.</li>
            <li><Link tab="campaign">Campaign</Link> — import a contact list, let AI research each person, draft 5 personalized emails a day.</li>
            <li><Link tab="meetings">Meetings</Link> — interviews and chats, synced from Google Calendar, auto-linked to your contacts.</li>
          </ul>
        </Section>

        <Section title="Getting started">
          First open <Link tab="campaign">Campaign</Link> and hit <strong style={{ color: "var(--ink)", fontWeight: 500 }}>Set up profile</strong>. Fill in your name, background, what you're looking for, and how you sign off. This is the unlock for the daily briefing and personalized email drafts — without it, the AI can't sound like you.
          <br /><br />
          Then start adding activity any way you like. The fastest path is the <strong style={{ color: "var(--accent)", fontWeight: 500 }}>Capture</strong> button at the top right — screenshot a job posting, drop a recruiter email PDF, or paste a LinkedIn DM. AI figures out what each is and routes it to the right place.
        </Section>

        <Section title="Four ways to add things">
          <strong style={{ color: "var(--ink)", fontWeight: 500 }}>Paste a URL.</strong> In the Pipeline tab, click "Add a job" and paste any job posting URL. AI fetches the page and extracts the company, role, location, salary, and key requirements. Works on LinkedIn, Greenhouse, Lever, Ashby, and most company career pages. Workday is hit-or-miss; screenshot those instead.
          <br /><br />
          <strong style={{ color: "var(--ink)", fontWeight: 500 }}>Capture (top right).</strong> Drop or paste up to 3 related screenshots or PDFs. AI classifies the content — job posting, LinkedIn DM, application confirmation, recruiter email, interview invite, calendar invite — and pre-fills the right form. For long content that spans multiple images (an email thread or full job description), drop them in order; AI merges them into one record.
          <br /><br />
          <strong style={{ color: "var(--ink)", fontWeight: 500 }}>Summarize Gmail.</strong> The <Link tab="inbox">Inbox</Link> tab reads your 10 most recent emails and writes a short digest plus one card per message. Job-related emails are flagged; route any card to Pipeline or Outreach with one click.
          <br /><br />
          <strong style={{ color: "var(--ink)", fontWeight: 500 }}>Manual.</strong> Type it in. Always available as a fallback.
        </Section>

        <Section title="The daily briefing">
          The card at the top of the Overview tab. Hit <Tag>Generate briefing</Tag> and Claude reviews your last 7 days of activity — applications applied to, stuck roles, outreach sent vs replies received, upcoming meetings, contacts overdue for follow-up — and writes you a short briefing with a single "today's focus" recommendation plus 3-5 prioritized action items. The briefing caches for 24 hours; after that it goes stale and offers a refresh. It needs your profile filled out first.
        </Section>

        <Section title="The campaign workflow">
          For systematic outreach to a list of people.
          <br /><br />
          <strong style={{ color: "var(--ink)", fontWeight: 500 }}>1. Import a CSV.</strong> Required column: <Tag>email</Tag>. Recognized: <Tag>name</Tag>, <Tag>first_name</Tag>, <Tag>last_name</Tag>, <Tag>company</Tag>, <Tag>role</Tag>, <Tag>linkedin</Tag>, <Tag>notes</Tag>. Excel: File → Save As → CSV.
          <br /><br />
          <strong style={{ color: "var(--ink)", fontWeight: 500 }}>2. Research.</strong> Click <Tag>Research</Tag> on a queued contact. AI web-searches them and pulls together a short bio plus 3-5 specific talking points (recent posts, projects, mutual interests). One API call per person.
          <br /><br />
          <strong style={{ color: "var(--ink)", fontWeight: 500 }}>3. Draft.</strong> Click <Tag>Draft email</Tag>. AI writes a personalized 4-6 sentence email using your profile, the research, and your default ask. You edit anything before sending.
          <br /><br />
          <strong style={{ color: "var(--ink)", fontWeight: 500 }}>4. Send.</strong> Hit <Tag>Create Gmail draft</Tag>. It lands in your Gmail Drafts folder — review one more time and send from your inbox. Never auto-sends, by design. Safer.
        </Section>

        <Section title="How tracking happens automatically">
          <strong style={{ color: "var(--ink)", fontWeight: 500 }}>Replies.</strong> When you summarize your inbox, replies from campaign contacts you've emailed are highlighted with a green border, a "Reply from [Name]" badge, and a one-click <Tag>Mark replied</Tag> button.
          <br /><br />
          <strong style={{ color: "var(--ink)", fontWeight: 500 }}>Follow-ups.</strong> Any contact who was sent an email more than 5 days ago without a reply shows up in the <Link tab="campaign">Campaign → Needs follow-up</Link> sub-tab, and surfaces as a yellow alert on the Overview. Adjust the window in Campaign settings.
          <br /><br />
          <strong style={{ color: "var(--ink)", fontWeight: 500 }}>Meetings.</strong> When you sync your calendar, any event with a tracked contact's email in the attendees auto-links to that contact and flips them to "Meeting scheduled". No manual association needed.
        </Section>

        <Section title="A suggested rhythm">
          <strong style={{ color: "var(--ink)", fontWeight: 500 }}>Each morning:</strong> open Overview, read the briefing, do the "today's focus" item before anything else.
          <br /><br />
          <strong style={{ color: "var(--ink)", fontWeight: 500 }}>Daily:</strong> Campaign tab → today's queue → research, draft, and send 5 emails.
          <br /><br />
          <strong style={{ color: "var(--ink)", fontWeight: 500 }}>Weekly (Mondays or Fridays):</strong> Summarize Gmail to catch replies and recruiter messages. Sync Calendar to pull in new interviews. Update statuses on the Pipeline.
          <br /><br />
          <strong style={{ color: "var(--ink)", fontWeight: 500 }}>Monthly:</strong> review the Companies tab to see where your effort is spread. Star the ones to go deeper on. Drop the ones that aren't priorities.
        </Section>

        <Section title="Small things worth knowing">
          The data lives in Claude's artifact storage and persists across sessions and devices — but only after the artifact is <em>published</em>. During in-conversation editing it doesn't save.
          <br /><br />
          Updating the artifact preserves your data; <strong style={{ color: "var(--rose)", fontWeight: 500 }}>unpublishing wipes it permanently.</strong> Never unpublish.
          <br /><br />
          AI features use your Claude API allowance. Drafting 5 contacts a day plus a daily briefing is modest usage. Bulk-researching 50 contacts in one sitting can hit limits.
          <br /><br />
          LinkedIn DMs can only enter via screenshot — LinkedIn has no public API. Capture is built for this.
          <br /><br />
          Drafts always require your final click in Gmail. No auto-send, ever, by design.
        </Section>

        <div style={{
          marginTop: 20, paddingTop: 20, borderTop: "1px solid var(--line)",
          display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12,
        }}>
          <div style={{ fontSize: 12, color: "var(--ink-3)", fontStyle: "italic" }} className="jl-display">
            Built for one person at a time. Yours now.
          </div>
          <button onClick={onClose} style={primaryBtn}>
            <Check size={14} /> Got it
          </button>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   SHARED HELPERS
   ============================================================ */
function Modal({ children, onClose, title }) {
  return (
    <div style={drawerOverlay} onClick={onClose}>
      <div className="jl-fade jl-scroll" onClick={(e) => e.stopPropagation()} style={{
        position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
        width: "min(560px, 94vw)", maxHeight: "90vh", overflowY: "auto",
        background: "var(--surface)", borderRadius: 14, padding: "26px 30px",
        border: "1px solid var(--line)",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h2 className="jl-display" style={{ fontSize: 22, fontWeight: 500, margin: 0, letterSpacing: "-0.01em" }}>
            {title}
          </h2>
          <button onClick={onClose} style={iconBtn}><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Field({ label, required, children }) {
  return (
    <div>
      <div style={{
        fontSize: 11, color: "var(--ink-3)", marginBottom: 5,
        textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 500,
      }}>
        {label}{required && <span style={{ color: "var(--accent)" }}> *</span>}
      </div>
      {children}
    </div>
  );
}

function Label({ children }) {
  return (
    <div style={{
      fontSize: 11, color: "var(--ink-3)", textTransform: "uppercase",
      letterSpacing: "0.1em", fontWeight: 500,
    }}>{children}</div>
  );
}

function Fact({ icon: Icon, label, value }) {
  return (
    <div style={{
      padding: "10px 12px", background: "var(--paper)", borderRadius: 8,
      border: "1px solid var(--line-soft)",
    }}>
      <div style={{
        fontSize: 10, color: "var(--ink-3)", textTransform: "uppercase",
        letterSpacing: "0.1em", marginBottom: 3, display: "flex", alignItems: "center", gap: 4,
      }}>
        <Icon size={10} /> {label}
      </div>
      <div style={{ fontSize: 14, color: "var(--ink)", fontWeight: 500 }}>{value}</div>
    </div>
  );
}
