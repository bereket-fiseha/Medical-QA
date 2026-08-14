import { Activity } from "lucide-react";

export default function TypingIndicator() {
  return (
    <div className="flex items-start gap-3 animate-slide-up">
      {/* Avatar */}
      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary-600 to-accent-600 flex items-center justify-center text-white flex-shrink-0">
        <Activity size={16} strokeWidth={2.2} />
      </div>

      {/* Dots bubble */}
      <div className="bg-white border border-slate-200 rounded-2xl rounded-bl-sm shadow-sm px-4 py-3.5 flex items-center gap-1.5">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="w-2 h-2 rounded-full bg-slate-400 animate-bounce3"
            style={{ animationDelay: `${i * 0.18}s` }}
          />
        ))}
      </div>
    </div>
  );
}
