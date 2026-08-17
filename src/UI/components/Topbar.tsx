"use client";

import { useState } from "react";
import { Menu, Zap, Flame, CheckCircle2, XCircle, Loader2, AlertTriangle } from "lucide-react";
import clsx from "clsx";
import { LANGUAGES } from "@/lib/constants";
import { warmupTranslationServer, type WarmupStatus } from "@/lib/api";
import type { LanguageCode } from "@/lib/types";

type ChatStatus = "ready" | "loading" | "translating" | "error";

interface TopbarProps {
  currentLang: LanguageCode;
  status: ChatStatus;
  onMenuClick: () => void;
  lastDetected: { label: string; confidence: number } | null;
}

const CHAT_STATUS_CONFIG: Record<ChatStatus, { dot: string; label: string }> = {
  ready:       { dot: "bg-emerald-500",              label: "Ready" },
  loading:     { dot: "bg-violet-400 animate-pulse2", label: "Analysing…" },
  translating: { dot: "bg-sky-400 animate-pulse2",    label: "Translating…" },
  error:       { dot: "bg-red-500",                   label: "Error" },
};

// Config for each warmup state
const WARMUP_CONFIG: Record<
  WarmupStatus | "idle",
  { label: string; icon: React.ReactNode; className: string }
> = {
  idle: {
    label: "Warm up server",
    icon: <Flame size={13} strokeWidth={2} />,
    className:
      "text-slate-500 border-slate-200 hover:border-orange-300 hover:text-orange-500 hover:bg-orange-50",
  },
  warming: {
    label: "Warming up…",
    icon: <Loader2 size={13} strokeWidth={2} className="animate-spin" />,
    className: "text-amber-600 border-amber-200 bg-amber-50 cursor-not-allowed",
  },
  ready: {
    label: "Server ready",
    icon: <CheckCircle2 size={13} strokeWidth={2} />,
    className: "text-emerald-600 border-emerald-200 bg-emerald-50 cursor-default",
  },
  degraded: {
    label: "Degraded — retry?",
    icon: <AlertTriangle size={13} strokeWidth={2} />,
    className:
      "text-amber-600 border-amber-200 bg-amber-50 hover:bg-amber-100 cursor-pointer",
  },
  timeout: {
    label: "Timed out — retry?",
    icon: <XCircle size={13} strokeWidth={2} />,
    className:
      "text-red-500 border-red-200 bg-red-50 hover:bg-red-100 cursor-pointer",
  },
  error: {
    label: "Failed — retry?",
    icon: <XCircle size={13} strokeWidth={2} />,
    className:
      "text-red-500 border-red-200 bg-red-50 hover:bg-red-100 cursor-pointer",
  },
};

export default function Topbar({ currentLang, status, onMenuClick, lastDetected }: TopbarProps) {
  const isAuto = currentLang === "auto";
  const lang   = LANGUAGES.find((l) => l.code === currentLang);
  const cs     = CHAT_STATUS_CONFIG[status];

  const [warmup, setWarmup]       = useState<WarmupStatus | "idle">("idle");
  const [elapsedMs, setElapsedMs] = useState<number | null>(null);

  async function handleWarmup() {
    if (warmup === "warming" || warmup === "ready") return;
    setWarmup("warming");
    setElapsedMs(null);
    const result = await warmupTranslationServer();
    setWarmup(result.status);
    if (result.elapsed_ms !== undefined) setElapsedMs(result.elapsed_ms);
  }

  const wc = WARMUP_CONFIG[warmup];

  return (
    <header className="flex items-center gap-2.5 px-4 py-3 bg-white border-b border-slate-200 shadow-sm flex-shrink-0 z-10">

      {/* Hamburger */}
      <button
        onClick={onMenuClick}
        className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors flex-shrink-0"
        aria-label="Toggle sidebar"
      >
        <Menu size={18} />
      </button>

      {/* Left: language pill + detected + title */}
      <div className="flex items-center gap-2 flex-1 min-w-0 flex-wrap">
        {isAuto ? (
          <span className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-full px-3 py-0.5 flex-shrink-0">
            <Zap size={11} strokeWidth={2.5} />
            Auto-detect
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-primary-600 bg-primary-50 border border-primary-100 rounded-full px-3 py-0.5 flex-shrink-0">
            {lang?.flag} {lang?.label}
          </span>
        )}

        {/* Last detected language chip */}
        {isAuto && lastDetected && (
          <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-slate-700 bg-slate-100 border border-slate-200 rounded-full px-3 py-0.5 animate-fade-in flex-shrink-0">
            🔍 {lastDetected.label}
            <span className="text-[11px] font-normal text-slate-400">
              {(lastDetected.confidence * 100).toFixed(0)}%
            </span>
          </span>
        )}

        <span className="text-[14px] font-semibold text-slate-800 hidden sm:block">
          NCD &amp; Diet Assistant
        </span>
      </div>

      {/* Right: warmup button + chat status */}
      <div className="flex items-center gap-3 flex-shrink-0">

        {/* ── Warmup button ── */}
        <button
          onClick={handleWarmup}
          disabled={warmup === "warming" || warmup === "ready"}
          title={
            elapsedMs !== null
              ? `Translation server responded in ${elapsedMs} ms`
              : "Ping the serverless translation API to avoid cold-start delays"
          }
          className={clsx(
            "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[12px] font-medium transition-all",
            wc.className
          )}
        >
          {wc.icon}
          <span className="hidden sm:inline">{wc.label}</span>
          {warmup === "ready" && elapsedMs !== null && (
            <span className="text-[11px] text-emerald-400 font-normal">
              {elapsedMs} ms
            </span>
          )}
        </button>

        {/* ── Chat status dot ── */}
        <div className="flex items-center gap-1.5">
          <span className={clsx("w-2 h-2 rounded-full transition-colors", cs.dot)} />
          <span className="text-[12.5px] text-slate-400 font-medium hidden sm:inline">
            {cs.label}
          </span>
        </div>
      </div>
    </header>
  );
}
