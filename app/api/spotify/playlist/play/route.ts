import { NextRequest, NextResponse } from "next/server";
import { getValidAccessToken } from "../../tokens";
import { DeviceTarget, getDevices, pickDevice } from "@/lib/spotify";

const SPOTIFY_API = "https://api.spotify.com/v1";

interface SpotifyApiPlaylist {
  id: string;
  name: string;
  uri: string;
  external_urls?: { spotify?: string };
  images?: { url: string }[];
}

export async function POST(request: NextRequest) {
  try {
    const {
      name,
      id,
      target = "default",
      deviceId,
    } = (await request.json()) as {
      name?: string;
      id?: string;
      target?: DeviceTarget;
      deviceId?: string;
    };

    if (!name?.trim() && !id) {
      return NextResponse.json({ error: "Falta el nombre o id del playlist" }, { status: 400 });
    }

    const token = await getValidAccessToken();

    // Resolver el playlist a reproducir.
    let playlist: { uri: string; name: string; url: string | null; image: string | null };
    if (id) {
      playlist = { uri: `spotify:playlist:${id}`, name: name?.trim() ?? "Playlist", url: null, image: null };
    } else {
      const res = await fetch(`${SPOTIFY_API}/me/playlists?limit=50`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      const items = (data.items ?? []) as SpotifyApiPlaylist[];
      const q = name!.trim().toLowerCase();
      // Coincidencia exacta primero; si no, la primera que contenga el nombre.
      const match =
        items.find((p) => p.name?.toLowerCase() === q) ??
        items.find((p) => p.name?.toLowerCase().includes(q));
      if (!match) {
        return NextResponse.json(
          { error: `No encontré un playlist llamado "${name}".` },
          { status: 404 }
        );
      }
      playlist = {
        uri: match.uri,
        name: match.name,
        url: match.external_urls?.spotify ?? null,
        image: match.images?.[0]?.url ?? null,
      };
    }

    // Elegir dispositivo y reproducir.
    const devices = await getDevices(token);
    if (devices.length === 0) {
      return NextResponse.json(
        { error: "No hay dispositivos Spotify activos. Abre Spotify en algún dispositivo primero.", playlist },
        { status: 409 }
      );
    }
    const device = deviceId
      ? (devices.find((d) => d.id === deviceId) ?? pickDevice(devices, target))
      : pickDevice(devices, target);
    if (!device) {
      const available = devices.map((d) => `${d.name} (${d.type})`).join(", ");
      return NextResponse.json(
        { error: `Dispositivo no encontrado. Disponibles: ${available}`, playlist },
        { status: 409 }
      );
    }

    const playRes = await fetch(`${SPOTIFY_API}/me/player/play?device_id=${device.id}`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ context_uri: playlist.uri }),
    });

    if (!playRes.ok && playRes.status !== 204) {
      const errData = await playRes.json().catch(() => ({}));
      return NextResponse.json(
        { error: errData?.error?.message ?? "No se pudo reproducir el playlist", playlist },
        { status: playRes.status }
      );
    }

    return NextResponse.json({
      ok: true,
      playlist,
      device: { name: device.name, type: device.type },
    });
  } catch (err) {
    console.error("[/api/spotify/playlist/play]", err);
    const message = err instanceof Error ? err.message : "Error al reproducir el playlist";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
