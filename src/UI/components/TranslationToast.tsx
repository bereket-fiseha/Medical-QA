"use client";

import clsx from "clsx";

export type PipelineStage =
  | "idle"
  | "detecting"
  | "detected"
  | "translating_in"
  | "thinking"
  | "translating_out"
  | "done"
  | "error";

interface PipelineStatusBarProps {
  stage: PipelineStage;
  label: string;
  detectedLang?: string;
  confidence?: number;
}

// Per-stage colour theme: icon · bar colour · text colour · bg · border
const THEME: Record<PipelineStage, {
  icon: string;
  bar: string;
  text: string;
  bg: string;
  border: string;
  pulse: boolean;
}> = {
  idle:           { icon: "",  bar: "bg-slate-300",   text: "text-slate-400",   bg: "bg-white",      border: "border-slate-200",  pulse: false },
  detecting:      { icon: "◎", bar: "bg-violet-500",  text: "text-violet-700",  bg: "bg-violet-50",  border: "border-violet-200", pulse: true  },
  detected:       { icon: "◉", bar: "bg-violet-400",  text: "text-violet-700",  bg: "bg-violet-50",  border: "border-violet-200", pulse: false },
  translating_in: { icon: "⇢", bar: "bg-sky-500",     text: "text-sky-700",     bg: "bg-sky-50",     border: "border-sky-200",    pulse: true  },
  thinking:       { icon: "⬡", bar: "bg-blue-500",    text: "text-blue-700",    bg: "bg-blue-50",    border: "border-blue-200",   pulse: true  },
  translating_out:{ icon: "⇢", bar: "bg-teal-500",    text: "text-teal-700",    bg: "bg-teal-50",    border: "border-teal-200",   pulse: true  },
  done:           { icon: "✦", bar: "bg-emerald-500", text: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-200",pulse: false },
  error:          { icon: "✕", bar: "bg-red-400",     text: "text-red-700",     bg: "bg-red-50",     border: "border-red-200",    pulse: false },
};

export default function PipelineStatusBar({
  stage,
  label,
}: PipelineStatusBarProps) {
  const visible = stage !== "idle";
  const t = THEME[stage];

  return (
    <div
      role="status"
      aria-live="polite"
      className={clsx(
        "fixed bottom-20 left-1/2 -translate-x-1/2 z-50",
        "w-72 rounded-2xl border shadow-lg shadow-black/10 overflow-hidden",
        "transition-all duration-300 pointer-events-none select-none",
        t.bg, t.border,
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3"
      )}
    >
      {/* Progress bar */}
      <div className="h-[3px] w-full bg-black/[0.06] overflow-hidden">
        <div className={clsx(
          "h-full transition-all duration-500",
          t.bar,
          t.pulse  ? "w-2/3 animate-[progressSlide_1.6s_ease-in-out_infinite]"
          : stage === "done" ? "w-full"
          : "w-1/4"
        )} />
      </div>

      {/* Content row */}
      <div className="flex items-center gap-3 px-4 py-3">
        {/* Icon */}
        <span className={clsx(
          "text-[16px] font-bold w-6 flex items-center justify-center flex-shrink-0",
          t.text,
          t.pulse && "animate-pulse"
        )}>
          {t.icon}
        </span>

        {/* Label — driven directly by SSE event label */}
        <span className={clsx("text-[13px] font-semibold flex-1 truncate", t.text)}>
          {label}
        </span>

        {/* Dots for active stages */}
        {t.pulse && (
          <span className="flex gap-1 items-center flex-shrink-0">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className={clsx("w-1.5 h-1.5 rounded-full", t.bar, "animate-bounce3")}
                style={{ animationDelay: `${i * 0.15}s` }}
              />
            ))}
          </span>
        )}
      </div>
    </div>
  );
}
