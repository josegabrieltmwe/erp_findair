import { ref, computed } from "vue";
import { storeToRefs } from "pinia";
import { useI18n } from "vue-i18n";
import { useCargoStore } from "@cargo/stores/cargo.store";
import { useCargoFlightManagerStore } from "@cargo/stores/cargo_flight_manager.store";
import { useToastStore } from "@cargo/stores/toast.store";
import type { Cargo } from "@cargo/services/cargo.types";

/**
 * Shared "reset flights" flow used from both the flight card and the manual
 * legs modal, so the two entry points behave identically.
 *
 * Full reset = cancel an active WebCargo/KLM booking (releasing AWB stock) →
 * clear the selected rate → wipe the manual legs (flight_num1..5 and the
 * departure/arrival/origin/dest columns) on spedizioni_cargo.
 *
 * The confirm dialog is driven here: `open()` shows it, `confirm()` runs the
 * cascade. When a booking is active the caller's dialog must require the
 * operator to opt in to the cancel (see `hasActiveBooking`) before enabling
 * the confirm button — cancelling a booking is destructive.
 */
export function useFlightReset() {
  const { t } = useI18n();
  const cargo = useCargoStore();
  const manager = useCargoFlightManagerStore();
  const toasts = useToastStore();
  const { cargo: cargoRow, id: cargoId } = storeToRefs(cargo);

  const dialogOpen = ref(false);
  const busy = ref(false);

  const hasActiveBooking = computed(() => manager.hasActiveBooking);
  const hasRate = computed(() => !!manager.rate);

  /** True when there is any manual leg data to clear. */
  const hasManualLegs = computed<boolean>(() => {
    const c = cargoRow.value as unknown as Record<string, unknown> | null;
    if (!c) return false;
    for (let i = 1; i <= 5; i++) {
      const num = String(c[`flight_num${i}`] ?? "");
      const dep = String(c[`flight_data${i}`] ?? "");
      const org = String(c[`flight_airp${i}`] ?? "");
      if (num || (dep && !dep.startsWith("0000-")) || org) return true;
    }
    return false;
  });

  /** True when there is anything at all to reset. */
  const hasAnything = computed(
    () => hasActiveBooking.value || hasRate.value || hasManualLegs.value,
  );

  function open(): void {
    dialogOpen.value = true;
  }
  function close(): void {
    if (!busy.value) dialogOpen.value = false;
  }

  /** Build the patch that blanks every manual leg column. */
  function emptyLegsPatch(): Partial<Cargo> {
    const patch: Record<string, unknown> = {};
    for (let i = 1; i <= 5; i++) {
      patch[`flight_num${i}`] = "";
      patch[`flight_data${i}`] = "";
      patch[`flight_datad${i}`] = "";
      patch[`flight_airp${i}`] = "";
      patch[`flight_aird${i}`] = "";
    }
    return patch as Partial<Cargo>;
  }

  /**
   * Run the reset cascade. Order matters: booking/rate FIRST (so a failed
   * booking cancel aborts before we blank the legs), legs LAST.
   *
   * `opts.clearManualLegs` decide si los tramos escritos a mano se borran.
   * Es la UNICA diferencia que queda entre las dos entradas que antes eran dos
   * botones distintos, asi que ahora es una casilla del dialogo y no otro
   * boton: el operador que metio los tramos a mano puede conservarlos al
   * soltar la tarifa, que es el unico caso en que la distincion importaba.
   */
  async function confirm(
    opts: { clearManualLegs?: boolean } = {},
  ): Promise<boolean> {
    const clearLegs = opts.clearManualLegs ?? true;
    busy.value = true;
    try {
      // 1) Booking + rate (idempotent when nothing is selected).
      if (hasActiveBooking.value || hasRate.value) {
        const ok = await manager.resetFlights({
          cancelBookingReason: t("cargo.resetflights.reason"),
        });
        if (!ok) {
          toasts.push("error", manager.error ?? t("cargo.resetflights.failed"));
          return false;
        }
      }

      // 2) Manual legs — persist immediately, bypassing the modal draft buffer.
      if (clearLegs && hasManualLegs.value) {
        const ok = await cargo.persistUpdate(emptyLegsPatch());
        if (!ok) {
          toasts.push("error", t("cargo.resetflights.failed"));
          return false;
        }
      }

      // Reload the cargo row so the UI reflects the cleared values without a
      // page refresh: persistUpdate only merges whatever the PATCH echoes back
      // (often partial, so blanked legs stay stale locally), and the flight
      // card re-hydrates off the now-empty `id_rate_webcargo`.
      if (cargoId.value) await cargo.load(Number(cargoId.value));

      toasts.push("success", t("cargo.resetflights.done"));
      dialogOpen.value = false;
      return true;
    } finally {
      busy.value = false;
    }
  }

  return {
    dialogOpen,
    busy,
    hasActiveBooking,
    hasRate,
    hasManualLegs,
    hasAnything,
    open,
    close,
    confirm,
  };
}
