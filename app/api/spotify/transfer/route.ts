import { NextRequest, NextResponse } from "next/server";
import { getValidAccessToken } from "../tokens";

export async function POST(request: NextRequest) {
  try {
    const { deviceId } = (await request.json()) as { deviceId: string };
    if (!deviceId) {
      return NextResponse.json({ error: "deviceId requerido" }, { status: 400 });
    }

    const token = await getValidAccessToken();

    const res = await fetch("https://api.spotify.com/v1/me/player", {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ device_ids: [deviceId], play: true }),
    });

    if (!res.ok && res.status !== 204) {
      const err = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
      return NextResponse.json(
        { error: err?.error?.message ?? "No se pudo transferir la reproducción" },
        { status: res.status }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error al transferir reproducción";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
