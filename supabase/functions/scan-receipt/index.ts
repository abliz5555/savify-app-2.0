// Savify — "scan-receipt" Supabase Edge Function (free)
// Reads a receipt photo with Google Gemini (free API key) and returns
// { merchant, amount, date, category, confidence }.
//
// Secrets to set in Supabase → Edge Functions → Secrets:
//   GEMINI_API_KEY   (required — from https://aistudio.google.com/apikey)
//   GEMINI_MODEL     (optional — default "gemini-flash-lite-latest")
//   DAILY_SCAN_LIMIT (optional — default 15 scans per user per day)
//
// SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY are provided
// automatically by Supabase.

import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CATEGORIES = [
  "Food & Dining", "Transportation", "Housing", "Entertainment",
  "Healthcare", "Shopping", "Education", "Travel", "Utilities", "Other",
];

function reply(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return reply({ error: "Method not allowed" }, 405);

  try {
    // 1. Who is calling? (must be a signed-in Savify user)
    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return reply({ error: "Please sign in again." }, 401);

    // 2. Daily limit per user (protects your free Gemini quota)
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const limit = Number(Deno.env.get("DAILY_SCAN_LIMIT") ?? "15");
    const today = new Date().toISOString().slice(0, 10);
    const { data: usage } = await admin
      .from("ai_usage").select("count").eq("user_id", user.id).eq("day", today).maybeSingle();
    const used = usage?.count ?? 0;
    if (used >= limit) {
      return reply({ error: `Daily scan limit reached (${limit}). Try again tomorrow or enter it manually.` }, 429);
    }

    // 3. Read the photo
    const { imageBase64, mimeType } = await req.json() as { imageBase64?: string; mimeType?: string };
    if (!imageBase64) return reply({ error: "No image received." }, 400);
    if (imageBase64.length > 7_000_000) return reply({ error: "Image is too large. Please take a closer photo." }, 413);

    const apiKey = Deno.env.get("GEMINI_API_KEY");
    if (!apiKey) return reply({ error: "Receipt scanning is not set up yet (missing GEMINI_API_KEY)." }, 503);
    const model = Deno.env.get("GEMINI_MODEL") ?? "gemini-flash-lite-latest";

    const prompt =
      `You read shop receipts. Return ONLY JSON with these keys:
merchant (string, shop name), amount (number, the final TOTAL paid, no currency sign),
date (string YYYY-MM-DD, use ${today} if not visible),
category (one of: ${CATEGORIES.join(", ")}),
confidence (number 0-1, how sure you are).
If the picture is not a receipt, return {"merchant":"","amount":0,"date":"${today}","category":"Other","confidence":0}.`;

    const gemini = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: prompt },
              { inline_data: { mime_type: mimeType || "image/jpeg", data: imageBase64 } },
            ],
          }],
          generationConfig: { responseMimeType: "application/json", temperature: 0 },
        }),
      },
    );

    if (gemini.status === 429) {
      return reply({ error: "The free scanner is busy right now. Please try again in a minute." }, 429);
    }
    if (!gemini.ok) {
      console.error("Gemini error", gemini.status, await gemini.text());
      return reply({ error: "Could not read the receipt. Please try again or enter it manually." }, 502);
    }

    const out = await gemini.json();
    const text: string = out?.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
    let parsed: Record<string, unknown> = {};
    try { parsed = JSON.parse(text.replace(/```json|```/g, "").trim()); } catch { /* ignore */ }

    const amount = Math.abs(Number(parsed.amount) || 0);
    const date = /^\d{4}-\d{2}-\d{2}$/.test(String(parsed.date)) ? String(parsed.date) : today;
    const category = CATEGORIES.includes(String(parsed.category)) ? String(parsed.category) : "Other";

    // 4. Count this scan
    await admin.from("ai_usage").upsert({ user_id: user.id, day: today, count: used + 1 });

    return reply({
      merchant: String(parsed.merchant ?? "").slice(0, 80),
      amount: Math.round(amount * 100) / 100,
      date,
      category,
      confidence: Math.max(0, Math.min(1, Number(parsed.confidence) || 0)),
    });
  } catch (e) {
    console.error(e);
    return reply({ error: "Something went wrong while scanning. Please try again." }, 500);
  }
});
