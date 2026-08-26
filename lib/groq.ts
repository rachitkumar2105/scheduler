const GROQ_MODEL = "allam-2-7b";
const TIMEOUT_MS = 5000;
const MAX_TOKENS = 20; // keep it tight — this is one short sentence, not a paragraph

async function callGroq(apiKey: string, prompt: string): Promise<string | null> {
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
        max_tokens: MAX_TOKENS,
        messages: [
          {
            role: "system",
            content: "Reply with one short plain sentence, under 10 words. No labels, no quotes, no markdown.",
          },
          { role: "user", content: prompt },
        ],
      }),
      signal: controller.signal,
    });

    if (!res.ok) return null;

    const data = await res.json();
    const text: string | undefined = data?.choices?.[0]?.message?.content;
    return text?.trim() || null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Writes a short one-line email body via Groq. Tries GROQ_API_KEY first, then
 * GROQ_API_KEY_2 if the first key fails for any reason (quota exhausted,
 * rate limited, etc). Returns null if both are unset/fail — callers must
 * fall back to a static line; reminder delivery never depends on this.
 */
export async function craftReminderBody(prompt: string): Promise<string | null> {
  const keys = [process.env.GROQ_API_KEY, process.env.GROQ_API_KEY_2].filter(
    (k): k is string => Boolean(k)
  );

  for (const key of keys) {
    const result = await callGroq(key, prompt);
    if (result) return result;
  }
  return null;
}
