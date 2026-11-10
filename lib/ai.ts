/**
 * Savify smart features — all free.
 *
 *  • Coach tips & analysis → lib/coach.ts (runs on the phone, no internet needed)
 *  • Receipt scan          → Supabase Edge Function "scan-receipt" using a free Gemini key
 */
import { supabase } from "@/lib/supabase";
import { generateTips, type Tip } from "@/lib/coach";
import type { AggregateData, FinancialProfile } from "@/lib/types";

export type ScannedData = { merchant: string; amount: number; date: string; category: string; confidence: number };

/** Coach tips in the old { insights } shape. */
export async function callCoach(
  data: AggregateData, currency: string, profile?: FinancialProfile | null,
): Promise<{ insights: { icon: string; headline: string; detail: string; saving?: string; trend: Tip["trend"] }[] }> {
  const tips = generateTips(data, currency, profile, 5);
  return { insights: tips.map((t) => ({ icon: t.icon, headline: t.title, detail: t.message, saving: t.saving, trend: t.trend })) };
}

/** Full analysis list (more tips). */
export async function callInsights(
  data: AggregateData, currency: string, profile?: FinancialProfile | null,
): Promise<{ insights: { type: string; icon: string; title: string; message: string; trend: Tip["trend"] }[] }> {
  const tips = generateTips(data, currency, profile, 10);
  return { insights: tips.map((t) => ({ type: t.id, icon: t.icon, title: t.title, message: t.message + (t.saving ? `  (${t.saving})` : ""), trend: t.trend })) };
}

/** Read a receipt photo. Throws a friendly error message if it can't. */
export async function callReceiptScan(imageBase64: string, mimeType: string): Promise<ScannedData> {
  const { data, error } = await supabase.functions.invoke<ScannedData>("scan-receipt", {
    body: { imageBase64, mimeType },
  });
  if (error) {
    // Try to show the message the function returned
    let msg = "Could not scan the receipt. Please try again or enter it manually.";
    try {
      const ctx = (error as { context?: Response }).context;
      if (ctx && typeof ctx.json === "function") {
        const body = await ctx.json() as { error?: string };
        if (body?.error) msg = body.error;
      }
    } catch { /* keep default */ }
    if (/Failed to send|fetch|network/i.test(error.message)) msg = "No internet connection. Please try again.";
    throw new Error(msg);
  }
  if (!data) throw new Error("Could not scan the receipt.");
  return data;
}
