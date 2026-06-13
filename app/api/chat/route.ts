import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { getRecentPlays, getTopArtists, getTopTracks } from "@/lib/db";

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
- Creatividad visual: generar imágenes a partir de una descripción.
- Cálculos, conversiones, razonamiento lógico y resolución de problemas complejos.

REGLAS DE RESPUESTA:
1. Responde SIEMPRE con un JSON válido. No escribas nada fuera del JSON.
2. Sin listas, viñetas, markdown ni caracteres especiales dentro del campo text.
3. Sé concisa pero completa. Da lo más importante primero.
4. Si no sabes algo con certeza, dilo con honestidad.
5. Mantén el contexto de la conversación para respuestas coherentes y personalizadas.
6. Usa el historial musical para hacer recomendaciones personalizadas. Si el usuario pide una recomendación o "algo parecido", usa los artistas y géneros que más escucha como base.

Para conversación, preguntas, análisis o consejos:
{"text": "tu respuesta clara y natural", "action": null}

Para reproducir una canción en Spotify:
{"text": "Claro, te pongo [canción] de [artista] en Spotify.", "action": {"type": "spotify", "query": "[song name] [artist]", "target": "default"}}

El campo "target" indica en qué dispositivo reproducir:
- "default": sin dispositivo específico o solo dice "en Spotify" — reproduce donde haya algo activo.
- "pc": dice "en la pc", "en la computadora", "en el escritorio", "en windows", "en linux", "en mi pc".
- "mac": dice "en la mac", "en el mac", "en mi mac", "en la macbook", "en el macbook", "en el imac", "en mi macbook".
- "phone": dice "en mi celular", "en el teléfono", "en el móvil", "en mi teléfono".
- "tv": dice "en la tele", "en la tv", "en el tv", "en la televisión", "en la sala", "en mi pantalla principal", "en la samsung", "en la pantalla grande".

Para buscar un video en YouTube:
{"text": "Aquí tienes un video sobre [tema].", "action": {"type": "youtube", "query": "[search terms]"}}

Para generar una imagen cuando el usuario lo pida (por ejemplo dice "genera una imagen", "créame una imagen", "dibuja", "haz una imagen de", "muéstrame una imagen de"):
{"text": "Claro, estoy generando una imagen de [descripción breve].", "action": {"type": "image", "prompt": "[descripción detallada y visual en español de lo que se debe dibujar]"}}

En el campo "prompt" de la acción image, expande y enriquece la descripción del usuario con detalles visuales (estilo, colores, composición, iluminación) para que la imagen sea más vívida, manteniendo fielmente lo que pidió.

En el query de Spotify usa el nombre original de la canción y artista sin preposiciones en español.`;

function buildMusicContext(): string {
  try {
    const recent = getRecentPlays(20);
    const topArtists = getTopArtists(5);
    const topTracks = getTopTracks(5);

    if (recent.length === 0) return "";

    const lines: string[] = ["\n\nHISTORIAL MUSICAL DE EDUARDO:"];

    if (topArtists.length > 0) {
      lines.push(
        "Artistas más escuchados: " +
          topArtists.map((a) => `${a.artist} (${a.count}x)`).join(", ")
      );
    }

    if (topTracks.length > 0) {
      lines.push(
        "Canciones más repetidas: " +
          topTracks.map((t) => `"${t.track_name}" de ${t.artist}`).join(", ")
      );
    }

    lines.push(
      "Últimas canciones: " +
        recent
          .slice(0, 10)
          .map((p) => `"${p.track_name}" de ${p.artist}`)
          .join(", ")
    );

    lines.push(
      "Usa este historial para recomendar canciones similares cuando el usuario lo pida. " +
        "Si dice 'recomiéndame algo', 'pon algo parecido', 'algo similar' o 'sorpréndeme', " +
        "elige una canción que encaje con su gusto musical y ponla automáticamente con action spotify."
    );

    return lines.join("\n");
  } catch {
    return "";
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "Falta la variable OPENAI_API_KEY en .env.local" },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { messages, spotifyDevices } = body as {
      messages: { role: "user" | "assistant"; content: string }[];
      spotifyDevices?: { id: string; name: string; type: string }[];
    };

    if (!messages?.length) {
      return NextResponse.json({ error: "No se recibió ningún mensaje" }, { status: 400 });
    }

    let systemPrompt = SYSTEM_PROMPT + buildMusicContext();

    if (spotifyDevices?.length) {
      const deviceList = spotifyDevices
        .map((d) => `- "${d.name}" (${d.type}, id: ${d.id})`)
        .join("\n");
      systemPrompt +=
        `\n\nDISPOSITIVOS SPOTIFY ACTIVOS AHORA:\n${deviceList}\n` +
        `Cuando el usuario diga el nombre de un dispositivo, usa ese nombre exacto como "target" y también incluye el "deviceId" en la acción.`;
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-4.1",
      messages: [{ role: "system", content: systemPrompt }, ...messages],
      max_tokens: 700,
      temperature: 0.7,
      response_format: { type: "json_object" },
    });

    const raw = completion.choices[0]?.message?.content ?? '{"text":"","action":null}';

    let parsed: { text: string; action: Record<string, unknown> | null };
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
