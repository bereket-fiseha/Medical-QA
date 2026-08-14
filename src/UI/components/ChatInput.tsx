"use client";

import { useRef, useEffect, KeyboardEvent } from "react";
import { Send } from "lucide-react";
import clsx from "clsx";
import { LANGUAGES } from "@/lib/constants";
import type { LanguageCode } from "@/lib/types";

interface ChatInputProps {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  disabled: boolean;
  currentLang: LanguageCode;
}

export default function ChatInput({
  value,
  onChange,
  onSend,
  disabled,
  currentLang,
}: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lang = LANGUAGES.find((l) => l.code === currentLang)!;
  const canSend = value.trim().length > 0 && !disabled;

  // Auto-resize
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 140) + "px";
  }, [value]);

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (canSend) onSend();
    }
  }

  return (
    <footer className="bg-white border-t border-slate-200 px-4 py-3.5 flex-shrink-0">
      {/* Input row */}
      <div
        className={clsx(
          "flex items-end gap-2.5 max-w-3xl mx-auto",
          "bg-slate-50 border rounded-2xl px-4 py-2.5 transition-all",
          "focus-within:border-primary-500 focus-within:ring-2 focus-within:ring-primary-500/10",
          "border-slate-200"
        )}
      >
        {/* Language badge */}
        <span className="self-end mb-1 text-[11px] font-bold text-primary-600 bg-primary-50 border border-primary-100 rounded-md px-1.5 py-0.5 tracking-wide flex-shrink-0">
          {lang.badge}
        </span>

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={lang.placeholder}
          maxLength={2000}
          rows={1}
          disabled={disabled}
          aria-label="Type your medical question"
          className="flex-1 bg-transparent resize-none border-none outline-none text-[14.5px] text-slate-900 placeholder:text-slate-400 leading-relaxed max-h-36 min-h-6 overflow-y-auto scrollbar-thin disabled:opacity-60"
        />

        {/* Right side actions */}
        <div className="flex items-center gap-2 self-end flex-shrink-0">
          <span className="text-[11px] text-slate-400 tabular-nums hidden sm:block">
            {value.length}/2000
          </span>
          <button
            onClick={onSend}
            disabled={!canSend}
            aria-label="Send message"
            className={clsx(
              "w-9 h-9 rounded-full flex items-center justify-center transition-all flex-shrink-0",
              canSend
                ? "bg-primary-600 text-white hover:bg-primary-700 hover:scale-105 active:scale-95 shadow-sm"
                : "bg-slate-200 text-slate-400 cursor-not-allowed opacity-60"
            )}
          >
            <Send size={15} strokeWidth={2.2} />
          </button>
        </div>
      </div>

      {/* Hint */}
      <p className="text-[11.5px] text-slate-400 text-center mt-2 max-w-3xl mx-auto">
        MediAssist covers NCDs and diet — always consult a qualified healthcare professional for personal medical advice.
      </p>
    </footer>
  );
}
