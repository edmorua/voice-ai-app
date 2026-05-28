import { NextRequest, NextResponse } from "next/server";

async function getSpotifyToken(): Promise<string> {
  const credentials = Buffer.from(
    `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
  ).toString("base64");

  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  const data = await res.json();
  if (!data.access_token) throw new Error("No se pudo obtener el token de Spotify");
  return data.access_token;
}

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q");
  if (!query) {
    return NextResponse.json({ error: "Query requerida" }, { status: 400 });
  }

  if (!process.env.SPOTIFY_CLIENT_ID || !process.env.SPOTIFY_CLIENT_SECRET) {
    return NextResponse.json({ error: "Faltan credenciales de Spotify en .env.local" }, { status: 500 });
  }

  try {
    const token = await getSpotifyToken();

    const searchRes = await fetch(
      `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=1`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    const data = await searchRes.json();
    const track = data.tracks?.items?.[0];

    if (!track) {
      return NextResponse.json({ error: "No se encontró la canción" }, { status: 404 });
    }

    return NextResponse.json({
      url: track.external_urls.spotify,
      name: track.name,
      artist: track.artists[0]?.name ?? "",
    });
  } catch (err) {
    console.error("[/api/spotify/search]", err);
    return NextResponse.json({ error: "Error al buscar en Spotify" }, { status: 500 });
  }
}
