import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { promises as fs } from "fs";
import path from "path";

// Carpeta donde se guardan los audios ya sintetizados para no volver a llamar
// a ElevenLabs cuando el texto se repite (ej. "Generando", "Procesando", saludo).
const CACHE_DIR = path.join(process.cwd(), ".tts-cache");

const VOICE_SETTINGS = {
  stability: 0.5,
  similarity_boost: 0.75,
  style: 0.2,
  use_speaker_boost: true,
};

function cacheKey(text: string, voiceId: string): string {
  return createHash("sha256")
    .update(`${voiceId}:${JSON.stringify(VOICE_SETTINGS)}:${text}`)
    .digest("hex");
}

function audioResponse(buffer: ArrayBuffer | Buffer, cached: boolean) {
  return new NextResponse(buffer as ArrayBuffer, {
    status: 200,
    headers: {
      "Content-Type": "audio/mpeg",
      "Cache-Control": "no-store",
      "X-TTS-Cache": cached ? "HIT" : "MISS",
    },
  });
}

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    const voiceId = process.env.ELEVENLABS_VOICE_ID;

    if (!apiKey || !voiceId) {
      return NextResponse.json(
        {
          error:
            "Faltan variables de entorno: ELEVENLABS_API_KEY y/o ELEVENLABS_VOICE_ID en .env.local",
        },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { text } = body as { text: string };

    if (!text?.trim()) {
      return NextResponse.json({ error: "No se recibió texto para sintetizar" }, { status: 400 });
    }

    const key = cacheKey(text.trim(), voiceId);
    const cachePath = path.join(CACHE_DIR, `${key}.mp3`);

    // 1) Si ya existe en caché, lo servimos sin llamar a ElevenLabs.
    try {
      const cached = await fs.readFile(cachePath);
      return audioResponse(cached, true);
    } catch {
      // No está en caché: seguimos a sintetizar.
    }

    const elevenRes = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        method: "POST",
        headers: {
          Accept: "audio/mpeg",
          "Content-Type": "application/json",
          "xi-api-key": apiKey,
        },
        body: JSON.stringify({
          text,
          model_id: "eleven_multilingual_v2",
          voice_settings: VOICE_SETTINGS,
        }),
      }
    );

    if (!elevenRes.ok) {
      const errText = await elevenRes.text();
      console.error("[/api/speak] ElevenLabs error:", errText);
      return NextResponse.json(
        { error: `ElevenLabs respondió con error ${elevenRes.status}` },
        { status: 502 }
      );
    }

    const audioBuffer = await elevenRes.arrayBuffer();

    // 2) Guardamos en caché para próximas veces (best-effort).
    try {
      await fs.mkdir(CACHE_DIR, { recursive: true });
      await fs.writeFile(cachePath, Buffer.from(audioBuffer));
    } catch (err) {
      console.warn("[/api/speak] No se pudo escribir en caché:", err);
    }

    return audioResponse(audioBuffer, false);
  } catch (err: unknown) {
    console.error("[/api/speak]", err);
    const message = err instanceof Error ? err.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
