import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { MEDIA_DIR, LEGACY_MEDIA_DIR } from "@/lib/media";

// Sirve los medios generados (música, TTS, imágenes) desde una carpeta fuera del
// árbol del proyecto. Ver lib/media.ts para el porqué. Busca primero en MEDIA_DIR
// y cae al directorio heredado public/generated para mensajes antiguos.

const CONTENT_TYPES: Record<string, string> = {
  ".mp3": "audio/mpeg",
  ".mpeg": "audio/mpeg",
  ".wav": "audio/wav",
  ".ogg": "audio/ogg",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".md": "text/markdown; charset=utf-8",
};

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ file: string }> }
) {
  const { file } = await params;

  // Evita path traversal: solo permitimos un nombre de archivo simple.
  const fileName = path.basename(file);
  if (fileName !== file || fileName.startsWith(".")) {
    return NextResponse.json({ error: "Nombre de archivo inválido" }, { status: 400 });
  }

  const ext = path.extname(fileName).toLowerCase();
  const contentType = CONTENT_TYPES[ext] ?? "application/octet-stream";

  for (const dir of [MEDIA_DIR, LEGACY_MEDIA_DIR]) {
    try {
      const data = await fs.readFile(path.join(dir, fileName));
      return new NextResponse(new Uint8Array(data), {
        headers: {
          "Content-Type": contentType,
          "Content-Length": String(data.length),
          // Los nombres son únicos (uuid del mensaje), así que se pueden cachear.
          "Cache-Control": "public, max-age=31536000, immutable",
        },
      });
    } catch {
      // Probar el siguiente directorio.
    }
  }

  return NextResponse.json({ error: "Archivo no encontrado" }, { status: 404 });
}
