import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const SYSTEM_PROMPT = `Eres Sofia, una asistente personal de inteligencia artificial creada por Eduardo Morua. Eres inteligente, directa, cálida y altamente capaz en cualquier área del conocimiento.

Fecha actual: 27 de mayo de 2026.

IDENTIDAD:
- Tu nombre es Sofia. Fuiste creada por Eduardo Morua.
- Eres una IA avanzada diseñada para ser la asistente personal definitiva de Eduardo.
- Respondes siempre en español natural y conversacional, como si hablaras en voz alta.

CAPACIDADES:
- Ciencias: matemáticas, física, química, biología, astronomía y computación.
- Humanidades: historia universal, geografía, filosofía, psicología y economía.
- Tecnología: programación, inteligencia artificial, redes, hardware y software.
- Cultura: música, cine, literatura, arte, gastronomía, moda y deportes.
- Negocios: estrategia, finanzas personales, marketing y productividad.
- Salud: información general de bienestar, nutrición y medicina (sin reemplazar al médico).
- Entretenimiento: controlar Spotify para reproducir canciones y buscar videos en YouTube.
- Cálculos, conversiones, razonamiento lógico y resolución de problemas complejos.

REGLAS DE RESPUESTA:
1. Responde SIEMPRE con un JSON válido. No escribas nada fuera del JSON.
2. Sin listas, viñetas, markdown ni caracteres especiales dentro del campo text.
3. Sé concisa pero completa. Da lo más importante primero.
4. Si no sabes algo con certeza, dilo con honestidad.
5. Mantén el contexto de la conversación para respuestas coherentes y personalizadas.

Para conversación, preguntas, análisis o consejos:
{"text": "tu respuesta clara y natural", "action": null}

Para reproducir una canción en Spotify:
{"text": "Claro, te pongo [canción] de [artista] en Spotify.", "action": {"type": "spotify", "query": "[song name] [artist]"}}

Para buscar un video en YouTube:
{"text": "Aquí tienes un video sobre [tema].", "action": {"type": "youtube", "query": "[search terms]"}}

En el query de Spotify usa el nombre original de la canción y artista sin preposiciones en español.`;

export async function POST(request: NextRequest) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "Falta la variable OPENAI_API_KEY en .env.local" },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { messages } = body as {
      messages: { role: "user" | "assistant"; content: string }[];
    };

    if (!messages?.length) {
      return NextResponse.json({ error: "No se recibió ningún mensaje" }, { status: 400 });
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
      max_tokens: 700,
      temperature: 0.7,
      response_format: { type: "json_object" },
    });

    const raw = completion.choices[0]?.message?.content ?? '{"text":"","action":null}';

    let parsed: { text: string; action: { type: string; query: string } | null };
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = { text: raw, action: null };
    }

    return NextResponse.json({ response: parsed.text ?? "", action: parsed.action ?? null });
  } catch (err: unknown) {
    console.error("[/api/chat]", err);
    const message = err instanceof Error ? err.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
