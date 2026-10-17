/**
 * Cliente del endpoint ÚNICO de booking (F3.3).
 *
 * Un solo endpoint —`/api_cargo_booking`— para todos los carriers: el proveedor
 * se deduce del identificador en el backend y `Booking_Dispatcher` enruta al
 * driver. Frente a `booking.service.ts` + `klm_booking.service.ts`, aquí no hay
 * que saber de qué carrier es la reserva antes de llamar.
 *
 * ESTADO: disponible y probado, pero el store todavía usa los servicios por
 * proveedor. La migración es independiente y reversible — los endpoints
 * anteriores siguen vivos. Cuando el store pase por aquí, `booking_provider.ts`
 * se reduce a las capacidades, porque el prefijo deja de importar en el cliente.
 */
import { http } from "./http";
import type { BookingSummary } from "./booking.service";
import type { BookingStage } from "./booking_provider";

export interface StageResult {
  success: boolean;
  stage?: string;
  state?: string | null;
  booking?: BookingSummary;
  error?: string;
  error_code?: string;
  /** Resultado DESCONOCIDO: no reintentar sin verificar antes. */
  indeterminate?: boolean;
  /** La respuesta describe una simulación, no una reserva real. */
  simulated?: boolean;
}

export interface BookInput {
  shortId: string;
  shipmentId: number;
  awbManual?: string;
  useTesting?: boolean;
}

export const unifiedBookingService = {
  /** Reserva por booking_id. null si no existe o no hay acceso. */
  async get(bookingId: string): Promise<BookingSummary | null> {
    if (!bookingId) return null;
    try {
      const r = await http<{ success: boolean; booking?: BookingSummary }>(
        "/api_cargo_booking",
        { query: { id: bookingId } },
      );
      return r?.booking ?? null;
    } catch {
      return null;
    }
  },

  /** Reserva ACTIVA de una tarifa. */
  async getByShortId(shortId: string): Promise<BookingSummary | null> {
    if (!shortId) return null;
    try {
      const r = await http<{ success: boolean; booking?: BookingSummary }>(
        "/api_cargo_booking",
        { query: { short_id: shortId } },
      );
      return r?.booking ?? null;
    } catch {
      return null;
    }
  },

  /** Reserva ACTIVA de una expedición. */
  async getByShipment(shipmentId: number): Promise<BookingSummary | null> {
    if (!shipmentId) return null;
    try {
      const r = await http<{ success: boolean; booking?: BookingSummary }>(
        "/api_cargo_booking",
        { query: { shipment_id: shipmentId } },
      );
      return r?.booking ?? null;
    } catch {
      return null;
    }
  },

  /**
   * Etapas que soporta el carrier dueño de este id.
   *
   * Es la versión autoritativa de lo que `booking_provider.ts` mantiene en
   * duro: aquí las declara el backend. Útil cuando entren carriers cuyo
   * conjunto de capacidades el frontend no conozca de antemano.
   */
  async capabilities(id: string): Promise<BookingStage[]> {
    if (!id) return [];
    try {
      const r = await http<{ success: boolean; stages?: BookingStage[] }>(
        "/api_cargo_booking",
        { query: { id, stage: "capabilities" } },
      );
      return r?.stages ?? [];
    } catch {
      return [];
    }
  },

  /** Historial de la reserva. */
  async history(bookingId: string): Promise<unknown[]> {
    if (!bookingId) return [];
    try {
      const r = await http<{ success: boolean; history?: unknown[] }>(
        "/api_cargo_booking",
        { query: { id: bookingId, stage: "history" } },
      );
      return r?.history ?? [];
    } catch {
      return [];
    }
  },

  /** Relee el estado contra el carrier (sólo si soporta la etapa `status`). */
  async status(bookingId: string): Promise<StageResult> {
    return await this.run("status", { id: bookingId }, "GET");
  },

  /** Reserva. */
  async book(input: BookInput): Promise<StageResult> {
    return await this.run("book", {
      short_id: input.shortId,
      shipment_id: input.shipmentId,
      awb_manual: input.awbManual,
      use_testing: input.useTesting,
    });
  },

  /** Cancela. */
  async cancel(bookingId: string, reason?: string): Promise<StageResult> {
    return await this.run("cancel", { booking_id: bookingId, reason });
  },

  /** Dry run (sólo carriers que lo soporten). */
  async simulate(input: BookInput): Promise<StageResult> {
    return await this.run("simulate", {
      short_id: input.shortId,
      shipment_id: input.shipmentId,
      use_testing: input.useTesting,
    });
  },

  /**
   * Ejecuta una etapa. Un fallo de red se devuelve con la misma forma que un
   * fallo de negocio, para que el llamante no tenga dos caminos de error.
   */
  async run(
    stage: BookingStage,
    payload: Record<string, unknown>,
    method: "GET" | "POST" = "POST",
  ): Promise<StageResult> {
    try {
      if (method === "GET") {
        return await http<StageResult>("/api_cargo_booking", {
          query: { ...payload, stage },
        });
      }
      return await http<StageResult>("/api_cargo_booking", {
        method: "POST",
        body: { ...payload, stage },
      });
    } catch (e) {
      return {
        success: false,
        stage,
        error: (e as Error).message,
        error_code: "NETWORK_ERROR",
      };
    }
  },
};
