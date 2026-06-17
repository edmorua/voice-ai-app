// Capa de síntesis de voz (TTS) con selección por tier de usuario.
//
//   free    → Piper  (modelo local, gratis, corre en CPU / Raspberry Pi)
//   premium → ElevenLabs (voz de alta calidad, de pago)
//
// Cada proveedor expone la MISMA forma (TtsProvider) para que la ruta /api/speak
// los trate igual: misma caché por hash, mismo manejo de respuesta. Lo único que
// cambia es quién genera los bytes de audio y en qué formato (mp3 vs wav).

import { spawn } from "child_process";

export type Tier = "free" | "premium";

export interface TtsProvider {
  name: "elevenlabs" | "piper";
  contentType: string; // "audio/mpeg" | "audio/wav"
  ext: "mp3" | "wav";
  // Identifica voz + ajustes; entra en la clave de caché para que el mismo
  // texto sintetizado con otra voz/proveedor no colisione.
  cacheTag: string;
  synth(text: string): Promise<Buffer>;
}

// Ajustes de la voz de ElevenLabs (voz limpia, cálida, alegre y un punto
// seductora). Movidos aquí desde la ruta.
const ELEVEN_VOICE_SETTINGS = {
  stability: 0.32,
  similarity_boost: 0.9,
  style: 0.72,
  use_speaker_boost: true,
  speed: 1.1,
};

function elevenLabsProvider(): TtsProvider {
  const apiKey = process.env.ELEVENLABS_API_KEY!;
  const voiceId = process.env.ELEVENLABS_VOICE_ID!;
  return {
    name: "elevenlabs",
    contentType: "audio/mpeg",
    ext: "mp3",
    cacheTag: `elevenlabs:${voiceId}:${JSON.stringify(ELEVEN_VOICE_SETTINGS)}`,
    async synth(text: string): Promise<Buffer> {
      const res = await fetch(
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
            voice_settings: ELEVEN_VOICE_SETTINGS,
          }),
        }
      );
      if (!res.ok) {
        throw new Error(`ElevenLabs respondió ${res.status}: ${await res.text()}`);
      }
      return Buffer.from(await res.arrayBuffer());
    },
  };
}

// Ejecuta el binario de Piper: lee el texto por stdin y escribe un WAV a stdout.
function runPiper(bin: string, voice: string, text: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const proc = spawn(bin, ["--model", voice, "--output_file", "-"]);
    const out: Buffer[] = [];
    const err: Buffer[] = [];

    proc.stdout.on("data", (d) => out.push(d));
    proc.stderr.on("data", (d) => err.push(d));
    proc.on("error", (e) =>
      reject(new Error(`No se pudo ejecutar Piper ('${bin}'): ${e.message}`))
    );
    proc.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`Piper terminó con código ${code}: ${Buffer.concat(err).toString()}`));
        return;
      }
      resolve(Buffer.concat(out));
    });

    proc.stdin.write(text);
    proc.stdin.end();
  });
}

function piperProvider(): TtsProvider {
  const bin = process.env.PIPER_BIN || "piper";
  const voice = process.env.PIPER_VOICE;
  if (!voice) {
    throw new Error(
      "Falta PIPER_VOICE (ruta al modelo .onnx de Piper) en el entorno"
    );
  }
  return {
    name: "piper",
    contentType: "audio/wav",
    ext: "wav",
    cacheTag: `piper:${voice}`,
    synth: (text: string) => runPiper(bin, voice, text),
  };
}

/**
 * Elige el proveedor de voz según el tier.
 * Si se pide premium pero ElevenLabs no está configurado, cae a Piper (free).
 */
export function selectProvider(tier: Tier): TtsProvider {
  const elevenReady =
    !!process.env.ELEVENLABS_API_KEY && !!process.env.ELEVENLABS_VOICE_ID;
  if (tier === "premium" && elevenReady) {
    return elevenLabsProvider();
  }
  return piperProvider();
}
