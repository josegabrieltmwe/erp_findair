import { computed, toValue, type MaybeRefOrGetter } from "vue";
import { useI18n } from "vue-i18n";
import type { Cargo } from "@cargo/services/cargo.types";

export type ChipColor =
  | "primary"
  | "secondary"
  | "success"
  | "warning"
  | "error"
  | "info"
  | "default";

export interface CargoBadge {
  label: string;
  color: ChipColor;
  icon?: string;
  hint?: string;
}

export function useCargoStatus(cargo: MaybeRefOrGetter<Cargo | null>) {
  const { t } = useI18n();
  const badges = computed<CargoBadge[]>(() => {
    const s = toValue(cargo);
    if (!s) return [];
    const out: CargoBadge[] = [];

    // Invoiced state (cargo equivalent of giafatt).
    if (Number(s.id_fattura_a ?? 0) > 0 && (s.AWB_forn ?? "") !== "") {
      out.push({
        label: t("cargo.badge.invoiced", { id: s.id_fattura_a }),
        color: "success",
        icon: "mdi-receipt-text-check",
        hint: t("cargo.badge.invoiced_hint"),
      });
    } else if (Number(s.id_fattura_a ?? 0) > 0) {
      out.push({
        label: t("cargo.badge.invoice", { id: s.id_fattura_a }),
        color: "info",
        icon: "mdi-receipt-text",
      });
    } else {
      out.push({
        label: t("cargo.badge.draft"),
        color: "default",
        icon: "mdi-file-document-edit-outline",
      });
    }

    // MAWB assigned?
    if ((s.AWB_forn ?? "") !== "") {
      out.push({
        label: t("cargo.badge.mawb", { awb: s.AWB_forn }),
        color: "primary",
        icon: "mdi-airplane",
        hint: t("cargo.badge.mawb_hint"),
      });
    }

    // Quote/offer workflow status (gestione + offerta).
    const offer = (s.offerta ?? "") as string;
    if (offer === "S") {
      out.push({
        label: t("cargo.badge.offer_sent"),
        color: "info",
        icon: "mdi-email-arrow-right-outline",
      });
    } else if (offer === "N") {
      out.push({
        label: t("cargo.badge.quote_pending"),
        color: "warning",
        icon: "mdi-clock-outline",
      });
    }

    // Delivery state.
    const delivered = s.consegna_data ?? "";
    if (delivered && delivered !== "0000-00-00 00:00:00") {
      out.push({
        label: t("cargo.badge.delivered"),
        color: "success",
        icon: "mdi-check-circle",
        hint: t("cargo.badge.delivered_hint", { date: delivered }),
      });
    }

    // Controllata.
    const controllata = (s.controllata ?? "") as string;
    if (controllata === "O") {
      out.push({
        label: t("cargo.badge.offer"),
        color: "warning",
        icon: "mdi-tag-outline",
      });
    } else if (controllata === "N") {
      out.push({
        label: t("cargo.badge.not_checked"),
        color: "warning",
        icon: "mdi-alert-circle-outline",
      });
    }

    // Archived.
    if (s.archiviata === "S") {
      out.push({
        label: t("cargo.badge.archived"),
        color: "default",
        icon: "mdi-archive",
      });
    }

    // Bad address.
    if (s.badaddress === "S") {
      out.push({
        label: t("cargo.badge.bad_address"),
        color: "error",
        icon: "mdi-map-marker-alert",
      });
    }

    // Webcargo rate linkage.
    if (s.id_rate_webcargo && Number(s.id_rate_webcargo) > 0) {
      out.push({
        label: t("cargo.badge.webcargo_rate"),
        color: "info",
        icon: "mdi-cloud-outline",
      });
    }

    return out;
  });

  /** Composite state used by useCargoState for readonly logic. */
  const giafatt = computed<boolean>(() => {
    const s = toValue(cargo);
    if (!s) return false;
    return Number(s.id_fattura_a ?? 0) > 0 && (s.AWB_forn ?? "") !== "";
  });

  const postFatturated = computed<boolean>(() => {
    const s = toValue(cargo);
    if (!s) return false;
    return Number(s.id_fattura_a2 ?? 0) > 0;
  });

  return { badges, giafatt, postFatturated };
}
