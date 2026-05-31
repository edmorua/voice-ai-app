import { NextResponse } from "next/server";
import { readTokens } from "../tokens";

export async function GET() {
  return NextResponse.json({ connected: readTokens() !== null });
}
