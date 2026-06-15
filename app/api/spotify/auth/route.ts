import { NextResponse } from "next/server";

export async function GET() {
  const params = new URLSearchParams({
    client_id: process.env.SPOTIFY_CLIENT_ID!,
    response_type: "code",
    redirect_uri: process.env.SPOTIFY_REDIRECT_URI!,
    scope: [
      "user-modify-playback-state",
      "user-read-playback-state",
      "playlist-modify-public",
      "playlist-modify-private",
      "playlist-read-private",
      "playlist-read-collaborative",
      "user-top-read",
      "user-read-recently-played",
    ].join(" "),
    // Fuerza a Spotify a mostrar de nuevo la pantalla de permisos aunque ya
    // hubiera una sesión, para que se concedan los scopes nuevos al reconectar.
    show_dialog: "true",
  });

  return NextResponse.redirect(
    `https://accounts.spotify.com/authorize?${params.toString()}`
  );
}
