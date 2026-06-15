import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import OpenAI from "openai";
import { MEDIA_DIR, mediaUrl } from "@/lib/media";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const DEFAULT_PROMPT =
  "Combina estas imágenes en una sola imagen nueva, coherente y bien compuesta.";

export async function POST(request: NextRequest) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "Falta la variable OPENAI_API_KEY en .env.local" },
        { status: 500 }
      );
    }

    const formData = await request.formData();
    const prompt = (formData.get("prompt") as string | null)?.trim() || DEFAULT_PROMPT;
    const messageId = (formData.get("messageId") as string | null) ?? undefined;

    // Una o varias imágenes de referencia (campo repetido "images").
    const images = formData
      .getAll("images")
      .filter((v): v is File => v instanceof File && v.size > 0);

    if (images.length === 0) {
      return NextResponse.json(
        { error: "No se recibió ninguna imagen de referencia" },
        { status: 400 }
      );
    }

    // gpt-image-1 acepta varias imágenes de referencia para generar una nueva.
    const result = await openai.images.edit({
      model: "gpt-image-1",
      image: images,
      prompt,
      size: "1024x1024",
    });

    const b64 = result.data?.[0]?.b64_json;
    if (!b64) {
      return NextResponse.json({ error: "No se pudo generar la imagen" }, { status: 502 });
    }

    const safeId = messageId?.replace(/[^a-zA-Z0-9_-]/g, "");
    const fileName = `${safeId || `sofia-${Date.now()}`}.png`;
    await fs.mkdir(MEDIA_DIR, { recursive: true });
    await fs.writeFile(path.join(MEDIA_DIR, fileName), Buffer.from(b64, "base64"));

    return NextResponse.json({ image: mediaUrl(fileName) });
  } catch (err: unknown) {
    console.error("[/api/image/edit]", err);
    const message = err instanceof Error ? err.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
