import { defineStore } from "pinia";
import { i18n } from "@cargo/plugins/i18n";
import { ref, computed } from "vue";
import { useEntityCreate } from "@tmwe/shared-frontend/composables/useEntityCreate";
import {
  cargoService,
  packagesService,
  cargoAddressesService,
  type CargoAddress,
  type CargoAddressTipo,
  type CargoSede,
} from "@cargo/services/cargo.service";
import { http } from "@cargo/services/http";
import { anagraficaService } from "@cargo/services/anagrafica.service";
import { useToastStore } from "./toast.store";
import type { Cargo, CargoPackage } from "@cargo/services/cargo.types";
import { useCargoState } from "@cargo/composables/useCargoState";
import { validateDraft } from "@cargo/validation/cargoRules";

export const useCargoStore = defineStore("cargo", () => {
  const cargo = ref<Cargo | null>(null);
  const packages = ref<CargoPackage[]>([]);
  const destination = ref<CargoAddress | null>(null);
  const pickup = ref<CargoAddress | null>(null);
  const agency = ref<CargoAddress | null>(null);
  const handler = ref<CargoAddress | null>(null);
  /** Sede interna del cliente: origen del cargo cuando no hay presa propia. */
  const sede = ref<CargoSede | null>(null);
  /** true si el origen se hereda de la sede (no existe fila de presa activa). */
  const usesSedeAddress = ref(false);
  const loading = ref(false);
  const saving = ref(false);
  const error = ref<string | null>(null);
  /** Machine-readable code of the last load failure. `NOT_FOUND` = cargo
   *  missing / soft-deleted / no access — a permanent state the UI shows
   *  without a (pointless) retry button. */
  const errorCode = ref<string | null>(null);
  /** Resolved client display name. Hydrated separately because the cargo
   *  payload does not embed `cliente` (only `id_cliente`). */
  const clientName = ref<string>("");

  const id = computed<number | null>(() =>
    cargo.value ? Number(cargo.value.id) : null,
  );

  const toasts = useToastStore();

  // ─── Draft scope (edit-in-buffer + Save, no autosave) ─────────────────
  // While a modal is open we collect edits in a BUFFER instead of hitting the
  // backend on every blur. `cargo.value` is updated optimistically so the UI
  // stays live, but nothing is persisted until `commitDraft()`. Cancelling
  // reverts to the snapshot taken in `beginDraft()`.
  //
  // Scope: only scalar `Cargo` fields (the columns of `spedizioni_cargo`).
  // Sub-flows that own their own store + endpoint — charges
  // (cargoChargesStore), addresses, packages, HAWB, flight legs — are NOT
  // routed through the draft; they keep their own save semantics.
  const draftActive = ref(false);
  const draftPatch = ref<Partial<Cargo>>({});
  const draftSnapshot = ref<Cargo | null>(null);
  /** Field → message map produced by the last failed commit (for the modal). */
  const lastDraftErrors = ref<Record<string, string>>({});

  // Lock helper, reused from the box readonly logic so the draft never tries
  // to persist (or block on) fields that are read-only by cargo state.
  // `useCargoState` wants a ComputedRef, so wrap the plain ref.
  const { readonly: isFieldLocked } = useCargoState(
    computed(() => cargo.value),
  );

  const isDraftDirty = computed(() => Object.keys(draftPatch.value).length > 0);

  /** Open a buffered edit scope. No-op if one is already active. */
  function beginDraft(): void {
    if (draftActive.value) return;
    draftSnapshot.value = cargo.value ? { ...cargo.value } : null;
    draftPatch.value = {};
    draftActive.value = true;
  }

  /** Internal: the real persistence path (shared by `update` + `commitDraft`). */
  async function persistUpdate(patch: Partial<Cargo>): Promise<boolean> {
    if (!id.value) return false;
    saving.value = true;
    try {
      const res = await cargoService.update(id.value, patch);
      if (!res.success) {
        toasts.push("error", res.error ?? "Update failed");
        return false;
      }
      if (res.data) {
        cargo.value = { ...cargo.value, ...res.data };
      }

      // El backend acepta la peticion (success:true) aunque descarte campos:
      // los que no estan en la whitelist salen en `ignored_fields` y los que
      // protege un candado en `blocked_by_lock`. Sin mostrarlos, un campo que
      // no se guarda es INVISIBLE — el toast dice "guardado", el input mantiene
      // el valor en local y solo al recargar se ve que no se persistio.
      //
      // `action` se filtra: es el discriminador de ruta del propio ERP, no un
      // campo que el operador haya intentado guardar.
      const meta = res as unknown as {
        ignored_fields?: string[];
        blocked_by_lock?: string[];
      };
      const ignored = (meta.ignored_fields ?? []).filter((f) => f !== "action");
      const blocked = meta.blocked_by_lock ?? [];

      if (blocked.length) {
        toasts.push(
          "warning",
          i18n.global.t("cargo.toast.blocked_by_lock", {
            fields: blocked.join(", "),
          }),
        );
      } else if (ignored.length) {
        toasts.push(
          "warning",
          i18n.global.t("cargo.toast.ignored_fields", {
            fields: ignored.join(", "),
          }),
        );
      } else {
        toasts.push("success", i18n.global.t("cargo.toast.saved"));
      }
      return true;
    } catch (err) {
      toasts.push("error", (err as Error).message);
      return false;
    } finally {
      saving.value = false;
    }
  }

  /**
   * Draft creation — POST /unified_cargo_shipment, returns the new id
   * (backend key `shipment_id`). The generic flow lives in the shared
   * useEntityCreate composable; here we only bind the app http + toast.
   */
  const { saving: creating, create: createDraft } = useEntityCreate<
    { customer_id: number } & Record<string, unknown>
  >({
    http,
    endpoint: "/unified_cargo_shipment",
    idKey: "shipment_id",
    onError: (msg) => toasts.push("error", msg),
  });

  async function create(
    customerId: number,
    extra: Record<string, unknown> = {},
  ): Promise<number | null> {
    return createDraft({ customer_id: customerId, ...extra });
  }

  async function load(cargoId: number): Promise<void> {
    loading.value = true;
    error.value = null;
    errorCode.value = null;
    clientName.value = "";
    destination.value = null;
    pickup.value = null;
    agency.value = null;
    handler.value = null;
    try {
      const res = await cargoService.load(cargoId);
      if (!res.success || !res.data) {
        error.value = res.error ?? "Failed to load cargo shipment";
        errorCode.value = res.error_code ?? null;
        cargo.value = null;
        return;
      }
      cargo.value = res.data;

      // Parallelize the secondary lookups — they are independent.
      const [anag, pkgRes, addrRes] = await Promise.all([
        Number(res.data.id_cliente ?? 0) > 0
          ? anagraficaService.getById(Number(res.data.id_cliente))
          : Promise.resolve(null),
        packagesService.list(cargoId),
        cargoAddressesService.list(cargoId),
      ]);
      if (anag) clientName.value = String(anag.rag_soc ?? "");
      packages.value =
        pkgRes.success && pkgRes.data ? pkgRes.data.packages : [];
      if (addrRes.success && addrRes.data) {
        destination.value = addrRes.data.destination;
        pickup.value = addrRes.data.pickup;
        agency.value = addrRes.data.agency;
        handler.value = addrRes.data.handler;
      }
    } catch (err) {
      error.value = (err as Error).message;
      // The shared http client throws ApiError on non-2xx, carrying the
      // backend error_code. A 404 (missing) or 403 (soft-deleted stato='O'
      // / no access) is a permanent state, so surface the code — the page
      // uses it to show a "cannot open this cargo" notice without a retry.
      // Duck-type instead of `instanceof ApiError`: the bundler can end up
      // with two copies of the ApiError class (app vs shared chunk), which
      // makes instanceof silently false.
      const e = err as { status?: number; errorCode?: string };
      if (typeof e.status === "number") {
        errorCode.value =
          e.errorCode ?? (e.status === 404 ? "NOT_FOUND" : null);
      }
      cargo.value = null;
    } finally {
      loading.value = false;
    }
  }

  async function update(patch: Partial<Cargo>): Promise<boolean> {
    if (!id.value) return false;
    // Draft mode: buffer the edit + apply optimistically, do NOT persist.
    // Boxes call `update()` on blur exactly as before; the draft scope
    // (opened by ModalWrapper) transparently turns that into a buffered edit.
    if (draftActive.value) {
      cargo.value = { ...(cargo.value as Cargo), ...patch };
      draftPatch.value = { ...draftPatch.value, ...patch };
      return true;
    }
    return persistUpdate(patch);
  }

  /**
   * Validate + persist the accumulated buffer in one shot.
   * Returns false (and keeps the draft open) when validation fails or the
   * backend rejects the patch, so the modal can stay open and show errors.
   */
  async function commitDraft(): Promise<boolean> {
    if (!draftActive.value) return true;
    const patch = draftPatch.value;
    if (Object.keys(patch).length === 0) {
      // Nothing changed — just close the scope.
      draftActive.value = false;
      draftSnapshot.value = null;
      return true;
    }
    const errors = validateDraft(patch, (f) => isFieldLocked(f as string));
    if (Object.keys(errors).length > 0) {
      lastDraftErrors.value = errors;
      toasts.push("error", Object.values(errors)[0]);
      return false;
    }
    lastDraftErrors.value = {};
    const ok = await persistUpdate(patch);
    if (!ok) return false;
    draftActive.value = false;
    draftPatch.value = {};
    draftSnapshot.value = null;
    return true;
  }

  /** Discard the buffer: revert the optimistic view to the snapshot. */
  function discardDraft(): void {
    if (!draftActive.value) return;
    if (draftSnapshot.value) {
      cargo.value = { ...draftSnapshot.value };
    }
    draftActive.value = false;
    draftPatch.value = {};
    draftSnapshot.value = null;
    lastDraftErrors.value = {};
  }

  /**
   * Close the draft scope WITHOUT reverting to the snapshot. Used by the shared
   * FormModal when a custom-footer modal closes with a clean buffer (its saves
   * refresh via dedicated load() paths, so reverting would drop fresh data).
   * Mirrors the courier store's `clearDraft` for host-contract parity.
   */
  function clearDraft(): void {
    draftActive.value = false;
    draftPatch.value = {};
    draftSnapshot.value = null;
    lastDraftErrors.value = {};
  }

  async function saveAddress(
    tipo: CargoAddressTipo,
    fields: Partial<CargoAddress>,
  ): Promise<boolean> {
    if (!id.value) return false;
    saving.value = true;
    try {
      const r = await cargoAddressesService.upsert(id.value, tipo, fields);
      if (!r.success) {
        toasts.push("error", r.error ?? "Address save failed");
        return false;
      }
      toasts.push("success", i18n.global.t("cargo.toast.address_saved"));
      await refreshAddresses();
      return true;
    } catch (err) {
      toasts.push("error", (err as Error).message);
      return false;
    } finally {
      saving.value = false;
    }
  }

  async function refreshAddresses(): Promise<void> {
    if (!id.value) return;
    const r = await cargoAddressesService.list(id.value);
    if (r.success && r.data) {
      destination.value = r.data.destination;
      pickup.value = r.data.pickup;
      agency.value = r.data.agency;
      handler.value = r.data.handler;
      sede.value = r.data.sede ?? null;
      usesSedeAddress.value = r.data.uses_sede_address ?? false;
    }
  }

  /**
   * "Usa la dirección de la sede": archiva la presa propia para que el origen
   * vuelva a heredarse de sedi_interne (paridad spedy_form / spedyc_form).
   */
  async function useSedeAsOrigin(): Promise<boolean> {
    if (!id.value) return false;
    saving.value = true;
    try {
      const r = await cargoAddressesService.useSede(id.value);
      if (!r.success) {
        toasts.push("error", r.error ?? "Failed to set origin to sede");
        return false;
      }
      await refreshAddresses();
      toasts.push("success", i18n.global.t("cargo.toast.origin_sede"));
      return true;
    } catch (err) {
      toasts.push("error", (err as Error).message);
      return false;
    } finally {
      saving.value = false;
    }
  }

  async function refreshPackages(): Promise<void> {
    if (!id.value) return;
    const r = await packagesService.list(id.value);
    if (r.success && r.data) packages.value = r.data.packages;
  }

  /**
   * Persist the edited package buffer (colli) against the server state.
   *
   * Cargo has NO bulk-replace endpoint (unlike express `ajax_shipment_packages`):
   * `ajax_cargo_packages` only exposes add / patch / delete one-at-a-time.
   * So we diff the buffer against `packages.value` and issue the minimal set
   * of calls:
   *   - rows WITH id present in buffer  → patch (always, simplest + safe)
   *   - rows WITHOUT id                 → add
   *   - server rows missing from buffer → delete (soft-delete, stato='O')
   *
   * This is BD-only — no courier APIs are touched. On any failure we surface
   * the error and reload to re-sync the UI with whatever did persist.
   */
  async function savePackages(
    rows: Array<Partial<CargoPackage> & { id?: number | string }>,
  ): Promise<boolean> {
    if (!id.value) return false;
    saving.value = true;
    try {
      const serverIds = new Set(
        packages.value
          .map((p) => String(p.id))
          .filter((x) => x && x !== "undefined"),
      );
      const bufferIds = new Set(
        rows.map((r) => String(r.id)).filter((x) => x && x !== "undefined"),
      );

      // 1) Deletes: server rows no longer in the buffer.
      for (const p of packages.value) {
        const pid = String(p.id);
        if (pid && !bufferIds.has(pid)) {
          const res = await packagesService.remove(Number(p.id));
          if (!res.success) {
            toasts.push("error", res.error ?? "Package delete failed");
            await refreshPackages();
            return false;
          }
        }
      }

      // 2) Adds + 3) Updates.
      for (const r of rows) {
        const pid = String(r.id ?? "");
        const payload: Partial<CargoPackage> = {
          n_collo: r.n_collo,
          peso: r.peso,
          dim_a: r.dim_a,
          dim_l: r.dim_l,
          dim_p: r.dim_p,
          stackable: r.stackable,
          turnable: r.turnable,
        };
        if (pid && serverIds.has(pid)) {
          const res = await packagesService.update(Number(r.id), payload);
          if (!res.success) {
            toasts.push("error", res.error ?? "Package update failed");
            await refreshPackages();
            return false;
          }
        } else {
          const res = await packagesService.add(id.value, payload);
          if (!res.success) {
            toasts.push("error", res.error ?? "Package add failed");
            await refreshPackages();
            return false;
          }
        }
      }

      await refreshPackages();
      toasts.push("success", i18n.global.t("cargo.toast.packages_saved"));
      return true;
    } catch (err) {
      toasts.push("error", (err as Error).message);
      await refreshPackages();
      return false;
    } finally {
      saving.value = false;
    }
  }

  return {
    cargo,
    packages,
    destination,
    pickup,
    agency,
    handler,
    sede,
    usesSedeAddress,
    loading,
    saving,
    creating,
    error,
    errorCode,
    id,
    clientName,
    create,
    load,
    update,
    saveAddress,
    useSedeAsOrigin,
    refreshAddresses,
    refreshPackages,
    savePackages,
    // Direct persist (bypasses the draft buffer). Used by money fields that
    // must convert + persist immediately on blur, like the legacy FldUpdSpc —
    // buffering a target-currency value in the optimistic draft would show a
    // double-converted amount in the other boxes.
    persistUpdate,
    // Draft scope (edit-in-buffer + Save)
    draftActive,
    draftPatch,
    draftSnapshot,
    lastDraftErrors,
    isDraftDirty,
    beginDraft,
    commitDraft,
    discardDraft,
    clearDraft,
  };
});
