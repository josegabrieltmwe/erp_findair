import { computed, toValue, type MaybeRefOrGetter } from "vue";
import type { Shipment } from "@shipment/services/shipment.types";

export type ChipColor =
  | "primary"
  | "secondary"
  | "success"
  | "warning"
  | "error"
  | "info"
  | "default";

export interface StatusBadge {
  label: string;
  color: ChipColor;
  icon?: string;
  /** Optional tooltip describing the underlying state. */
  hint?: string;
}

/**
 * Derives a list of semantic status badges from the shipment payload. The
 * SPA renders them as v-chips in the sticky header so the user sees the
 * shipment lifecycle at a glance.
 */
export function useShipmentStatus(shipment: MaybeRefOrGetter<Shipment | null>) {
  const badges = computed<StatusBadge[]>(() => {
    const s = toValue(shipment);
    if (!s) return [];
    const out: StatusBadge[] = [];

    // Invoiced state (highest priority — drives readonly behaviour).
    if (Number(s.id_fattura_a ?? 0) > 0 && (s.AWB_forn ?? "") !== "") {
      out.push({
        label: `Invoiced #${s.id_fattura_a}`,
        color: "success",
        icon: "mdi-receipt-text-check",
        hint: "Fattura emessa — form fields are locked",
      });
    } else if (Number(s.id_fattura_a ?? 0) > 0) {
      out.push({
        label: `Invoice #${s.id_fattura_a}`,
        color: "info",
        icon: "mdi-receipt-text",
      });
    } else {
      out.push({
        label: "Draft",
        color: "default",
        icon: "mdi-file-document-edit-outline",
      });
    }

    // AWB / tracking number.
    if ((s.AWB_forn ?? "") !== "") {
      out.push({
        label: `AWB ${s.AWB_forn}`,
        color: "primary",
        icon: "mdi-package-variant-closed",
        hint: "Air waybill assigned by the courier",
      });
    }

    // Pickup state.
    const presaTipo = (s.presa_tipo ?? "0") as string;
    if (presaTipo === "T") {
      out.push({
        label: "Triangulation",
        color: "info",
        icon: "mdi-vector-triangle",
      });
    } else if (presaTipo === "S") {
      out.push({ label: "From sede", color: "default", icon: "mdi-warehouse" });
    }

    // Delivery state.
    const consegna = s.consegna_data ?? "";
    if (consegna && consegna !== "0000-00-00 00:00:00") {
      out.push({
        label: "Delivered",
        color: "success",
        icon: "mdi-check-circle",
        hint: `On ${consegna}`,
      });
    }

    // Controllata flag.
    const controllata = (s.controllata ?? "") as string;
    if (controllata === "O") {
      out.push({ label: "Offer", color: "warning", icon: "mdi-tag-outline" });
    } else if (controllata === "N") {
      out.push({
        label: "Not checked",
        color: "warning",
        icon: "mdi-alert-circle-outline",
      });
    }

    // Cost to verify.
    if (s.costo_daverif === "S") {
      out.push({
        label: "Cost to check",
        color: "warning",
        icon: "mdi-cash-clock",
      });
    }

    // Archived.
    if (s.archiviata === "S") {
      out.push({ label: "Archived", color: "default", icon: "mdi-archive" });
    }

    // Bad address flag.
    if (s.badaddress === "S") {
      out.push({
        label: "Bad address",
        color: "error",
        icon: "mdi-map-marker-alert",
      });
    }

    // Remote area cost flag.
    if (s.acc_aree_remote === "S") {
      out.push({
        label: "Remote area",
        color: "warning",
        icon: "mdi-map-marker-radius",
      });
    }

    return out;
  });

  /** Single-line summary text used in toolbar / page title. */
  const headline = computed<string>(() => {
    const s = toValue(shipment);
    if (!s) return "";
    const courier = (s.AWB_forn ?? "").slice(0, 18);
    const cliente = (s.cliente ?? "").slice(0, 28);
    if (courier && cliente) return `${cliente} — ${courier}`;
    if (cliente) return cliente;
    return `Shipment #${s.id ?? ""}`;
  });

  return { badges, headline };
}
