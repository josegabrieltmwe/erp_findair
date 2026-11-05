/**
 * Código de aeropuerto para mostrar. El legacy guarda '0' (o vacío) en
 * dhl_airport / terminal_* cuando no hay aeropuerto: no debe pintarse
 * «aeropuerto 0».
 */
export function cleanAirport(v: unknown): string {
  const s = String(v ?? "").trim();
  return s && s !== "0" ? s : "";
}
