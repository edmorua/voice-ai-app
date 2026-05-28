import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q");
  if (!query) {
    return NextResponse.json({ error: "Query requerida" }, { status: 400 });
  }

  if (!process.env.YOUTUBE_API_KEY) {
    return NextResponse.json({ error: "Falta YOUTUBE_API_KEY en .env.local" }, { status: 500 });
  }

  try {
    const res = await fetch(
      `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(query)}&type=video&maxResults=1&key=${process.env.YOUTUBE_API_KEY}`
    );

    const data = await res.json();

    if (data.error) {
      throw new Error(data.error.message);
    }

    const video = data.items?.[0];
    if (!video) {
      return NextResponse.json({ error: "No se encontró el video" }, { status: 404 });
    }

    return NextResponse.json({
      url: `https://www.youtube.com/watch?v=${video.id.videoId}`,
      title: video.snippet.title,
      channel: video.snippet.channelTitle,
    });
  } catch (err) {
    console.error("[/api/youtube/search]", err);
    return NextResponse.json({ error: "Error al buscar en YouTube" }, { status: 500 });
  }
}
