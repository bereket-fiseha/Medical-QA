"use client";

import { Menu } from "lucide-react";
import clsx from "clsx";
import { LANGUAGES } from "@/lib/constants";
import type { LanguageCode } from "@/lib/types";

type Status = "ready" | "loading" | "translating" | "error";

interface TopbarProps {
  currentLang: LanguageCode;
  status: Status;
  onMenuClick: () => void;
}

const STATUS_CONFIG: Record<Status, { dot: string; label: string }> = {
  ready:       { dot: "bg-emerald-500",      label: "Ready" },
  loading:     { dot: "bg-amber-400 animate-pulse2", label: "Processing…" },
  translating: { dot: "bg-amber-400 animate-pulse2", label: "Translating…" },
  error:       { dot: "bg-red-500",           label: "Error" },
};

export default function Topbar({ currentLang, status, onMenuClick }: TopbarProps) {
  const lang = LANGUAGES.find((l) => l.code === currentLang)!;
  const s = STATUS_CONFIG[status];

  return (
    <header className="flex items-center gap-3 px-4 py-3 bg-white border-b border-slate-200 shadow-sm flex-shrink-0 z-10">
      <button
        onClick={onMenuClick}
        className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors"
        aria-label="Toggle sidebar"
      >
        <Menu size={18} />
      </button>

      <div className="flex items-center gap-2.5 flex-1">
        <span className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-primary-600 bg-primary-50 border border-primary-100 rounded-full px-3 py-0.5">
          {lang.flag} {lang.label}
        </span>
        <span className="text-[14px] font-semibold text-slate-800">NCD &amp; Diet Assistant</span>
      </div>

      <div className="flex items-center gap-1.5">
        <span
          className={clsx("w-2 h-2 rounded-full flex-shrink-0 transition-colors", s.dot)}
        />
        <span className="text-[12.5px] text-slate-400 font-medium">{s.label}</span>
      </div>
    </header>
  );
}
