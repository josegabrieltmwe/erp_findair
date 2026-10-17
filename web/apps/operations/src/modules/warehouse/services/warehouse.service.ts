/**
 * warehouse.service — pesaje, Doctor Pack, carga del autista, entregas y
 * manifiestos. Endpoints (respuestas `{ success, data, pagination? }`):
 *   GET/POST api_docpack_validation   escaneo, huérfanos, asociar, registrar
 *   GET/PUT/POST api_docpack_parcels  bultos, pesaje, impresión, autista
 *   GET api_docpack_completeness      completitud por envío / por día
 *   GET api_driver_routes             autistas del día
 *   GET api_driver_manifest           borderò (solo admin interno)
 *   GET api_driver_delivery           verificación de LDV
 *   POST api_driver_pod               firma de entrega
 *   GET api_manifest_history          histórico de manifiestos
 *   POST api_brt_manifest             manifiesto BRT
 */
import { trackingStatusesService } from "@shared/tracking_statuses/services/trackingStatuses.service";
import { http } from "./http";
import type {
  BrtManifestResult,
  Completeness,
  CompletenessItem,
  DriverLoading,
  DriverRef,
  Envelope,
  LdvInfo,
  ManifestHistory,
  Parcel,
  PendingClients,
  PendingShipments,
  PodRequest,
  PodResult,
  TrackingStatusLite,
  ValidationResult,
} from "../types";
import type { WeighValues } from "../logic";
import type { Manifest } from "../../pickup/types";

export const VALIDATION = "/api_docpack_validation";
export const PARCELS = "/api_docpack_parcels";
export const COMPLETENESS = "/api_docpack_completeness";

