"use client";

import { useState, useRef, useEffect, useCallback } from "react";

// ── Types ───────────────────────────────────────────────────────────────────

type AppState = "idle" | "recording" | "processing" | "speaking";

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
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
      return { animationClass: "animate-pulse-idle", gradient: "from-violet-600 via-purple-600 to-indigo-700", Icon: MicIcon, label: "Toca para hablar", sublabel: "Graba tu mensaje de voz", iconSpin: false };
    case "recording":
      return { animationClass: "animate-pulse-recording", gradient: "from-red-500 via-rose-600 to-red-700", Icon: StopIcon, label: "Grabando…", sublabel: "Toca para detener la grabación", iconSpin: false };
    case "processing":
      return { animationClass: "animate-pulse-processing", gradient: "from-amber-500 via-orange-500 to-amber-700", Icon: SpinnerIcon, label: "Procesando…", sublabel: "Transcribiendo y generando respuesta", iconSpin: true };
    case "speaking":
      return { animationClass: "animate-pulse-speaking", gradient: "from-emerald-500 via-teal-500 to-emerald-700", Icon: SpeakerIcon, label: "Respondiendo…", sublabel: "Reproduciendo respuesta de voz", iconSpin: false };
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
          style={{ height: active ? "8px" : "4px", background: active ? `linear-gradient(to top, #7c3aed, #ec4899)` : "rgba(255,255,255,0.15)", transition: active ? "none" : "height 0.5s ease, background 0.5s ease" }}
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

// ── Message bubble ────────────────────────────────────────────────────────────

