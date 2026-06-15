import { NextRequest, NextResponse } from "next/server";
import { addMessage, updateMessageImage, updateMessageAudio, updateMessageDoc } from "@/lib/db";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: conversationId } = await params;
    const body = (await request.json()) as {
      id?: string;
      role?: "user" | "assistant";
      content?: string;
      imagePath?: string | null;
      imagePrompt?: string | null;
      audioPath?: string | null;
      audioPrompt?: string | null;
      docPath?: string | null;
      docTitle?: string | null;
    };

    if (!body.id || !body.role || typeof body.content !== "string") {
      return NextResponse.json({ error: "Mensaje inválido" }, { status: 400 });
    }

    addMessage({
      id: body.id,
      conversation_id: conversationId,
      role: body.role,
      content: body.content,
      image_path: body.imagePath ?? null,
      image_prompt: body.imagePrompt ?? null,
      audio_path: body.audioPath ?? null,
      audio_prompt: body.audioPrompt ?? null,
      doc_path: body.docPath ?? null,
      doc_title: body.docTitle ?? null,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error al guardar el mensaje";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { messageId, imagePath, audioPath, docPath, docTitle } = (await request.json()) as {
      messageId?: string;
      imagePath?: string;
      audioPath?: string;
      docPath?: string;
      docTitle?: string;
    };
    if (!messageId || (!imagePath && !audioPath && !docPath)) {
      return NextResponse.json(
        { error: "Faltan messageId y una ruta (imagePath, audioPath o docPath)" },
        { status: 400 }
      );
    }
    if (imagePath) updateMessageImage(messageId, imagePath);
    if (audioPath) updateMessageAudio(messageId, audioPath);
    if (docPath) updateMessageDoc(messageId, docPath, docTitle);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error al actualizar el mensaje";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
