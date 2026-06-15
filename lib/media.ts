// Almacenamiento de medios generados en runtime (audios de música/TTS e imágenes).
//
// IMPORTANTE: estos archivos NO se guardan en `public/`. En modo dev, Next.js
// vigila el árbol del proyecto (incluido `public/`) y, al detectar un archivo
// nuevo, fuerza una recarga completa de la página. Eso hacía que al generar una
// canción la app "se reiniciara" justo cuando iba a sonar. Guardándolos fuera
// del proyecto, el watcher no los ve y la recarga desaparece.
//
// La carpeta es configurable con la variable MEDIA_DIR; por defecto vive en el
// home del usuario para persistir entre reinicios y quedar fuera del repo.

import os from "os";
import path from "path";

export const MEDIA_DIR =
  process.env.MEDIA_DIR?.trim() || path.join(os.homedir(), ".sofia-media");

// Carpeta heredada donde quedaron los medios generados antes de este cambio.
// El route handler de /api/media la usa como fallback para no romper mensajes
// antiguos cuya URL ya quedó guardada en la base de datos.
export const LEGACY_MEDIA_DIR = path.join(process.cwd(), "public", "generated");

// URL pública (servida por app/api/media/[file]/route.ts) de un archivo guardado.
export function mediaUrl(fileName: string): string {
  return `/api/media/${fileName}`;
}
