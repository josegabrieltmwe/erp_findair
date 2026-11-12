/**
 * Selección de bultos para imprimir/descargar etiquetas: lógica pura (sin Vue ni red).
 *
 * El servidor valida lo mismo (`Package_Selection`, 400 si es inválido) y es la autoridad: esto solo evita
 * peticiones absurdas y da el aviso en el formulario. Una selección NO autoriza nada, solo reduce lo que se
 * empaqueta de una expedición que el usuario ya puede ver.
 */

/** Tope de bultos por petición (el mismo del servidor). */
export const MAX_PACKAGES = 500;

export type LabelScope = "current" | "all" | "range";
export type LabelFormat = "pdf" | "zip";

export interface LabelSelection {
  scope: LabelScope;
  /** null = todos los bultos. */
  packages: number[] | null;
  format: LabelFormat;
}

export type ParseResult =
  | { ok: true; packages: number[] }
  | { ok: false; reason: "empty" | "invalid" | "out_of_range" | "too_many" };

/**
 * «1-5,8» → [1,2,3,4,5,8] (únicos y ordenados). Con `total`, todo número debe estar entre 1 y `total`.
 */
export function parsePackageSelection(
  text: string,
  total?: number,
): ParseResult {
  const spec = (text ?? "").replace(/\s+/g, "");
  if (!spec) return { ok: false, reason: "empty" };
  if (spec.length > 200 || !/^\d+(-\d+)?(,\d+(-\d+)?)*$/.test(spec)) {
    return { ok: false, reason: "invalid" };
  }
  const out = new Set<number>();
  for (const part of spec.split(",")) {
    const [a, b] = part.split("-").map(Number);
    const from = a;
    const to = b === undefined ? a : b;
    if (from < 1 || to < from) return { ok: false, reason: "invalid" };
    if (to - from >= MAX_PACKAGES) return { ok: false, reason: "too_many" };
    for (let n = from; n <= to; n++) {
      if (total !== undefined && n > total) {
        return { ok: false, reason: "out_of_range" };
      }
      out.add(n);
      if (out.size > MAX_PACKAGES) return { ok: false, reason: "too_many" };
    }
  }
  return { ok: true, packages: [...out].sort((x, y) => x - y) };
}

/** [1,2,3,4,5,8] → «1-5,8» (para el parámetro `packages` del API). */
export function formatPackageSelection(nums: readonly number[]): string {
  const sorted = [
    ...new Set(nums.filter((n) => Number.isInteger(n) && n > 0)),
  ].sort((a, b) => a - b);
  const parts: string[] = [];
  let i = 0;
  while (i < sorted.length) {
    let j = i;
    while (j + 1 < sorted.length && sorted[j + 1] === sorted[j] + 1) j++;
    parts.push(j > i ? `${sorted[i]}-${sorted[j]}` : `${sorted[i]}`);
    i = j + 1;
  }
  return parts.join(",");
}

/** Parámetro `packages` a enviar; undefined = todos (no se manda nada). */
export function packagesParam(sel: LabelSelection): string | undefined {
  return sel.packages && sel.packages.length
    ? formatPackageSelection(sel.packages)
    : undefined;
}

/** Tracking abreviado para el carril: conserva el final, que es lo que distingue un bulto de otro. */
export function shortTracking(
  tracking: string | null | undefined,
  max = 14,
): string {
  const t = (tracking ?? "").trim();
  if (t.length <= max) return t;
  return `…${t.slice(t.length - (max - 1))}`;
}

/** Índices vecinos válidos (para precargar el siguiente/anterior sin pedir todo). */
export function neighborIndexes(index: number, count: number): number[] {
  return [index + 1, index - 1].filter((i) => i >= 0 && i < count);
}

/** Índice acotado a [0, count-1] (0 si no hay elementos). */
export function clampIndex(index: number, count: number): number {
  if (count <= 0) return 0;
  return Math.min(Math.max(Math.trunc(index) || 0, 0), count - 1);
}
