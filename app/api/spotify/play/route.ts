import { NextRequest, NextResponse } from "next/server";
import { getValidAccessToken } from "../tokens";

type DeviceTarget = "default" | "pc" | "phone" | "tv";

interface SpotifyDevice {
  id: string;
  name: string;
  type: string;
  is_active: boolean;
}

function pickDevice(devices: SpotifyDevice[], target: DeviceTarget): SpotifyDevice | null {
  switch (target) {
    case "pc":
      return devices.find((d) => d.type === "Computer") ?? null;
    case "phone":
      return devices.find((d) => d.type === "Smartphone") ?? null;
    case "tv":
      return (
        devices.find((d) => d.type === "TV") ??
        devices.find((d) => /samsung|smart\s*tv|pantalla|television/i.test(d.name)) ??
        null
      );
    default:
      return devices.find((d) => d.is_active) ?? devices[0] ?? null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const { query, target = "default" } = (await request.json()) as {
      query: string;
      target?: DeviceTarget;
    };

    if (!query) {
      return NextResponse.json({ error: "Query requerida" }, { status: 400 });
    }

    const token = await getValidAccessToken();

    // 1. Search for track
    const searchRes = await fetch(
      `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=1`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const searchData = await searchRes.json();
    const track = searchData.tracks?.items?.[0];

    if (!track) {
      return NextResponse.json({ error: "No se encontró la canción" }, { status: 404 });
    }

    // 2. Get available devices
    const devicesRes = await fetch("https://api.spotify.com/v1/me/player/devices", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const devicesData = await devicesRes.json();
    const devices: SpotifyDevice[] = devicesData.devices ?? [];

    if (devices.length === 0) {
      return NextResponse.json(
        {
          error: "No hay dispositivos Spotify activos. Abre Spotify en algún dispositivo primero.",
          track: { name: track.name, artist: track.artists[0]?.name ?? "" },
        },
        { status: 409 }
      );
    }

    const device = pickDevice(devices, target as DeviceTarget);

    if (!device) {
      const available = devices.map((d) => `${d.name} (${d.type})`).join(", ");
      return NextResponse.json(
        {
          error: `Dispositivo no encontrado. Disponibles: ${available}`,
          track: { name: track.name, artist: track.artists[0]?.name ?? "" },
        },
        { status: 409 }
      );
    }

    // 3. Start playback on target device
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
        { error: errData?.error?.message ?? "No se pudo iniciar la reproducción" },
        { status: playRes.status }
      );
    }

    return NextResponse.json({
      ok: true,
      track: { name: track.name, artist: track.artists[0]?.name ?? "" },
      device: { name: device.name, type: device.type },
    });
  } catch (err) {
    console.error("[/api/spotify/play]", err);
    const message = err instanceof Error ? err.message : "Error al reproducir en Spotify";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
