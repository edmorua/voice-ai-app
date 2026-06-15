"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";

// ── Types ───────────────────────────────────────────────────────────────────

type AppState = "idle" | "recording" | "processing" | "speaking";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  imageGenerating?: boolean;
  imageUrl?: string;
  imageError?: string;
  imagePrompt?: string;
  audioGenerating?: boolean;
  audioUrl?: string;
  audioError?: string;
  audioPrompt?: string;
  spotifyStatus?: "searching" | "playing" | "notfound" | "error";
  spotifyTrack?: SpotifyTrack;
  spotifyDevice?: string;
  spotifySuggestions?: SpotifyTrack[];
  spotifyError?: string;
  spotifyTarget?: string;
  // Crear / reproducir un playlist concreto.
  playlistStatus?: "creating" | "ready" | "error";
  playlist?: PlaylistItem;
  playlistError?: string;
  // Listar los playlists del usuario.
  playlistsStatus?: "loading" | "ready" | "error";
  playlists?: PlaylistItem[];
  playlistsError?: string;
  // Documento de estudio (markdown con ejercicios y código).
  docGenerating?: boolean;
  docMarkdown?: string;
  docUrl?: string;
  docTitle?: string;
  docError?: string;
}

interface SpotifyTrack {
  uri: string;
  name: string;
  artist: string;
  image?: string | null;
}

interface PlaylistItem {
  id?: string;
  name: string;
  url: string | null;
  image: string | null;
  trackCount?: number;
}

interface NetworkDevice {
  ip: string;
  mac: string;
  name: string;
  vendor: string;
  isPrivateMac: boolean;
  isNew?: boolean;
}

interface SpotifyDevice {
  id: string;
  name: string;
  type: string;
  is_active: boolean;
  volume_percent: number;
}

interface PlayRecord {
  id: number;
  track_name: string;
  artist: string;
  device_name: string | null;
  played_at: number;
}

interface MusicHistory {
  recent: PlayRecord[];
  topArtists: { artist: string; count: number }[];
  topTracks: { track_name: string; artist: string; count: number }[];
}

interface ConversationMeta {
  id: string;
  title: string | null;
  created_at: number;
  updated_at: number;
}

interface DbMessageRow {
  id: string;
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

// ── Icons ───────────────────────────────────────────────────────────────────

function MicIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3z" />
      <path d="M19 10v1a7 7 0 0 1-14 0v-1H3v1a9 9 0 0 0 8 8.94V22H8v2h8v-2h-3v-2.06A9 9 0 0 0 21 11v-1h-2z" />
    </svg>
  );
}

function StopIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <rect x="6" y="6" width="12" height="12" rx="2" />
    </svg>
  );
}

function SpinnerIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" strokeLinecap="round" />
    </svg>
  );
}

function SpeakerIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
    </svg>
  );
}

function UserIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z" />
    </svg>
  );
}

function DocIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z" />
    </svg>
  );
}

function ClipIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
    </svg>
  );
}

function BotIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 15v-4H7l5-8v4h4l-5 8z" />
    </svg>
  );
}

function WifiIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M1 9l2 2c4.97-4.97 13.03-4.97 18 0l2-2C16.93 2.93 7.08 2.93 1 9zm8 8l3 3 3-3a4.237 4.237 0 0 0-6 0zm-4-4l2 2a7.074 7.074 0 0 1 10 0l2-2C15.14 9.14 8.87 9.14 5 13z" />
    </svg>
  );
}

function SpotifyIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
    </svg>
  );
}

function TvIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M21 3H3c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h5v2h8v-2h5c1.1 0 1.99-.9 1.99-2L23 5c0-1.1-.9-2-2-2zm0 14H3V5h18v12z" />
    </svg>
  );
}

function PhoneIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M17 1.01L7 1c-1.1 0-2 .9-2 2v18c0 1.1.9 2 2 2h10c1.1 0 2-.9 2-2V3c0-1.1-.9-1.99-2-1.99zM17 19H7V5h10v14z" />
    </svg>
  );
}

function ComputerIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M20 18c1.1 0 1.99-.9 1.99-2L22 6c0-1.1-.9-2-2-2H4c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2H0v2h24v-2h-4zM4 6h16v10H4V6z" />
    </svg>
  );
}

// ── Button config ────────────────────────────────────────────────────────────

interface ButtonConfig {
  animationClass: string;
  gradient: string;
  Icon: React.FC<{ className?: string }>;
  label: string;
  sublabel: string;
  iconSpin: boolean;
}

function getButtonConfig(state: AppState): ButtonConfig {
  switch (state) {
    case "idle":
      return { animationClass: "animate-pulse-idle", gradient: "from-violet-500 via-purple-600 to-indigo-700", Icon: MicIcon, label: "Toca para hablar", sublabel: "Graba tu mensaje de voz", iconSpin: false };
    case "recording":
      return { animationClass: "animate-pulse-recording", gradient: "from-red-500 via-rose-600 to-red-700", Icon: StopIcon, label: "Grabando…", sublabel: "Toca para detener", iconSpin: false };
    case "processing":
      return { animationClass: "animate-pulse-processing", gradient: "from-amber-500 via-orange-500 to-amber-700", Icon: SpinnerIcon, label: "Procesando…", sublabel: "Transcribiendo y generando", iconSpin: true };
    case "speaking":
      return { animationClass: "animate-pulse-speaking", gradient: "from-violet-500 via-purple-600 to-fuchsia-700", Icon: SpeakerIcon, label: "Respondiendo…", sublabel: "Reproduciendo voz", iconSpin: false };
  }
}

// ── Wave bars visualizer ─────────────────────────────────────────────────────

function WaveVisualizer({ active, barsRef }: { active: boolean; barsRef: React.RefObject<(HTMLDivElement | null)[]> }) {
  const BAR_COUNT = 24;
  return (
    <div className="flex items-end justify-center gap-[3px] h-14 w-52">
      {Array.from({ length: BAR_COUNT }).map((_, i) => (
        <div
          key={i}
          ref={(el) => { if (barsRef.current) barsRef.current[i] = el; }}
          className="w-1.5 rounded-full wave-bar transition-all duration-75"
          style={{ height: active ? "8px" : "4px", background: active ? `linear-gradient(to top, #7c3aed, #c084fc)` : "rgba(255,255,255,0.15)", transition: active ? "none" : "height 0.5s ease, background 0.5s ease" }}
        />
      ))}
    </div>
  );
}

// ── Retry utilities ──────────────────────────────────────────────────────────

const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

async function fetchWithRetry(makeRequest: () => Promise<Response>, maxAttempts = 3, onRetry?: (attempt: number) => void): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await makeRequest();
      if (res.ok || (res.status >= 400 && res.status < 500)) return res;
      if (attempt === maxAttempts) return res;
      onRetry?.(attempt + 1);
      await delay(1000 * attempt);
    } catch (err) {
      lastError = err;
      if (attempt === maxAttempts) break;
      onRetry?.(attempt + 1);
      await delay(1000 * attempt);
    }
  }
  throw lastError ?? new Error("No se pudo completar la solicitud. Verifica tu conexión a internet.");
}

// ── Frases de seguimiento (Sofia las dice al terminar de generar) ─────────────

const IMAGE_DONE_LINES = [
  "¡Listo! Aquí tienes tu imagen. ¿Qué te parece? Si quieres le ajusto algún detalle.",
  "¡Ya quedó tu imagen! Espero que te guste muchísimo. ¿Le cambiamos algo o así está perfecta?",
  "¡Terminé tu imagen! Cuéntame qué te parece o si prefieres que pruebe otra versión.",
];

const MUSIC_DONE_LINES = [
  "¡Terminé de componer tu canción! Dale play para escucharla. ¿Te gustó cómo quedó?",
  "¡Tu canción ya está lista! Ya puedes reproducirla aquí mismo. ¿Quieres que componga otra versión?",
  "¡Listo, aquí está tu canción! Escúchala con calma y dime qué te parece.",
];

const IMAGE_FAIL_LINE = "Uy, no pude generar la imagen esta vez. ¿Quieres que lo intente de nuevo?";
const MUSIC_FAIL_LINE = "Uy, no pude componer la canción esta vez. ¿Lo intentamos otra vez?";

const pickLine = (lines: string[]) => lines[Math.floor(Math.random() * lines.length)];

// ── Message bubble ────────────────────────────────────────────────────────────

