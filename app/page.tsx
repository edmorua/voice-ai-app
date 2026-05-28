"use client";

import { useState, useRef, useEffect, useCallback } from "react";

// ── Types ───────────────────────────────────────────────────────────────────

type AppState = "idle" | "recording" | "processing" | "speaking";

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
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
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
    >
      <path
        d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"
        strokeLinecap="round"
      />
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
      return {
        animationClass: "animate-pulse-idle",
        gradient: "from-violet-600 via-purple-600 to-indigo-700",
        Icon: MicIcon,
        label: "Toca para hablar",
        sublabel: "Graba tu mensaje de voz",
        iconSpin: false,
      };
    case "recording":
      return {
        animationClass: "animate-pulse-recording",
        gradient: "from-red-500 via-rose-600 to-red-700",
        Icon: StopIcon,
        label: "Grabando…",
        sublabel: "Toca para detener la grabación",
        iconSpin: false,
      };
    case "processing":
      return {
        animationClass: "animate-pulse-processing",
        gradient: "from-amber-500 via-orange-500 to-amber-700",
        Icon: SpinnerIcon,
        label: "Procesando…",
        sublabel: "Transcribiendo y generando respuesta",
        iconSpin: true,
      };
    case "speaking":
      return {
        animationClass: "animate-pulse-speaking",
        gradient: "from-emerald-500 via-teal-500 to-emerald-700",
        Icon: SpeakerIcon,
        label: "Respondiendo…",
        sublabel: "Reproduciendo respuesta de voz",
        iconSpin: false,
      };
  }
}

// ── Wave bars visualizer ─────────────────────────────────────────────────────

function WaveVisualizer({
  active,
  barsRef,
}: {
  active: boolean;
  barsRef: React.RefObject<(HTMLDivElement | null)[]>;
}) {
  const BAR_COUNT = 24;

  return (
    <div className="flex items-end justify-center gap-[3px] h-14 w-52">
      {Array.from({ length: BAR_COUNT }).map((_, i) => (
        <div
          key={i}
          ref={(el) => {
            if (barsRef.current) barsRef.current[i] = el;
          }}
          className="w-1.5 rounded-full wave-bar transition-all duration-75"
          style={{
            height: active ? "8px" : "4px",
            background: active
              ? `linear-gradient(to top, #7c3aed, #ec4899)`
              : "rgba(255,255,255,0.15)",
            transition: active ? "none" : "height 0.5s ease, background 0.5s ease",
          }}
        />
      ))}
    </div>
  );
}

// ── Retry utilities ──────────────────────────────────────────────────────────

const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

