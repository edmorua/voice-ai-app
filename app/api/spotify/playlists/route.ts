import { NextResponse } from "next/server";
import { getValidAccessToken } from "../tokens";

const SPOTIFY_API = "https://api.spotify.com/v1";

interface SpotifyApiPlaylist {
  id: string;
  name: string;
  external_urls?: { spotify?: string };
  images?: { url: string }[];
  tracks?: { total?: number };
  owner?: { id?: string; display_name?: string };
}

export async function GET() {
  try {
    const token = await getValidAccessToken();
    const res = await fetch(`${SPOTIFY_API}/me/playlists?limit=50`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      return NextResponse.json(
        { error: errData?.error?.message ?? "No se pudieron obtener los playlists" },
        { status: res.status }
      );
    }

    const data = await res.json();
    const items = (data.items ?? []) as SpotifyApiPlaylist[];
    const playlists = items
      .filter(Boolean)
      .map((p) => ({
        id: p.id,
        name: p.name,
        url: p.external_urls?.spotify ?? null,
        image: p.images?.[0]?.url ?? null,
        trackCount: p.tracks?.total ?? 0,
        owner: p.owner?.display_name ?? p.owner?.id ?? "",
      }));

    return NextResponse.json({ playlists });
  } catch (err) {
    console.error("[/api/spotify/playlists]", err);
    const message = err instanceof Error ? err.message : "Error al obtener los playlists";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
