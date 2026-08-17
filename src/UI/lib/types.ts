export type LanguageCode = "en" | "rw" | "dav" | "auto";

export interface Language {
  code: LanguageCode;
  label: string;
  flag: string;
  badge: string;
  placeholder: string;
}

export interface Message {
  id: string;
  role: "user" | "assistant" | "error";
  text: string;
  timestamp: Date;
  translatedFrom?: string;
  detectedLang?: string;        // set on USER message when auto-detect resolves
  detectedConfidence?: number;  // 0–1 confidence score
  source?: string;
  kgUsed?: boolean;
}

export interface ChatApiRequest {
  message: string;
  language: LanguageCode;
}

export interface ChatApiResponse {
  response: string;
  original_message: string;
  translated_input?: string;
  language: string;
  detected_language?: string;
  detection_confidence?: number;
  kg_used: boolean;
  source: string;
}
