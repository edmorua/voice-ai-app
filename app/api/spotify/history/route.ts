import { NextResponse } from "next/server";
import { getRecentPlays, getTopArtists, getTopTracks } from "@/lib/db";

export async function GET() {
  try {
    return NextResponse.json({
      recent: getRecentPlays(30),
      topArtists: getTopArtists(5),
      topTracks: getTopTracks(5),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error al leer historial";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
