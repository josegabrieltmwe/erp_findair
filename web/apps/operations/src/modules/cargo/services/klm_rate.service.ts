import { http } from "./http";
import type { WebcargoRate } from "./webcargo_rate.service";

/**
 * Detalle de una tarifa KLM/AF por `short_id` (`klm_…`).
 *
 * POR QUE EXISTE
 * --------------
 * Con un vuelo KLM asignado, la ficha mostraba el vettore pero el gestor de
 * vuelo aparecia como "No flight selected": sin Book, sin Remove, solo "Search
 * flights". Con WebCargo funcionaba. La causa era que el store resolvia una
 * promesa VACIA para los `klm_` —no habia servicio que pidiera el detalle—, y
 * sin `rate` el estado de render cae a `empty` y con el desaparecen las
 * acciones.
 *
 * El endpoint ya existia; lo que faltaba era este servicio y un wrapper `Web_*`
 * que aceptara cookie de sesion (el controller de api/ es solo OAuth y
 * respondia 401 a la SPA).
 *
 * FORMA DE LA RESPUESTA — no es la misma que WebCargo:
 *   WebCargo → { success, rate: {...} }
 *   KLM      → { success, data: { rate: {...} } }
 * Se normaliza aqui para que el store no tenga que saberlo.
 */

interface KlmRateDetailResponse {
  success: boolean;
  data?: { rate?: WebcargoRate };
  /** Algunas rutas devuelven el rate en la raiz; se acepta por robustez. */
  rate?: WebcargoRate;
  error?: { message?: string; code?: string } | string;
}

/** Un `short_id` KLM siempre lleva el prefijo del carrier. */
export function isKlmShortId(shortId: string): boolean {
  return typeof shortId === "string" && shortId.startsWith("klm_");
}

export const klmRateService = {
  /**
   * Devuelve el rate KLM cacheado, o `null` si no existe o caduco.
   *
   * `null` NO es un error de programa: una quote KLM vive minutos, asi que un
   * rate caducado es el caso normal pasado un rato. El store distingue ese caso
   * del fallo real para poder caer al render de "solo reserva" cuando la
   * reserva sigue viva.
   */
  async getRateDetail(shortId: string): Promise<WebcargoRate | null> {
    if (!isKlmShortId(shortId)) return null;
    try {
      const r = await http<KlmRateDetailResponse>(
        "/api_cargo_klm_rate_detail",
        { query: { short_id: shortId } },
      );
      const rate = r?.data?.rate ?? r?.rate ?? null;
      if (!r?.success || !rate) return null;

      // `rate_data` puede llegar como string; se parsea aqui para que los
      // consumidores no tengan que repetirlo.
      if (typeof rate.rate_data === "string") {
        try {
          rate.rate_data = JSON.parse(rate.rate_data);
        } catch {
          /* leave as string */
        }
      }

      // Normalizar al contrato que espera la UI. El detalle KLM usa nombres
      // propios y deja fuera campos que WebCargo si trae; sin esto la tarjeta
      // se pintaria sin ruta y sin saber si la tarifa es reservable.
      const rd = (rate.rate_data ?? {}) as Record<string, unknown>;
      const asRec = rate as unknown as Record<string, unknown>;

      if (!rate.route) {
        const origin = asRec.origin_terminal;
        const destination = asRec.destination_terminal;
        if (origin || destination) {
          rate.route = {
            origin: origin ? String(origin) : "",
            destination: destination ? String(destination) : "",
          };
        }
      }

      // `bookable` vive dentro de rate_data como `quote_status`. Solo se fija
      // cuando el estado viene informado: dejarlo `undefined` significa "no se
      // sabe" y la UI no bloquea el boton, que es lo correcto — bloquear por un
      // dato ausente impediria reservar tarifas perfectamente validas.
      if (rate.bookable === undefined && typeof rd.quote_status === "string") {
        rate.bookable = rd.quote_status === "BOOKABLE";
        if (!rate.bookable && !rate.not_bookable_reason) {
          rate.not_bookable_reason = String(
            rd.not_bookable_reason ?? rd.quote_status,
          );
        }
      }

      if (!rate.source) rate.source = "klm_quote";
      if (!rate.airline_name) rate.airline_name = rate.airline_code;

      return rate;
    } catch {
      return null;
    }
  },
};