function MessageBubble({ msg }: { msg: Message }) {
  const isUser = msg.role === "user";
  return (
    <div className={`flex gap-3 animate-fade-in-up ${isUser ? "flex-row-reverse" : "flex-row"}`}>
      <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${isUser ? "bg-gradient-to-br from-violet-600 to-purple-800" : "bg-gradient-to-br from-emerald-600 to-teal-800"}`}>
        {isUser ? <UserIcon className="w-4 h-4 text-white" /> : <BotIcon className="w-4 h-4 text-white" />}
      </div>
      <div className={`flex flex-col gap-1 max-w-[75%] ${isUser ? "items-end" : "items-start"}`}>
        <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed ${isUser ? "bg-gradient-to-br from-violet-600/80 to-purple-800/80 backdrop-blur-sm text-white rounded-tr-sm" : "glass text-gray-200 rounded-tl-sm"}`}>
          {msg.content}
        </div>
        <span className="text-xs text-gray-600 px-1">
          {msg.timestamp.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}
        </span>
      </div>
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

// ── Main component ────────────────────────────────────────────────────────────

export default function Home() {
  const [appState, setAppState] = useState<AppState>("idle");
  const [messages, setMessages] = useState<Message[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [processingStep, setProcessingStep] = useState<string | null>(null);
  const [spotifyConnected, setSpotifyConnected] = useState<boolean | null>(null);

  // Network devices
  const [networkDevices, setNetworkDevices] = useState<NetworkDevice[]>([]);
  const [networkScanning, setNetworkScanning] = useState(false);
  const [networkError, setNetworkError] = useState<string | null>(null);
  const [lastScanTime, setLastScanTime] = useState<Date | null>(null);
  const [newDeviceAlert, setNewDeviceAlert] = useState<NetworkDevice[]>([]);
  const knownMacsRef = useRef<Set<string>>(new Set());
  const [showNetworkPanel, setShowNetworkPanel] = useState(false);

  // Spotify devices
  const [spotifyDevices, setSpotifyDevices] = useState<SpotifyDevice[]>([]);
  const [selectedSpotifyDevice, setSelectedSpotifyDevice] = useState<SpotifyDevice | null>(null);
  const [showSpotifyDevices, setShowSpotifyDevices] = useState(false);
  const [transferring, setTransferring] = useState(false);

  // Music history
  const [history, setHistory] = useState<MusicHistory | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  // Generated image
  const [generatedImage, setGeneratedImage] = useState<{ url: string; prompt: string } | null>(null);
  const [imageGenerating, setImageGenerating] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number>(0);
  const barsRef = useRef<(HTMLDivElement | null)[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesRef = useRef<Message[]>([]);
  const lastBlobRef = useRef<Blob | null>(null);

  useEffect(() => { messagesRef.current = messages; }, [messages]);
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  // Saludo inicial al cargar la app. El navegador puede bloquear el autoplay,
  // así que también lo intentamos en la primera interacción del usuario.
  useEffect(() => {
    const greeting = "Hola, soy Sofia. ¿En qué puedo ayudarte, arquitecto Eduardo?";
    let cancelled = false;
    let played = false;
    let audio: HTMLAudioElement | null = null;
    let url: string | null = null;

    (async () => {
      try {
        const res = await fetch("/api/speak", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: greeting }),
        });
        if (!res.ok || cancelled) return;
        url = URL.createObjectURL(new Blob([await res.arrayBuffer()], { type: "audio/mpeg" }));
        audio = new Audio(url);
        audio.onended = () => { if (url) URL.revokeObjectURL(url); };
        await audio.play();
        played = true;
      } catch {
        // Autoplay bloqueado: se reproducirá en el primer gesto del usuario.
      }
    })();

    const onGesture = async () => {
      if (played || !audio) return;
      try { await audio.play(); played = true; window.removeEventListener("pointerdown", onGesture); } catch {}
    };
    window.addEventListener("pointerdown", onGesture);

    return () => {
      cancelled = true;
      window.removeEventListener("pointerdown", onGesture);
      if (url) URL.revokeObjectURL(url);
    };
  }, []);

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
        const hue = 270 + (value / 255) * 60;
        bar.style.background = `linear-gradient(to top, hsl(${hue}, 80%, 55%), hsl(${hue + 40}, 80%, 70%))`;
      }
    };
    animate();
  }, []);

  const startRecording = async () => {
    try {
      setError(null);
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("Tu navegador no soporta acceso al micrófono");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
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
      let userMessage = "No se pudo acceder al micrófono. Verifica los permisos del navegador.";
      if (message.includes("NotAllowedError") || message.includes("Permission denied")) userMessage = "Permiso denegado. Permite el acceso al micrófono en los ajustes del navegador.";
      else if (message.includes("NotFoundError") || message.includes("no devices found")) userMessage = "No se encontró micrófono. Verifica que esté conectado.";
      setError(userMessage);
      setAppState("idle");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current?.state === "recording") { setAppState("processing"); mediaRecorderRef.current.stop(); }
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
      const userMsg: Message = { role: "user", content: text, timestamp: new Date() };
      setMessages((prev) => [...prev, userMsg]);

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

      // Texto que Sofia dirá en voz alta. Para imágenes usamos una frase corta
      // (cacheada) para no esperar la síntesis larga mientras se genera.
      let spokenText: string = response;

      if (action?.type === "spotify" && action.query) {
        const targetDevice = action.deviceId
          ? spotifyDevices.find((d) => d.id === action.deviceId)
          : selectedSpotifyDevice;
        fetch("/api/spotify/play", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: action.query, target: action.target ?? "default", deviceId: targetDevice?.id }),
        }).then((r) => r.json()).then((data) => {
          if (data.error) console.warn("[spotify play]", data.error);
          else fetchHistory();
        }).catch(console.error);
      } else if (action?.type === "youtube" && action.query) {
        fetch(`/api/youtube/search?q=${encodeURIComponent(action.query)}`).then((r) => r.json()).then(({ url }) => { if (url) window.open(url, "_blank"); }).catch(console.error);
      } else if (action?.type === "image" && (action.prompt || action.query)) {
        const imagePrompt = action.prompt ?? action.query;
        spokenText = "Generando imagen, un momento.";
        setImageError(null);
        setImageGenerating(true);
        setGeneratedImage(null);
        fetch("/api/image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: imagePrompt }),
        })
          .then((r) => r.json())
          .then((data) => {
            if (data.image) setGeneratedImage({ url: data.image, prompt: imagePrompt });
            else setImageError(data.error || "No se pudo generar la imagen");
          })
          .catch(() => setImageError("No se pudo generar la imagen"))
          .finally(() => setImageGenerating(false));
      }

      setProcessingStep("Sintetizando voz…");
      const speakRes = await fetchWithRetry(() => fetch("/api/speak", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: spokenText }) }), 3, (a) => setProcessingStep(`Reintentando síntesis (${a}/3)…`));
      if (!speakRes.ok) throw new Error((await speakRes.json()).error || "Error al generar el audio");
      setProcessingStep(null);
      setAppState("speaking");
      const audioBlob2 = new Blob([await speakRes.arrayBuffer()], { type: "audio/mpeg" });
      const audioUrl = URL.createObjectURL(audioBlob2);
      const audio = new Audio(audioUrl);
      audio.onended = () => { URL.revokeObjectURL(audioUrl); setAppState("idle"); };
      audio.onerror = () => { URL.revokeObjectURL(audioUrl); setError("Error al reproducir el audio. Intenta de nuevo."); setAppState("idle"); };
      audio.onplay = () => { setMessages((prev) => [...prev, { role: "assistant", content: response, timestamp: new Date() }]); };
      await audio.play();
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
    <div className="min-h-screen flex flex-col items-center py-10 px-4 relative overflow-hidden">
      {/* Background decorations */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[400px] bg-violet-700/10 rounded-full blur-[100px]" />
        <div className="absolute bottom-0 left-1/4 w-80 h-80 bg-pink-700/8 rounded-full blur-[80px]" />
        <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-cyan-700/8 rounded-full blur-[80px]" />
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)", backgroundSize: "40px 40px" }} />
      </div>

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

      {/* Header */}
      <header className="relative z-10 text-center mb-8">
        <div className="flex items-center justify-center gap-3 mb-3">
          <div className="w-2 h-2 rounded-full bg-violet-400 animate-pulse" />
          <span className="text-xs uppercase tracking-[0.3em] text-gray-500 font-medium">Tu asistente de voz personal</span>
          <div className="w-2 h-2 rounded-full bg-pink-400 animate-pulse" />
        </div>
        <h1 className="text-6xl font-bold tracking-tight shimmer-text">Sofia</h1>
      </header>

      {/* Spotify + Network badges row */}
      <div className="relative z-10 mb-6 flex flex-wrap items-center justify-center gap-3">
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
                  Di "recomiéndame algo" o "pon algo parecido" para que Sofia elija por ti
                </p>
              </div>
            </>
          )}
        </div>
      )}

      {/* Generated image panel */}
      {(imageGenerating || generatedImage || imageError) && (
        <div className="relative z-10 w-full max-w-md mb-6 glass rounded-2xl border border-white/5 overflow-hidden animate-fade-in-up">
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
            <div className="flex items-center gap-2">
              <BotIcon className="w-4 h-4 text-pink-400" />
              <span className="text-xs font-semibold text-gray-300">Imagen generada</span>
            </div>
            <button
              onClick={() => { setGeneratedImage(null); setImageError(null); }}
              className="text-[10px] text-gray-600 hover:text-gray-400 transition-colors"
            >
              Cerrar
            </button>
          </div>
          <div className="p-3">
            {imageGenerating && (
              <div className="flex flex-col items-center justify-center gap-3 py-12">
                <SpinnerIcon className="w-8 h-8 text-pink-400 animate-spin-icon" />
                <p className="text-xs text-gray-500">Generando imagen…</p>
              </div>
            )}
            {!imageGenerating && imageError && (
              <p className="text-xs text-red-400 text-center py-6">⚠ {imageError}</p>
            )}
            {!imageGenerating && generatedImage && (
              <div className="flex flex-col gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={generatedImage.url}
                  alt={generatedImage.prompt}
                  className="w-full rounded-xl border border-white/5"
                />
                <p className="text-[10px] text-gray-600 italic px-1">{generatedImage.prompt}</p>
                <a
                  href={generatedImage.url}
                  download="sofia-imagen.png"
                  className="text-center text-[10px] px-3 py-1.5 rounded-full bg-pink-900/40 hover:bg-pink-700/50 text-pink-300 transition-colors"
                >
                  Descargar imagen
                </a>
              </div>
            )}
          </div>
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

      {/* Main button + visualizer */}
      <div className="relative z-10 flex flex-col items-center gap-6 mb-6">
        <div className="relative flex items-center justify-center">
          <div className={`absolute rounded-full bg-gradient-to-br ${config.gradient} opacity-20 blur-2xl transition-all duration-500`} style={{ width: 200, height: 200 }} />
          <button
            onClick={handleButtonClick}
            disabled={isDisabled}
            className={`relative z-10 w-40 h-40 rounded-full bg-gradient-to-br ${config.gradient} flex items-center justify-center transition-all duration-300 ${config.animationClass} ${isDisabled ? "cursor-not-allowed opacity-90" : "cursor-pointer hover:scale-105 active:scale-95"}`}
            aria-label={config.label}
          >
            <Icon className={`w-16 h-16 text-white drop-shadow-lg ${config.iconSpin ? "animate-spin-icon" : ""}`} />
          </button>
        </div>
        <WaveVisualizer active={appState === "recording"} barsRef={barsRef} />
        <div className="text-center">
          <p className={`text-base font-semibold transition-colors duration-300 ${appState === "recording" ? "text-red-400" : appState === "processing" ? "text-amber-400" : appState === "speaking" ? "text-emerald-400" : "text-violet-300"}`}>
            {config.label}
          </p>
          <p className="text-xs text-gray-600 mt-1">
            {appState === "processing" && processingStep ? processingStep : config.sublabel}
          </p>
          {selectedSpotifyDevice && appState === "idle" && (
            <p className="text-[10px] text-emerald-600 mt-1">
              Spotify → {selectedSpotifyDevice.name}
            </p>
          )}
        </div>
      </div>

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
      <div className="relative z-10 w-full max-w-2xl flex-1">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center py-12 animate-float">
            <div className="w-16 h-16 rounded-full glass flex items-center justify-center mb-4">
              <MicIcon className="w-7 h-7 text-gray-600" />
            </div>
            <p className="text-gray-600 text-sm">Presiona el botón y comienza a hablar con Sofia</p>
          </div>
        ) : (
          <>
            <div className="space-y-4 max-h-[420px] overflow-y-auto px-1 pb-4">
              {messages.map((msg, i) => <MessageBubble key={i} msg={msg} />)}
              <div ref={messagesEndRef} />
            </div>
            {appState === "idle" && (
              <div className="text-center mt-3">
                <button onClick={() => setMessages([])} className="text-xs text-gray-700 hover:text-gray-500 transition-colors underline underline-offset-2">
                  Nueva conversación
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Footer */}
      <footer className="relative z-10 mt-10 text-center text-gray-700 text-xs">
        <p>Sofia · Creada por Eduardo Morua · {new Date().getFullYear()}</p>
      </footer>
    </div>
  );
}
