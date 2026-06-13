import { NextResponse } from "next/server";
import { getValidAccessToken } from "../tokens";

export async function GET() {
  try {
    const token = await getValidAccessToken();
    const res = await fetch("https://api.spotify.com/v1/me/player/devices", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    return NextResponse.json({ devices: data.devices ?? [] });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error al obtener dispositivos Spotify";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
