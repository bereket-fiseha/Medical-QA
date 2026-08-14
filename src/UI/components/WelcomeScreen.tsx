"use client";

import { Activity } from "lucide-react";
import { SUGGESTIONS } from "@/lib/constants";

interface WelcomeScreenProps {
  onSuggestion: (prompt: string) => void;
}

export default function WelcomeScreen({ onSuggestion }: WelcomeScreenProps) {
  return (
    <div className="flex flex-col items-center text-center px-4 py-10 animate-fade-in max-w-xl mx-auto w-full">

      {/* Icon */}
      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-600 to-accent-600 flex items-center justify-center text-white mb-4 shadow-lg shadow-primary-600/20">
        <Activity size={30} strokeWidth={1.8} />
      </div>

      <h1 className="text-2xl font-bold text-slate-900 tracking-tight mb-1">
        MediAssist
      </h1>
      <p className="text-[13.5px] text-slate-500 mb-1">
        Non-Communicable Disease &amp; Diet Q&amp;A
      </p>
      <p className="text-[12.5px] text-slate-400 mb-8">
        Ask in English, Kinyarwanda, or Taita
      </p>

      {/* NCD suggestion cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full">
        {SUGGESTIONS.map((s) => (
          <button
            key={s.prompt}
            onClick={() => onSuggestion(s.prompt)}
            className="flex items-start gap-3 p-3.5 bg-white border border-slate-200 rounded-xl text-left text-[13px] text-slate-600 hover:border-primary-400 hover:bg-primary-50 hover:text-slate-900 transition-all shadow-sm hover:-translate-y-0.5 active:translate-y-0"
          >
            <span className="text-lg leading-none flex-shrink-0 mt-0.5">{s.icon}</span>
            <span className="leading-snug">{s.text}</span>
          </button>
        ))}
      </div>

      {/* NCD topic pills */}
      <div className="flex flex-wrap justify-center gap-2 mt-6">
        {["Hypertension", "Diabetes", "Heart Disease", "Stroke", "Obesity", "Diet & Nutrition"].map((tag) => (
          <span
            key={tag}
            className="text-[11.5px] font-medium text-slate-400 bg-slate-100 border border-slate-200 rounded-full px-3 py-1"
          >
            {tag}
          </span>
        ))}
      </div>
    </div>
  );
}
