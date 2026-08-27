const GROQ_MODEL = "allam-2-7b";
const TIMEOUT_MS = 8000;

/**
 * One full, independent completion attempt. Never partially consumed —
 * a caller either gets this whole response or falls through to the next
 * key/fallback. Never merge output across two calls (risks corrupted,
 * frankensteined text if a key switch happens mid-thought).
 */
async function callGroq(apiKey: string, systemPrompt: string, userPrompt: string, maxTokens: number): Promise<string | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        temperature: 0.2,
        max_tokens: maxTokens,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
      signal: controller.signal,
    });

    if (!res.ok) return null;

    const data = await res.json();
    const choice = data?.choices?.[0];
    // finish_reason "length" means it got cut off mid-sentence — treat as a
    // failed attempt rather than ship a truncated fragment.
    if (choice?.finish_reason === "length") return null;

    const text: string | undefined = choice?.message?.content;
    return text?.trim() || null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/** Tries GROQ_API_KEY, then GROQ_API_KEY_2 as a full independent retry if the first fails for any reason. */
async function tryKeys(systemPrompt: string, userPrompt: string, maxTokens: number): Promise<string | null> {
  const keys = [process.env.GROQ_API_KEY, process.env.GROQ_API_KEY_2].filter((k): k is string => Boolean(k));

  for (const key of keys) {
    const result = await callGroq(key, systemPrompt, userPrompt, maxTokens);
    if (result) return result;
  }
  return null;
}

/**
 * Writes a short one-line reminder email body. Returns null if both keys
 * are unset/fail — callers must fall back to a static line; reminder
 * delivery never depends on this.
 */
export async function craftReminderBody(prompt: string): Promise<string | null> {
  return tryKeys(
    "Reply with one short plain sentence, under 10 words. No labels, no quotes, no markdown.",
    prompt,
    20
  );
}

/**
 * Writes a short 1-2 sentence morning-briefing opener for the daily digest.
 * The actual task list and deadlines are always rendered deterministically
 * by the caller, never by this — this only adds a human framing line on
 * top, so a bad/garbled completion can never misstate a date or deadline.
 */
export async function craftDigestSummary(prompt: string): Promise<string | null> {
  return tryKeys(
    "You write a short, friendly opening line for a morning task-briefing email. " +
      "1-2 sentences, under 30 words total. No labels, no quotes, no markdown, no greeting like 'Dear'.",
    prompt,
    60
  );
}