async function fetchWithRetry(
  makeRequest: () => Promise<Response>,
  maxAttempts = 3,
  onRetry?: (attempt: number) => void
): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await makeRequest();
      // Don't retry client errors (4xx) — those won't change on retry
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
    <div
      className={`flex gap-3 animate-fade-in-up ${isUser ? "flex-row-reverse" : "flex-row"}`}
    >
      {/* Avatar */}
      <div
        className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
          isUser
            ? "bg-gradient-to-br from-violet-600 to-purple-800"
            : "bg-gradient-to-br from-emerald-600 to-teal-800"
        }`}
      >
        {isUser ? (
          <UserIcon className="w-4 h-4 text-white" />
        ) : (
          <BotIcon className="w-4 h-4 text-white" />
        )}
      </div>

      {/* Content */}
      <div className={`flex flex-col gap-1 max-w-[75%] ${isUser ? "items-end" : "items-start"}`}>
        <div
          className={`px-4 py-3 rounded-2xl text-sm leading-relaxed ${
            isUser
              ? "bg-gradient-to-br from-violet-600/80 to-purple-800/80 backdrop-blur-sm text-white rounded-tr-sm"
              : "glass text-gray-200 rounded-tl-sm"
          }`}
        >
          {msg.content}
        </div>
        <span className="text-xs text-gray-600 px-1">
          {msg.timestamp.toLocaleTimeString("es-MX", {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function Home() {
  const [appState, setAppState] = useState<AppState>("idle");
  const [messages, setMessages] = useState<Message[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [processingStep, setProcessingStep] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number>(0);
  const barsRef = useRef<(HTMLDivElement | null)[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesRef = useRef<Message[]>([]);
  const lastBlobRef = useRef<Blob | null>(null);

  // Keep messagesRef in sync with state for async closures
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // Auto-scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Animate the wave bars with real audio data
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
        const idx = Math.floor((i / BAR_COUNT) * dataArray.length);
        const value = dataArray[idx];
        const height = Math.max(4, (value / 255) * 52);
        bar.style.height = `${height}px`;
        // Dynamic color based on amplitude
        const hue = 270 + (value / 255) * 60;
        bar.style.background = `linear-gradient(to top, hsl(${hue}, 80%, 55%), hsl(${hue + 40}, 80%, 70%))`;
      }
    };

    animate();
  }, []);

  const startRecording = async () => {
    try {
      setError(null);
      
      // Verificar soporte de getUserMedia
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Tu navegador no soporta acceso al micrófono");
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Audio context + analyser for visualization
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContext) {
        throw new Error("Tu navegador no soporta Web Audio API");
      }

      audioContextRef.current = new AudioContext();
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 64;
      const source = audioContextRef.current.createMediaStreamSource(stream);
      source.connect(analyserRef.current);

      // MediaRecorder
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";

      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        cancelAnimationFrame(animationFrameRef.current);

        // Reset bars
        barsRef.current.forEach((bar) => {
          if (bar) {
            bar.style.height = "4px";
            bar.style.background = "rgba(255,255,255,0.15)";
          }
        });

        const audioBlob = new Blob(chunksRef.current, { type: mimeType });
        await processAudio(audioBlob);
      };

      mediaRecorder.start();
      setAppState("recording");
      startBarsAnimation();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Error desconocido";
      console.error("[startRecording]", message, err);
      
      let userMessage = "No se pudo acceder al micrófono. Verifica los permisos del navegador.";
      if (message.includes("NotAllowedError") || message.includes("Permission denied")) {
        userMessage = "Permiso denegado. Permite el acceso al micrófono en los ajustes del navegador.";
      } else if (message.includes("NotFoundError") || message.includes("no devices found")) {
        userMessage = "No se encontró micrófono. Verifica que esté conectado.";
      } else if (message.includes("web audio")) {
        userMessage = "Tu navegador no soporta grabación de audio.";
      }
      
      setError(userMessage);
      setAppState("idle");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current?.state === "recording") {
      setAppState("processing");
      mediaRecorderRef.current.stop();
    }
  };

  const processAudio = async (blob: Blob) => {
    lastBlobRef.current = blob;
    try {
      // ── 1. Transcribir con Whisper ───────────────────────────────────────
      setProcessingStep("Transcribiendo audio…");
      const formData = new FormData();
      formData.append("audio", blob, "recording.webm");

      const transcribeRes = await fetchWithRetry(
        () => fetch("/api/transcribe", { method: "POST", body: formData }),
        3,
        (attempt) => setProcessingStep(`Reintentando transcripción (${attempt}/3)…`)
      );

      if (!transcribeRes.ok) {
        const err = await transcribeRes.json();
        throw new Error(err.error || "Error al transcribir el audio");
      }

      const { text } = await transcribeRes.json();

      if (!text?.trim()) {
        setError("No se detectó audio. Intenta de nuevo hablando más fuerte o más cerca del micrófono.");
        setAppState("idle");
        setProcessingStep(null);
        return;
      }

      const userMsg: Message = { role: "user", content: text, timestamp: new Date() };
      setMessages((prev) => [...prev, userMsg]);

      // ── 2. Respuesta con GPT ─────────────────────────────────────────────
      setProcessingStep("Pensando…");
      const chatRes = await fetchWithRetry(
        () =>
          fetch("/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              messages: [...messagesRef.current, userMsg].map((m) => ({
                role: m.role,
                content: m.content,
              })),
            }),
          }),
        3,
        (attempt) => setProcessingStep(`Reintentando respuesta (${attempt}/3)…`)
      );

      if (!chatRes.ok) {
        const err = await chatRes.json();
        throw new Error(err.error || "Error al obtener respuesta");
      }

      const { response, action } = await chatRes.json();

      // ── 3. Ejecutar acción de Spotify o YouTube ──────────────────────────
      if (action?.type === "spotify" && action.query) {
        fetch(`/api/spotify/search?q=${encodeURIComponent(action.query)}`)
          .then((r) => r.json())
          .then(({ url }) => { if (url) window.open(url, "_blank"); })
          .catch((e) => console.error("[spotify action]", e));
      } else if (action?.type === "youtube" && action.query) {
        fetch(`/api/youtube/search?q=${encodeURIComponent(action.query)}`)
          .then((r) => r.json())
          .then(({ url }) => { if (url) window.open(url, "_blank"); })
          .catch((e) => console.error("[youtube action]", e));
      }

      // ── 4. Síntesis de voz con ElevenLabs ───────────────────────────────
      setProcessingStep("Sintetizando voz…");
      const speakRes = await fetchWithRetry(
        () =>
          fetch("/api/speak", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: response }),
          }),
        3,
        (attempt) => setProcessingStep(`Reintentando síntesis (${attempt}/3)…`)
      );

      if (!speakRes.ok) {
        const err = await speakRes.json();
        throw new Error(err.error || "Error al generar el audio");
      }

      setProcessingStep(null);
      setAppState("speaking");

      const audioBuffer = await speakRes.arrayBuffer();
      const audioBlob = new Blob([audioBuffer], { type: "audio/mpeg" });
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);

      audio.onended = () => {
        URL.revokeObjectURL(audioUrl);
        setAppState("idle");
      };
      audio.onerror = () => {
        URL.revokeObjectURL(audioUrl);
        setError("Error al reproducir el audio. Intenta de nuevo.");
        setAppState("idle");
      };
      audio.onplay = () => {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: response, timestamp: new Date() },
        ]);
      };

      await audio.play();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Ocurrió un error inesperado";
      console.error(err);
      setError(msg);
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
      {/* ── Background decorations ── */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[400px] bg-violet-700/10 rounded-full blur-[100px]" />
        <div className="absolute bottom-0 left-1/4 w-80 h-80 bg-pink-700/8 rounded-full blur-[80px]" />
        <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-cyan-700/8 rounded-full blur-[80px]" />
        {/* Grid overlay */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />
      </div>

      {/* ── Header ── */}
      <header className="relative z-10 text-center mb-12">
        <div className="flex items-center justify-center gap-3 mb-3">
          <div className="w-2 h-2 rounded-full bg-violet-400 animate-pulse" />
          <span className="text-xs uppercase tracking-[0.3em] text-gray-500 font-medium">
            Tu asistente de voz personal
          </span>
          <div className="w-2 h-2 rounded-full bg-pink-400 animate-pulse" />
        </div>
        <h1 className="text-6xl font-bold tracking-tight shimmer-text">
          Sofia
        </h1>
      </header>

      {/* ── Main button + visualizer ── */}
      <div className="relative z-10 flex flex-col items-center gap-6 mb-6">
        {/* Outer glow ring */}
        <div className="relative flex items-center justify-center">
          <div
            className={`absolute rounded-full bg-gradient-to-br ${config.gradient} opacity-20 blur-2xl transition-all duration-500`}
            style={{ width: 200, height: 200 }}
          />

          {/* Button */}
          <button
            onClick={handleButtonClick}
            disabled={isDisabled}
            className={`
              relative z-10 w-40 h-40 rounded-full
              bg-gradient-to-br ${config.gradient}
              flex items-center justify-center
              transition-all duration-300
              ${config.animationClass}
              ${isDisabled ? "cursor-not-allowed opacity-90" : "cursor-pointer hover:scale-105 active:scale-95"}
            `}
            aria-label={config.label}
          >
            <Icon
              className={`w-16 h-16 text-white drop-shadow-lg ${
                config.iconSpin ? "animate-spin-icon" : ""
              }`}
            />
          </button>
        </div>

        {/* Wave visualizer */}
        <WaveVisualizer active={appState === "recording"} barsRef={barsRef} />

        {/* Status labels */}
        <div className="text-center">
          <p
            className={`text-base font-semibold transition-colors duration-300 ${
              appState === "recording"
                ? "text-red-400"
                : appState === "processing"
                ? "text-amber-400"
                : appState === "speaking"
                ? "text-emerald-400"
                : "text-violet-300"
            }`}
          >
            {config.label}
          </p>
          <p className="text-xs text-gray-600 mt-1">
            {appState === "processing" && processingStep ? processingStep : config.sublabel}
          </p>
        </div>
      </div>

      {/* ── Error banner ── */}
      {error && (
        <div className="relative z-10 mb-6 px-5 py-3 glass rounded-2xl text-red-400 text-sm max-w-md text-center border border-red-900/40 animate-fade-in-up">
          <p className="mb-2">⚠ {error}</p>
          <div className="flex items-center justify-center gap-3">
            {lastBlobRef.current && (
              <button
                onClick={() => {
                  setError(null);
                  setAppState("processing");
                  processAudio(lastBlobRef.current!);
                }}
                className="text-xs px-3 py-1 rounded-full bg-red-900/40 hover:bg-red-900/70 text-red-300 transition-colors"
              >
                Reintentar
              </button>
            )}
            <button
              onClick={() => setError(null)}
              className="text-xs text-red-600 hover:text-red-400 transition-colors"
            >
              Descartar
            </button>
          </div>
        </div>
      )}

      {/* ── Messages ── */}
      <div className="relative z-10 w-full max-w-2xl flex-1">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center py-12 animate-float">
            <div className="w-16 h-16 rounded-full glass flex items-center justify-center mb-4">
              <MicIcon className="w-7 h-7 text-gray-600" />
            </div>
            <p className="text-gray-600 text-sm">
              Presiona el botón y comienza a hablar con Sofia
            </p>
          </div>
        ) : (
          <>
            <div className="space-y-4 max-h-[420px] overflow-y-auto px-1 pb-4">
              {messages.map((msg, i) => (
                <MessageBubble key={i} msg={msg} />
              ))}
              <div ref={messagesEndRef} />
            </div>
            {appState === "idle" && (
              <div className="text-center mt-3">
                <button
                  onClick={() => setMessages([])}
                  className="text-xs text-gray-700 hover:text-gray-500 transition-colors underline underline-offset-2"
                >
                  Nueva conversación
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Footer ── */}
      <footer className="relative z-10 mt-10 text-center text-gray-700 text-xs">
        <p>Sofia · Creada por Eduardo Morua · {new Date().getFullYear()}</p>
      </footer>
    </div>
  );
}
