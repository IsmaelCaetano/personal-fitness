import { createClient } from "@/lib/supabase/server";
import { askGemini } from "@/lib/fitness/gemini";
import { z } from "zod";

export const dynamic = "force-dynamic";
const requestSchema = z.object({ image: z.string().max(3_700_000), mimeType: z.enum(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]) });

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Entre com sua conta para ler a imagem." }, { status: 401 });
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return Response.json({ error: "Origem inválida." }, { status: 403 });
  try {
    const raw = await request.text();
    if (raw.length > 3_800_000) return Response.json({ error: "A imagem precisa ser menor. Recorte a ficha e tente de novo." }, { status: 413 });
    const parsed = requestSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) return Response.json({ error: "Use uma imagem JPG, PNG, WEBP ou HEIC." }, { status: 400 });
    const match = /^data:(image\/(?:jpeg|png|webp|heic|heif));base64,([A-Za-z0-9+/]+={0,2})$/.exec(parsed.data.image);
    if (!match || match[1] !== parsed.data.mimeType || Buffer.from(match[2], "base64").length > 2_800_000)
      return Response.json({ error: "Imagem inválida ou grande demais." }, { status: 400 });
    const base64 = match[2];
    const text = await askGemini([
      { text: "Transcreva esta ficha de treino em português. Preserve títulos, dias, nomes dos exercícios, séries, repetições, cargas, descansos, RIR/RPE e observações. Use uma linha por exercício no formato Nome — séries x repetições — carga — descanso — observações. Não invente informações ilegíveis; marque [ilegível]. Retorne somente o texto transcrito." },
      { inlineData: { mimeType: parsed.data.mimeType, data: base64 } },
    ]);
    return Response.json({ text: text.slice(0, 50_000) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("workout ocr", error);
    const message = error instanceof Error ? error.message : "Falha ao ler imagem.";
    if (message === "AI_NOT_CONFIGURED") return Response.json({ error: "A leitura por imagem ainda não foi configurada pelo administrador." }, { status: 503 });
    return Response.json({ error: "Não foi possível ler esta imagem. Tente uma foto mais nítida e bem iluminada." }, { status: 503 });
  }
}
