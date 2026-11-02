/**
 * Fecha de hoy en hora local, como YYYY-MM-DD (valor de <input type="date">).
 *
 * No usar `new Date().toISOString().slice(0, 10)`: convierte a UTC antes de
 * cortar y, al este de Greenwich, la fecha pasa a ser la de ayer durante parte
 * de la tarde-noche.
 */
export function todayLocal(now: Date = new Date()): string {
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

/** Hora local actual como HH:MM. */
export function nowTimeLocal(now: Date = new Date()): string {
  const h = String(now.getHours()).padStart(2, "0");
  const m = String(now.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}
