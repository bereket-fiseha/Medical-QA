"use client";

import { Activity, Plus, X, Zap } from "lucide-react";
import clsx from "clsx";
import type { Language, LanguageCode } from "@/lib/types";
import { LANGUAGES } from "@/lib/constants";

interface SidebarProps {
  open: boolean;
  currentLang: LanguageCode;
  autoDetect: boolean;
  onLangChange: (lang: LanguageCode) => void;
  onAutoDetectChange: (enabled: boolean) => void;
  onNewChat: () => void;
  onClose: () => void;
}

export default function Sidebar({
  open,
  currentLang,
  autoDetect,
  onLangChange,
  onAutoDetectChange,
  onNewChat,
  onClose,
}: SidebarProps) {
  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 bg-black/40 z-20 lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={clsx(
          "fixed lg:relative inset-y-0 left-0 z-30 flex flex-col",
          "w-60 bg-sidebar text-slate-300 transition-transform duration-200 ease-in-out",
          open ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-5 border-b border-white/[0.07] flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-primary-600 flex items-center justify-center text-white flex-shrink-0">
              <Activity size={16} strokeWidth={2.2} />
            </div>
            <div>
              <p className="text-[15px] font-bold text-slate-100 leading-tight">MediAssist</p>
              <p className="text-[10px] text-slate-500 leading-tight">NCD &amp; Diet Q&amp;A</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="lg:hidden p-1.5 rounded-lg hover:bg-white/10 text-slate-500 hover:text-white transition-colors"
            aria-label="Close sidebar"
          >
            <X size={15} />
          </button>
        </div>

        {/* New chat */}
        <div className="px-3 py-4 flex-shrink-0">
          <button
            onClick={onNewChat}
            className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-[13px] font-semibold transition-all hover:-translate-y-px active:translate-y-0"
          >
            <Plus size={14} strokeWidth={2.5} />
            New Conversation
          </button>
        </div>

        {/* ── Language section ── */}
        <p className="px-5 pb-2 text-[10px] font-bold uppercase tracking-widest text-slate-600 flex-shrink-0">
          Language
        </p>

        {/* Auto-detect toggle */}
        <div className="px-3 mb-2 flex-shrink-0">
          <button
            onClick={() => onAutoDetectChange(!autoDetect)}
            className={clsx(
              "w-full flex items-center justify-between px-3 py-2.5 rounded-xl border text-[13px] font-medium transition-all",
              autoDetect
                ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-400"
                : "border-white/10 text-slate-400 hover:bg-white/7 hover:text-white"
            )}
            aria-pressed={autoDetect}
          >
            <span className="flex items-center gap-2">
              <Zap size={13} strokeWidth={2.2} className={autoDetect ? "text-emerald-400" : "text-slate-500"} />
              Auto-detect language
            </span>
            {/* Toggle pill */}
            <span
              className={clsx(
                "relative inline-flex h-5 w-9 rounded-full transition-colors duration-200 flex-shrink-0",
                autoDetect ? "bg-emerald-500" : "bg-slate-600"
              )}
            >
              <span
                className={clsx(
                  "absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200",
                  autoDetect ? "translate-x-4" : "translate-x-0"
                )}
              />
            </span>
          </button>
        </div>

        {/* Manual language buttons — dimmed when auto-detect is on */}
        <div
          className={clsx(
            "px-3 flex flex-col gap-1 flex-shrink-0 transition-opacity duration-200",
            autoDetect && "opacity-40 pointer-events-none"
          )}
        >
          {LANGUAGES.map((lang: Language) => (
            <button
              key={lang.code}
              onClick={() => onLangChange(lang.code)}
              tabIndex={autoDetect ? -1 : 0}
              className={clsx(
                "flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all text-left border",
                currentLang === lang.code
                  ? "bg-primary-600/25 border-primary-600/50 text-sky-300"
                  : "border-transparent hover:bg-white/7 hover:text-white text-slate-400"
              )}
            >
              <span className="text-base leading-none">{lang.flag}</span>
              <span>{lang.label}</span>
            </button>
          ))}
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Footer */}
        <div className="px-4 pb-5 pt-3 flex-shrink-0 border-t border-white/[0.07]">
          <p className="text-[11px] text-slate-600 leading-relaxed">
            ℹ️ For informational use only. Always consult a healthcare professional.
          </p>
        </div>
      </aside>
    </>
  );
}
