import { defineStore } from "pinia";
import { ref } from "vue";
import {
  serviceSelectionService,
  type ClientServiceOption,
  type FornitoreServiceOption,
  type RateDebugTrace,
} from "@shipment/services/service_selection.service";
import { fornitoriService } from "@shipment/services/fornitori.service";
import { useShipmentStore } from "./shipment.store";
import { useToastStore } from "./toast.store";

/**
 * WS-S-O — Pinia store for the service selection flow.
 *
 * Owns:
 *   - the cached lists of client services (carico) and fornitore services (costo)
 *   - the loading / selecting flags so buttons can disable themselves
 *   - the cascade method that calls /api_express_service_select and
 *     refreshes the shipment store
 *
 * Does NOT own:
 *   - the current shipment id (read from useShipmentStore)
 *   - the toast notifications (delegates to useToastStore)
 */
export const useServiceSelectionStore = defineStore("service_selection", () => {
  const clientServices = ref<ClientServiceOption[]>([]);
  const fornitoreServices = ref<FornitoreServiceOption[]>([]);
  const loadingClient = ref(false);
  const loadingFornitore = ref(false);
  const selecting = ref(false);
  const error = ref<string | null>(null);

  const shipmentStore = useShipmentStore();
  const toasts = useToastStore();

  async function loadClient(
    shipment_id: number,
    includeUnavailable = false,
  ): Promise<void> {
    loadingClient.value = true;
    error.value = null;
    try {
      const r = await serviceSelectionService.listClient(shipment_id, {
        include_unavailable: includeUnavailable,
      });
      if (r.success && r.data) {
        clientServices.value = r.data.services;
      } else {
        error.value = r.error ?? "Failed to load client services";
        clientServices.value = [];
      }
    } catch (e) {
      error.value = (e as Error).message;
      clientServices.value = [];
    } finally {
      loadingClient.value = false;
    }
  }

  async function loadFornitore(
    shipment_id: number,
    includeUnavailable = false,
  ): Promise<void> {
    loadingFornitore.value = true;
    error.value = null;
    try {
      const r = await serviceSelectionService.listFornitore(shipment_id, {
        include_unavailable: includeUnavailable,
      });
      if (r.success && r.data) {
        // The endpoint may return either grouped-by-fornitore or a flat list;
        // accept both shapes.
        const raw = r.data.services as unknown[];
        if (raw.length > 0 && (raw[0] as { services?: unknown }).services) {
          fornitoreServices.value = raw as FornitoreServiceOption[];
        } else {
          // Flat — group locally by fornitore_id.
          const grouped = new Map<number, FornitoreServiceOption>();
          for (const item of raw as Array<Record<string, unknown>>) {
            const fid = Number(item.fornitore_id ?? item.id_fornitore ?? 0);
            if (!grouped.has(fid)) {
              grouped.set(fid, {
                fornitore_id: fid,
                fornitore_name: String(
                  item.fornitore_name ?? item.fornitore ?? `#${fid}`,
                ),
                services: [],
              });
            }
            grouped.get(fid)!.services.push({
              id_servizio_fornitore: Number(item.id_servizio_fornitore ?? 0),
              description: String(item.description ?? item.service_name ?? ""),
              cost: Number(item.cost ?? item.price ?? 0),
              fuel_surcharge: Number(item.fuel_surcharge ?? 0),
              currency: String(item.currency ?? "EUR"),
              available: item.available !== false,
            });
          }
          fornitoreServices.value = Array.from(grouped.values());
        }
      } else {
        error.value = r.error ?? "Failed to load fornitore services";
        fornitoreServices.value = [];
      }
    } catch (e) {
      error.value = (e as Error).message;
      fornitoreServices.value = [];
    } finally {
      loadingFornitore.value = false;
    }
  }

  /**
   * Persist client service selection + cascade to fornitore. The backend
   * does the heavy lifting (rate engine + supplementi). We just refresh
   * the shipment store after the call returns.
   */
  async function selectAndCascade(
    shipment_id: number,
    service_id: number,
    fornitore_id?: number,
  ): Promise<boolean> {
    selecting.value = true;
    try {
      const r = await serviceSelectionService.select(
        shipment_id,
        service_id,
        fornitore_id,
      );
      if (r.success) {
        toasts.push(
          "success",
          `Servicio asignado${r.data?.service?.description ? ": " + r.data.service.description : ""}`,
        );
        if (r.data?.price_locked) {
          toasts.push(
            "info",
            "Carico bloqueado por lock — precio cliente no recalculado",
          );
        }
        await shipmentStore.load(shipment_id);
        return true;
      }
      toasts.push("error", r.error ?? r.error_code ?? "Selection failed");
      return false;
    } catch (e) {
      toasts.push("error", (e as Error).message);
      return false;
    } finally {
      selecting.value = false;
    }
  }

  /**
   * Asignación MANUAL de un servicio del courier (click en una fila de la tabla
   * de fornitori). Paridad legacy `FornSet` → spedy_update_forn_set.php:
   * persiste id_fornitore + id_servizio_fornitore (= id de la fila) + los
   * costes de ESA fila, y NO toca id_servizio (el comercial se mantiene).
   *
   * Es distinto de `selectAndCascade` (que parte del servicio COMERCIAL y deja
   * que el motor elija el courier): aquí el usuario elige explícitamente el
   * servicio courier, así que se asigna tal cual el de la fila clicada.
   */
  async function assignFornitoreService(
    shipment_id: number,
    fornitore_id: number,
    svc: {
      id_servizio_fornitore: number;
      cost?: number;
      fuel_surcharge?: number;
      currency?: string;
      zone_code?: string;
    },
  ): Promise<boolean> {
    selecting.value = true;
    try {
      const r = await fornitoriService.setService(shipment_id, {
        id_fornitore: fornitore_id,
        id_servizio_fornitore: svc.id_servizio_fornitore,
        cst: svc.cost,
        fuel: svc.fuel_surcharge,
        prvl: svc.currency,
        apizona: svc.zone_code,
      });
      if (r.success && !r.etxt) {
        toasts.push("success", "Servicio del courier asignado");
        await shipmentStore.load(shipment_id);
        return true;
      }
      toasts.push("error", r.etxt || r.error || "Selection failed");
      return false;
    } catch (e) {
      toasts.push("error", (e as Error).message);
      return false;
    } finally {
      selecting.value = false;
    }
  }

  async function clear(shipment_id: number): Promise<boolean> {
    selecting.value = true;
    try {
      const r = await serviceSelectionService.clear(shipment_id);
      if (r.success) {
        toasts.push("success", "Service cleared");
        await shipmentStore.load(shipment_id);
        return true;
      }
      toasts.push("error", r.error ?? "Clear failed");
      return false;
    } catch (e) {
      toasts.push("error", (e as Error).message);
      return false;
    } finally {
      selecting.value = false;
    }
  }

  function reset(): void {
    clientServices.value = [];
    fornitoreServices.value = [];
    error.value = null;
  }

  // ─── Price-derivation trace (legacy DebugPrezzo) ──────────────────────────
  const debugOpen = ref(false);
  const debugLoading = ref(false);
  const debugServiceName = ref("");
  const debugTrace = ref<RateDebugTrace | null>(null);

  /**
   * Fetch the step-by-step pricing trace for one client service and open the
   * panel. Lists with debug=true (which forces a recalc, since cached results
   * carry no trace) and extracts the requested service's trace.
   */
  async function explainClientPrice(
    shipment_id: number,
    service_id: number,
    service_name: string,
  ): Promise<void> {
    debugServiceName.value = service_name;
    debugTrace.value = null;
    debugOpen.value = true;
    debugLoading.value = true;
    try {
      const r = await serviceSelectionService.listClient(shipment_id, {
        include_unavailable: true,
        debug: true,
      });
      if (r.success && r.data) {
        const svc = r.data.services.find((s) => s.service_id === service_id);
        debugTrace.value = svc?.debug_trace ?? null;
      }
    } catch (e) {
      error.value = (e as Error).message;
    } finally {
      debugLoading.value = false;
    }
  }

  /**
   * Fetch the step-by-step pricing trace for one FORNITORE child service and
   * open the panel (legacy DebugPrezzo quale=F). Mirrors explainClientPrice.
   */
  async function explainFornitorePrice(
    shipment_id: number,
    fornitore_id: number,
    id_servizio_fornitore: number,
    service_name: string,
  ): Promise<void> {
    debugServiceName.value = service_name;
    debugTrace.value = null;
    debugOpen.value = true;
    debugLoading.value = true;
    try {
      const r = await serviceSelectionService.listFornitore(shipment_id, {
        include_unavailable: true,
        debug: true,
      });
      if (r.success && r.data) {
        const groups = (r.data.services ?? []) as FornitoreServiceOption[];
        const grp = groups.find((g) => g.fornitore_id === fornitore_id);
        const svc = grp?.services.find(
          (s) => Number(s.id_servizio_fornitore) === id_servizio_fornitore,
        );
        debugTrace.value =
          (svc?.debug_trace as RateDebugTrace | undefined) ?? null;
      }
    } catch (e) {
      error.value = (e as Error).message;
    } finally {
      debugLoading.value = false;
    }
  }

  return {
    clientServices,
    fornitoreServices,
    loadingClient,
    loadingFornitore,
    selecting,
    error,
    loadClient,
    loadFornitore,
    selectAndCascade,
    assignFornitoreService,
    clear,
    reset,
    debugOpen,
    debugLoading,
    debugServiceName,
    debugTrace,
    explainClientPrice,
    explainFornitorePrice,
  };
});
