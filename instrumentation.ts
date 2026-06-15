// Next.js ejecuta register() una sola vez cuando arranca el servidor, antes de
// atender peticiones. Lo usamos para validar la configuración de entorno y
// fallar rápido en producción si falta algo crítico.

export async function register() {
  // Solo en el runtime de Node (no en Edge), donde corren nuestras rutas API.
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { validateEnv } = await import("./lib/env");
    validateEnv();
  }
}
