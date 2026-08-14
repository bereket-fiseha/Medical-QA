"use client";

import { Languages } from "lucide-react";
import clsx from "clsx";

interface TranslationToastProps {
  visible: boolean;
  message: string;
}

export default function TranslationToast({ visible, message }: TranslationToastProps) {
  return (
    <div
      className={clsx(
        "fixed bottom-24 left-1/2 -translate-x-1/2 z-50",
        "flex items-center gap-2 px-4 py-2.5 rounded-full",
        "bg-slate-900 text-slate-300 text-[12.5px] font-medium shadow-xl",
        "transition-all duration-200 pointer-events-none select-none",
        visible
          ? "opacity-100 translate-y-0"
          : "opacity-0 translate-y-2"
      )}
    >
      <Languages size={13} className="flex-shrink-0" />
      {message}
    </div>
  );
}
