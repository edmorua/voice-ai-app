import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { MEDIA_DIR, mediaUrl } from "@/lib/media";

// Límites de duración para la música generada (ElevenLabs Music).
const MIN_MS = 10_000;
const MAX_MS = 120_000;
const DEFAULT_MS = 120_000;

export async function POST(request: NextRequest) {
  try {
    if (!process.env.ELEVENLABS_API_KEY) {
      return NextResponse.json(
        { error: "Falta la variable ELEVENLABS_API_KEY en .env.local" },
        { status: 500 }
      );
    }

    const { prompt, durationMs, messageId } = (await request.json()) as {
      prompt?: string;
      durationMs?: number;
      messageId?: string;
    };

    if (!prompt?.trim()) {
      return NextResponse.json(
        { error: "No se recibió ninguna descripción para la música" },
        { status: 400 }
      );
    }

    const lengthMs = Math.min(
      MAX_MS,
      Math.max(MIN_MS, Math.round(durationMs ?? DEFAULT_MS))
    );

    const res = await fetch("https://api.elevenlabs.io/v1/music", {
      method: "POST",
      headers: {
        "xi-api-key": process.env.ELEVENLABS_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ prompt: prompt.trim(), music_length_ms: lengthMs }),
    });

    if (!res.ok) {
      // ElevenLabs devuelve JSON con el detalle del error (p. ej. prompt que
      // viola sus Términos por nombrar a un artista). Lo propagamos legible.
      let detail = `Error ${res.status} al generar la música`;
      try {
        const errJson = await res.json();
        const d = errJson?.detail;
        if (typeof d === "string") detail = d;
        else if (d?.message) detail = d.message;
      } catch {}
      return NextResponse.json({ error: detail }, { status: 502 });
    }

    const buffer = Buffer.from(await res.arrayBuffer());

    // Guardamos el audio en disco y devolvemos su URL pública. Si viene
    // messageId, nombramos el archivo con él para atarlo al mensaje.
    const safeId = messageId?.replace(/[^a-zA-Z0-9_-]/g, "");
    const fileName = `${safeId || `sofia-${Date.now()}`}.mp3`;
    await fs.mkdir(MEDIA_DIR, { recursive: true });
    await fs.writeFile(path.join(MEDIA_DIR, fileName), buffer);

    return NextResponse.json({ audio: mediaUrl(fileName) });
  } catch (err: unknown) {
    console.error("[/api/music]", err);
    const message = err instanceof Error ? err.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
