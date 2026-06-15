import Database from "better-sqlite3";
import path from "path";

const DB_PATH = path.join(process.cwd(), "sofia.db");

let _db: Database.Database | null = null;

function getDb(): Database.Database {
  if (_db) return _db;
  _db = new Database(DB_PATH);
  _db.pragma("journal_mode = WAL");
  _db.pragma("foreign_keys = ON");
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

    CREATE TABLE IF NOT EXISTS conversations (
      id         TEXT PRIMARY KEY,
      title      TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS messages (
      id              TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
      role            TEXT NOT NULL,
      content         TEXT NOT NULL,
      image_path      TEXT,
      image_prompt    TEXT,
      created_at      INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages (conversation_id, created_at);
  `);

  // Migración: columnas de audio (música generada) para BD existentes.
  const cols = (_db.prepare(`PRAGMA table_info(messages)`).all() as { name: string }[]).map(
    (c) => c.name
  );
  if (!cols.includes("audio_path")) {
    _db.exec(`ALTER TABLE messages ADD COLUMN audio_path TEXT`);
  }
  if (!cols.includes("audio_prompt")) {
    _db.exec(`ALTER TABLE messages ADD COLUMN audio_prompt TEXT`);
  }
  // Migración: documentos de estudio (markdown) generados.
  if (!cols.includes("doc_path")) {
    _db.exec(`ALTER TABLE messages ADD COLUMN doc_path TEXT`);
  }
  if (!cols.includes("doc_title")) {
    _db.exec(`ALTER TABLE messages ADD COLUMN doc_title TEXT`);
  }

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

// ── Conversaciones e historial de chat ──────────────────────────────────────

export interface Conversation {
  id: string;
  title: string | null;
  created_at: number;
  updated_at: number;
}

export interface DbMessage {
  id: string;
  conversation_id: string;
  role: "user" | "assistant";
  content: string;
  image_path: string | null;
  image_prompt: string | null;
  audio_path: string | null;
  audio_prompt: string | null;
  doc_path: string | null;
  doc_title: string | null;
  created_at: number;
}

export function createConversation(id: string, title: string | null): void {
  const now = Date.now();
  getDb()
    .prepare(
      `INSERT INTO conversations (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)`
    )
    .run(id, title, now, now);
}

export function listConversations(): Conversation[] {
  return getDb()
    .prepare(`SELECT * FROM conversations ORDER BY updated_at DESC`)
    .all() as Conversation[];
}

export function getMessages(conversationId: string): DbMessage[] {
  return getDb()
    .prepare(
      `SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC, rowid ASC`
    )
    .all(conversationId) as DbMessage[];
}

export function addMessage(m: {
  id: string;
  conversation_id: string;
  role: "user" | "assistant";
  content: string;
  image_path?: string | null;
  image_prompt?: string | null;
  audio_path?: string | null;
  audio_prompt?: string | null;
  doc_path?: string | null;
  doc_title?: string | null;
}): void {
  const db = getDb();
  const now = Date.now();
  const tx = db.transaction(() => {
    db.prepare(
      `INSERT INTO messages (id, conversation_id, role, content, image_path, image_prompt, audio_path, audio_prompt, doc_path, doc_title, created_at)
       VALUES (@id, @conversation_id, @role, @content, @image_path, @image_prompt, @audio_path, @audio_prompt, @doc_path, @doc_title, @created_at)`
    ).run({
      id: m.id,
      conversation_id: m.conversation_id,
      role: m.role,
      content: m.content,
      image_path: m.image_path ?? null,
      image_prompt: m.image_prompt ?? null,
      audio_path: m.audio_path ?? null,
      audio_prompt: m.audio_prompt ?? null,
      doc_path: m.doc_path ?? null,
      doc_title: m.doc_title ?? null,
      created_at: now,
    });
    db.prepare(`UPDATE conversations SET updated_at = ? WHERE id = ?`).run(now, m.conversation_id);
  });
  tx();
}

export function updateMessageImage(id: string, imagePath: string): void {
  getDb().prepare(`UPDATE messages SET image_path = ? WHERE id = ?`).run(imagePath, id);
}

export function updateMessageAudio(id: string, audioPath: string): void {
  getDb().prepare(`UPDATE messages SET audio_path = ? WHERE id = ?`).run(audioPath, id);
}

export function updateMessageDoc(id: string, docPath: string, docTitle?: string | null): void {
  getDb()
    .prepare(`UPDATE messages SET doc_path = ?, doc_title = ? WHERE id = ?`)
    .run(docPath, docTitle ?? null, id);
}

/** Borra la conversación (y por cascada sus mensajes) y devuelve las rutas de
 *  archivos generados (imágenes y audios) que tenía, para que el caller los
 *  elimine del disco. */
export function deleteConversation(id: string): string[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT image_path, audio_path, doc_path FROM messages
       WHERE conversation_id = ? AND (image_path IS NOT NULL OR audio_path IS NOT NULL OR doc_path IS NOT NULL)`
    )
    .all(id) as { image_path: string | null; audio_path: string | null; doc_path: string | null }[];
  db.prepare(`DELETE FROM conversations WHERE id = ?`).run(id);
  return rows.flatMap((r) => [r.image_path, r.audio_path, r.doc_path].filter((p): p is string => !!p));
}