function MessageBubble({ msg, onPlaySuggestion, onUseAsReference }: {
  msg: Message;
  onPlaySuggestion?: (msgId: string, track: SpotifyTrack, target?: string) => void;
  onUseAsReference?: (imageUrl: string) => void;
}) {
  const isUser = msg.role === "user";
  return (
    <div className="animate-fade-in-up flex gap-4 py-5">
      {/* Avatar */}
      <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${isUser ? "bg-zinc-700" : "bg-gradient-to-br from-violet-500 to-purple-700"}`}>
        {isUser ? <UserIcon className="w-4 h-4 text-zinc-300" /> : <BotIcon className="w-4 h-4 text-white" />}
      </div>

      {/* Contenido */}
      <div className="flex-1 min-w-0 space-y-2">
        <p className="text-sm font-semibold text-gray-200">{isUser ? "Tú" : "Sofia"}</p>
        <p className="text-[17px] leading-relaxed text-gray-300 whitespace-pre-wrap break-words">{msg.content}</p>

        {/* Imagen generada dentro del chat */}
        {msg.imageGenerating && (
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <SpinnerIcon className="w-4 h-4 text-violet-400 animate-spin-icon" />
            Generando imagen…
          </div>
        )}
        {msg.imageError && (
          <p className="text-sm text-red-400">⚠ {msg.imageError}</p>
        )}
        {msg.imageUrl && (
          <div className="flex flex-col gap-2 pt-1">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={msg.imageUrl}
              alt={msg.imagePrompt ?? "Imagen generada por Sofia"}
              onLoad={(e) => e.currentTarget.scrollIntoView({ behavior: "smooth", block: "center" })}
              className="w-auto max-w-full max-h-[55vh] object-contain rounded-xl"
            />
            <div className="flex items-center gap-2">
              <a
                href={msg.imageUrl}
                download="sofia-imagen.png"
                className="text-xs px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 transition-colors"
              >
                Descargar imagen
              </a>
              {!isUser && onUseAsReference && (
                <button
                  onClick={() => onUseAsReference(msg.imageUrl!)}
                  className="text-xs px-3 py-1.5 rounded-lg bg-violet-900/30 hover:bg-violet-900/50 text-violet-200 transition-colors"
                >
                  Usar como referencia
                </button>
              )}
            </div>
          </div>
        )}

        {/* Música generada dentro del chat */}
        {msg.audioGenerating && (
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <SpinnerIcon className="w-4 h-4 text-violet-400 animate-spin-icon" />
            Componiendo música…
          </div>
        )}
        {msg.audioError && (
          <p className="text-sm text-red-400">⚠ {msg.audioError}</p>
        )}
        {msg.audioUrl && (
          <div className="flex flex-col gap-2 pt-1 max-w-md">
            <div className="flex items-center gap-2 text-xs text-violet-300">
              <SpeakerIcon className="w-3.5 h-3.5" />
              <span className="truncate">{msg.audioPrompt ?? "Canción generada por Sofia"}</span>
            </div>
            <audio src={msg.audioUrl} controls className="w-full" />
            <a
              href={msg.audioUrl}
              download="sofia-cancion.mp3"
              className="self-start text-xs px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 transition-colors"
            >
              Descargar canción
            </a>
          </div>
        )}

        {/* Spotify dentro del chat */}
        {msg.spotifyStatus === "searching" && (
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <SpinnerIcon className="w-4 h-4 text-emerald-400 animate-spin-icon" />
            Buscando en Spotify…
          </div>
        )}

        {msg.spotifyStatus === "playing" && msg.spotifyTrack && (
          <div className="flex flex-col gap-2 pt-1 max-w-md">
            <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-emerald-900/15 border border-emerald-800/40">
              {msg.spotifyTrack.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={msg.spotifyTrack.image} alt={msg.spotifyTrack.name} className="w-10 h-10 rounded object-cover flex-shrink-0" />
              ) : (
                <SpotifyIcon className="w-8 h-8 text-emerald-400 flex-shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-emerald-300 truncate">{msg.spotifyTrack.name || "Reproduciendo"}</p>
                <p className="text-[10px] text-gray-500 truncate">
                  {msg.spotifyTrack.artist}
                  {msg.spotifyDevice ? ` · ${msg.spotifyDevice}` : ""}
                </p>
              </div>
              <span className="flex items-center gap-1 text-[10px] text-emerald-400 flex-shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Sonando
              </span>
            </div>
            {/* Corrección: ¿no era esa? Permite elegir entre las alternativas. */}
            {!isUser && (msg.spotifySuggestions?.length ?? 0) > 0 && onPlaySuggestion && (
              <details className="group">
                <summary className="text-[11px] text-gray-500 hover:text-gray-300 cursor-pointer select-none">
                  ¿No era esa? Ver otras opciones
                </summary>
                <div className="mt-2 space-y-1.5">
                  {msg.spotifySuggestions!.map((t) => (
                    <SuggestionRow key={t.uri} track={t} onPlay={() => onPlaySuggestion(msg.id, t, msg.spotifyTarget)} />
                  ))}
                </div>
              </details>
            )}
          </div>
        )}

        {msg.spotifyStatus === "notfound" && (
          <div className="flex flex-col gap-2 pt-1 max-w-md">
            <p className="text-sm text-gray-400">No encontré esa canción exacta.</p>
            {(msg.spotifySuggestions?.length ?? 0) > 0 ? (
              <>
                <p className="text-xs text-gray-600">¿Quizá alguna de estas? Toca para reproducir:</p>
                <div className="space-y-1.5">
                  {msg.spotifySuggestions!.map((t) => (
                    <SuggestionRow key={t.uri} track={t} onPlay={() => onPlaySuggestion?.(msg.id, t, msg.spotifyTarget)} />
                  ))}
                </div>
              </>
            ) : (
              <p className="text-xs text-gray-600">No encontré nada parecido. Intenta decir el nombre de otra forma.</p>
            )}
          </div>
        )}

        {msg.spotifyStatus === "error" && (
          <div className="flex flex-col gap-2 pt-1 max-w-md">
            <p className="text-sm text-red-400">⚠ {msg.spotifyError}</p>
            {(msg.spotifySuggestions?.length ?? 0) > 0 && (
              <>
                <p className="text-xs text-gray-600">Prueba con otra:</p>
                <div className="space-y-1.5">
                  {msg.spotifySuggestions!.map((t) => (
                    <SuggestionRow key={t.uri} track={t} onPlay={() => onPlaySuggestion?.(msg.id, t, msg.spotifyTarget)} />
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* Crear / reproducir un playlist */}
        {msg.playlistStatus === "creating" && (
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <SpinnerIcon className="w-4 h-4 text-emerald-400 animate-spin-icon" />
            Creando tu playlist…
          </div>
        )}
        {msg.playlistStatus === "ready" && msg.playlist && (
          <a
            href={msg.playlist.url ?? "#"}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-emerald-900/15 border border-emerald-800/40 hover:bg-emerald-900/25 transition-colors max-w-md"
          >
            {msg.playlist.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={msg.playlist.image} alt={msg.playlist.name} className="w-10 h-10 rounded object-cover flex-shrink-0" />
            ) : (
              <SpotifyIcon className="w-8 h-8 text-emerald-400 flex-shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-emerald-300 truncate">{msg.playlist.name}</p>
              <p className="text-[10px] text-gray-500 truncate">
                Playlist{typeof msg.playlist.trackCount === "number" ? ` · ${msg.playlist.trackCount} canciones` : ""}
              </p>
            </div>
            <span className="text-[10px] text-emerald-400 flex-shrink-0">Abrir en Spotify</span>
          </a>
        )}
        {msg.playlistStatus === "error" && (
          <p className="text-sm text-red-400">⚠ {msg.playlistError}</p>
        )}

        {/* Lista de playlists del usuario */}
        {msg.playlistsStatus === "loading" && (
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <SpinnerIcon className="w-4 h-4 text-emerald-400 animate-spin-icon" />
            Cargando tus playlists…
          </div>
        )}
        {msg.playlistsStatus === "ready" && (
          (msg.playlists?.length ?? 0) > 0 ? (
            <div className="flex flex-col gap-1.5 pt-1 max-w-md">
              {msg.playlists!.map((p, i) => (
                <a
                  key={p.id ?? i}
                  href={p.url ?? "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-xl bg-white/3 hover:bg-emerald-900/20 border border-white/5 hover:border-emerald-800/40 transition-colors text-left"
                >
                  {p.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.image} alt={p.name} className="w-9 h-9 rounded object-cover flex-shrink-0" />
                  ) : (
                    <SpotifyIcon className="w-7 h-7 text-emerald-500 flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-gray-200 truncate">{p.name}</p>
                    <p className="text-[10px] text-gray-500 truncate">
                      {typeof p.trackCount === "number" ? `${p.trackCount} canciones` : "Playlist"}
                    </p>
                  </div>
                </a>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400">No encontré playlists en tu cuenta.</p>
          )
        )}
        {msg.playlistsStatus === "error" && (
          <p className="text-sm text-red-400">⚠ {msg.playlistsError}</p>
        )}

        {/* Documento de estudio */}
        {msg.docGenerating && (
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <SpinnerIcon className="w-4 h-4 text-violet-400 animate-spin-icon" />
            Preparando tu documento de estudio…
          </div>
        )}
        {msg.docError && <p className="text-sm text-red-400">⚠ {msg.docError}</p>}
        {(msg.docMarkdown || msg.docUrl) && !msg.docGenerating && (
          <DocCard title={msg.docTitle} markdown={msg.docMarkdown} url={msg.docUrl} />
        )}
      </div>
    </div>
  );
}

// ── Fila de sugerencia de canción (seleccionable) ─────────────────────────────

function SuggestionRow({ track, onPlay }: { track: SpotifyTrack; onPlay: () => void }) {
  return (
    <button
      onClick={onPlay}
      className="w-full flex items-center gap-3 px-3 py-2 rounded-xl bg-white/3 hover:bg-emerald-900/20 border border-white/5 hover:border-emerald-800/40 transition-colors text-left"
    >
      {track.image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={track.image} alt={track.name} className="w-9 h-9 rounded object-cover flex-shrink-0" />
      ) : (
        <SpotifyIcon className="w-7 h-7 text-emerald-500 flex-shrink-0" />
      )}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-gray-200 truncate">{track.name}</p>
        <p className="text-[10px] text-gray-500 truncate">{track.artist}</p>
      </div>
      <span className="text-[10px] text-emerald-400 flex-shrink-0">Reproducir</span>
    </button>
  );
}

// ── Miniatura de imagen de referencia adjunta ─────────────────────────────────

function PendingThumb({ file, onRemove }: { file: File; onRemove: () => void }) {
  const url = useMemo(() => URL.createObjectURL(file), [file]);
  useEffect(() => () => URL.revokeObjectURL(url), [url]);
  return (
    <div className="relative w-12 h-12 flex-shrink-0">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt={file.name} className="w-12 h-12 rounded-lg object-cover border border-white/10" />
      <button
        onClick={onRemove}
        aria-label="Quitar imagen"
        className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-zinc-800 border border-white/20 text-gray-300 text-xs leading-none flex items-center justify-center hover:bg-red-900/70"
      >
        ×
      </button>
    </div>
  );
}

// ── Tarjeta de documento de estudio (markdown renderizado + descarga) ─────────

function DocCard({ title, markdown, url }: { title?: string; markdown?: string; url?: string }) {
  // Si venimos del historial solo tenemos la URL: cargamos el markdown bajo demanda.
  const [fetched, setFetched] = useState<string | undefined>(undefined);
  const [open, setOpen] = useState(true);
  const md = markdown ?? fetched;

  useEffect(() => {
    if (markdown || !url) return;
    let cancelled = false;
    fetch(url)
      .then((r) => r.text())
      .then((text) => {
        if (!cancelled) setFetched(text);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [markdown, url]);

  return (
    <div className="flex flex-col gap-2 pt-1 max-w-2xl w-full">
      <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-t-xl bg-violet-900/20 border border-violet-800/40">
        <div className="flex items-center gap-2 min-w-0">
          <DocIcon className="w-4 h-4 text-violet-300 flex-shrink-0" />
          <span className="text-xs font-semibold text-violet-200 truncate">
            {title ? `Material de estudio · ${title}` : "Material de estudio"}
          </span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => setOpen((o) => !o)}
            className="text-[10px] px-2 py-1 rounded-md bg-white/5 hover:bg-white/10 text-gray-300 transition-colors"
          >
            {open ? "Ocultar" : "Mostrar"}
          </button>
          {url && (
            <a
              href={url}
              download={`${(title || "documento").replace(/[^a-zA-Z0-9_-]+/g, "-").toLowerCase()}.md`}
              className="text-[10px] px-2 py-1 rounded-md bg-violet-900/30 hover:bg-violet-900/50 text-violet-200 transition-colors"
            >
              Descargar .md
            </a>
          )}
        </div>
      </div>
      {open && (
        <div className="markdown-doc max-h-[60vh] overflow-y-auto px-4 py-3 rounded-b-xl bg-black/30 border border-t-0 border-violet-800/40 text-sm text-gray-300">
          {md ? (
            <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
              {md}
            </ReactMarkdown>
          ) : (
            <p className="text-gray-500">Cargando documento…</p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Device type icon ────────────────────────────────────────────────────────

function DeviceTypeIcon({ type, className }: { type: string; className?: string }) {
  const t = type.toLowerCase();
  if (t.includes("tv") || t.includes("cast") || t.includes("television")) return <TvIcon className={className} />;
  if (t.includes("smartphone") || t.includes("phone") || t.includes("mobile")) return <PhoneIcon className={className} />;
  return <ComputerIcon className={className} />;
}

// ── Spotify device card ───────────────────────────────────────────────────────

function SpotifyDeviceCard({ device, selected, onSelect, onTransfer }: {
  device: SpotifyDevice;
  selected: boolean;
  onSelect: () => void;
  onTransfer: () => void;
}) {
  return (
    <div
      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-all duration-200 border ${
        selected
          ? "border-emerald-500/60 bg-emerald-900/20"
          : device.is_active
          ? "border-emerald-800/40 bg-emerald-900/10 hover:border-emerald-700/50"
          : "border-white/5 bg-white/3 hover:border-white/10"
      }`}
      onClick={onSelect}
    >
      <DeviceTypeIcon type={device.type} className="w-4 h-4 text-gray-400 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className={`text-xs font-medium truncate ${selected ? "text-emerald-300" : "text-gray-300"}`}>
          {device.name}
        </p>
        <p className="text-[10px] text-gray-600 truncate">{device.type}</p>
      </div>
      {device.is_active && (
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse flex-shrink-0" title="Reproduciendo ahora" />
      )}
      <button
        onClick={(e) => { e.stopPropagation(); onTransfer(); }}
        className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-900/40 hover:bg-emerald-700/50 text-emerald-400 transition-colors flex-shrink-0"
        title="Transferir reproducción aquí"
      >
        Poner aquí
      </button>
    </div>
  );
}

