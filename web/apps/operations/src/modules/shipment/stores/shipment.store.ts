import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { useEntityCreate } from "@tmwe/shared-frontend/composables/useEntityCreate";
import { shipmentService } from "@shipment/services/shipment.service";
import { addressesService } from "@shipment/services/addresses.service";
import {
  packagesService,
  type PackageUpsertRow,
} from "@shipment/services/packages.service";
import { supplementsService } from "@shipment/services/supplements.service";
import { filesService } from "@shipment/services/files.service";
import { http } from "@shipment/services/http";
import { useToastStore } from "./toast.store";
import { validateShipmentPatch } from "@shipment/validation/shipmentRules";
import type {
  Shipment,
  ShipmentAddress,
  ShipmentPackage,
  ShipmentSupplement,
  ShipmentFile,
} from "@shipment/services/shipment.types";

/**
 * Editable row of the Colli table, shared between the Packages header box and
 * the per-package list inside the Colli modal. Weights/dimensions are always
 * stored in METRIC (kg, cm); the modal converts for display only.
 */
export interface ColliRow {
  id?: number | string;
  n_collo: number;
  segnac_cliente: string;
  peso: number;
  dim_a: number;
  dim_l: number;
  dim_p: number;
}

/**
 * Central state of the currently-loaded shipment plus all CRUD operations.
 * Components subscribe through `useShipmentStore()` and read `shipment.value`
 * reactively; writes go through the action methods so the store can call the
 * backend, refresh, and surface toasts.
 */
