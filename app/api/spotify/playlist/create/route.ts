import { NextRequest, NextResponse } from "next/server";
import { getValidAccessToken } from "../../tokens";
import {
  DeviceTarget,
  getMe,
  getDevices,
  pickDevice,
  searchFirstTrackUri,
} from "@/lib/spotify";

const SPOTIFY_API = "https://api.spotify.com/v1";

export async function POST(request: NextRequest) {
  try {
    const {
      name,
      description,
      trackQueries = [],
      isPublic = true,
      play = false,
      target = "default",
      deviceId,
    } = (await request.json()) as {
      name?: string;
      description?: string;
      trackQueries?: string[];
      isPublic?: boolean;
      play?: boolean;
      target?: DeviceTarget;
      deviceId?: string;
    };

    if (!name?.trim()) {
      return NextResponse.json({ error: "Falta el nombre del playlist" }, { status: 400 });
    }

    const token = await getValidAccessToken();
    const me = await getMe(token);

    // 1. Crear el playlist vacío en la cuenta del usuario.
    const createRes = await fetch(`${SPOTIFY_API}/users/${me.id}/playlists`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        description: description?.trim() || "Creado por Sofia",
        public: isPublic,
      }),
    });

    if (!createRes.ok) {
      const errData = await createRes.json().catch(() => ({}));
      return NextResponse.json(
        { error: errData?.error?.message ?? "No se pudo crear el playlist" },
        { status: createRes.status }
      );
    }

    const playlist = await createRes.json();
    const playlistUri: string = playlist.uri;
    const playlistId: string = playlist.id;

    // 2. Resolver las consultas a URIs de pistas (en paralelo), dedupe.
    const resolved = await Promise.all(
      trackQueries.map((q) => searchFirstTrackUri(token, q).catch(() => null))
    );
    const uris = [...new Set(resolved.filter((u): u is string => !!u))];

    if (uris.length > 0) {
      // La API acepta hasta 100 URIs por llamada; ~15 caben de sobra.
      await fetch(`${SPOTIFY_API}/playlists/${playlistId}/tracks`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ uris }),
      });
    }

    // 3. Reproducir el playlist completo si se pidió y hay canciones.
    let playedDevice: { name: string; type: string } | null = null;
    if (play && uris.length > 0) {
      const devices = await getDevices(token);
      const device = deviceId
        ? (devices.find((d) => d.id === deviceId) ?? pickDevice(devices, target))
        : pickDevice(devices, target);
      if (device) {
        const playRes = await fetch(
          `${SPOTIFY_API}/me/player/play?device_id=${device.id}`,
          {
            method: "PUT",
            headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
            body: JSON.stringify({ context_uri: playlistUri }),
          }
        );
        if (playRes.ok || playRes.status === 204) {
          playedDevice = { name: device.name, type: device.type };
        }
      }
    }

    return NextResponse.json({
      ok: true,
      playlist: {
        id: playlistId,
        name: playlist.name,
        url: playlist.external_urls?.spotify ?? null,
        image: playlist.images?.[0]?.url ?? null,
        trackCount: uris.length,
      },
      tracksAdded: uris.length,
      played: !!playedDevice,
      device: playedDevice,
    });
  } catch (err) {
    console.error("[/api/spotify/playlist/create]", err);
    const message = err instanceof Error ? err.message : "Error al crear el playlist";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
