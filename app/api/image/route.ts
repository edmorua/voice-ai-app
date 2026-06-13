import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Carpeta pública donde se guardan las imágenes generadas.
const IMAGES_DIR = path.join(process.cwd(), "public", "generated");

export async function POST(request: NextRequest) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "Falta la variable OPENAI_API_KEY en .env.local" },
        { status: 500 }
      );
    }

    const { prompt } = (await request.json()) as { prompt?: string };

    if (!prompt?.trim()) {
      return NextResponse.json(
        { error: "No se recibió ninguna descripción para la imagen" },
        { status: 400 }
      );
    }

    const result = await openai.images.generate({
      model: "gpt-image-1",
      prompt: prompt.trim(),
      size: "1024x1024",
      n: 1,
    });

    const b64 = result.data?.[0]?.b64_json;
    if (!b64) {
      return NextResponse.json(
        { error: "No se pudo generar la imagen" },
        { status: 502 }
      );
    }

    // Guardamos la imagen en disco y devolvemos su URL pública.
    const fileName = `sofia-${Date.now()}.png`;
    await fs.mkdir(IMAGES_DIR, { recursive: true });
    await fs.writeFile(path.join(IMAGES_DIR, fileName), Buffer.from(b64, "base64"));

    return NextResponse.json({ image: `/generated/${fileName}` });
  } catch (err: unknown) {
    console.error("[/api/image]", err);
    const message = err instanceof Error ? err.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
