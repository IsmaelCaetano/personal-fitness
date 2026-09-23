const endpoint = "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent";

type GeminiPart = { text: string } | { inlineData: { mimeType: string; data: string } };

export async function askGemini(parts: GeminiPart[], responseSchema?: Record<string, unknown>) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("AI_NOT_CONFIGURED");
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({
      contents: [{ role: "user", parts }],
      generationConfig: {
        maxOutputTokens: 16384,
        ...(responseSchema ? { responseMimeType: "application/json", responseSchema } : {}),
      },
    }),
    signal: AbortSignal.timeout(45000),
  });
  const payload = await response.json() as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
    error?: { message?: string };
  };
  if (!response.ok) throw new Error(payload.error?.message ?? "A IA não respondeu.");
  const text = payload.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("").trim();
  if (!text) throw new Error("A IA retornou uma resposta vazia.");
  return text;
}
