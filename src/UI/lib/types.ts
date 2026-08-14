export type LanguageCode = "en" | "rw" | "dav";

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
  language: LanguageCode;
  kg_used: boolean;
  source: string;
}
