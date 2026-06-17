import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { promises as fs } from "fs";
import path from "path";
import { selectProvider, type Tier } from "@/lib/tts";

// Carpeta donde se guardan los audios ya sintetizados para no volver a llamar
// al proveedor (ElevenLabs/Piper) cuando el texto se repite (ej. "Generando",
// "Procesando", saludo).
const CACHE_DIR = path.join(process.cwd(), ".tts-cache");

function cacheKey(text: string, cacheTag: string): string {
  return createHash("sha256").update(`${cacheTag}:${text}`).digest("hex");
}

function audioResponse(buffer: ArrayBuffer | Buffer, contentType: string, cached: boolean) {
  return new NextResponse(buffer as ArrayBuffer, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "no-store",
      "X-TTS-Cache": cached ? "HIT" : "MISS",
    },
  });
}

// Tier del usuario: del body, o de SOFIA_DEFAULT_TIER, o "premium" por defecto.
function resolveTier(bodyTier: unknown): Tier {
  if (bodyTier === "free" || bodyTier === "premium") return bodyTier;
  const env = process.env.SOFIA_DEFAULT_TIER;
  if (env === "free" || env === "premium") return env;
  return "premium";
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { text?: string; tier?: string };
    const text = body.text?.trim();

    if (!text) {
      return NextResponse.json({ error: "No se recibió texto para sintetizar" }, { status: 400 });
    }

    let provider;
    try {
      provider = selectProvider(resolveTier(body.tier));
    } catch (err) {
      // Falta configuración del proveedor elegido (claves de ElevenLabs o voz de Piper).
      const message = err instanceof Error ? err.message : "Proveedor de voz no configurado";
      return NextResponse.json({ error: message }, { status: 500 });
    }

    const key = cacheKey(text, provider.cacheTag);
    const cachePath = path.join(CACHE_DIR, `${key}.${provider.ext}`);

    // 1) Si ya existe en caché, lo servimos sin volver a sintetizar.
    try {
      const cached = await fs.readFile(cachePath);
      return audioResponse(cached, provider.contentType, true);
    } catch {
      // No está en caché: seguimos a sintetizar.
    }

    let audioBuffer: Buffer;
    try {
      audioBuffer = await provider.synth(text);
    } catch (err) {
      console.error(`[/api/speak] error de ${provider.name}:`, err);
      return NextResponse.json(
        { error: `El proveedor de voz (${provider.name}) falló al sintetizar` },
        { status: 502 }
      );
    }

    // 2) Guardamos en caché para próximas veces (best-effort).
    try {
      await fs.mkdir(CACHE_DIR, { recursive: true });
      await fs.writeFile(cachePath, audioBuffer);
    } catch (err) {
      console.warn("[/api/speak] No se pudo escribir en caché:", err);
    }

    return audioResponse(audioBuffer, provider.contentType, false);
  } catch (err: unknown) {
    console.error("[/api/speak]", err);
    const message = err instanceof Error ? err.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
