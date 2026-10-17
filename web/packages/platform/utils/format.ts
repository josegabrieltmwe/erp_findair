/**
 * Utilidades de formateo compartidas — fuente única para moneda / peso / fecha
 * en las SPAs del ERP. Centralizarlas evita el `fmtEur/fmtKg` inline (origen del
 * bug "toFixed is not a function" cuando el backend manda strings) y fija el
 * estilo visible al operador.
 *
 * IMPORTANTE sobre el formato de moneda: conviven dos estilos históricos:
 *   - IT (canónico operador): "€ 1.234,56" (miles '.', decimales ',').
 *   - EN: "1,234.56" (usado hoy en algunos componentes de cargo).
 * Se exponen ambos de forma EXPLÍCITA; cada llamada elige. No unificar a ciegas
 * (cambiaría el aspecto de cargo).
 */

/** Coerción defensiva a número finito (acepta string | null | undefined). */
function toNum(v: number | string | null | undefined): number {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Moneda estilo italiano: símbolo + espacio + número (miles '.', decimales ',').
 * No-EUR usa el código ISO en vez del símbolo: "USD 1.234,56".
 * Equivale al antiguo shipment_express/utils/currency.ts::formatMoney.
 */
export function formatMoneyIT(
  amount: number | string | null | undefined,
  currency = 'EUR',
): string {
  const value = toNum(amount);
  const sign = value < 0 ? '-' : '';
  const [intPart, decPart] = Math.abs(value).toFixed(2).split('.');
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const cur = (currency || 'EUR').toUpperCase();
  const prefix = cur === 'EUR' ? '€' : cur;
  return `${sign}${prefix} ${grouped},${decPart}`;
}

/** Moneda estilo en-US ("1,234.56"). Para componentes que ya lo usan. */
export function formatMoneyEN(
  amount: number | string | null | undefined,
  opts: { minimumFractionDigits?: number; maximumFractionDigits?: number } = {},
): string {
  return toNum(amount).toLocaleString('en-US', {
    minimumFractionDigits: opts.minimumFractionDigits ?? 2,
    maximumFractionDigits: opts.maximumFractionDigits ?? 2,
  });
}

/** Peso en kg con 2 decimales: "12.34 kg". */
export function formatWeightKg(v: number | string | null | undefined): string {
  return `${toNum(v).toFixed(2)} kg`;
}

/** Fecha ISO 'YYYY-MM-DD' a representación local; si no parsea, devuelve el original. */
export function formatDateLocal(
  date: string | Date | null | undefined,
  locale?: string,
): string {
  if (!date) return '';
  const d = date instanceof Date ? date : new Date(date);
  return Number.isNaN(d.getTime()) ? String(date) : d.toLocaleDateString(locale);
}
