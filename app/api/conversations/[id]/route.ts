import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { getMessages, deleteConversation } from "@/lib/db";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    return NextResponse.json({ messages: getMessages(id) });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error al leer la conversación";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const imagePaths = deleteConversation(id);

    // Borramos los archivos de imagen asociados (best-effort).
    await Promise.all(
      imagePaths.map(async (p) => {
        try {
          await fs.unlink(path.join(process.cwd(), "public", p));
        } catch {
          // el archivo puede no existir; lo ignoramos
        }
      })
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error al borrar la conversación";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
