// Helpers compartidos para las rutas de Spotify (reproducción y playlists).
//
// Centralizan la selección de dispositivo, la búsqueda de pistas y la identidad
// del usuario para no duplicar esa lógica entre /play, /playlist/create, etc.

const SPOTIFY_API = "https://api.spotify.com/v1";

export type DeviceTarget = "default" | "pc" | "mac" | "phone" | "tv";

export interface SpotifyDevice {
  id: string;
  name: string;
  type: string;
  is_active: boolean;
}

// Pista normalizada que el frontend usa para tarjetas y para volver a reproducir.
export interface Track {
  uri: string;
  name: string;
  artist: string;
  image: string | null;
}

interface SpotifyApiTrack {
  uri: string;
  name: string;
  artists?: { name: string }[];
  album?: { images?: { url: string }[] };
}

const isMac = (d: SpotifyDevice) =>
  d.type === "Computer" && /mac|macbook|imac|mac\s*mini|mac\s*pro|mac\s*studio/i.test(d.name);

const isPC = (d: SpotifyDevice) =>
  d.type === "Computer" && !/mac|macbook|imac/i.test(d.name);

export function pickDevice(devices: SpotifyDevice[], target: DeviceTarget): SpotifyDevice | null {
  switch (target) {
    case "mac":
      return devices.find(isMac) ?? devices.find((d) => d.type === "Computer") ?? null;
    case "pc":
      return devices.find(isPC) ?? devices.find((d) => d.type === "Computer") ?? null;
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

export const mapTrack = (t: SpotifyApiTrack): Track => ({
  uri: t.uri,
  name: t.name,
  artist: t.artists?.[0]?.name ?? "",
  // Miniatura: la imagen más pequeña del álbum (la última del arreglo).
  image: t.album?.images?.slice(-1)[0]?.url ?? null,
});

export async function searchTracks(token: string, q: string, limit: number): Promise<SpotifyApiTrack[]> {
  const res = await fetch(
    `${SPOTIFY_API}/search?q=${encodeURIComponent(q)}&type=track&limit=${limit}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const data = await res.json();
  return (data.tracks?.items ?? []) as SpotifyApiTrack[];
}

/** Devuelve el URI de la primera coincidencia para una consulta, o null. */
export async function searchFirstTrackUri(token: string, q: string): Promise<string | null> {
  const clean = q.trim();
  if (!clean) return null;
  const items = await searchTracks(token, clean, 1);
  return items[0]?.uri ?? null;
}

export async function getDevices(token: string): Promise<SpotifyDevice[]> {
  const res = await fetch(`${SPOTIFY_API}/me/player/devices`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  return (data.devices ?? []) as SpotifyDevice[];
}

let _cachedUserId: string | null = null;

/** Id del usuario autenticado (cacheado: no cambia mientras viva el proceso). */
export async function getMe(token: string): Promise<{ id: string }> {
  if (_cachedUserId) return { id: _cachedUserId };
  const res = await fetch(`${SPOTIFY_API}/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("No se pudo obtener el perfil de Spotify");
  const data = await res.json();
  _cachedUserId = data.id as string;
  return { id: _cachedUserId };
}
