import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import OpenAI from "openai";
import { MEDIA_DIR, mediaUrl } from "@/lib/media";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const SYSTEM_PROMPT = `Eres Sofia, una ingeniera de software senior con más de 10 años de experiencia en Amazon y Spotify, experta en inteligencia artificial y en enseñar tecnología de forma práctica.

Tu tarea es generar un DOCUMENTO DE ESTUDIO completo en formato Markdown sobre el tema que se te indique, pensado para que alguien lo aprenda haciendo.

ESTRUCTURA OBLIGATORIA del documento (en Markdown):
1. Un título con "# ".
2. Sección "## Resumen": qué es, para qué sirve y cuándo usarlo (2-4 párrafos).
3. Sección "## Conceptos clave": los fundamentos explicados con claridad, cada uno con un ejemplo de código.
4. Sección "## Ejercicios": de 5 a 8 ejercicios PROGRESIVOS (de básico a avanzado). Cada ejercicio con: enunciado claro, pistas, y un bloque de código de partida cuando aplique.
5. Sección "## Soluciones": la solución comentada de cada ejercicio.
6. Sección "## Buenas prácticas y siguientes pasos": consejos de un senior y qué aprender después.

REGLAS:
- TODO el código va en bloques con el lenguaje indicado (por ejemplo \`\`\`ts, \`\`\`bash, \`\`\`json).
- Los snippets deben ser correctos, idiomáticos y listos para ejecutar/adaptar.
- Explica el PORQUÉ, no solo el cómo. Incluye errores comunes y cómo evitarlos.
- Responde SIEMPRE en español (el código y palabras clave técnicas en su idioma original).
- Devuelve ÚNICAMENTE el Markdown del documento. No agregues texto fuera del documento ni uses bloque de código para envolver todo el documento.`;

export async function POST(request: NextRequest) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "Falta la variable OPENAI_API_KEY en .env.local" },
        { status: 500 }
      );
    }

    const { topic, focus, level, messageId } = (await request.json()) as {
      topic?: string;
      focus?: string;
      level?: string;
      messageId?: string;
    };

    if (!topic?.trim()) {
      return NextResponse.json(
        { error: "No se recibió el tema a estudiar" },
        { status: 400 }
      );
    }

    const userParts = [`Tema: ${topic.trim()}`];
    if (focus?.trim()) userParts.push(`Enfoque específico: ${focus.trim()}`);
    if (level?.trim()) userParts.push(`Nivel: ${level.trim()}`);
    userParts.push("Genera el documento de estudio completo siguiendo la estructura indicada.");

    const completion = await openai.chat.completions.create({
      model: "gpt-4.1",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userParts.join("\n") },
      ],
      max_completion_tokens: 8192,
    });

    const markdown = completion.choices[0]?.message?.content?.trim();
    if (!markdown) {
      return NextResponse.json({ error: "No se pudo generar el documento" }, { status: 502 });
    }

    // Título legible para la tarjeta/descarga.
    const title = topic.trim();

    // Guardamos el .md en MEDIA_DIR (igual que imágenes/audios).
    const safeId = messageId?.replace(/[^a-zA-Z0-9_-]/g, "");
    const fileName = `${safeId || `sofia-doc-${Date.now()}`}.md`;
    await fs.mkdir(MEDIA_DIR, { recursive: true });
    await fs.writeFile(path.join(MEDIA_DIR, fileName), markdown, "utf-8");

    return NextResponse.json({ markdown, url: mediaUrl(fileName), title });
  } catch (err: unknown) {
    console.error("[/api/study]", err);
    const message = err instanceof Error ? err.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
