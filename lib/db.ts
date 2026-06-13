import Database from "better-sqlite3";
import path from "path";

const DB_PATH = path.join(process.cwd(), "sofia.db");

let _db: Database.Database | null = null;

function getDb(): Database.Database {
  if (_db) return _db;
  _db = new Database(DB_PATH);
  _db.pragma("journal_mode = WAL");
  _db.exec(`
    CREATE TABLE IF NOT EXISTS plays (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      track_name  TEXT    NOT NULL,
      artist      TEXT    NOT NULL,
      spotify_uri TEXT,
      device_name TEXT,
      device_type TEXT,
      played_at   INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_plays_played_at ON plays (played_at DESC);
  `);
  return _db;
}

export interface Play {
  id: number;
  track_name: string;
  artist: string;
  spotify_uri: string | null;
  device_name: string | null;
  device_type: string | null;
  played_at: number;
}

export function savePlay(p: Omit<Play, "id" | "played_at">): void {
  const db = getDb();
  db.prepare(
    `INSERT INTO plays (track_name, artist, spotify_uri, device_name, device_type, played_at)
     VALUES (@track_name, @artist, @spotify_uri, @device_name, @device_type, @played_at)`
  ).run({ ...p, played_at: Date.now() });
}

export function getRecentPlays(limit = 30): Play[] {
  return getDb()
    .prepare(`SELECT * FROM plays ORDER BY played_at DESC LIMIT ?`)
    .all(limit) as Play[];
}

export function getTopArtists(limit = 10): { artist: string; count: number }[] {
  return getDb()
    .prepare(
      `SELECT artist, COUNT(*) as count FROM plays GROUP BY artist ORDER BY count DESC LIMIT ?`
    )
    .all(limit) as { artist: string; count: number }[];
}

export function getTopTracks(limit = 10): { track_name: string; artist: string; count: number }[] {
  return getDb()
    .prepare(
      `SELECT track_name, artist, COUNT(*) as count FROM plays
       GROUP BY track_name, artist ORDER BY count DESC LIMIT ?`
    )
    .all(limit) as { track_name: string; artist: string; count: number }[];
}
