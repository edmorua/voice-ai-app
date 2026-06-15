import { NextRequest, NextResponse } from "next/server";
import { createConversation, listConversations } from "@/lib/db";

export async function GET() {
  try {
    return NextResponse.json({ conversations: listConversations() });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error al leer conversaciones";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { id, title } = (await request.json()) as { id?: string; title?: string };
    if (!id?.trim()) {
      return NextResponse.json({ error: "Falta el id de la conversación" }, { status: 400 });
    }
    const cleanTitle = (title ?? "").trim().slice(0, 80) || null;
    createConversation(id, cleanTitle);
    return NextResponse.json({ id, title: cleanTitle });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error al crear conversación";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
