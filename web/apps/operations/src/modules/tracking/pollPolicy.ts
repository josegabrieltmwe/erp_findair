/**
 * Límites del sondeo del job de tracking masivo. Sin ellos, un job que no existe o un fallo de red
 * sostenido dejaban la pantalla en «en curso» para siempre y el sondeo activo.
 */
export const POLL_INTERVAL_MS = 2000;
/** Un lote grande puede tardar; pasado este tiempo se avisa de que se sigue en el servidor. */
export const POLL_MAX_WAIT_MS = 30 * 60 * 1000;
/** Errores de red seguidos tolerados antes de rendirse (un error aislado es transitorio). */
export const POLL_MAX_CONSECUTIVE_ERRORS = 5;

export type PollGiveUp = "timeout" | "errors" | null;

export function pollGiveUp(elapsedMs: number, consecutiveErrors: number): PollGiveUp {
  if (consecutiveErrors >= POLL_MAX_CONSECUTIVE_ERRORS) return "errors";
  if (elapsedMs > POLL_MAX_WAIT_MS) return "timeout";
  return null;
}
