import { NextRequest, NextResponse } from "next/server";
import { getValidAccessToken } from "../tokens";
import { savePlay } from "@/lib/db";
import {
  DeviceTarget,
  SpotifyDevice,
  Track,
  pickDevice,
  mapTrack,
  searchTracks,
} from "@/lib/spotify";

export async function POST(request: NextRequest) {
  try {
    const {
      query,
      uri,
      name,
      artist,
      target = "default",
      deviceId,
    } = (await request.json()) as {
      query?: string;
      uri?: string;
      name?: string;
      artist?: string;
      target?: DeviceTarget;
      deviceId?: string;
    };

    if (!query && !uri) {
      return NextResponse.json({ error: "Falta query o uri" }, { status: 400 });
    }

    const token = await getValidAccessToken();

    // Pista a reproducir + alternativas (para "¿no era esa?").
    let track: Track;
    let alternatives: Track[] = [];

    if (uri) {
      // El usuario eligió una sugerencia: reproducimos esa pista directamente.
      track = { uri, name: name ?? "", artist: artist ?? "", image: null };
    } else {
      // 1. Buscamos varias coincidencias para la consulta de voz.
      let items = await searchTracks(token, query as string, 6);

      // Fallback: si no hubo resultados, reintentamos con una consulta relajada
      // (primeras palabras), por si la transcripción de voz fue imperfecta.
      if (items.length === 0) {
        const relaxed = (query as string).split(/\s+/).slice(0, 2).join(" ").trim();
        if (relaxed && relaxed !== query) items = await searchTracks(token, relaxed, 6);
      }

      if (items.length === 0) {
        return NextResponse.json(
          { error: "No se encontró la canción", suggestions: [] as Track[] },
          { status: 404 }
        );
      }

      track = mapTrack(items[0]);
      alternatives = items.slice(1).map(mapTrack);
    }

    // 2. Dispositivos disponibles.
    const devicesRes = await fetch("https://api.spotify.com/v1/me/player/devices", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const devicesData = await devicesRes.json();
    const devices: SpotifyDevice[] = devicesData.devices ?? [];

    if (devices.length === 0) {
      return NextResponse.json(
        {
          error: "No hay dispositivos Spotify activos. Abre Spotify en algún dispositivo primero.",
          track,
          alternatives,
        },
        { status: 409 }
      );
    }

    const device = deviceId
      ? (devices.find((d) => d.id === deviceId) ?? pickDevice(devices, target as DeviceTarget))
      : pickDevice(devices, target as DeviceTarget);

    if (!device) {
      const available = devices.map((d) => `${d.name} (${d.type})`).join(", ");
      return NextResponse.json(
        { error: `Dispositivo no encontrado. Disponibles: ${available}`, track, alternatives },
        { status: 409 }
      );
    }

    // 3. Iniciamos la reproducción en el dispositivo elegido.
    const playRes = await fetch(
      `https://api.spotify.com/v1/me/player/play?device_id=${device.id}`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ uris: [track.uri] }),
      }
    );

    if (!playRes.ok && playRes.status !== 204) {
      const errData = await playRes.json().catch(() => ({}));
      return NextResponse.json(
        { error: errData?.error?.message ?? "No se pudo iniciar la reproducción", track, alternatives },
        { status: playRes.status }
      );
    }

    savePlay({
      track_name: track.name,
      artist: track.artist,
      spotify_uri: track.uri ?? null,
      device_name: device.name,
      device_type: device.type,
    });

    return NextResponse.json({
      ok: true,
      track,
      alternatives,
      device: { name: device.name, type: device.type },
    });
  } catch (err) {
    console.error("[/api/spotify/play]", err);
    const message = err instanceof Error ? err.message : "Error al reproducir en Spotify";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
