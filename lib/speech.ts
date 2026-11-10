import { Platform } from "react-native";

/**
 * Free voice input using the phone's own speech recognition (Apple / Google).
 * Works in real app builds. In Expo Go the native part is missing, so
 * `speechAvailable()` returns false and the app falls back to typing
 * (users can still tap the microphone on their keyboard).
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let Speech: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  Speech = require("expo-speech-recognition").ExpoSpeechRecognitionModule;
} catch {
  Speech = null;
}

export function speechAvailable(): boolean {
  if (!Speech || Platform.OS === "web") return false;
  try { return Speech.isRecognitionAvailable?.() !== false; } catch { return false; }
}

const LANG: Record<string, string> = {
  English: "en-US", Arabic: "ar-AE", Russian: "ru-RU", Chinese: "zh-CN", French: "fr-FR", German: "de-DE",
  Spanish: "es-ES", Hindi: "hi-IN", Portuguese: "pt-BR", Japanese: "ja-JP", Korean: "ko-KR", Italian: "it-IT",
  Turkish: "tr-TR", Dutch: "nl-NL", Polish: "pl-PL",
};

/** Start listening. Returns a function that stops it. */
export async function startListening(opts: {
  language: string;
  onText: (text: string, isFinal: boolean) => void;
  onEnd: () => void;
  onError: (message: string) => void;
}): Promise<() => void> {
  if (!Speech) { opts.onError("Voice needs the installed app (not Expo Go). You can type instead."); return () => {}; }
  const perm = await Speech.requestPermissionsAsync();
  if (!perm?.granted) { opts.onError("Please allow microphone and speech access in your phone Settings."); return () => {}; }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const subs: { remove: () => void }[] = [
    Speech.addListener("result", (e: { results?: { transcript?: string }[]; isFinal?: boolean }) => {
      const text = e.results?.[0]?.transcript ?? "";
      if (text) opts.onText(text, !!e.isFinal);
    }),
    Speech.addListener("end", () => { cleanup(); opts.onEnd(); }),
    Speech.addListener("error", (e: { error?: string; message?: string }) => {
      if (e.error === "no-speech" || e.error === "aborted") return;
      opts.onError(e.message || "Couldn't hear that. Please try again.");
    }),
  ];
  function cleanup() { subs.splice(0).forEach((s) => { try { s.remove(); } catch {} }); }

  Speech.start({
    lang: LANG[opts.language] ?? "en-US",
    interimResults: true,
    continuous: false,
    addsPunctuation: false,
    // keep audio on the phone when the phone supports it (free + private)
    requiresOnDeviceRecognition: false,
  });

  return () => { try { Speech.stop(); } catch {} };
}
