import fs from "fs";
import path from "path";

const TOKEN_FILE = path.join(process.cwd(), ".spotify-tokens.json");

interface SpotifyTokens {
  access_token: string;
  refresh_token: string;
  expires_at: number;
}

export function readTokens(): SpotifyTokens | null {
  try {
    return JSON.parse(fs.readFileSync(TOKEN_FILE, "utf-8")) as SpotifyTokens;
  } catch {
    return null;
  }
}

export function writeTokens(tokens: SpotifyTokens): void {
  fs.writeFileSync(TOKEN_FILE, JSON.stringify(tokens), "utf-8");
}

export async function getValidAccessToken(): Promise<string> {
  const tokens = readTokens();
  if (!tokens) {
    throw new Error("Spotify no está conectado. Ve a /api/spotify/auth para autenticarte.");
  }

  if (Date.now() < tokens.expires_at - 60_000) {
    return tokens.access_token;
  }

  const credentials = Buffer.from(
    `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
  ).toString("base64");

  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: tokens.refresh_token,
    }),
  });

  const data = await res.json();
  if (!data.access_token) throw new Error("No se pudo refrescar el token de Spotify");

  const updated: SpotifyTokens = {
    access_token: data.access_token,
    refresh_token: data.refresh_token ?? tokens.refresh_token,
    expires_at: Date.now() + data.expires_in * 1000,
  };
  writeTokens(updated);
  return updated.access_token;
}
