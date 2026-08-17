"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { nanoid } from "@/lib/nanoid";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import WelcomeScreen from "./WelcomeScreen";
import MessageBubble from "./MessageBubble";
import TypingIndicator from "./TypingIndicator";
import ChatInput from "./ChatInput";
import PipelineStatusBar, { type PipelineStage } from "./TranslationToast";
import { sendChatMessage } from "@/lib/api";
import { LANGUAGES } from "@/lib/constants";
import type { Message, LanguageCode } from "@/lib/types";

type Status = "ready" | "loading" | "error";

// Stages shown when language is NOT English (full pipeline)
const STAGES_FULL: { stage: PipelineStage; label: string }[] = [
  { stage: "detecting",       label: "Identifying language" },
  { stage: "translating_in",  label: "Translating"          },
  { stage: "thinking",        label: "Querying knowledge base" },
];

// Stages for English (no translation needed)
const STAGES_EN: { stage: PipelineStage; label: string }[] = [
  { stage: "thinking", label: "Querying knowledge base" },
];

export default function ChatPage() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [currentLang, setCurrentLang] = useState<LanguageCode>("en");
  const [autoDetect, setAutoDetect]   = useState(false);
  const [messages, setMessages]       = useState<Message[]>([]);
  const [inputValue, setInputValue]   = useState("");
  const [status, setStatus]           = useState<Status>("ready");
  const [isTyping, setIsTyping]       = useState(false);

  const [pipelineStage, setPipelineStage] = useState<PipelineStage>("idle");
  const [pipelineLabel, setPipelineLabel] = useState("");
  const [lastDetected, setLastDetected]   = useState<{ label: string; confidence: number } | null>(null);

  const messagesEndRef  = useRef<HTMLDivElement>(null);
  const stageTimerRef   = useRef<ReturnType<typeof setInterval> | null>(null);
  const clearTimerRef   = useRef<ReturnType<typeof setTimeout>  | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  /** Advance through stages on a timer while request is in-flight */
  function startStageSimulation(isEnglish: boolean) {
    const stages = isEnglish ? STAGES_EN : STAGES_FULL;
    let idx = 0;

    // Set first stage immediately
    setPipelineStage(stages[0].stage);
    setPipelineLabel(stages[0].label);

    if (stages.length === 1) return; // nothing more to cycle

    stageTimerRef.current = setInterval(() => {
      idx = Math.min(idx + 1, stages.length - 1);
      setPipelineStage(stages[idx].stage);
      setPipelineLabel(stages[idx].label);
      if (idx === stages.length - 1) {
        // Reached the last stage — stop cycling, stay there until response
        if (stageTimerRef.current) clearInterval(stageTimerRef.current);
      }
    }, 2000); // advance every 2 s
  }

  function stopStageSimulation(finalLabel: string) {
    if (stageTimerRef.current) { clearInterval(stageTimerRef.current); stageTimerRef.current = null; }
    setPipelineStage("done");
    setPipelineLabel(finalLabel);
    if (clearTimerRef.current) clearTimeout(clearTimerRef.current);
    clearTimerRef.current = setTimeout(() => setPipelineStage("idle"), 2000);
  }

  function failStageSimulation() {
    if (stageTimerRef.current) { clearInterval(stageTimerRef.current); stageTimerRef.current = null; }
    setPipelineStage("error");
    setPipelineLabel("Something went wrong");
    if (clearTimerRef.current) clearTimeout(clearTimerRef.current);
    clearTimerRef.current = setTimeout(() => setPipelineStage("idle"), 3000);
  }

  function patchMessage(id: string, patch: Partial<Message>) {
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m)));
  }

  const handleSend = useCallback(async (overrideText?: string) => {
    const text = (overrideText ?? inputValue).trim();
    if (!text || status !== "ready") return;

    const effectiveLang: LanguageCode = autoDetect ? "auto" : currentLang;
    const langMeta = LANGUAGES.find((l) => l.code === currentLang);
    const isEnglish = !autoDetect && currentLang === "en";

    const userMsgId = nanoid();
    setMessages((prev) => [...prev, {
      id: userMsgId, role: "user", text, timestamp: new Date(),
      translatedFrom: (!autoDetect && currentLang !== "en") ? langMeta?.label : undefined,
    }]);
    setInputValue("");
    setIsTyping(true);
    setStatus("loading");
    startStageSimulation(isEnglish);

    try {
      const data = await sendChatMessage({ message: text, language: effectiveLang });

      const resolvedMeta  = LANGUAGES.find((l) => l.code === data.language);
      const resolvedLabel = resolvedMeta?.label ?? data.language.toUpperCase();
      const confidence    = data.detection_confidence ?? 0;

      if (autoDetect && data.detected_language) {
        patchMessage(userMsgId, { detectedLang: resolvedLabel, detectedConfidence: confidence });
        setLastDetected({ label: resolvedLabel, confidence });
      }

      stopStageSimulation(`Responded in ${resolvedLabel}`);

      setMessages((prev) => [...prev, {
        id: nanoid(), role: "assistant", text: data.response,
        timestamp: new Date(), source: data.source, kgUsed: data.kg_used,
      }]);
      setStatus("ready");
    } catch (err) {
      failStageSimulation();
      const errorText = err instanceof Error ? err.message : "An unexpected error occurred.";
      setMessages((prev) => [...prev,
        { id: nanoid(), role: "error", text: errorText, timestamp: new Date() }
      ]);
      setStatus("error");
      setTimeout(() => setStatus("ready"), 3000);
    } finally {
      setIsTyping(false);
    }
  }, [inputValue, currentLang, autoDetect, status]);

  function handleNewChat() {
    setMessages([]); setInputValue(""); setIsTyping(false);
    setStatus("ready"); setLastDetected(null); setPipelineStage("idle");
    if (stageTimerRef.current) clearInterval(stageTimerRef.current);
  }

  function handleAutoDetectChange(enabled: boolean) {
    setAutoDetect(enabled);
    if (!enabled) setLastDetected(null);
  }

  return (
    <div className="flex h-full overflow-hidden">
      <Sidebar
        open={sidebarOpen} currentLang={currentLang} autoDetect={autoDetect}
        onLangChange={setCurrentLang} onAutoDetectChange={handleAutoDetectChange}
        onNewChat={handleNewChat} onClose={() => setSidebarOpen(false)}
      />

      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Topbar
          currentLang={autoDetect ? "auto" : currentLang}
          lastDetected={autoDetect ? lastDetected : null}
          status={status === "loading" ? "loading" : status === "error" ? "error" : "ready"}
          onMenuClick={() => setSidebarOpen((o) => !o)}
        />

        <main className="flex-1 overflow-y-auto px-4 py-6 scroll-smooth">
          <div className="max-w-3xl mx-auto w-full">
            {messages.length === 0
              ? <WelcomeScreen onSuggestion={(p) => handleSend(p)} />
              : <div className="flex flex-col gap-5">
                  {messages.map((msg) => <MessageBubble key={msg.id} message={msg} />)}
                  {isTyping && <TypingIndicator />}
                  <div ref={messagesEndRef} />
                </div>
            }
          </div>
        </main>

        <ChatInput
          value={inputValue} onChange={setInputValue}
          onSend={() => handleSend()} disabled={status !== "ready"}
          currentLang={autoDetect ? "auto" : currentLang}
        />
      </div>

      <PipelineStatusBar stage={pipelineStage} label={pipelineLabel} />
    </div>
  );
}
