/**
 * Resolución de proveedor y capacidades de booking — punto ÚNICO en el frontend.
 *
 * F3.4. Antes, la decisión "de qué carrier es esto" estaba repetida en tres
 * puntos del store (`book`, `cancel`, `refreshBookingStatus`) como
 * `startsWith("klm_")`, y cada nuevo carrier obligaba a tocar los tres. Peor:
 * al añadir el refresh se olvidó enrutar, así que un botón de la ficha llamaba
 * a WebCargo aun con una reserva KLM.
 *
 * El backend ya resolvió esto con `Booking_Driver::supports()`: cada driver
 * declara sus etapas y el llamante PREGUNTA. Aquí se refleja el mismo contrato
 * para que la UI no codifique qué carrier hace qué.
 *
 * Los prefijos siguen viviendo aquí (y sólo aquí) porque el frontend necesita
 * decidir a qué endpoint llamar ANTES de tener respuesta del backend. Cuando
 * exista el endpoint único de F3.3, este módulo se reduce a las capacidades.
 */

/** Claves de proveedor, en paridad con `Booking_Driver::key()` del backend. */
export type BookingProvider = "klm" | "webcargo";

/** Etapas del ciclo, en paridad con las constantes `STAGE_*` del backend. */
export type BookingStage =
  | "quote"
  | "simulate"
  | "book"
  | "confirm"
  | "modify"
  | "cancel"
  | "status"
  | "history";

/**
 * Capacidades declaradas por cada driver del backend.
 *
 * DEBE mantenerse en paridad con `supported_stages()` de
 * `Klm_Booking_Provider` y `Webcargo_Booking_Provider`.
 *
 * Son deliberadamente complementarias, y por eso la UI pregunta en vez de
 * asumir: WebCargo tiene `status` (GET /booking, una lectura barata) pero no
 * `simulate`; KLM al revés. KLM NO declara `status` a propósito — su
 * equivalente (`manage_booking`) es una ESCRITURA contra el carrier, y
 * refrescar es una acción de UI que el operador repite a voluntad.
 */
const CAPABILITIES: Record<BookingProvider, readonly BookingStage[]> = {
  klm: ["book", "cancel", "simulate", "modify", "history"],
  webcargo: ["book", "cancel", "status", "history"],
};

/** Prefijos de short_id (tarifa cacheada). */
const SHORT_ID_PREFIX: Record<BookingProvider, string> = {
  klm: "klm_",
  webcargo: "wc_",
};

/** Prefijos de booking_id (reserva ya creada). */
const BOOKING_ID_PREFIX: Record<BookingProvider, string> = {
  klm: "klm_book_",
  webcargo: "wc_book_",
};

/**
 * Proveedor dueño de un booking_id. null si nadie lo reconoce.
 */
export function providerForBookingId(
  bookingId: string | null | undefined,
): BookingProvider | null {
  if (!bookingId) return null;
  const id = String(bookingId);
  for (const [provider, prefix] of Object.entries(BOOKING_ID_PREFIX)) {
    if (id.startsWith(prefix)) return provider as BookingProvider;
  }
  return null;
}

/**
 * Proveedor dueño de un short_id. null si nadie lo reconoce.
 *
 * Se comprueba primero el booking_id: `klm_book_x` también empieza por `klm_`,
 * y sin ese orden un id de reserva se confundiría con uno de tarifa.
 */
export function providerForShortId(
  shortId: string | null | undefined,
): BookingProvider | null {
  if (!shortId) return null;
  const id = String(shortId);
  const asBooking = providerForBookingId(id);
  if (asBooking) return asBooking;
  for (const [provider, prefix] of Object.entries(SHORT_ID_PREFIX)) {
    if (id.startsWith(prefix)) return provider as BookingProvider;
  }
  return null;
}

/**
 * ¿El proveedor soporta esa etapa?
 *
 * Sustituye a los `startsWith` dispersos: la UI pregunta en lugar de codificar.
 */
export function supportsStage(
  provider: BookingProvider | null,
  stage: BookingStage,
): boolean {
  if (!provider) return false;
  return CAPABILITIES[provider].includes(stage);
}

/**
 * Atajo: ¿el dueño de este id soporta la etapa? Acepta short_id o booking_id.
 */
export function idSupportsStage(
  id: string | null | undefined,
  stage: BookingStage,
): boolean {
  return supportsStage(providerForShortId(id), stage);
}
