import { defineStore } from "pinia";
import { i18n } from "@cargo/plugins/i18n";
import { ref, computed } from "vue";
import {
  vettoriService,
  type AwbStockItem,
  type IataAgentMetadata,
  type VettoreOption,
} from "@cargo/services/vettori.service";
import { useToastStore } from "./toast.store";

/**
 * Ephemeral state for the carrier picker + AWB stock picker on the
 * cargo detail page. Not persisted; reset between cargo loads.
 *
 * Keeps three logically separate lists:
 *   - carriers       : results of api_cargo_vettori_list
 *   - awbStock       : results of api_cargo_awb_vettori_list
 *   - agentResult    : last response from api_cargo_mawb_agent (toast confirmation)
 */
export const useVettoriStore = defineStore("vettori", () => {
  const carriers = ref<VettoreOption[]>([]);
  const awbStock = ref<AwbStockItem[]>([]);
  // id of the vettore whose stock is currently listed — needed to reserve.
  const awbStockVettoreId = ref<number>(0);
  // partner that owns that stock — needed to ask the airline for more.
  const awbStockPartnerId = ref<number>(0);
  const reservingAwb = ref(false);
  const requestingAwb = ref(false);
  /** Datos del último 429: cuándo se pidió y cuántos días dura el freno. */
  const cooldownInfo = ref<{
    last_sent_at: string;
    cooldown_days: number;
  } | null>(null);
  const agentResult = ref<{
    partner_id: number;
    rows_updated: number;
    agent: IataAgentMetadata;
  } | null>(null);

  const loadingCarriers = ref(false);
  const loadingAwbs = ref(false);
  const applyingAgent = ref(false);

  const error = ref<string | null>(null);

  const toasts = useToastStore();

  const hasCarriers = computed(() => carriers.value.length > 0);
  const hasAwbStock = computed(() => awbStock.value.length > 0);

  async function fetchCarriers(
    cargo_id: number,
    terminal_part_override?: string,
  ): Promise<void> {
    if (!cargo_id) return;
    loadingCarriers.value = true;
    error.value = null;
    try {
      const res = await vettoriService.listCarriers(
        cargo_id,
        terminal_part_override,
      );
      if (res.success && res.data) {
        carriers.value = res.data.carriers;
      } else {
        carriers.value = [];
        error.value = res.error ?? "Failed to load carriers";
        toasts.push("error", error.value);
      }
    } catch (e) {
      carriers.value = [];
      error.value = (e as Error).message;
      toasts.push("error", error.value);
    } finally {
      loadingCarriers.value = false;
    }
  }

  async function fetchAwbStock(cargo_id: number): Promise<void> {
    if (!cargo_id) return;
    loadingAwbs.value = true;
    error.value = null;
    try {
      const res = await vettoriService.listAwbStock(cargo_id);
      if (res.success && res.data) {
        awbStock.value = res.data.awbs;
        awbStockVettoreId.value = res.data.vettore?.id ?? 0;
        awbStockPartnerId.value = res.data.partner_id ?? 0;
        if (res.data.note) {
          // "No carrier selected on the cargo" → surface as an info toast,
          // not an error. The picker UI keeps the empty state with the
          // hint.
          toasts.push("info", res.data.note);
        }
      } else {
        awbStock.value = [];
        error.value = res.error ?? "Failed to load AWB stock";
        toasts.push("error", error.value);
      }
    } catch (e) {
      awbStock.value = [];
      error.value = (e as Error).message;
      toasts.push("error", error.value);
    } finally {
      loadingAwbs.value = false;
    }
  }

  async function applyIataAgent(cargo_id: number): Promise<boolean> {
    if (!cargo_id) return false;
    applyingAgent.value = true;
    error.value = null;
    try {
      const res = await vettoriService.applyIataAgent(cargo_id);
      if (res.success && res.data) {
        agentResult.value = {
          partner_id: res.data.partner_id,
          rows_updated: res.data.rows_updated,
          agent: res.data.agent,
        };
        toasts.push(
          "success",
          `IATA agent applied to ${res.data.rows_updated} AWB row(s): ${res.data.agent.issuing_carrier}`,
        );
        return true;
      }
      error.value = res.error ?? "Failed to apply IATA agent";
      toasts.push("error", error.value);
      return false;
    } catch (e) {
      error.value = (e as Error).message;
      toasts.push("error", error.value);
      return false;
    } finally {
      applyingAgent.value = false;
    }
  }

  /**
   * Reserve a specific AWB of the current vettore's stock for the cargo
   * (legacy spedyc_vtt_awb_set). Returns the reserved number on success so the
   * caller can update the AWB_forn field; the stock decrement / previous-AWB
   * release / history are handled server-side.
   */
  async function reserveAwb(
    cargo_id: number,
    awb: string,
  ): Promise<string | null> {
    if (!cargo_id || !awb) return null;
    const id_vettore = awbStockVettoreId.value;
    if (id_vettore <= 0) {
      toasts.push("error", i18n.global.t("cargo.toast.no_carrier_awb"));
      return null;
    }
    reservingAwb.value = true;
    error.value = null;
    try {
      const res = await vettoriService.reserveAwb(cargo_id, id_vettore, awb);
      if (res.success) {
        // Drop the reserved number from the local stock list.
        awbStock.value = awbStock.value.filter((a) => a.awb !== awb);
        toasts.push("success", `AWB ${awb} reserved`);
        return res.awb ?? awb;
      }
      error.value = res.error ?? "AWB reservation failed";
      toasts.push("error", error.value);
      return null;
    } catch (e) {
      error.value = (e as Error).message;
      toasts.push("error", error.value);
      return null;
    } finally {
      reservingAwb.value = false;
    }
  }

  /**
   * Pedir a la aerolínea que asigne nuevos AWB al partner. No cambia el stock
   * — sale un email y la aerolínea responde fuera del sistema.
   */
  async function requestAwbStock(payload: {
    id_vettore: number;
    partner_id: number;
    qty?: number;
    note?: string;
    extra_to?: string[];
    force?: boolean;
  }): Promise<boolean | "cooldown"> {
    if (!payload.id_vettore || !payload.partner_id) return false;
    requestingAwb.value = true;
    cooldownInfo.value = null;
    error.value = null;
    try {
      const res = await vettoriService.requestAwbStock(payload);
      if (res.success && res.data) {
        toasts.push(
          "success",
          i18n.global.t("cargo.awb_request.sent", { to: res.data.sent_to }),
        );
        // Sin plantilla configurada salió el texto por defecto: se avisa para
        // que alguien la cree, pero el email YA se envió.
        if (res.data.used_fallback) {
          toasts.push("info", i18n.global.t("cargo.awb_request.no_template"));
        }
        return true;
      }
      error.value = res.error ?? "AWB request failed";
      toasts.push("error", error.value);
      return false;
    } catch (e) {
      // 429 = enfriamiento, no un fallo. Se devuelve como estado propio para
      // que el diálogo ofrezca "enviar igualmente" en vez de un toast rojo:
      // el operador no ha hecho nada mal, solo se le está evitando repetir el
      // mismo correo a la aerolínea.
      const err = e as { status?: number; payload?: unknown; message?: string };
      if (err?.status === 429) {
        const d = (err.payload as { details?: Record<string, unknown> })
          ?.details;
        cooldownInfo.value = {
          last_sent_at: String(d?.last_sent_at ?? ""),
          cooldown_days: Number(d?.cooldown_days ?? 0),
        };
        return "cooldown";
      }
      error.value = (e as Error).message;
      toasts.push("error", error.value);
      return false;
    } finally {
      requestingAwb.value = false;
    }
  }

  function reset(): void {
    carriers.value = [];
    awbStock.value = [];
    awbStockVettoreId.value = 0;
    awbStockPartnerId.value = 0;
    agentResult.value = null;
    error.value = null;
  }

  return {
    // state
    carriers,
    awbStock,
    awbStockVettoreId,
    awbStockPartnerId,
    agentResult,
    loadingCarriers,
    loadingAwbs,
    applyingAgent,
    reservingAwb,
    requestingAwb,
    cooldownInfo,
    error,
    // getters
    hasCarriers,
    hasAwbStock,
    // actions
    fetchCarriers,
    fetchAwbStock,
    applyIataAgent,
    reserveAwb,
    requestAwbStock,
    reset,
  };
});