export const warehouseApi = {
  // --- escaneo / validación ---
  async lookup(sticker: string): Promise<ValidationResult> {
    const r = await http<Envelope<ValidationResult>>(VALIDATION, {
      method: "GET",
      query: { sticker },
    });
    return r.data;
  },

  /** Clientes con envíos cuyas LDV aún no se han impreso (PackMaster). */
  async pendingClients(days?: number): Promise<PendingClients> {
    const query: Record<string, string | number> = { pending: "clients" };
    if (days) query.days = days;
    const r = await http<Envelope<PendingClients>>(VALIDATION, {
      method: "GET",
      query,
    });
    return { days: r.data?.days ?? days ?? 7, clients: r.data?.clients ?? [] };
  },

  async pendingShipments(clientId: number, days?: number): Promise<PendingShipments> {
    const query: Record<string, string | number> = {
      pending: "shipments",
      client_id: clientId,
    };
    if (days) query.days = days;
    const r = await http<Envelope<PendingShipments>>(VALIDATION, {
      method: "GET",
      query,
    });
    return {
      days: r.data?.days ?? days ?? 7,
      client_id: r.data?.client_id ?? clientId,
      shipments: r.data?.shipments ?? [],
    };
  },

  async listOrphans(
    page: number,
    perPage: number,
    stickerFilter?: string,
  ): Promise<{ items: Parcel[]; total: number }> {
    const query: Record<string, string | number> = {
      orphans: 1,
      page,
      per_page: perPage,
    };
    if (stickerFilter?.trim()) query.sticker_filter = stickerFilter.trim();
    const r = await http<Envelope<Parcel[]>>(VALIDATION, {
      method: "GET",
      query,
    });
    return {
      items: Array.isArray(r.data) ? r.data : [],
      total: r.pagination?.total ?? 0,
    };
  },

  async registerOrphan(
    sticker: string,
    v: WeighValues,
  ): Promise<Envelope<unknown>> {
    return http<Envelope<unknown>>(VALIDATION, {
      method: "POST",
      body: { action: "register", sticker, ...v },
    });
  },

  async associate(orphanId: number, shipmentId: number): Promise<unknown> {
    const r = await http<Envelope<unknown>>(VALIDATION, {
      method: "POST",
      body: { action: "associate", orphan_id: orphanId, shipment_id: shipmentId },
    });
    return r.data;
  },

  // --- pesaje ---
  async weighParcel(id: number, v: WeighValues): Promise<unknown> {
    const r = await http<Envelope<unknown>>(PARCELS, {
      method: "PUT",
      body: {
        id,
        peso: v.peso,
        dim_a: v.dim_a,
        dim_l: v.dim_l,
        dim_p: v.dim_p,
      },
    });
    return r.data;
  },

  async weighDocument(id: number, v: WeighValues): Promise<unknown> {
    const parcel: Record<string, unknown> = { id, peso: v.peso, tipo: "D" };
    if (v.dim_a) parcel.dim_a = v.dim_a;
    if (v.dim_l) parcel.dim_l = v.dim_l;
    if (v.dim_p) parcel.dim_p = v.dim_p;
    const r = await http<Envelope<unknown>>(PARCELS, {
      method: "POST",
      body: { action: "batch_weigh", parcels: [parcel] },
    });
    return r.data;
  },

  // --- completitud ---
  async completeness(shipmentId: number): Promise<Completeness> {
    const r = await http<Envelope<Completeness>>(COMPLETENESS, {
      method: "GET",
      query: { shipment_id: shipmentId },
    });
    return r.data;
  },

  async completenessByDate(
    date: string,
    incompleteOnly = false,
  ): Promise<CompletenessItem[]> {
    const query: Record<string, string> = { date };
    if (incompleteOnly) query.status = "incomplete";
    const r = await http<Envelope<CompletenessItem[]>>(COMPLETENESS, {
      method: "GET",
      query,
    });
    return Array.isArray(r.data) ? r.data : [];
  },

  async shipmentParcels(shipmentId: number): Promise<Parcel[]> {
    const r = await http<Envelope<Parcel[]>>(PARCELS, {
      method: "GET",
      query: { shipment_id: shipmentId },
    });
    return Array.isArray(r.data) ? r.data : [];
  },

  async autoMatch(shipmentId: number): Promise<unknown> {
    const r = await http<Envelope<unknown>>(PARCELS, {
      method: "POST",
      body: { action: "auto_match", shipment_id: shipmentId },
    });
    return r.data;
  },

  async markPrinted(parcelIds: number[]): Promise<unknown> {
    const r = await http<Envelope<unknown>>(PARCELS, {
      method: "POST",
      body: { action: "mark_printed", parcel_ids: parcelIds },
    });
    return r.data;
  },

  // --- carga del autista ---
  async driversForDate(date: string): Promise<DriverRef[]> {
    const r = await http<Envelope<{ drivers: DriverRef[] }>>("/api_driver_routes", {
      method: "GET",
      query: { date },
    });
    return r.data?.drivers ?? [];
  },

  async driverLoading(driverId: number, date: string): Promise<DriverLoading> {
    const r = await http<Envelope<DriverLoading>>(PARCELS, {
      method: "GET",
      query: { driver_id: driverId, date },
    });
    return r.data;
  },

  async assignDriver(parcelIds: number[], driverId: number): Promise<unknown> {
    const r = await http<Envelope<unknown>>(PARCELS, {
      method: "POST",
      body: { action: "assign_driver", parcel_ids: parcelIds, driver_id: driverId },
    });
    return r.data;
  },

  async clearDriverLoading(driverId: number, date: string): Promise<unknown> {
    const r = await http<Envelope<unknown>>(PARCELS, {
      method: "POST",
      body: {
        action: "clear_driver_loading",
        driver_id: driverId,
        date,
        confirm: true,
      },
    });
    return r.data;
  },

  async driverManifest(driverId: number, date: string): Promise<Manifest> {
    const r = await http<Envelope<Manifest>>("/api_driver_manifest", {
      method: "GET",
      query: { driver_id: driverId, date },
    });
    return r.data;
  },

  // --- entregas ---
  async verifyLdv(ldv: string): Promise<LdvInfo> {
    const r = await http<Envelope<LdvInfo>>("/api_driver_delivery", {
      method: "GET",
      query: { ldv },
    });
    return r.data;
  },

  async registerPod(p: PodRequest): Promise<PodResult> {
    const r = await http<Envelope<PodResult>>("/api_driver_pod", {
      method: "POST",
      body: p,
    });
    return r.data;
  },

  /** Estados de tracking (catálogo compartido de /settings/tracking-statuses). */
  async trackingStatuses(): Promise<TrackingStatusLite[]> {
    const out: TrackingStatusLite[] = [];
    for (let page = 1; page <= 20; page++) {
      const res = await trackingStatusesService.list(page);
      out.push(...res.items);
      if (page >= res.pages || res.items.length === 0) break;
    }
    return out;
  },

  // --- manifiestos ---
  async manifestHistory(q: {
    date: string;
    carrier?: string;
    page: number;
    perPage: number;
  }): Promise<ManifestHistory> {
    const query: Record<string, string | number> = {
      date: q.date,
      page: q.page,
      per_page: q.perPage,
    };
    if (q.carrier?.trim()) query.carrier = q.carrier.trim();
    const r = await http<Envelope<ManifestHistory>>("/api_manifest_history", {
      method: "GET",
      query,
    });
    const d = r.data;
    return { ...d, items: d?.items ?? [] };
  },

  async generateBrt(shipmentIds: number[]): Promise<BrtManifestResult> {
    const r = await http<Envelope<BrtManifestResult>>("/api_brt_manifest", {
      method: "POST",
      body: { shipment_ids: shipmentIds },
    });
    return r.data;
  },
};
