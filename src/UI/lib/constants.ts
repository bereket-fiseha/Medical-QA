import type { Language } from "./types";

export const LANGUAGES: Language[] = [
  {
    code: "en",
    label: "English",
    flag: "🇬🇧",
    badge: "EN",
    placeholder: "Ask about hypertension, diabetes, diet…",
  },
  {
    code: "rw",
    label: "Kinyarwanda",
    flag: "🇷🇼",
    badge: "RW",
    placeholder: "Baza ikibazo ku ndwara zitandura…",
  },
  {
    code: "dav",
    label: "Kidawida",
    flag: "🇰🇪",
    badge: "DAV",
    placeholder: "Uliza kuhusu magonjwa yasiyoambukiza…",
  },
];

// NCD-focused suggestion cards shown on the welcome screen
export const SUGGESTIONS = [
  {
    icon: "🩺",
    text: "How do I manage high blood pressure?",
    prompt: "How do I manage high blood pressure?",
  },
  {
    icon: "🍬",
    text: "What foods should a diabetic avoid?",
    prompt: "What foods should a person with diabetes avoid?",
  },
  {
    icon: "🫀",
    text: "Signs of a heart attack I should know",
    prompt: "What are the warning signs of a heart attack?",
  },
  {
    icon: "🥦",
    text: "Best diet for preventing NCDs",
    prompt: "What is the best diet to prevent non-communicable diseases like hypertension and diabetes?",
  },
];