// ── Microphone option card ────────────────────────────────────────────────────

function MicOptionCard({ label, sublabel, selected, onSelect }: {
  label: string;
  sublabel?: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <div
      onClick={onSelect}
      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-all duration-200 border ${
        selected ? "border-sky-500/60 bg-sky-900/20" : "border-white/5 bg-white/3 hover:border-white/10"
      }`}
    >
      <MicIcon className={`w-4 h-4 flex-shrink-0 ${selected ? "text-sky-300" : "text-gray-400"}`} />
      <div className="flex-1 min-w-0">
        <p className={`text-xs font-medium truncate ${selected ? "text-sky-300" : "text-gray-300"}`}>{label}</p>
        {sublabel && <p className="text-[10px] text-gray-600 truncate">{sublabel}</p>}
      </div>
      {selected && <span className="w-1.5 h-1.5 rounded-full bg-sky-400 flex-shrink-0" title="En uso" />}
    </div>
  );
}

// Clave de localStorage para recordar el micrófono elegido entre sesiones.
const MIC_STORAGE_KEY = "sofia_selected_mic";

// Clip de silencio (10 ms) para "desbloquear" la reproducción de audio en
// navegadores móviles: debe sonar DENTRO de un gesto del usuario para que luego
// el navegador permita reproducir voz desde callbacks asíncronos.
const SILENT_AUDIO =
  "data:audio/wav;base64,UklGRnQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YVAAAACAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgA==";

// ── Main component ────────────────────────────────────────────────────────────

export default function Home() {
  const [appState, setAppState] = useState<AppState>("idle");
  const [messages, setMessages] = useState<Message[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [processingStep, setProcessingStep] = useState<string | null>(null);
  const [spotifyConnected, setSpotifyConnected] = useState<boolean | null>(null);
  // Imágenes de referencia adjuntas (para generar una imagen a partir de varias).
  const [pendingImages, setPendingImages] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Network devices
  const [networkDevices, setNetworkDevices] = useState<NetworkDevice[]>([]);
  const [networkScanning, setNetworkScanning] = useState(false);
  const [networkError, setNetworkError] = useState<string | null>(null);
  const [lastScanTime, setLastScanTime] = useState<Date | null>(null);
  const [newDeviceAlert, setNewDeviceAlert] = useState<NetworkDevice[]>([]);
  const knownMacsRef = useRef<Set<string>>(new Set());
  const [showNetworkPanel, setShowNetworkPanel] = useState(false);

  // Micrófonos (selección de entrada de audio, estilo Zoom/Meet)
  const [audioInputs, setAudioInputs] = useState<MediaDeviceInfo[]>([]);
  const [selectedMicId, setSelectedMicId] = useState<string | null>(null);
  const [showMicPanel, setShowMicPanel] = useState(false);
  const [micPermission, setMicPermission] = useState<"unknown" | "granted" | "denied">("unknown");

  // Spotify devices
  const [spotifyDevices, setSpotifyDevices] = useState<SpotifyDevice[]>([]);
  const [selectedSpotifyDevice, setSelectedSpotifyDevice] = useState<SpotifyDevice | null>(null);
  const [showSpotifyDevices, setShowSpotifyDevices] = useState(false);
  const [transferring, setTransferring] = useState(false);

  // Music history
  const [history, setHistory] = useState<MusicHistory | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  // Conversaciones (historial de chat)
  const [conversations, setConversations] = useState<ConversationMeta[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [showSidebar, setShowSidebar] = useState(false);
  const conversationIdRef = useRef<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number>(0);
  const barsRef = useRef<(HTMLDivElement | null)[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesRef = useRef<Message[]>([]);
  const lastBlobRef = useRef<Blob | null>(null);
  const appStateRef = useRef<AppState>("idle");
  // Cola de voz: encadena las locuciones de Sofia para que nunca se solapen.
  const voiceChainRef = useRef<Promise<void>>(Promise.resolve());
  const voicePendingRef = useRef(0);
  // Reproductor ÚNICO de voz. Los móviles solo permiten reproducir audio en un
  // elemento ya desbloqueado por un gesto previo; por eso reutilizamos siempre
  // el mismo elemento (no `new Audio()` por locución) y lo desbloqueamos al
  // primer toque del usuario (ver unlockAudio / startRecording).
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const audioUnlockedRef = useRef(false);

  useEffect(() => { messagesRef.current = messages; }, [messages]);
  useEffect(() => { appStateRef.current = appState; }, [appState]);
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);
  useEffect(() => { conversationIdRef.current = conversationId; }, [conversationId]);

  // ── Conversaciones ────────────────────────────────────────────────────────
  const fetchConversations = useCallback(async () => {
    try {
      const res = await fetch("/api/conversations");
      if (res.ok) setConversations((await res.json()).conversations ?? []);
    } catch {}
  }, []);

  useEffect(() => { fetchConversations(); }, [fetchConversations]);

  // Crea la conversación actual si aún no existe; devuelve su id (o null si falla).
  const ensureConversation = useCallback(async (firstText: string): Promise<string | null> => {
    if (conversationIdRef.current) return conversationIdRef.current;
    const id = crypto.randomUUID();
    try {
      const res = await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, title: firstText.slice(0, 80) }),
      });
      if (!res.ok) return null;
      conversationIdRef.current = id;
      setConversationId(id);
      fetchConversations();
      return id;
    } catch {
      return null;
    }
  }, [fetchConversations]);

  const persistMessage = useCallback(async (
    convId: string,
    msg: { id: string; role: "user" | "assistant"; content: string; imagePath?: string | null; imagePrompt?: string | null; audioPath?: string | null; audioPrompt?: string | null; docPath?: string | null; docTitle?: string | null }
  ) => {
    try {
      await fetch(`/api/conversations/${convId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(msg),
      });
      fetchConversations();
    } catch {}
  }, [fetchConversations]);

  const patchMessageImage = useCallback(async (convId: string, messageId: string, imagePath: string) => {
    try {
      await fetch(`/api/conversations/${convId}/messages`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageId, imagePath }),
      });
    } catch {}
  }, []);

  const patchMessageAudio = useCallback(async (convId: string, messageId: string, audioPath: string) => {
    try {
      await fetch(`/api/conversations/${convId}/messages`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageId, audioPath }),
      });
    } catch {}
  }, []);

  const patchMessageDoc = useCallback(async (convId: string, messageId: string, docPath: string, docTitle?: string) => {
    try {
      await fetch(`/api/conversations/${convId}/messages`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageId, docPath, docTitle }),
      });
    } catch {}
  }, []);

  // ── Imágenes de referencia (para generar una imagen a partir de varias) ─────
  const onSelectFiles = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []).filter((f) => f.type.startsWith("image/"));
    if (files.length) setPendingImages((prev) => [...prev, ...files].slice(0, 8));
    e.target.value = ""; // permite re-seleccionar el mismo archivo
  }, []);

  const removePendingImage = useCallback((idx: number) => {
    setPendingImages((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  // Reutiliza una imagen ya generada por Sofia como referencia (la baja a un File).
  const useGeneratedAsReference = useCallback(async (imageUrl: string) => {
    try {
      const res = await fetch(imageUrl);
      const blob = await res.blob();
      const name = imageUrl.split("/").pop() || "referencia.png";
      const file = new File([blob], name, { type: blob.type || "image/png" });
      setPendingImages((prev) => [...prev, file].slice(0, 8));
    } catch {
      setError("No se pudo usar esa imagen como referencia.");
    }
  }, []);

  // Reproduce una locución de Sofia EN SERIE: espera a que termine la locución
  // anterior antes de empezar esta, para que dos voces nunca se solapen (p. ej.
  // el anuncio "estoy componiendo…" y el aviso "¡terminé!"). `onStart` se llama
  // cuando ESTA locución empieza a sonar (o, como respaldo, si la reproducción
  // falla) para que el texto aparezca sincronizado con la voz sin perderse.
  // Mientras haya voz en cola el estado es "speaking"; al vaciarse vuelve a
  // "idle" (sin pisar grabación ni procesamiento en curso).
  // Devuelve el reproductor único (lo crea de forma perezosa en el cliente).
  const getPlayer = useCallback((): HTMLAudioElement => {
    if (!audioPlayerRef.current) audioPlayerRef.current = new Audio();
    return audioPlayerRef.current;
  }, []);

  // Desbloquea el audio en móviles. DEBE invocarse dentro de un gesto del
  // usuario (toque del micrófono, primer pointerdown). Reproduce un instante de
  // silencio en el reproductor compartido; tras esto el navegador permite
  // reproducir voz en ese mismo elemento aunque sea desde un callback asíncrono.
  const unlockAudio = useCallback(() => {
    if (audioUnlockedRef.current) return;
    const a = getPlayer();
    try {
      a.src = SILENT_AUDIO;
      const p = a.play();
      if (p) p.then(() => { a.pause(); a.currentTime = 0; audioUnlockedRef.current = true; }).catch(() => {});
    } catch {}
  }, [getPlayer]);

  const enqueueVoice = useCallback((audioUrl: string, onStart?: () => void): Promise<void> => {
    voicePendingRef.current += 1;
    const play = () =>
      new Promise<void>((resolve) => {
        const audio = getPlayer();
        let started = false;
        const reveal = () => { if (!started) { started = true; onStart?.(); } };
        const done = () => {
          audio.onplay = null; audio.onended = null; audio.onerror = null;
          URL.revokeObjectURL(audioUrl);
          resolve();
        };
        audio.onplay = () => {
          if (appStateRef.current !== "recording" && appStateRef.current !== "processing") {
            setAppState("speaking");
          }
          reveal();
        };
        audio.onended = done;
        audio.onerror = () => { reveal(); done(); };
        audio.src = audioUrl;
        audio.currentTime = 0;
        audio.play().catch(() => { reveal(); done(); });
      });
    const next = voiceChainRef.current.then(play, play).finally(() => {
      voicePendingRef.current -= 1;
      if (voicePendingRef.current === 0) {
        setAppState((s) => (s === "speaking" ? "idle" : s));
      }
    });
    voiceChainRef.current = next;
    return next;
  }, [getPlayer]);

  // Mensaje de seguimiento de Sofia (p. ej. al terminar una imagen o canción):
  // se persiste, se dice en voz alta (en cola, tras la locución previa) y su
  // texto aparece en el chat justo cuando empieza a SONAR su voz. Si el TTS
  // falla, el texto se muestra igual para no perderlo.
  const addSpokenFollowUp = useCallback(async (convId: string | null, text: string) => {
    const id = crypto.randomUUID();
    if (convId) persistMessage(convId, { id, role: "assistant", content: text });
    const showText = () =>
      setMessages((prev) =>
        prev.some((m) => m.id === id)
          ? prev
          : [...prev, { id, role: "assistant", content: text, timestamp: new Date() }]
      );
    try {
      const res = await fetch("/api/speak", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) { showText(); return; }
      const url = URL.createObjectURL(new Blob([await res.arrayBuffer()], { type: "audio/mpeg" }));
      await enqueueVoice(url, showText);
    } catch {
      showText();
    }
  }, [persistMessage, enqueueVoice]);

  const loadConversation = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/conversations/${id}`);
      if (!res.ok) return;
      const { messages: rows } = (await res.json()) as { messages: DbMessageRow[] };
      setMessages(
        rows.map((m) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          timestamp: new Date(m.created_at),
          imageUrl: m.image_path ?? undefined,
          imagePrompt: m.image_prompt ?? undefined,
          audioUrl: m.audio_path ?? undefined,
          audioPrompt: m.audio_prompt ?? undefined,
          docUrl: m.doc_path ?? undefined,
          docTitle: m.doc_title ?? undefined,
        }))
      );
      conversationIdRef.current = id;
      setConversationId(id);
      setError(null);
      setShowSidebar(false);
    } catch {}
  }, []);

  const startNewConversation = useCallback(() => {
    setMessages([]);
    conversationIdRef.current = null;
    setConversationId(null);
    setError(null);
    setShowSidebar(false);
  }, []);

  const removeConversation = useCallback(async (id: string) => {
    try {
      await fetch(`/api/conversations/${id}`, { method: "DELETE" });
      if (conversationIdRef.current === id) {
        setMessages([]);
        conversationIdRef.current = null;
        setConversationId(null);
      }
      fetchConversations();
    } catch {}
  }, [fetchConversations]);

  // Saludo inicial: solo la PRIMERA vez que se abre la app en este navegador.
  // Se persiste una bandera en localStorage para no repetirlo en cada recarga
  // (evita la molestia y el gasto de TTS en cada refresh). El navegador puede
  // bloquear el autoplay, así que también lo intentamos en el primer gesto.
  useEffect(() => {
    const GREETED_KEY = "sofia_greeted";
    try {
      if (localStorage.getItem(GREETED_KEY)) return;
    } catch {}

    const greeting = "¡Hola! Soy Sofia. ¿En qué puedo ayudarte hoy, arquitecto Eduardo? Si necesitas mi ayuda, solo presiona el botón del micrófono y con gusto te asistiré en lo que quieras.";
    let cancelled = false;
    let played = false;
    let url: string | null = null;

    // Reproduce el saludo por el reproductor único (ya desbloqueado tras el
    // primer gesto). En desktop suele funcionar en autoplay; en móvil se
    // reproduce en cuanto el usuario toca la pantalla.
    const playGreeting = () => {
      if (played || cancelled || !url) return;
      const a = getPlayer();
      a.src = url;
      a.currentTime = 0;
      a.play().then(() => {
        played = true;
        try { localStorage.setItem(GREETED_KEY, "1"); } catch {}
      }).catch(() => {});
    };

    (async () => {
      try {
        const res = await fetch("/api/speak", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: greeting }),
        });
        if (!res.ok || cancelled) return;
        url = URL.createObjectURL(new Blob([await res.arrayBuffer()], { type: "audio/mpeg" }));
        playGreeting();
      } catch {
        // Autoplay bloqueado: se reproducirá en el primer gesto del usuario.
      }
    })();

    const onGesture = () => {
      unlockAudio();
      playGreeting();
      if (played) window.removeEventListener("pointerdown", onGesture);
    };
    window.addEventListener("pointerdown", onGesture);

    return () => {
      cancelled = true;
      window.removeEventListener("pointerdown", onGesture);
      if (url) URL.revokeObjectURL(url);
    };
  }, [getPlayer, unlockAudio]);

  // Spotify OAuth redirect handling + initial status check
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const spotifyParam = params.get("spotify");
    if (spotifyParam === "connected") { setSpotifyConnected(true); window.history.replaceState({}, "", "/"); }
    else if (spotifyParam === "error") { setError("No se pudo conectar Spotify. Intenta de nuevo."); window.history.replaceState({}, "", "/"); }
    fetch("/api/spotify/status")
      .then((r) => r.json())
      .then(({ connected }) => setSpotifyConnected(connected))
      .catch(() => setSpotifyConnected(false));
  }, []);

  // Fetch Spotify devices when connected
  const fetchSpotifyDevices = useCallback(async () => {
    if (!spotifyConnected) return;
    try {
      const res = await fetch("/api/spotify/devices");
      if (res.ok) {
        const { devices } = await res.json();
        setSpotifyDevices(devices ?? []);
      }
    } catch {}
  }, [spotifyConnected]);

  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetch("/api/spotify/history");
      if (res.ok) setHistory(await res.json());
    } catch {}
  }, []);

  useEffect(() => {
    fetchSpotifyDevices();
    fetchHistory();
  }, [fetchSpotifyDevices, fetchHistory]);

  // ── Micrófonos ──────────────────────────────────────────────────────────────
  // Enumera los micrófonos conectados. Los nombres solo están disponibles tras
  // conceder permiso; mientras tanto el navegador los devuelve sin etiqueta.
  const refreshAudioInputs = useCallback(async () => {
    try {
      if (!navigator.mediaDevices?.enumerateDevices) return;
      const devices = await navigator.mediaDevices.enumerateDevices();
      const mics = devices.filter((d) => d.kind === "audioinput");
      setAudioInputs(mics);
      // Si hay etiquetas, el permiso ya está concedido: marcamos estado y
      // reconciliamos la selección (si el mic elegido se desconectó, volvemos al
      // predeterminado). Antes del permiso los deviceId vienen vacíos, así que no
      // tocamos la selección para no borrar la preferencia guardada.
      if (mics.some((m) => m.label)) {
        setMicPermission("granted");
        setSelectedMicId((prev) =>
          prev && !mics.some((m) => m.deviceId === prev) ? null : prev
        );
      }
    } catch {}
  }, []);

  // Pide permiso de micrófono (para revelar los nombres) y refresca la lista.
  const requestMicAccess = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
      setMicPermission("granted");
    } catch {
      setMicPermission("denied");
    }
    await refreshAudioInputs();
  }, [refreshAudioInputs]);

  // Carga la preferencia guardada, enumera al montar y escucha conexiones o
  // desconexiones de micrófonos en caliente (igual que Zoom o Meet).
  useEffect(() => {
    const saved = localStorage.getItem(MIC_STORAGE_KEY);
    if (saved) setSelectedMicId(saved);
    refreshAudioInputs();
    const onChange = () => refreshAudioInputs();
    navigator.mediaDevices?.addEventListener?.("devicechange", onChange);
    return () => navigator.mediaDevices?.removeEventListener?.("devicechange", onChange);
  }, [refreshAudioInputs]);

  // Persiste la selección de micrófono entre sesiones.
  useEffect(() => {
    if (selectedMicId) localStorage.setItem(MIC_STORAGE_KEY, selectedMicId);
    else localStorage.removeItem(MIC_STORAGE_KEY);
  }, [selectedMicId]);

  // Network scan function
  const scanNetwork = useCallback(async (isFirstScan = false) => {
    setNetworkScanning(true);
    setNetworkError(null);
    try {
      const res = await fetch("/api/network/devices");
      if (!res.ok) throw new Error("Error al escanear la red");
      const { devices } = (await res.json()) as { devices: NetworkDevice[] };

      if (isFirstScan) {
        // On first scan, just populate known MACs without alerting
        devices.forEach((d) => knownMacsRef.current.add(d.mac));
        setNetworkDevices(devices.map((d) => ({ ...d, isNew: false })));
      } else {
        const newOnes = devices.filter((d) => !knownMacsRef.current.has(d.mac));
        newOnes.forEach((d) => knownMacsRef.current.add(d.mac));
        setNetworkDevices(
          devices.map((d) => ({ ...d, isNew: newOnes.some((n) => n.mac === d.mac) }))
        );
        if (newOnes.length > 0) setNewDeviceAlert(newOnes);
      }

      setLastScanTime(new Date());
    } catch (err) {
      setNetworkError(err instanceof Error ? err.message : "Error de red");
    } finally {
      setNetworkScanning(false);
    }
  }, []);

  // Initial scan + 5-minute polling
  useEffect(() => {
    scanNetwork(true);
    const interval = setInterval(() => scanNetwork(false), 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [scanNetwork]);

  // Spotify device polling every 30s when panel is open
  useEffect(() => {
    if (!showSpotifyDevices || !spotifyConnected) return;
    fetchSpotifyDevices();
    const interval = setInterval(fetchSpotifyDevices, 30000);
    return () => clearInterval(interval);
  }, [showSpotifyDevices, spotifyConnected, fetchSpotifyDevices]);

  const transferToDevice = async (device: SpotifyDevice) => {
    setTransferring(true);
    try {
      const res = await fetch("/api/spotify/transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceId: device.id }),
      });
      if (res.ok) setSelectedSpotifyDevice(device);
    } catch {}
    setTransferring(false);
    await fetchSpotifyDevices();
  };

  // Reproduce una pista concreta (sugerencia elegida por el usuario) por su URI,
  // sin volver a buscar, y actualiza el mensaje con el estado de reproducción.
  const playSuggestion = useCallback(async (msgId: string, track: SpotifyTrack, target?: string) => {
    setMessages((prev) => prev.map((m) => (m.id === msgId ? { ...m, spotifyStatus: "searching", spotifyError: undefined } : m)));
    try {
      const res = await fetch("/api/spotify/play", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          uri: track.uri,
          name: track.name,
          artist: track.artist,
          target: target ?? "default",
          deviceId: selectedSpotifyDevice?.id,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === msgId
              ? { ...m, spotifyStatus: "playing", spotifyTrack: { ...track, image: track.image }, spotifyDevice: data.device?.name }
              : m
          )
        );
        fetchHistory();
      } else {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === msgId ? { ...m, spotifyStatus: "error", spotifyError: data.error || "No se pudo reproducir la canción" } : m
          )
        );
      }
    } catch {
      setMessages((prev) =>
        prev.map((m) => (m.id === msgId ? { ...m, spotifyStatus: "error", spotifyError: "No se pudo conectar con Spotify" } : m))
      );
    }
  }, [selectedSpotifyDevice, fetchHistory]);

  // Animate wave bars
  const startBarsAnimation = useCallback(() => {
    if (!analyserRef.current) return;
    const analyser = analyserRef.current;
    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    const bars = barsRef.current;
    const BAR_COUNT = bars.length;
    const animate = () => {
      if (!analyserRef.current) return;
      animationFrameRef.current = requestAnimationFrame(animate);
      analyser.getByteFrequencyData(dataArray);
      for (let i = 0; i < BAR_COUNT; i++) {
        const bar = bars[i];
        if (!bar) continue;
        const value = dataArray[Math.floor((i / BAR_COUNT) * dataArray.length)];
        bar.style.height = `${Math.max(4, (value / 255) * 52)}px`;
        const hue = 270 + (value / 255) * 30;
        bar.style.background = `linear-gradient(to top, hsl(${hue}, 75%, 55%), hsl(${hue + 20}, 80%, 70%))`;
      }
    };
    animate();
  }, []);

  const startRecording = async () => {
    try {
      setError(null);
      // Estamos dentro de un gesto del usuario: aprovechamos para desbloquear el
      // audio en móviles, así la voz de respuesta podrá sonar luego.
      unlockAudio();
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("Tu navegador no soporta acceso al micrófono");
      // Usa el micrófono elegido; si no hay, el predeterminado del sistema.
      const audioConstraints: MediaTrackConstraints | boolean = selectedMicId
        ? { deviceId: { exact: selectedMicId } }
        : true;
      const stream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints });
      // Ya con permiso concedido, refrescamos la lista para tener los nombres.
      setMicPermission("granted");
      refreshAudioInputs();
      const AudioContext =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof window.AudioContext }).webkitAudioContext;
      if (!AudioContext) throw new Error("Tu navegador no soporta Web Audio API");
      audioContextRef.current = new AudioContext();
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 64;
      audioContextRef.current.createMediaStreamSource(stream).connect(analyserRef.current);
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus" : "audio/webm";
      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];
      mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        cancelAnimationFrame(animationFrameRef.current);
        barsRef.current.forEach((bar) => { if (bar) { bar.style.height = "4px"; bar.style.background = "rgba(255,255,255,0.15)"; } });
        await processAudio(new Blob(chunksRef.current, { type: mimeType }));
      };
      mediaRecorder.start();
      setAppState("recording");
      startBarsAnimation();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Error desconocido";
      const name = err instanceof Error ? err.name : "";
      let userMessage = "No se pudo acceder al micrófono. Verifica los permisos del navegador.";
      if (name === "NotAllowedError" || message.includes("NotAllowedError") || message.includes("Permission denied")) {
        setMicPermission("denied");
        userMessage = "Permiso denegado. Permite el acceso al micrófono en los ajustes del navegador.";
      } else if (name === "NotFoundError" || message.includes("NotFoundError") || message.includes("no devices found")) {
        userMessage = "No se encontró micrófono. Verifica que esté conectado.";
      } else if (name === "OverconstrainedError" || message.includes("OverconstrainedError") || message.includes("Overconstrained")) {
        // El micrófono elegido ya no está disponible: volvemos al predeterminado.
        setSelectedMicId(null);
        userMessage = "El micrófono seleccionado ya no está disponible. Volví al predeterminado, intenta de nuevo.";
        refreshAudioInputs();
      }
      setError(userMessage);
      setAppState("idle");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current?.state === "recording") { setAppState("processing"); mediaRecorderRef.current.stop(); }
  };

  // Genera UNA imagen a partir de las imágenes de referencia adjuntas + la
  // instrucción hablada. No pasa por el chat (GPT no ve las imágenes): la
  // instrucción transcrita ES el prompt de edición.
  const handleImageEdit = async (instruction: string, convId: string | null, images: File[]) => {
    const assistantId = crypto.randomUUID();
    const prompt = instruction.trim();
    const confirm = "¡Va! Estoy creando tu imagen con esas referencias.";

    if (convId) persistMessage(convId, { id: assistantId, role: "assistant", content: confirm, imagePrompt: prompt });
    setMessages((prev) => [
      ...prev,
      { id: assistantId, role: "assistant", content: confirm, timestamp: new Date(), imageGenerating: true, imagePrompt: prompt },
    ]);
    setProcessingStep(null);

    // Confirmación hablada (no bloqueante).
    fetch("/api/speak", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: confirm }) })
      .then((r) => (r.ok ? r.arrayBuffer() : null))
      .then((buf) => { if (buf) enqueueVoice(URL.createObjectURL(new Blob([buf], { type: "audio/mpeg" }))); else setAppState("idle"); })
      .catch(() => setAppState("idle"));

    const fd = new FormData();
    images.forEach((f) => fd.append("images", f));
    fd.append("prompt", prompt);
    fd.append("messageId", assistantId);

    try {
      const res = await fetch("/api/image/edit", { method: "POST", body: fd });
      const data = await res.json();
      if (res.ok && data.image) {
        setMessages((prev) => prev.map((m) => (m.id === assistantId ? { ...m, imageGenerating: false, imageUrl: data.image } : m)));
        if (convId) patchMessageImage(convId, assistantId, data.image);
        addSpokenFollowUp(convId, pickLine(IMAGE_DONE_LINES));
      } else {
        setMessages((prev) => prev.map((m) => (m.id === assistantId ? { ...m, imageGenerating: false, imageError: data.error || "No se pudo generar la imagen" } : m)));
        addSpokenFollowUp(convId, IMAGE_FAIL_LINE);
      }
    } catch {
      setMessages((prev) => prev.map((m) => (m.id === assistantId ? { ...m, imageGenerating: false, imageError: "No se pudo generar la imagen" } : m)));
      addSpokenFollowUp(convId, IMAGE_FAIL_LINE);
    }
  };

  const processAudio = async (blob: Blob) => {
    lastBlobRef.current = blob;
    try {
      setProcessingStep("Transcribiendo audio…");
      const formData = new FormData();
      formData.append("audio", blob, "recording.webm");
      const transcribeRes = await fetchWithRetry(() => fetch("/api/transcribe", { method: "POST", body: formData }), 3, (a) => setProcessingStep(`Reintentando transcripción (${a}/3)…`));
      if (!transcribeRes.ok) throw new Error((await transcribeRes.json()).error || "Error al transcribir el audio");
      const { text } = await transcribeRes.json();
      if (!text?.trim()) { setError("No se detectó audio. Intenta de nuevo hablando más fuerte."); setAppState("idle"); setProcessingStep(null); return; }
      const userMsg: Message = { id: crypto.randomUUID(), role: "user", content: text, timestamp: new Date() };
      setMessages((prev) => [...prev, userMsg]);

      // Aseguramos la conversación (se crea con título = primer mensaje) y guardamos.
      const convId = await ensureConversation(text);
      if (convId) persistMessage(convId, { id: userMsg.id, role: "user", content: text });

      // Si hay imágenes de referencia adjuntas, esto es una edición de imagen:
      // generamos UNA imagen a partir de ellas + la instrucción y no llamamos al chat.
      if (pendingImages.length > 0) {
        const refs = pendingImages;
        setPendingImages([]);
        await handleImageEdit(text, convId, refs);
        return;
      }

      setProcessingStep("Pensando…");
      const chatRes = await fetchWithRetry(
        () => fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: [...messagesRef.current, userMsg].map((m) => ({ role: m.role, content: m.content })),
            spotifyDevices: spotifyDevices.length > 0 ? spotifyDevices : undefined,
          }),
        }),
        3,
        (a) => setProcessingStep(`Reintentando respuesta (${a}/3)…`)
      );
      if (!chatRes.ok) throw new Error((await chatRes.json()).error || "Error al obtener respuesta");
      const { response, action } = await chatRes.json();

      // Texto que Sofia dirá en voz alta: siempre el mismo de la respuesta del chat.
      const spokenText: string = response;
      // Id del mensaje del asistente (compartido por UI, persistencia e imagen).
      const assistantId = crypto.randomUUID();
      // El mensaje del asistente se agrega al chat cuando empieza a SONAR su voz
      // (audio.onplay), para que texto y audio aparezcan sincronizados. Si la
      // acción genera un medio (imagen/música), guardamos aquí su tipo y, cuando
      // el medio resuelva, su resultado; así el mensaje se siembra con el estado
      // correcto sin importar si el audio o el medio llegan primero.
      let pendingMedia: null | {
        kind: "image" | "music" | "spotify" | "create_playlist" | "list_playlists" | "play_playlist" | "study_doc";
        prompt?: string;
        target?: string;
      } = null;
      let mediaResult: Partial<Message> | null = null;

      if (action?.type === "spotify" && action.query) {
        const msgId = assistantId;
        const target: string = action.target ?? "default";
        pendingMedia = { kind: "spotify", target };
        const targetDevice = action.deviceId
          ? spotifyDevices.find((d) => d.id === action.deviceId)
          : selectedSpotifyDevice;
        fetch("/api/spotify/play", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: action.query, target, deviceId: targetDevice?.id }),
        })
          .then((r) => r.json().then((data) => ({ status: r.status, ok: r.ok, data })))
          .then(({ status, ok, data }) => {
            if (ok && data.track) {
              mediaResult = {
                spotifyStatus: "playing",
                spotifyTrack: data.track,
                spotifyDevice: data.device?.name,
                spotifySuggestions: data.alternatives ?? [],
                spotifyTarget: target,
              };
              fetchHistory();
            } else if (status === 404) {
              mediaResult = {
                spotifyStatus: "notfound",
                spotifySuggestions: data.suggestions ?? [],
                spotifyTarget: target,
              };
            } else {
              mediaResult = {
                spotifyStatus: "error",
                spotifyError: data.error || "No se pudo reproducir la canción",
                spotifyTrack: data.track,
                spotifySuggestions: data.alternatives ?? [],
                spotifyTarget: target,
              };
            }
            setMessages((prev) => prev.map((m) => (m.id === msgId ? { ...m, ...mediaResult } : m)));
          })
          .catch(() => {
            mediaResult = { spotifyStatus: "error", spotifyError: "No se pudo conectar con Spotify", spotifyTarget: target };
            setMessages((prev) => prev.map((m) => (m.id === msgId ? { ...m, ...mediaResult } : m)));
          });
      } else if (action?.type === "youtube" && action.query) {
        fetch(`/api/youtube/search?q=${encodeURIComponent(action.query)}`).then((r) => r.json()).then(({ url }) => { if (url) window.open(url, "_blank"); }).catch(console.error);
      } else if (action?.type === "image" && (action.prompt || action.query)) {
        const imagePrompt: string = action.prompt ?? action.query;
        const msgId = assistantId;
        pendingMedia = { kind: "image", prompt: imagePrompt };

        // Disparamos la generación de inmediato. El mensaje aparece cuando suena
        // la voz (onplay); aquí solo guardamos el resultado y, si el mensaje ya
        // existe, lo actualizamos (el map es no-op si aún no se agregó).
        fetch("/api/image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: imagePrompt, messageId: msgId }),
        })
          .then((r) => r.json())
          .then((data) => {
            mediaResult = data.image
              ? { imageGenerating: false, imageUrl: data.image }
              : { imageGenerating: false, imageError: data.error || "No se pudo generar la imagen" };
            setMessages((prev) => prev.map((m) => (m.id === msgId ? { ...m, ...mediaResult } : m)));
            if (data.image) {
              if (convId) patchMessageImage(convId, msgId, data.image);
              addSpokenFollowUp(convId, pickLine(IMAGE_DONE_LINES));
            } else {
              addSpokenFollowUp(convId, IMAGE_FAIL_LINE);
            }
          })
          .catch(() => {
            mediaResult = { imageGenerating: false, imageError: "No se pudo generar la imagen" };
            setMessages((prev) => prev.map((m) => (m.id === msgId ? { ...m, ...mediaResult } : m)));
            addSpokenFollowUp(convId, IMAGE_FAIL_LINE);
          });
      } else if (action?.type === "music" && (action.prompt || action.query)) {
        const musicPrompt: string = action.prompt ?? action.query;
        const durationMs: number | undefined =
          typeof action.durationMs === "number" ? action.durationMs : undefined;
        const msgId = assistantId;
        pendingMedia = { kind: "music", prompt: musicPrompt };

        // Igual que la imagen: la generación arranca ya; el mensaje aparece con
        // la voz (onplay) y se actualiza cuando la canción esté lista.
        fetch("/api/music", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: musicPrompt, durationMs, messageId: msgId }),
        })
          .then((r) => r.json())
          .then((data) => {
            mediaResult = data.audio
              ? { audioGenerating: false, audioUrl: data.audio }
              : { audioGenerating: false, audioError: data.error || "No se pudo generar la música" };
            setMessages((prev) => prev.map((m) => (m.id === msgId ? { ...m, ...mediaResult } : m)));
            if (data.audio) {
              if (convId) patchMessageAudio(convId, msgId, data.audio);
              addSpokenFollowUp(convId, pickLine(MUSIC_DONE_LINES));
            } else {
              addSpokenFollowUp(convId, MUSIC_FAIL_LINE);
            }
          })
          .catch(() => {
            mediaResult = { audioGenerating: false, audioError: "No se pudo generar la música" };
            setMessages((prev) => prev.map((m) => (m.id === msgId ? { ...m, ...mediaResult } : m)));
            addSpokenFollowUp(convId, MUSIC_FAIL_LINE);
          });
      } else if (action?.type === "create_playlist" && action.name) {
        const msgId = assistantId;
        const target: string = action.target ?? "default";
        pendingMedia = { kind: "create_playlist", target };
        const targetDevice = action.deviceId
          ? spotifyDevices.find((d) => d.id === action.deviceId)
          : selectedSpotifyDevice;
        fetch("/api/spotify/playlist/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: action.name,
            description: action.description,
            trackQueries: Array.isArray(action.trackQueries) ? action.trackQueries : [],
            play: action.play !== false,
            target,
            deviceId: targetDevice?.id,
          }),
        })
          .then((r) => r.json().then((data) => ({ ok: r.ok, data })))
          .then(({ ok, data }) => {
            mediaResult = ok && data.playlist
              ? { playlistStatus: "ready", playlist: data.playlist }
              : { playlistStatus: "error", playlistError: data.error || "No se pudo crear el playlist" };
            setMessages((prev) => prev.map((m) => (m.id === msgId ? { ...m, ...mediaResult } : m)));
            if (ok) fetchHistory();
          })
          .catch(() => {
            mediaResult = { playlistStatus: "error", playlistError: "No se pudo conectar con Spotify" };
            setMessages((prev) => prev.map((m) => (m.id === msgId ? { ...m, ...mediaResult } : m)));
          });
      } else if (action?.type === "list_playlists") {
        const msgId = assistantId;
        pendingMedia = { kind: "list_playlists" };
        fetch("/api/spotify/playlists")
          .then((r) => r.json().then((data) => ({ ok: r.ok, data })))
          .then(({ ok, data }) => {
            mediaResult = ok && Array.isArray(data.playlists)
              ? { playlistsStatus: "ready", playlists: data.playlists }
              : { playlistsStatus: "error", playlistsError: data.error || "No se pudieron obtener los playlists" };
            setMessages((prev) => prev.map((m) => (m.id === msgId ? { ...m, ...mediaResult } : m)));
          })
          .catch(() => {
            mediaResult = { playlistsStatus: "error", playlistsError: "No se pudo conectar con Spotify" };
            setMessages((prev) => prev.map((m) => (m.id === msgId ? { ...m, ...mediaResult } : m)));
          });
      } else if (action?.type === "play_playlist" && action.name) {
        const msgId = assistantId;
        const target: string = action.target ?? "default";
        pendingMedia = { kind: "play_playlist", target };
        const targetDevice = action.deviceId
          ? spotifyDevices.find((d) => d.id === action.deviceId)
          : selectedSpotifyDevice;
        fetch("/api/spotify/playlist/play", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: action.name, target, deviceId: targetDevice?.id }),
        })
          .then((r) => r.json().then((data) => ({ ok: r.ok, data })))
          .then(({ ok, data }) => {
            mediaResult = ok && data.playlist
              ? { playlistStatus: "ready", playlist: data.playlist }
              : { playlistStatus: "error", playlistError: data.error || "No se pudo reproducir el playlist" };
            setMessages((prev) => prev.map((m) => (m.id === msgId ? { ...m, ...mediaResult } : m)));
          })
          .catch(() => {
            mediaResult = { playlistStatus: "error", playlistError: "No se pudo conectar con Spotify" };
            setMessages((prev) => prev.map((m) => (m.id === msgId ? { ...m, ...mediaResult } : m)));
          });
      } else if (action?.type === "study_doc" && action.topic) {
        const msgId = assistantId;
        const topic: string = action.topic;
        pendingMedia = { kind: "study_doc", prompt: topic };
        fetch("/api/study", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ topic, focus: action.focus, level: action.level, messageId: msgId }),
        })
          .then((r) => r.json().then((data) => ({ ok: r.ok, data })))
          .then(({ ok, data }) => {
            mediaResult = ok && data.markdown
              ? { docGenerating: false, docMarkdown: data.markdown, docUrl: data.url, docTitle: data.title }
              : { docGenerating: false, docError: data.error || "No se pudo generar el documento" };
            setMessages((prev) => prev.map((m) => (m.id === msgId ? { ...m, ...mediaResult } : m)));
            if (ok && data.url) {
              if (convId) patchMessageDoc(convId, msgId, data.url, data.title);
              addSpokenFollowUp(convId, "¡Listo! Tu material de estudio ya está aquí. Tiene explicaciones, ejercicios y código. ¿Quieres que profundicemos en algún punto?");
            } else {
              addSpokenFollowUp(convId, "Uy, no pude preparar el documento esta vez. ¿Lo intento de nuevo?");
            }
          })
          .catch(() => {
            mediaResult = { docGenerating: false, docError: "No se pudo generar el documento" };
            setMessages((prev) => prev.map((m) => (m.id === msgId ? { ...m, ...mediaResult } : m)));
            addSpokenFollowUp(convId, "Uy, no pude preparar el documento esta vez. ¿Lo intento de nuevo?");
          });
      }

      // Persistimos el mensaje del asistente (la imagen/audio se parchea al
      // resolver). La persistencia es independiente de cuándo aparece en la UI.
      if (convId) {
        persistMessage(convId, {
          id: assistantId,
          role: "assistant",
          content: response,
          imagePrompt: pendingMedia?.kind === "image" ? pendingMedia.prompt : undefined,
          audioPrompt: pendingMedia?.kind === "music" ? pendingMedia.prompt : undefined,
        });
      }

      // Siembra el mensaje del asistente (con el estado del medio si aplica). Se
      // llama al SONAR la voz (onplay); también como respaldo si la síntesis o la
      // reproducción fallan, para no perder el texto ni la imagen/canción.
      const showAssistant = () => {
        setMessages((prev) => {
          if (prev.some((m) => m.id === assistantId)) return prev;
          const base: Message = { id: assistantId, role: "assistant", content: response, timestamp: new Date() };
          if (pendingMedia?.kind === "image") {
            return [...prev, { ...base, imageGenerating: !mediaResult, imagePrompt: pendingMedia.prompt, ...(mediaResult ?? {}) }];
          }
          if (pendingMedia?.kind === "music") {
            return [...prev, { ...base, audioGenerating: !mediaResult, audioPrompt: pendingMedia.prompt, ...(mediaResult ?? {}) }];
          }
          if (pendingMedia?.kind === "spotify") {
            return [...prev, { ...base, spotifyStatus: "searching", spotifyTarget: pendingMedia.target, ...(mediaResult ?? {}) }];
          }
          if (pendingMedia?.kind === "create_playlist") {
            return [...prev, { ...base, playlistStatus: "creating", ...(mediaResult ?? {}) }];
          }
          if (pendingMedia?.kind === "play_playlist") {
            // Reproducir es rápido: solo el texto hablado hasta que aparece la tarjeta "ready".
            return [...prev, { ...base, ...(mediaResult ?? {}) }];
          }
          if (pendingMedia?.kind === "list_playlists") {
            return [...prev, { ...base, playlistsStatus: "loading", ...(mediaResult ?? {}) }];
          }
          if (pendingMedia?.kind === "study_doc") {
            return [...prev, { ...base, docGenerating: !mediaResult, ...(mediaResult ?? {}) }];
          }
          return [...prev, base];
        });
      };

      setProcessingStep("Sintetizando voz…");
      let speakRes: Response;
      try {
        speakRes = await fetchWithRetry(() => fetch("/api/speak", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: spokenText }) }), 3, (a) => setProcessingStep(`Reintentando síntesis (${a}/3)…`));
        if (!speakRes.ok) throw new Error((await speakRes.json()).error || "Error al generar el audio");
      } catch (e) {
        showAssistant(); // sin voz, pero el texto (y la imagen/canción) sí aparecen
        throw e;
      }
      setProcessingStep(null);
      setAppState("speaking");
      const audioBlob2 = new Blob([await speakRes.arrayBuffer()], { type: "audio/mpeg" });
      const audioUrl = URL.createObjectURL(audioBlob2);
      // Encolamos la voz: si la generación de música/imagen ya disparó un aviso,
      // este anuncio suena primero y el aviso espera su turno (no se solapan).
      enqueueVoice(audioUrl, showAssistant);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Ocurrió un error inesperado");
      setAppState("idle");
      setProcessingStep(null);
    }
  };

  const handleButtonClick = () => {
    if (appState === "idle") startRecording();
    else if (appState === "recording") stopRecording();
  };

  const config = getButtonConfig(appState);
  const { Icon } = config;
  const isDisabled = appState === "processing" || appState === "speaking";

  return (
    <div className="relative flex flex-col h-[100dvh] overflow-hidden">
      {/* Background — limpio y clásico, con un resplandor morado muy sutil */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute top-[-10%] left-1/2 -translate-x-1/2 w-[600px] h-[360px] bg-violet-700/10 rounded-full blur-[120px]" />
      </div>

      {/* Botón para abrir el historial (sidebar) */}
      <button
        onClick={() => setShowSidebar(true)}
        className="fixed top-4 left-4 z-30 flex items-center gap-2 px-3 py-2 rounded-lg text-gray-400 hover:text-gray-200 hover:bg-white/5 transition-colors"
        aria-label="Abrir historial de conversaciones"
      >
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M3 6h18M3 12h18M3 18h18" />
        </svg>
        <span className="text-xs hidden sm:inline">Historial</span>
      </button>

      {/* Backdrop del sidebar */}
      {showSidebar && (
        <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm animate-fade-in-up" onClick={() => setShowSidebar(false)} />
      )}

      {/* Sidebar lateral de conversaciones */}
      <aside
        className={`fixed top-0 left-0 z-50 h-full w-72 max-w-[85vw] bg-[#1a1a1d] border-r border-white/10 flex flex-col transition-transform duration-300 ${showSidebar ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="flex items-center justify-between px-4 py-4 border-b border-white/10">
          <span className="text-sm font-semibold text-gray-200">Conversaciones</span>
          <button onClick={() => setShowSidebar(false)} className="text-gray-500 hover:text-gray-300 transition-colors" aria-label="Cerrar">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <button
          onClick={startNewConversation}
          className="mx-3 mt-3 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg bg-gradient-to-r from-violet-600 to-purple-700 hover:from-violet-500 hover:to-purple-600 text-white text-sm font-medium transition-colors"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
          Nueva conversación
        </button>

        <div className="flex-1 overflow-y-auto px-2 py-3 space-y-1">
          {conversations.length === 0 ? (
            <p className="text-xs text-gray-600 text-center py-6">Aún no hay conversaciones</p>
          ) : (
            conversations.map((c) => (
              <div
                key={c.id}
                onClick={() => loadConversation(c.id)}
                className={`group flex items-center gap-2 px-3 py-2.5 rounded-lg cursor-pointer transition-colors ${
                  conversationId === c.id ? "bg-white/10" : "hover:bg-white/5"
                }`}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-200 truncate">{c.title || "Nueva conversación"}</p>
                  <p className="text-[10px] text-gray-600">
                    {new Date(c.updated_at).toLocaleDateString("es-MX", { day: "2-digit", month: "short" })}
                    {" · "}
                    {new Date(c.updated_at).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); removeConversation(c.id); }}
                  className="opacity-0 group-hover:opacity-100 text-gray-600 hover:text-red-400 transition-all flex-shrink-0"
                  aria-label="Borrar conversación"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                  </svg>
                </button>
              </div>
            ))
          )}
        </div>
      </aside>

      {/* New device alert toast */}
      {newDeviceAlert.length > 0 && (
        <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-xs animate-fade-in-up">
          {newDeviceAlert.map((d) => (
            <div key={d.mac} className="flex items-start gap-3 px-4 py-3 rounded-2xl bg-violet-900/90 backdrop-blur-sm border border-violet-500/40 shadow-xl">
              <WifiIcon className="w-4 h-4 text-violet-300 mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-violet-200">Nuevo dispositivo detectado</p>
                <p className="text-xs text-violet-300 font-medium truncate">{d.name}</p>
                <p className="text-[10px] text-violet-600 font-mono">{d.ip} · {d.vendor}</p>
              </div>
              <button onClick={() => setNewDeviceAlert((a) => a.filter((x) => x.mac !== d.mac))} className="text-violet-600 hover:text-violet-400 text-xs mt-0.5">✕</button>
            </div>
          ))}
        </div>
      )}

      {/* Zona scrolleable: header, badges, paneles y mensajes. Es el ÚNICO
          scroll vertical de la app, así el header siempre vuelve al subir. */}
      <main className="flex-1 min-h-0 w-full overflow-y-auto flex flex-col items-center px-4 pt-16 pb-44">
      {/* Header */}
      <header className="relative z-10 text-center mb-4 sm:mb-8">
        <div className="flex items-center justify-center gap-2 sm:gap-3 mb-2 sm:mb-3">
          <div className="w-2 h-2 rounded-full bg-violet-400 animate-pulse" />
          <span className="text-[10px] sm:text-xs uppercase tracking-[0.2em] sm:tracking-[0.3em] text-gray-500 font-medium">Tu asistente de voz personal</span>
          <div className="w-2 h-2 rounded-full bg-pink-400 animate-pulse" />
        </div>
        <h1 className="text-5xl sm:text-6xl font-bold tracking-tight shimmer-text">Sofia</h1>
      </header>

      {/* Spotify + Network badges row */}
      <div className="relative z-10 mb-6 w-full flex flex-wrap items-center justify-center gap-2 sm:gap-3">
        {/* Spotify connect badge */}
        {spotifyConnected !== null && (
          spotifyConnected ? (
            <button
              onClick={() => { setShowSpotifyDevices((v) => !v); if (!showSpotifyDevices) fetchSpotifyDevices(); }}
              className="flex items-center gap-2 px-4 py-1.5 rounded-full glass border border-emerald-900/40 text-xs text-emerald-400 hover:border-emerald-700/60 transition-colors"
            >
              <SpotifyIcon className="w-3.5 h-3.5" />
              Spotify conectado
              {spotifyDevices.length > 0 && (
                <span className="ml-1 px-1.5 py-0.5 rounded-full bg-emerald-900/50 text-[10px]">{spotifyDevices.length}</span>
              )}
            </button>
          ) : (
            <a href="/api/spotify/auth" className="flex items-center gap-2 px-4 py-1.5 rounded-full glass border border-violet-900/40 text-xs text-violet-400 hover:border-violet-600/60 hover:text-violet-300 transition-colors">
              <SpotifyIcon className="w-3.5 h-3.5" />
              Conectar Spotify
            </a>
          )
        )}

        {/* Music history badge */}
        {spotifyConnected && (
          <button
            onClick={() => { setShowHistory((v) => !v); if (!showHistory) fetchHistory(); }}
            className="flex items-center gap-2 px-4 py-1.5 rounded-full glass border border-purple-900/40 text-xs text-purple-400 hover:border-purple-700/60 transition-colors"
          >
            <SpotifyIcon className="w-3.5 h-3.5" />
            Historial
            {history && history.recent.length > 0 && (
              <span className="ml-1 px-1.5 py-0.5 rounded-full bg-purple-900/50 text-[10px]">{history.recent.length}</span>
            )}
          </button>
        )}

        {/* Microphone selector badge */}
        <button
          onClick={() => { setShowMicPanel((v) => !v); if (!showMicPanel) refreshAudioInputs(); }}
          className="flex items-center gap-2 px-4 py-1.5 rounded-full glass border border-sky-900/40 text-xs text-sky-400 hover:border-sky-700/60 transition-colors max-w-[220px]"
        >
          <MicIcon className="w-3.5 h-3.5 flex-shrink-0" />
          <span className="truncate">
            {(() => {
              const sel = audioInputs.find((d) => d.deviceId === selectedMicId);
              return selectedMicId && sel?.label ? sel.label : "Micrófono";
            })()}
          </span>
        </button>

        {/* Network scan badge */}
        <button
          onClick={() => { setShowNetworkPanel((v) => !v); }}
          className="flex items-center gap-2 px-4 py-1.5 rounded-full glass border border-cyan-900/40 text-xs text-cyan-400 hover:border-cyan-700/60 transition-colors"
        >
          <WifiIcon className="w-3.5 h-3.5" />
          {networkScanning ? "Escaneando…" : `Red · ${networkDevices.length} dispositivos`}
          {networkScanning && <SpinnerIcon className="w-3 h-3 animate-spin-icon" />}
        </button>
      </div>

      {/* Microphone selector panel */}
      {showMicPanel && (
        <div className="relative z-10 w-full max-w-md mb-6 glass rounded-2xl border border-white/5 overflow-hidden animate-fade-in-up">
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
            <div className="flex items-center gap-2">
              <MicIcon className="w-4 h-4 text-sky-400" />
              <span className="text-xs font-semibold text-gray-300">Micrófono</span>
            </div>
            <button onClick={refreshAudioInputs} className="text-[10px] text-gray-600 hover:text-gray-400 transition-colors">Actualizar</button>
          </div>
          <div className="p-3 space-y-1.5">
            {micPermission === "denied" ? (
              <p className="text-xs text-red-400 text-center py-3">
                Permiso de micrófono denegado. Actívalo en los ajustes del navegador y pulsa Actualizar.
              </p>
            ) : audioInputs.length === 0 || audioInputs.every((d) => !d.label) ? (
              <button
                onClick={requestMicAccess}
                className="w-full text-xs px-3 py-2.5 rounded-xl bg-sky-900/30 hover:bg-sky-800/40 text-sky-300 border border-sky-800/40 transition-colors"
              >
                Permitir acceso para ver tus micrófonos
              </button>
            ) : (
              <>
                <MicOptionCard
                  label="Predeterminado del sistema"
                  sublabel="Usa el micrófono activo del sistema operativo"
                  selected={!selectedMicId}
                  onSelect={() => setSelectedMicId(null)}
                />
                {audioInputs.map((d, i) => (
                  <MicOptionCard
                    key={d.deviceId || i}
                    label={d.label || `Micrófono ${i + 1}`}
                    selected={selectedMicId === d.deviceId}
                    onSelect={() => setSelectedMicId(d.deviceId)}
                  />
                ))}
              </>
            )}
          </div>
          <div className="px-4 py-2 border-t border-white/5">
            <p className="text-[10px] text-gray-700">Tu elección se recuerda y se usa la próxima vez que grabes.</p>
          </div>
        </div>
      )}

      {/* Spotify devices panel */}
      {showSpotifyDevices && spotifyConnected && (
        <div className="relative z-10 w-full max-w-md mb-6 glass rounded-2xl border border-white/5 overflow-hidden animate-fade-in-up">
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
            <div className="flex items-center gap-2">
              <SpotifyIcon className="w-4 h-4 text-emerald-400" />
              <span className="text-xs font-semibold text-gray-300">Dispositivos Spotify</span>
            </div>
            <button onClick={fetchSpotifyDevices} className="text-[10px] text-gray-600 hover:text-gray-400 transition-colors">Actualizar</button>
          </div>
          <div className="p-3 space-y-1.5">
            {spotifyDevices.length === 0 ? (
              <p className="text-xs text-gray-600 text-center py-3">Abre Spotify en algún dispositivo</p>
            ) : (
              spotifyDevices.map((d) => (
                <SpotifyDeviceCard
                  key={d.id}
                  device={d}
                  selected={selectedSpotifyDevice?.id === d.id}
                  onSelect={() => setSelectedSpotifyDevice(d)}
                  onTransfer={() => transferToDevice(d)}
                />
              ))
            )}
          </div>
          {selectedSpotifyDevice && (
            <div className="px-4 py-2 border-t border-white/5 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span className="text-[10px] text-gray-500">Reproduciendo en: <span className="text-emerald-400">{selectedSpotifyDevice.name}</span></span>
            </div>
          )}
          {transferring && (
            <div className="px-4 py-2 border-t border-white/5 flex items-center gap-2">
              <SpinnerIcon className="w-3 h-3 animate-spin-icon text-emerald-400" />
              <span className="text-[10px] text-gray-500">Transfiriendo reproducción…</span>
            </div>
          )}
        </div>
      )}

      {/* Music history panel */}
      {showHistory && spotifyConnected && (
        <div className="relative z-10 w-full max-w-md mb-6 glass rounded-2xl border border-white/5 overflow-hidden animate-fade-in-up">
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
            <div className="flex items-center gap-2">
              <SpotifyIcon className="w-4 h-4 text-purple-400" />
              <span className="text-xs font-semibold text-gray-300">Historial musical</span>
            </div>
            <span className="text-[10px] text-gray-700">Sofia lo recuerda todo</span>
          </div>

          {(!history || history.recent.length === 0) ? (
            <p className="text-xs text-gray-600 text-center py-4">
              Aún no has puesto ninguna canción con Sofia
            </p>
          ) : (
            <>
              {/* Top artists */}
              {history.topArtists.length > 0 && (
                <div className="px-4 py-3 border-b border-white/5">
                  <p className="text-[10px] text-gray-600 uppercase tracking-widest mb-2">Más escuchados</p>
                  <div className="flex flex-wrap gap-1.5">
                    {history.topArtists.map((a) => (
                      <span key={a.artist} className="text-[10px] px-2 py-0.5 rounded-full bg-purple-900/30 text-purple-300 border border-purple-800/30">
                        {a.artist} · {a.count}x
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Recent plays */}
              <div className="divide-y divide-white/[0.03] max-h-48 overflow-y-auto">
                {history.recent.map((p) => (
                  <div key={p.id} className="flex items-center gap-3 px-4 py-2">
                    <div className="w-1 h-1 rounded-full bg-purple-700 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-300 truncate">{p.track_name}</p>
                      <p className="text-[10px] text-gray-600 truncate">{p.artist}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      {p.device_name && (
                        <p className="text-[9px] text-gray-700 truncate max-w-[80px]">{p.device_name}</p>
                      )}
                      <p className="text-[9px] text-gray-800">
                        {new Date(p.played_at).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="px-4 py-2 border-t border-white/5">
                <p className="text-[10px] text-gray-700">
                  {`Di "recomiéndame algo" o "pon algo parecido" para que Sofia elija por ti`}
                </p>
              </div>
            </>
          )}
        </div>
      )}

      {/* Network devices panel */}
      {showNetworkPanel && (
        <div className="relative z-10 w-full max-w-md mb-6 glass rounded-2xl border border-white/5 overflow-hidden animate-fade-in-up">
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
            <div className="flex items-center gap-2">
              <WifiIcon className="w-4 h-4 text-cyan-400" />
              <span className="text-xs font-semibold text-gray-300">Dispositivos en red</span>
            </div>
            <div className="flex items-center gap-3">
              {lastScanTime && (
                <span className="text-[10px] text-gray-700">
                  {lastScanTime.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}
                </span>
              )}
              <button
                onClick={() => scanNetwork(false)}
                disabled={networkScanning}
                className="text-[10px] text-gray-600 hover:text-gray-400 transition-colors disabled:opacity-40"
              >
                {networkScanning ? "Escaneando…" : "Escanear"}
              </button>
            </div>
          </div>
          <div className="divide-y divide-white/[0.03]">
            {networkError && (
              <p className="text-xs text-red-400 text-center py-3 px-4">{networkError}</p>
            )}
            {!networkError && networkDevices.length === 0 && (
              <p className="text-xs text-gray-600 text-center py-3">
                {networkScanning ? "Escaneando la red…" : "No se encontraron dispositivos"}
              </p>
            )}
            {networkDevices.map((d) => (
              <div key={d.mac} className={`flex items-center gap-3 px-4 py-2.5 ${d.isNew ? "bg-violet-900/15" : ""}`}>
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${d.isNew ? "bg-violet-900/50" : "bg-white/5"}`}>
                  <WifiIcon className={`w-3.5 h-3.5 ${d.isNew ? "text-violet-400" : d.isPrivateMac ? "text-yellow-600" : "text-cyan-600"}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-xs font-medium truncate ${d.isNew ? "text-violet-300" : "text-gray-300"}`}>
                    {d.name}
                  </p>
                  <p className="text-[10px] text-gray-600 truncate font-mono">
                    {d.ip} · <span className="text-gray-700">{d.mac}</span>
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                  {d.isNew && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-violet-900/60 text-violet-300 border border-violet-700/40">
                      NUEVO
                    </span>
                  )}
                  <span className={`text-[9px] px-1.5 py-0.5 rounded-full border ${d.isPrivateMac ? "bg-yellow-900/20 text-yellow-600 border-yellow-900/30" : "bg-cyan-900/20 text-cyan-600 border-cyan-900/30"}`}>
                    {d.vendor}
                  </span>
                </div>
              </div>
            ))}
          </div>
          <div className="px-4 py-2 border-t border-white/5 flex items-center justify-between">
            <span className="text-[10px] text-gray-700">Escaneo automático cada 5 min</span>
            <span className="text-[10px] text-gray-700">192.168.1.0/24</span>
          </div>
        </div>
      )}

      {/* Error banner */}
      {error && (
        <div className="relative z-10 mb-6 px-5 py-3 glass rounded-2xl text-red-400 text-sm max-w-md text-center border border-red-900/40 animate-fade-in-up">
          <p className="mb-2">⚠ {error}</p>
          <div className="flex items-center justify-center gap-3">
            {lastBlobRef.current && (
              <button onClick={() => { setError(null); setAppState("processing"); processAudio(lastBlobRef.current!); }} className="text-xs px-3 py-1 rounded-full bg-red-900/40 hover:bg-red-900/70 text-red-300 transition-colors">
                Reintentar
              </button>
            )}
            <button onClick={() => setError(null)} className="text-xs text-red-600 hover:text-red-400 transition-colors">Descartar</button>
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="relative z-10 w-full max-w-3xl">
        {messages.length === 0 ? null : (
          <>
            <div className="px-1 divide-y divide-white/[0.06]">
              {messages.map((msg) => <MessageBubble key={msg.id} msg={msg} onPlaySuggestion={playSuggestion} onUseAsReference={useGeneratedAsReference} />)}
              <div ref={messagesEndRef} />
            </div>
            {appState === "idle" && (
              <div className="text-center mt-4">
                <button onClick={startNewConversation} className="text-xs text-gray-600 hover:text-gray-400 transition-colors">
                  Nueva conversación
                </button>
              </div>
            )}
          </>
        )}
      </div>
      </main>

      {/* Floating mic button — fuera del scroll, siempre fijo y clicable */}
      <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50 flex flex-col items-end gap-2 sm:gap-3 max-w-[calc(100vw-2rem)]">
        {/* Siempre montado para que barsRef exista cuando inicia la animación;
            solo es visible al grabar. */}
        <div className={`rounded-2xl px-2 py-1.5 sm:px-3 sm:py-2 scale-75 origin-bottom-right sm:scale-100 transition-opacity duration-300 ${appState === "recording" ? "glass border border-white/5 opacity-100" : "opacity-0 pointer-events-none"}`}>
          <WaveVisualizer active={appState === "recording"} barsRef={barsRef} />
        </div>

        {/* Imágenes de referencia adjuntas (para generar una imagen a partir de ellas) */}
        {pendingImages.length > 0 && (
          <div className="glass rounded-2xl px-3 py-2 border border-violet-800/40 max-w-[80vw]">
            <p className="text-[10px] text-violet-300 mb-1.5">
              {pendingImages.length} {pendingImages.length === 1 ? "imagen" : "imágenes"} de referencia · graba tu instrucción
            </p>
            <div className="flex items-center gap-2 overflow-x-auto">
              {pendingImages.map((f, i) => (
                <PendingThumb key={`${f.name}-${i}`} file={f} onRemove={() => removePendingImage(i)} />
              ))}
            </div>
          </div>
        )}

        <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={onSelectFiles} className="hidden" />

        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={appState === "recording" || appState === "processing"}
            aria-label="Adjuntar imágenes de referencia"
            title="Adjuntar imágenes de referencia"
            className="relative z-10 w-11 h-11 sm:w-14 sm:h-14 rounded-full glass border border-white/10 flex items-center justify-center text-violet-300 transition-all hover:scale-105 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ClipIcon className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
          <div className="text-right glass rounded-2xl px-3 py-2 border border-white/5 hidden sm:block max-w-[200px]">
            <p className={`text-xs font-semibold transition-colors duration-300 ${appState === "recording" ? "text-red-400" : appState === "processing" ? "text-amber-400" : "text-violet-300"}`}>
              {config.label}
            </p>
            <p className="text-[10px] text-gray-500 truncate">
              {appState === "processing" && processingStep ? processingStep : config.sublabel}
            </p>
            {selectedSpotifyDevice && appState === "idle" && (
              <p className="text-[10px] text-emerald-600 truncate">Spotify → {selectedSpotifyDevice.name}</p>
            )}
          </div>
          <div className="relative flex items-center justify-center">
            <div className={`absolute rounded-full bg-gradient-to-br ${config.gradient} opacity-25 blur-2xl transition-all duration-500 w-16 h-16 sm:w-24 sm:h-24`} />
            <button
              onClick={handleButtonClick}
              disabled={isDisabled}
              className={`relative z-10 w-14 h-14 sm:w-20 sm:h-20 rounded-full bg-gradient-to-br ${config.gradient} flex items-center justify-center shadow-2xl transition-all duration-300 ${config.animationClass} ${isDisabled ? "cursor-not-allowed opacity-90" : "cursor-pointer hover:scale-105 active:scale-95"}`}
              aria-label={config.label}
            >
              <Icon className={`w-6 h-6 sm:w-9 sm:h-9 text-white drop-shadow-lg ${config.iconSpin ? "animate-spin-icon" : ""}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Footer — fijo y centrado horizontalmente en la pantalla */}
      <footer className="fixed bottom-3 sm:bottom-6 left-1/2 -translate-x-1/2 z-30 text-gray-600 text-[10px] sm:text-xs whitespace-nowrap pointer-events-none text-center">
        <p>Sofia · Eduardo Morua · {new Date().getFullYear()}</p>
      </footer>
    </div>
  );
}
