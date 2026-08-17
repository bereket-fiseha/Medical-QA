"use client";

import { Activity, User, Languages, Clock3, AlertCircle, Zap } from "lucide-react";
import clsx from "clsx";
import { formatAssistantText, formatTime } from "@/lib/format";
import type { Message } from "@/lib/types";

interface MessageBubbleProps {
  message: Message;
}

export default function MessageBubble({ message }: MessageBubbleProps) {
  const isUser      = message.role === "user";
  const isError     = message.role === "error";
  const isAssistant = message.role === "assistant";

  return (
    <div className={clsx("flex items-start gap-3 animate-slide-up", isUser && "flex-row-reverse")}>

      {/* Avatar */}
      <div className={clsx(
        "w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0",
        isUser      ? "bg-slate-100 border border-slate-200 text-slate-500"
        : isError   ? "bg-red-100 text-red-500"
                    : "bg-gradient-to-br from-primary-600 to-accent-600 text-white"
      )}>
        {isUser
          ? <User size={16} strokeWidth={2} />
          : <Activity size={16} strokeWidth={2.2} />
        }
      </div>

      {/* Bubble + meta */}
      <div className={clsx("flex flex-col gap-1.5 max-w-[75%]", isUser && "items-end")}>

        {/* Detected language banner — sits above the user bubble, appears after API responds */}
        {isUser && message.detectedLang && (
          <div className="inline-flex items-center gap-1.5 self-end text-[11.5px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-3 py-1 animate-fade-in">
            <Zap size={11} strokeWidth={2.5} className="text-emerald-500" />
            Detected: {message.detectedLang}
            {message.detectedConfidence !== undefined && (
              <span className="text-[10.5px] font-normal text-emerald-500">
                {(message.detectedConfidence * 100).toFixed(0)}%
              </span>
            )}
          </div>
        )}

        {/* Bubble */}
        <div className={clsx(
          "px-4 py-3 rounded-2xl text-[14.5px] leading-relaxed",
          isUser      ? "bg-primary-600 text-white rounded-br-sm shadow-sm"
          : isError   ? "bg-red-50 border border-red-200 text-red-700 rounded-bl-sm"
                      : "bg-white border border-slate-200 text-slate-900 rounded-bl-sm shadow-sm"
        )}>
          {isAssistant
            ? <AssistantContent text={message.text} />
            : <p>{message.text}</p>
          }
        </div>

        {/* Meta row */}
        <div className={clsx("flex items-center gap-2 flex-wrap", isUser && "flex-row-reverse")}>

          {/* Manual translation tag */}
          {message.translatedFrom && (
            <span className="inline-flex items-center gap-1 text-[11px] text-slate-400 bg-slate-100 border border-slate-200 rounded-full px-2 py-0.5">
              <Languages size={11} />
              From {message.translatedFrom}
            </span>
          )}

          {/* Knowledge source badge (assistant only) */}
          {isAssistant && message.source && (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-accent-600 bg-accent-50 border border-accent-100 rounded-full px-2 py-0.5">
              <Clock3 size={11} />
              {message.source}
            </span>
          )}

          <span className="text-[11px] text-slate-400 px-1">
            {formatTime(message.timestamp)}
          </span>
        </div>
      </div>
    </div>
  );
}

function AssistantContent({ text }: { text: string }) {
  const { bodyHtml, disclaimer } = formatAssistantText(text);
  return (
    <>
      <div
        className="prose-sm prose-slate max-w-none"
        dangerouslySetInnerHTML={{ __html: bodyHtml }}
      />
      {disclaimer && (
        <div className="mt-3 flex items-start gap-2 p-2.5 bg-amber-50 border border-amber-200/70 rounded-lg text-[12px] text-amber-700 leading-relaxed">
          <AlertCircle size={13} className="flex-shrink-0 mt-0.5" />
          <span>{disclaimer}</span>
        </div>
      )}
    </>
  );
}
