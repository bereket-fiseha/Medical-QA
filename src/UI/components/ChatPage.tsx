"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { nanoid } from "@/lib/nanoid";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import WelcomeScreen from "./WelcomeScreen";
import MessageBubble from "./MessageBubble";
import TypingIndicator from "./TypingIndicator";
import ChatInput from "./ChatInput";
import TranslationToast from "./TranslationToast";
import { sendChatMessage } from "@/lib/api";
import { LANGUAGES } from "@/lib/constants";
import type { Message, LanguageCode } from "@/lib/types";

type Status = "ready" | "loading" | "translating" | "error";

export default function ChatPage() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [currentLang, setCurrentLang] = useState<LanguageCode>("en");
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [status, setStatus] = useState<Status>("ready");
  const [isTyping, setIsTyping] = useState(false);
  const [toast, setToast] = useState({ visible: false, message: "" });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hasMessages = messages.length > 0;

  // Scroll to bottom whenever messages or typing state changes
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  function showToast(msg: string) {
    setToast({ visible: true, message: msg });
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(
      () => setToast((t) => ({ ...t, visible: false })),
      3000
    );
  }

  const handleSend = useCallback(async (overrideText?: string) => {
    const text = (overrideText ?? inputValue).trim();
    if (!text || status !== "ready") return;

    const langMeta = LANGUAGES.find((l) => l.code === currentLang)!;

    // Add user message
    const userMsg: Message = {
      id: nanoid(),
      role: "user",
      text,
      timestamp: new Date(),
      translatedFrom: currentLang !== "en" ? langMeta.label : undefined,
    };
    setMessages((prev) => [...prev, userMsg]);
    setInputValue("");

    // Update status
    if (currentLang !== "en") {
      setStatus("translating");
      showToast(`Translating from ${langMeta.label} to English…`);
    } else {
      setStatus("loading");
    }
    setIsTyping(true);

    try {
      const data = await sendChatMessage({ message: text, language: currentLang });

      if (currentLang !== "en") {
        showToast(`Response translated back to ${langMeta.label}`);
      }

      const assistantMsg: Message = {
        id: nanoid(),
        role: "assistant",
        text: data.response,
        timestamp: new Date(),
        source: data.source,
        kgUsed: data.kg_used,
      };
      setMessages((prev) => [...prev, assistantMsg]);
      setStatus("ready");
    } catch (err) {
      const errorText =
        err instanceof Error && err.message.includes("fetch")
          ? "Unable to connect to the MediAssist server. Make sure the API is running on localhost:8000."
          : err instanceof Error
          ? err.message
          : "An unexpected error occurred. Please try again.";

      const errMsg: Message = {
        id: nanoid(),
        role: "error",
        text: errorText,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errMsg]);
      setStatus("error");
      setTimeout(() => setStatus("ready"), 3000);
    } finally {
      setIsTyping(false);
    }
  }, [inputValue, currentLang, status]);

  function handleNewChat() {
    setMessages([]);
    setInputValue("");
    setIsTyping(false);
    setStatus("ready");
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* Sidebar */}
      <Sidebar
        open={sidebarOpen}
        currentLang={currentLang}
        onLangChange={setCurrentLang}
        onNewChat={handleNewChat}
        onClose={() => setSidebarOpen(false)}
      />

      {/* Main */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Topbar
          currentLang={currentLang}
          status={status}
          onMenuClick={() => setSidebarOpen((o) => !o)}
        />

        {/* Chat area */}
        <main className="flex-1 overflow-y-auto px-4 py-6 scroll-smooth">
          <div className="max-w-3xl mx-auto w-full">
            {!hasMessages ? (
              <WelcomeScreen onSuggestion={(prompt) => handleSend(prompt)} />
            ) : (
              <div className="flex flex-col gap-5">
                {messages.map((msg) => (
                  <MessageBubble key={msg.id} message={msg} />
                ))}
                {isTyping && <TypingIndicator />}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>
        </main>

        {/* Input */}
        <ChatInput
          value={inputValue}
          onChange={setInputValue}
          onSend={() => handleSend()}
          disabled={status !== "ready"}
          currentLang={currentLang}
        />
      </div>

      {/* Translation toast */}
      <TranslationToast visible={toast.visible} message={toast.message} />
    </div>
  );
}
