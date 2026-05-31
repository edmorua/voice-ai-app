import { NextRequest, NextResponse } from "next/server";
import { writeTokens } from "../tokens";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const error = request.nextUrl.searchParams.get("error");

  if (error || !code) {
    return NextResponse.redirect(new URL("/?spotify=error", request.nextUrl.origin));
  }

  const credentials = Buffer.from(
    `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
  ).toString("base64");

  try {
    const res = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: process.env.SPOTIFY_REDIRECT_URI!,
      }),
    });

    const data = await res.json();
    console.error("[spotify/callback] token response:", res.status, JSON.stringify(data));
    if (!data.access_token) throw new Error(data.error_description ?? data.error ?? "No access token");

    writeTokens({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: Date.now() + data.expires_in * 1000,
    });

    return NextResponse.redirect(new URL("/?spotify=connected", request.nextUrl.origin));
  } catch (err) {
    console.error("[spotify/callback] error:", err);
    return NextResponse.redirect(new URL("/?spotify=error", request.nextUrl.origin));
  }
}
