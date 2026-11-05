/**
 * Avisos HTTP globales que NO deben salir como «Error del servidor».
 *
 * Contexto: el cliente http compartido emite el evento `server-error` ante cualquier 5xx y `AppToaster` lo pinta como un
 * toast rojo genérico. Pero las pasarelas de pago están APAGADAS por defecto en el servidor: proponer un recargo, avisar,
 * cobrar o dar de alta una autorización responde 503 `PAYMENT_NOT_ACTIVE` (y 503 `PAYMENT_RETURN_URL_NOT_CONFIGURED` si
 * falta la dirección de retorno). Eso es un estado esperado, no una avería, y las pantallas de recargos y autorizaciones ya
 * lo explican en el propio diálogo o aviso de la página. Con el toast global se veía «Error del servidor» encima de una
 * explicación correcta (hallado probando las pantallas en un navegador real).
 *
 * Solo se silencian estos códigos concretos: cualquier otro 5xx sigue avisando.
 */

/** Códigos 503 de «función de cobro apagada o sin configurar»: estado esperado que explica cada pantalla. */
const EXPECTED_UNAVAILABLE_CODES: ReadonlySet<string> = new Set([
  "PAYMENT_NOT_ACTIVE",
  "PAYMENT_RETURN_URL_NOT_CONFIGURED",
]);

/**
 * ¿El cuerpo de un error 5xx es uno de los 503 esperados de las pasarelas? Lee `error_code`, `error.code` y `code`
 * (el BFF conserva el código de negocio en los tres para estas rutas).
 */
export function isExpectedUnavailable(payload: unknown): boolean {
  if (!payload || typeof payload !== "object") return false;
  const o = payload as {
    error_code?: unknown;
    code?: unknown;
    error?: unknown;
  };
  const nested =
    o.error && typeof o.error === "object"
      ? (o.error as { code?: unknown }).code
      : undefined;
  return [o.error_code, nested, o.code].some(
    (c) => typeof c === "string" && EXPECTED_UNAVAILABLE_CODES.has(c),
  );
}