export const useShipmentStore = defineStore("shipment", () => {
  const shipment = ref<Shipment | null>(null);
  const loading = ref(false);
  const saving = ref(false);
  const error = ref<string | null>(null);

  const id = computed(() => {
    const s = shipment.value;
    if (!s) return null;
    return Number(s.id);
  });

  const packages = computed<ShipmentPackage[]>(
    () => shipment.value?.packages_from_db ?? [],
  );

  /**
   * Shared editable rows for the Colli modal. Lifted into the store so the two
   * sibling components — ShipmentPackagesBox (header "Pieces"/colli) and
   * ShipmentColliList (the per-package table) — read/write ONE source of truth
   * and stay in sync without an event bus. Legacy parity (spedy_update_funz.php):
   * `colli` is the source of truth and the spedizioni_colli rows follow it. Here
   * the binding is bidirectional in the UI: changing colli resizes the rows,
   * adding/removing rows updates colli. Nothing is persisted until the user hits
   * Save (table) or Salva (modal) — the draft guard still applies.
   */
  const colliRows = ref<ColliRow[]>([]);
  /**
   * True while colliRows is being (re)hydrated from the loaded packages. The
   * colli↔rows-length sync watcher (ShipmentPackagesBox) skips its work in this
   * window so a server load never spuriously commits `colli`.
   */
  const colliRowsHydrating = ref(false);

  /**
   * Active DISPLAY unit system for the Colli modal ('M' kg/cm | 'I' lb/in).
   * Initialised from the client's `metric_imperial` and toggleable locally by
   * the operator. It is NEVER persisted (the legacy `?mtrsys` URL param behaves
   * the same way): the DB always stores metric. Shared in the store so the
   * header box and the per-package list show consistent units.
   */
  const metricDisplay = ref<"M" | "I">("M");

  /** Resize colliRows to exactly `n` rows: pad with empty rows, trim from the tail. */
  function resizeColliRows(n: number): void {
    const target = Math.max(0, Math.floor(n) || 0);
    const cur = colliRows.value;
    if (target === cur.length) return;
    if (target < cur.length) {
      colliRows.value = cur.slice(0, target);
      return;
    }
    const next = cur.slice();
    let maxN = next.reduce((m, r) => Math.max(m, Number(r.n_collo) || 0), 0);
    while (next.length < target) {
      maxN += 1;
      next.push({
        n_collo: maxN,
        segnac_cliente: "",
        peso: 0,
        dim_a: 0,
        dim_l: 0,
        dim_p: 0,
      });
    }
    colliRows.value = next;
  }
  const supplements = computed<ShipmentSupplement[]>(() => {
    const raw = shipment.value?.supplements;
    if (!raw) return [];
    return Array.isArray(raw) ? raw : Object.values(raw);
  });
  const files = computed<ShipmentFile[]>(() => shipment.value?.files ?? []);
  const destination = computed<ShipmentAddress | null>(
    () => shipment.value?.destination_address ?? null,
  );
  const pickup = computed<ShipmentAddress | null>(
    () => shipment.value?.origin_address ?? null,
  );

  const toasts = useToastStore();

  // ─── Draft scope (edit-in-buffer + Save button, no autosave) ──────────────
  // While a modal is open we buffer every commit (field bindings AND loose
  // store.update calls from boxes) instead of hitting the backend, so the user
  // can edit several fields and persist them all at once on "Salva" — or
  // discard them on "Annulla". This is centralised here so the ~14 *Box.vue
  // components need no changes: they keep calling store.update() as before.
  const draftActive = ref(false);
  const draftPatch = ref<Partial<Shipment>>({});
  const draftSnapshot = ref<Shipment | null>(null);

  const isDraftDirty = computed(
    () => draftActive.value && Object.keys(draftPatch.value).length > 0,
  );

  function beginDraft(): void {
    // Singleton store + single active modal: if a draft is already open, keep
    // it (re-entrant openModal must not wipe accumulated edits).
    if (draftActive.value) return;
    draftSnapshot.value = shipment.value ? { ...shipment.value } : null;
    draftPatch.value = {};
    draftActive.value = true;
  }

  /**
   * Draft creation — POST /unified_shipment, returns the new id (backend
   * key `id`). The generic flow lives in the shared useEntityCreate
   * composable; here we only bind the app http + toast. Express requires
   * id_cliente + destination_address.id_paese_iso (the wrapper page collects
   * the destination country and passes it through `extra`).
   */
  const { saving: creating, create: createDraft } = useEntityCreate<
    Record<string, unknown>
  >({
    http,
    endpoint: "/unified_shipment",
    idKey: "id",
    onError: (msg) => toasts.push("error", msg),
  });

  async function create(
    customerId: number,
    extra: Record<string, unknown> = {},
  ): Promise<number | null> {
    return createDraft({ id_cliente: customerId, ...extra });
  }

  function clearDraft(): void {
    draftActive.value = false;
    draftPatch.value = {};
    draftSnapshot.value = null;
  }

  function discardDraft(): void {
    if (draftSnapshot.value) {
      shipment.value = draftSnapshot.value;
    }
    clearDraft();
  }

  /**
   * Validate the accumulated draft before persisting. See
   * validation/shipmentRules.ts for the rationale of validating at commit time
   * rather than per-field in every box.
   */
  function validateDraft(): { ok: boolean; errors: string[] } {
    const errors = validateShipmentPatch(draftPatch.value);
    return { ok: errors.length === 0, errors };
  }

  /**
   * Persist a patch to the backend (no buffering). Internal: the public
   * `update` delegates here when no draft is active, and `commitDraft` calls it
   * with the accumulated patch.
   */
  async function persistUpdate(patch: Partial<Shipment>): Promise<boolean> {
    if (!id.value) return false;
    saving.value = true;
    try {
      const res = await shipmentService.update(id.value, patch);
      if (!res.success) {
        toasts.push("error", res.error ?? "Update failed");
        return false;
      }
      // Apply the PATCH we just persisted to the local state.
      //
      // `res.data` is an update RECEIPT ({updated, id, ignored_fields, …}),
      // not the new row — it never echoes the written columns. Merging only
      // the receipt left the old value on screen for any field cleared to an
      // empty string: `AWB_forn: ""` was written to the DB but the stale AWB
      // stayed visible, so "reset AWB" looked like it had done nothing.
      // Fields the server refused (ignored/locked) are excluded so the UI
      // never shows a value that was not actually stored.
      if (shipment.value) {
        const refused = new Set<string>([
          ...((res.data?.ignored_fields as string[] | undefined) ?? []),
          ...((res.data?.blocked_by_lock as string[] | undefined) ?? []),
        ]);
        const applied = Object.fromEntries(
          Object.entries(patch).filter(([k]) => !refused.has(k)),
        );
        shipment.value = { ...shipment.value, ...applied };
      }
      toasts.push("success", "Saved");
      return true;
    } catch (err) {
      toasts.push("error", (err as Error).message);
      return false;
    } finally {
      saving.value = false;
    }
  }

  /**
   * Commit the buffered draft. Validates first; on failure returns the errors
   * and keeps the draft open (modal stays open). On success persists the whole
   * patch in one call and clears the draft.
   */
  async function commitDraft(): Promise<{ ok: boolean; errors: string[] }> {
    if (!draftActive.value || Object.keys(draftPatch.value).length === 0) {
      clearDraft();
      return { ok: true, errors: [] };
    }
    const verdict = validateDraft();
    if (!verdict.ok) {
      return verdict;
    }
    const patch = draftPatch.value;
    // Disable buffering so persistUpdate's optimistic merge is the source of
    // truth, then clear the snapshot so a later discard can't revert it.
    draftActive.value = false;
    const ok = await persistUpdate(patch);
    if (ok) {
      clearDraft();
      return { ok: true, errors: [] };
    }
    // Persist failed: re-open the draft so the user can retry / cancel.
    draftActive.value = true;
    return { ok: false, errors: [] };
  }

  async function load(shipmentId: number): Promise<void> {
    loading.value = true;
    error.value = null;
    try {
      const res = await shipmentService.load(shipmentId, {
        withPackages: true,
        withSupplements: true,
        withFiles: true,
      });
      if (!res.success || !res.data) {
        error.value = res.error ?? "Failed to load shipment";
        shipment.value = null;
        return;
      }
      // If a draft is open (e.g. a dedicated save inside the same modal —
      // savePackages/saveAddress — triggered a refresh), re-base the snapshot
      // to the freshly loaded server state and re-apply the still-buffered
      // edits on top. Otherwise a later discardDraft would revert to stale
      // pre-load data and silently drop what the dedicated save just persisted.
      if (draftActive.value) {
        draftSnapshot.value = { ...res.data };
        shipment.value = { ...res.data, ...draftPatch.value };
      } else {
        shipment.value = res.data;
      }
    } catch (err) {
      error.value = (err as Error).message;
      shipment.value = null;
    } finally {
      loading.value = false;
    }
  }

  async function update(patch: Partial<Shipment>): Promise<boolean> {
    if (!id.value) return false;
    // Draft mode: buffer instead of persisting. Apply an optimistic merge so
    // the UI reflects the edit, accumulate the patch, and report success so
    // callers (field bindings / loose box commits) behave as before.
    if (draftActive.value) {
      if (shipment.value) {
        shipment.value = { ...shipment.value, ...patch };
      }
      draftPatch.value = { ...draftPatch.value, ...patch };
      return true;
    }
    return persistUpdate(patch);
  }

  /**
   * Merge fields into the in-memory shipment WITHOUT a backend round-trip or a
   * full reload. For when an endpoint has already persisted a change server-side
   * and just returned the new values (e.g. AWB generation), so the card can
   * reflect them without re-fetching the whole shipment and re-triggering every
   * card's watchers.
   */
  function mergeLocal(patch: Partial<Shipment>): void {
    if (shipment.value) {
      shipment.value = { ...shipment.value, ...patch };
    }
  }

  async function saveAddress(
    tipo: "P" | "D",
    address: Partial<ShipmentAddress>,
  ): Promise<boolean> {
    if (!id.value) return false;
    saving.value = true;
    try {
      const res = await addressesService.upsert(id.value, tipo, address);
      if (!res.success) {
        toasts.push("error", res.error ?? "Address save failed");
        return false;
      }
      // Refresh the shipment to pull back the flattened address fields.
      await load(id.value);
      toasts.push("success", "Address saved");
      return true;
    } catch (err) {
      toasts.push("error", (err as Error).message);
      return false;
    } finally {
      saving.value = false;
    }
  }

  /**
   * Revierte el origen a la sede del cliente (presa_tipo='S', borra la fila 'P').
   * Recarga la expedición para reflejar el origen heredado de la sede.
   */
  async function useSedeAsOrigin(): Promise<boolean> {
    if (!id.value) return false;
    saving.value = true;
    try {
      const res = await addressesService.useSede(id.value);
      if (!res.success) {
        toasts.push("error", res.error ?? "Failed to set origin to sede");
        return false;
      }
      await load(id.value);
      toasts.push("success", "Origin set to client site");
      return true;
    } catch (err) {
      toasts.push("error", (err as Error).message);
      return false;
    } finally {
      saving.value = false;
    }
  }

  async function savePackages(items: ColliRow[]): Promise<boolean> {
    if (!id.value) return false;
    saving.value = true;
    try {
      // ColliRow is a strict subset of PackageUpsertRow but lacks its
      // index signature; normalise each row so it satisfies the service
      // contract without widening ColliRow itself.
      const rows: PackageUpsertRow[] = items.map((it) => ({ ...it }));
      const res = await packagesService.upsertAll(id.value, rows);
      if (!res.success) {
        toasts.push("error", res.error ?? "Packages save failed");
        return false;
      }
      await load(id.value);
      toasts.push("success", "Packages saved");
      return true;
    } catch (err) {
      toasts.push("error", (err as Error).message);
      return false;
    } finally {
      saving.value = false;
    }
  }

  async function saveSupplements(
    items: Partial<ShipmentSupplement>[],
  ): Promise<boolean> {
    if (!id.value) return false;
    saving.value = true;
    try {
      const res = await supplementsService.upsertAll(id.value, items);
      if (!res.success) {
        toasts.push("error", res.error ?? "Supplements save failed");
        return false;
      }
      // Refresh ONLY the supplements slice. `load()` re-fetches the whole
      // shipment (a 22-JOIN aggregate plus packages and files), which repaints
      // every box on the page: with autosave on every toggle that made the UI
      // visibly jump on each click. refreshSupplements() swaps just this array,
      // so the rest of the page — and the scroll position — stays put.
      await refreshSupplements();
      return true;
    } catch (err) {
      toasts.push("error", (err as Error).message);
      return false;
    } finally {
      saving.value = false;
    }
  }

  /**
   * Partial refresh of just the supplements slice, via the dedicated
   * GET /ajax_shipment_supplements endpoint. Mirrors refreshFiles(): far
   * cheaper than load() (which re-fetches packages + files + the whole
   * shipment row) so the table reflects an add/remove immediately instead
   * of after a ~4s full reload — the lag that made a successful add read
   * as a failure.
   */
  async function refreshSupplements(): Promise<void> {
    if (!id.value || !shipment.value) return;
    const r = await supplementsService.list(id.value);
    if (!r.success || !r.data) return;

    // Both this endpoint and the full shipment payload now emit the same field
    // names (`id_supplementi`, `descrizione`) — see enrich_supplements() — so
    // the slice can replace the loaded one as-is. Only the container differs:
    // the endpoint returns a list, `load()` an object keyed by row id, and the
    // `supplements` getter accepts either.
    const raw = r.data.supplements ?? [];
    const rows = Array.isArray(raw) ? raw : Object.values(raw);

    shipment.value = {
      ...shipment.value,
      supplements: rows as unknown as typeof shipment.value.supplements,
    };
  }

  async function refreshFiles(): Promise<void> {
    // Legacy: the files UI now uses its own files.store (scope ext/int +
    // visibility). Kept for the shipment payload's `files` field; the row
    // shapes differ, so we cast through unknown.
    if (!id.value || !shipment.value) return;
    const r = await filesService.list(id.value);
    if (r.success && r.files) {
      shipment.value = {
        ...shipment.value,
        files: r.files as unknown as typeof shipment.value.files,
      };
    }
  }

  return {
    shipment,
    loading,
    saving,
    creating,
    error,
    id,
    packages,
    colliRows,
    colliRowsHydrating,
    resizeColliRows,
    metricDisplay,
    supplements,
    files,
    destination,
    pickup,
    create,
    load,
    update,
    mergeLocal,
    // Direct persist (bypasses draft) — used by money fields that convert +
    // persist immediately on blur, like the legacy FldUpdSpc.
    persistUpdate,
    saveAddress,
    useSedeAsOrigin,
    savePackages,
    saveSupplements,
    refreshSupplements,
    refreshFiles,
    // draft scope
    draftActive,
    isDraftDirty,
    beginDraft,
    commitDraft,
    discardDraft,
    clearDraft,
  };
});
