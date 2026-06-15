# Despliegue de Sofia (servidor casero, HTTPS gratis)

Sofia es un asistente de voz **autohospedado**: corre en tu máquina Linux, escanea
tu red local, controla Spotify y guarda los datos en SQLite local. No es una app
para la nube — se despliega como un servicio en tu propio equipo.

**Objetivo:** entrar desde **cualquier dispositivo de tu red** (celular, tablet,
otra laptop) por `https://TU-SUBDOMINIO.duckdns.org`, con **micrófono**, **sin
instalar nada** en esos dispositivos y **sin pagar** un dominio.

## Por qué este enfoque

El micrófono del navegador (`getUserMedia`) solo funciona en un *contexto seguro*:
en `localhost` cualquier `http://` vale, pero desde otro dispositivo necesitas
`https://` con un certificado **válido** (de confianza). No se puede obtener un
cert válido para un nombre inventado como `sofia.lan` (ninguna autoridad lo firma).

La solución gratis: **DuckDNS** te da un subdominio real (`algo.duckdns.org`) y
con él **Let's Encrypt** emite un certificado válido y gratuito mediante el reto
**DNS-01** (que no requiere abrir puertos a internet). El subdominio apunta a la
IP local de tu servidor, así que el tráfico **nunca sale de tu red**.

```
  Cualquier dispositivo del WiFi
        │  https://sofia-eduardo.duckdns.org   ← cert VÁLIDO ⇒ micrófono OK
        ▼
   nginx :443  (termina TLS, cert Let's Encrypt)
        │  proxy_pass
        ▼
   Next.js 127.0.0.1:3030   (servicio systemd, build de producción)
        │
        ├─ SQLite local (sofia.db)
        ├─ /proc/net/arp + ping (escaneo de red)
        └─ OpenAI · ElevenLabs · Spotify
```

---

## Paso a paso

### 1. Cuenta DuckDNS (gratis)

1. Entra a <https://www.duckdns.org> e inicia sesión (Google/GitHub).
2. Crea un subdominio, p. ej. `sofia-eduardo` → te queda `sofia-eduardo.duckdns.org`.
3. Copia tu **token** (aparece arriba en la página).

### 2. Variables de entorno

```bash
cp .env.local.example .env.local   # si aún no existe
```
Rellena:
- Obligatorias: `OPENAI_API_KEY`, `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID`.
- Spotify/YouTube si las usas.
- **DuckDNS**:
  ```
  DUCKDNS_DOMAIN=sofia-eduardo.duckdns.org
  DUCKDNS_TOKEN=tu-token
  ```

El servidor valida las variables al arrancar y falla con un mensaje claro si
falta una obligatoria (`lib/env.ts`).

### 3. Un solo comando

```bash
bash deploy/setup.sh
```

Hace todo (pide `sudo` para los pasos de sistema):
1. `npm run build`.
2. Servicio systemd `sofia` (app en `:3030`, reinicio automático, arranca al bootear).
3. Instala nginx si falta.
4. Obtiene el certificado HTTPS (DuckDNS + Let's Encrypt) y configura su renovación automática.
5. Configura nginx (`:443 → 127.0.0.1:3030`) con tu dominio.

Al terminar, abre en cualquier dispositivo del mismo WiFi:
```
https://sofia-eduardo.duckdns.org
```

### 4. Spotify (si lo usas)

Como el origen cambió:
1. En `.env.local`:
   ```
   SPOTIFY_REDIRECT_URI=https://sofia-eduardo.duckdns.org/api/spotify/callback
   ```
2. En <https://developer.spotify.com/dashboard> → tu app → *Edit Settings* →
   *Redirect URIs*: añade exactamente esa URL.
3. `sudo systemctl restart sofia` y reconecta Spotify desde la app.

---

## Comandos útiles

```bash
journalctl -u sofia -f          # logs de la app
sudo systemctl restart sofia    # reiniciar tras cambios (recuerda npm run build)
sudo systemctl status sofia
sudo nginx -t && sudo systemctl reload nginx
```

## Accesos

| Desde | URL | Micrófono |
|-------|-----|-----------|
| El propio servidor | `http://localhost:3030` | ✅ (localhost) |
| Cualquier dispositivo del WiFi | `https://TU-SUBDOMINIO.duckdns.org` | ✅ (cert válido) |

---

## Solución de problemas

### El nombre no resuelve en algún dispositivo ("DNS rebinding")

Algunos routers bloquean que un nombre público (`*.duckdns.org`) apunte a una IP
privada (`192.168.x.x`) — se llama *DNS rebinding protection*. Si pasa:

- **Opción A:** en la config del router, desactiva "DNS rebind protection" o añade
  `duckdns.org` a la lista de excepciones.
- **Opción B (sin tocar el router):** en cada dispositivo que falle, añade a su
  archivo hosts:
  ```
  192.168.1.76   sofia-eduardo.duckdns.org
  ```
  (En Android/iOS editar hosts no es trivial; preferible la Opción A.)

### La IP del servidor cambió

DuckDNS guarda la IP local. Si tu router le asignó otra IP al servidor, vuelve a
correr `sudo bash deploy/get-cert.sh` (re-apunta el dominio) o, mejor, asigna una
**IP fija/reserva DHCP** al servidor en el router.

### Renovación del certificado

`acme.sh` instala un cron (como root) que renueva cada ~60 días y recarga nginx
solo. No necesitas hacer nada. Para verlo: `sudo /root/.acme.sh/acme.sh --list`.

---

## Notas de seguridad

- La app **no tiene autenticación**: cualquiera en tu WiFi que conozca el nombre
  puede usarla. Mantenla en redes de confianza.
- Expone control de Spotify y escaneo de red.
- Secretos (`.env.local`, `.spotify-tokens.json`) están en `.gitignore`; no los subas.

## Actualizar la app

```bash
git pull
npm install        # si cambiaron dependencias
npm run build
sudo systemctl restart sofia
```
