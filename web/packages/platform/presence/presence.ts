/**
 * Presencia online — lado cliente (docs/plans/presencia_online/PROPUESTA.md §5.10).
 *
 * El backend infiere la presencia de las señales que recibe (modelo de lease):
 *   - cada petición autenticada renueva la CONEXIÓN de esta pestaña;
 *   - el latido (`web_presence_heartbeat`, cada 60 s con la pestaña visible)
 *     declara si hubo ACTIVIDAD real (ratón/teclado) → online vs away.
 *
 * Cada pestaña se identifica con un UUID (cabecera `X-Client-Instance`) que
 * vive en sessionStorage: sobrevive a recargas de la misma pestaña y es
 * distinto en otra pestaña. Con esa cabecera el backend sabe que este cliente
 * tiene latido y deja de contar sus peticiones (pollings incluidos) como
 * actividad.
 */

export const PRESENCE_INSTANCE_HEADER = 'X-Client-Instance';

const STORAGE_KEY = 'tmwe_presence_instance';
const HEARTBEAT_ROUTE = '/web_presence_heartbeat';
const DEFAULT_INTERVAL_MS = 60_000;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ACTIVITY_EVENTS = ['pointerdown', 'keydown', 'wheel', 'touchstart'] as const;

let cachedInstanceId: string | null = null;

function randomUuid(): string {
  const c = typeof crypto !== 'undefined' ? crypto : undefined;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  // randomUUID solo existe en contexto seguro: v4 a mano como respaldo.
  const b = new Uint8Array(16);
  if (c && typeof c.getRandomValues === 'function') {
    c.getRandomValues(b);
  } else {
    for (let i = 0; i < 16; i++) b[i] = Math.floor(Math.random() * 256);
  }
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/** UUID de esta pestaña (estable entre recargas de la misma pestaña). */
export function getClientInstanceId(): string {
  if (cachedInstanceId) return cachedInstanceId;
  let id: string | null = null;
  try {
    id = window.sessionStorage.getItem(STORAGE_KEY);
  } catch {
    /* almacenamiento bloqueado: UUID solo en memoria */
  }
  if (!id || !UUID_RE.test(id)) {
    id = randomUuid();
    try {
      window.sessionStorage.setItem(STORAGE_KEY, id);
    } catch {
      /* idem */
    }
  }
  cachedInstanceId = id;
  return id;
}

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.href;
  return (input as Request).url;
}

/**
 * Solo peticiones al propio origen: una cabecera custom en una petición
 * cross-origin (Google Maps, CDN…) dispararía un preflight CORS.
 */
function isSameOrigin(input: RequestInfo | URL): boolean {
  try {
    return new URL(requestUrl(input), window.location.href).origin === window.location.origin;
  } catch {
    return false;
  }
}

/**
 * Devuelve el `init` de fetch con `X-Client-Instance` añadida si la petición
 * va al propio origen; si no, el `init` original sin tocar.
 */
export function withPresenceHeaders(
  input: RequestInfo | URL,
  init?: RequestInit,
): RequestInit | undefined {
  if (typeof window === 'undefined' || !isSameOrigin(input)) return init;
  const headers = new Headers(
    init?.headers ?? (input instanceof Request ? input.headers : undefined),
  );
  if (headers.has(PRESENCE_INSTANCE_HEADER)) return init;
  headers.set(PRESENCE_INSTANCE_HEADER, getClientInstanceId());
  return { ...init, headers };
}

export interface PresenceHeartbeatOptions {
  /** Base de las rutas de tmwe_json (p. ej. '/bff/v1'), resuelta en cada latido. */
  basePath: () => string;
  /** Intervalo del latido. Debe ser < t_offline / 2 del backend (120 s). */
  intervalMs?: number;
}

/**
 * Arranca el latido de presencia de esta pestaña. Devuelve la función que lo
 * para. Si el backend responde `enabled: false` (presencia desactivada) se
 * para solo y no vuelve a llamar.
 */
export function startPresenceHeartbeat(opts: PresenceHeartbeatOptions): () => void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return () => {};

  const intervalMs = opts.intervalMs ?? DEFAULT_INTERVAL_MS;
  const instanceId = getClientInstanceId();
  // Cargar la página es ya una acción del usuario.
  let interacted = true;
  let stopped = false;
  let timer: number | null = null;

  const url = (): string => opts.basePath() + HEARTBEAT_ROUTE;
  const headers = (): Record<string, string> => ({
    Accept: 'application/json',
    'Content-Type': 'application/json',
    [PRESENCE_INSTANCE_HEADER]: instanceId,
  });

  async function beat(): Promise<void> {
    if (stopped || document.visibilityState !== 'visible') return;
    const active = interacted;
    interacted = false;
    try {
      const r = await fetch(url(), {
        method: 'POST',
        credentials: 'include',
        headers: headers(),
        body: JSON.stringify({ active }),
      });
      if (!r.ok) return;
      const body = await r.json().catch(() => null);
      const data = body?.data ?? body;
      if (data && data.enabled === false) stop();
    } catch {
      // Red caída: el siguiente latido reintenta. Si no vuelve, el backend
      // marcará offline a los t_offline segundos, que es lo correcto.
    }
  }

  const markActive = (): void => {
    interacted = true;
  };

  function onVisibility(): void {
    // Volver a la pestaña es interacción: latido inmediato, sin esperar al timer.
    if (document.visibilityState === 'visible') {
      interacted = true;
      void beat();
    }
  }

  function onPageHide(ev: PageTransitionEvent): void {
    // persisted = la página entra en bfcache y puede volver: no avisar.
    if (ev.persisted || stopped) return;
    try {
      // keepalive: la petición sobrevive a la descarga de la página.
      void fetch(url(), {
        method: 'POST',
        credentials: 'include',
        keepalive: true,
        headers: headers(),
        body: JSON.stringify({ leaving: true, instance_id: instanceId }),
      }).catch(() => undefined);
    } catch {
      /* best-effort */
    }
  }

  function stop(): void {
    if (stopped) return;
    stopped = true;
    if (timer !== null) window.clearInterval(timer);
    for (const ev of ACTIVITY_EVENTS) window.removeEventListener(ev, markActive, true);
    document.removeEventListener('visibilitychange', onVisibility);
    window.removeEventListener('pagehide', onPageHide);
  }

  for (const ev of ACTIVITY_EVENTS) {
    window.addEventListener(ev, markActive, { capture: true, passive: true });
  }
  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('pagehide', onPageHide);
  timer = window.setInterval(() => void beat(), intervalMs);
  void beat();

  return stop;
}
