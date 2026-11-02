/**
 * Número decimal con signo opcional y punto decimal (`-5`, `1.25`, `0.5`).
 * Rechaza `--5`, `1.2.3`, `.5` y `5.`: el servidor los leería como 0 o como un
 * valor distinto del tecleado.
 */
const SIGNED_DECIMAL = /^-?\d+(\.\d+)?$/;

export function isSignedDecimal(v: string): boolean {
  return v.length <= 10 && SIGNED_DECIMAL.test(v);
}
