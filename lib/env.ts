// Validación centralizada de variables de entorno.
//
// Se ejecuta una vez al arrancar el servidor (ver instrumentation.ts) para
// fallar rápido y con un mensaje claro si falta una clave, en lugar de
// descubrirlo a mitad de una petición con un error críptico de OpenAI/Spotify.

interface EnvVar {
  name: string;
  required: boolean;
  // Para qué se usa (se muestra en el mensaje de error/advertencia).
  purpose: string;
}

const ENV_VARS: EnvVar[] = [
  { name: "OPENAI_API_KEY", required: true, purpose: "transcripción (Whisper) y respuestas (GPT)" },
  { name: "ELEVENLABS_API_KEY", required: true, purpose: "síntesis de voz" },
  { name: "ELEVENLABS_VOICE_ID", required: true, purpose: "voz personalizada de Sofia" },
  { name: "SPOTIFY_CLIENT_ID", required: false, purpose: "control de Spotify" },
  { name: "SPOTIFY_CLIENT_SECRET", required: false, purpose: "control de Spotify" },
  { name: "SPOTIFY_REDIRECT_URI", required: false, purpose: "OAuth de Spotify" },
  { name: "YOUTUBE_API_KEY", required: false, purpose: "recomendación de videos" },
];

/**
 * Valida las variables de entorno. Lanza un error si falta alguna obligatoria.
 * Las opcionales solo generan una advertencia en consola.
 */
export function validateEnv(): void {
  const missingRequired: EnvVar[] = [];
  const missingOptional: EnvVar[] = [];

  for (const v of ENV_VARS) {
    const value = process.env[v.name];
    if (!value || value.trim() === "" || value.startsWith("sk-...") || value === "...") {
      (v.required ? missingRequired : missingOptional).push(v);
    }
  }

  if (missingOptional.length > 0) {
    console.warn(
      "[env] Variables opcionales sin configurar (algunas funciones estarán deshabilitadas):\n" +
        missingOptional.map((v) => `  - ${v.name} → ${v.purpose}`).join("\n")
    );
  }

  if (missingRequired.length > 0) {
    const list = missingRequired.map((v) => `  - ${v.name} → ${v.purpose}`).join("\n");
    throw new Error(
      `[env] Faltan variables de entorno OBLIGATORIAS. Configúralas en .env.local:\n${list}`
    );
  }

  console.log("[env] Variables de entorno validadas correctamente.");
}
