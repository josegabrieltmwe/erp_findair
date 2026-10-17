<template>
  <!-- Rendered when there is at least one business-relevant metadatum OR the
       user can add one (i.e. once the shipment is loaded). -->
  <section
    v-if="
      rows.length > 0 ||
      assegni.length > 0 ||
      editableRows.length > 0 ||
      canEdit
    "
    class="card-tmwe"
  >
    <CardHeader
      icon="mdi-tag-text-outline"
      :title="t('shipment.cards.metadati.title')"
    >
      <template v-if="canEdit" #actions>
        <button
          type="button"
          class="metadati-add-btn"
          :title="t('shipment.cards.metadati.add_key')"
          @click="openAdd"
        >
          <v-icon icon="mdi-plus" size="14" />
        </button>
      </template>
    </CardHeader>

    <!-- Simple scalar rows (awb_reso_tnt, …) — read-only, curated by SPECS -->
    <InfoRow
      v-for="row in rows"
      :key="row.key"
      :icon="row.icon"
      :title="row.label"
      :subtitle="row.hint"
      :value="row.value"
      :class="{ 'metadati-row--highlight': row.highlight }"
    />

    <!-- Editable user-facing scalar metadata (everything not in SPECS/HIDDEN) -->
    <div v-for="er in editableRows" :key="er.key" class="metadati-editable-row">
      <div class="metadati-editable-row__main">
        <div class="metadati-editable-row__key">{{ er.key }}</div>
        <div class="metadati-editable-row__value">{{ er.value }}</div>
      </div>
      <div class="metadati-editable-row__actions">
        <button
          type="button"
          class="metadati-icon-btn"
          :title="t('shipment.cards.metadati.edit')"
          @click="openEdit(er.key, er.value)"
        >
          <v-icon icon="mdi-pencil-outline" size="14" />
        </button>
        <button
          type="button"
          class="metadati-icon-btn"
          :title="t('shipment.cards.metadati.delete')"
          @click="confirmDelete(er.key)"
        >
          <v-icon icon="mdi-delete-outline" size="14" />
        </button>
      </div>
    </div>

    <!-- COD cheques (spedizioni_meta.assegni[]) — one line per cheque -->
    <template v-if="assegni.length > 0">
      <div class="metadati-subhead">
        <v-icon icon="mdi-cash-multiple" size="16" class="me-1" />
        {{ t("shipment.cards.metadati.assegni_title") }}
      </div>
      <div v-for="(a, i) in assegni" :key="`assegno-${i}`" class="assegno-line">
        <InfoRow
          icon="mdi-checkbook"
          :title="
            a.importo + (a.valuta && a.valuta !== 'EUR' ? ' ' + a.valuta : ' €')
          "
          :subtitle="a.subtitle"
          :value="a.numero"
        />

        <!-- Only when the sheet is actually there: the button is the answer to
             "what does the paper say?", so it must never open an empty viewer. -->
        <button
          v-if="captureFor(a.numero)"
          type="button"
          class="assegno-photo"
          :title="t('shipment.cards.metadati.assegni_photo')"
          @click="viewing = captureFor(a.numero)"
        >
          <v-icon icon="mdi-image-outline" size="16" />
        </button>
      </div>
    </template>

    <!-- Capture sheet viewer -->
    <v-dialog v-model="viewerOpen" max-width="900">
      <v-card rounded="lg">
        <v-card-title class="text-subtitle-2 d-flex align-center">
          <v-icon icon="mdi-image-outline" size="18" class="me-2" />
          {{ t("shipment.cards.metadati.assegni_photo") }}
          <span v-if="viewing" class="text-caption text-medium-emphasis ms-2">
            {{ viewing.numero_assegno }}
          </span>
          <v-spacer />
          <!-- Opening in a tab is how you zoom into a photographed sheet; the
               dialog caps at 900px and cheque numbers are small. -->
          <v-btn
            v-if="viewingUrl"
            :href="viewingUrl"
            target="_blank"
            rel="noopener"
            variant="text"
            size="small"
            icon="mdi-open-in-new"
          />
        </v-card-title>
        <v-card-text class="pa-2">
          <v-img :src="viewingUrl" max-height="70vh" contain>
            <template #placeholder>
              <div class="d-flex align-center justify-center fill-height">
                <v-progress-circular indeterminate size="28" />
              </div>
            </template>
          </v-img>
        </v-card-text>
      </v-card>
    </v-dialog>

    <!-- Add / edit dialog -->
    <v-dialog v-model="dialogOpen" max-width="420">
      <v-card rounded="lg">
        <v-card-title class="text-subtitle-2">
          {{
            editingKey
              ? t("shipment.cards.metadati.edit")
              : t("shipment.cards.metadati.add_key")
          }}
        </v-card-title>
        <v-card-text>
          <v-text-field
            v-model="formKey"
            :label="t('shipment.cards.metadati.key')"
            :disabled="!!editingKey"
            density="compact"
            variant="outlined"
            hide-details="auto"
            class="mb-3"
          />
          <v-text-field
            v-model="formValue"
            :label="t('shipment.cards.metadati.value')"
            density="compact"
            variant="outlined"
            hide-details="auto"
          />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn size="small" variant="text" @click="dialogOpen = false">
            {{ t("common.cancel") }}
          </v-btn>
          <v-btn
            size="small"
            color="primary"
            variant="flat"
            :loading="saving"
            :disabled="!formKey"
            @click="save"
          >
            {{ t("common.save") }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </section>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { storeToRefs } from "pinia";
import { useShipmentStore } from "@shipment/stores/shipment.store";
import CardHeader from "@shipment/components/shell/CardHeader.vue";
import InfoRow from "@shipment/components/shell/InfoRow.vue";
import { metadataService } from "@shipment/services/metadata.service";
import {
  codCapturesService,
  type CodCapture,
} from "@shipment/services/cod_captures.service";

const { t } = useI18n();
const store = useShipmentStore();
const { shipment } = storeToRefs(store);

/**
 * The photos of the remittance sheets these cheques were read off.
 *
 * The approval writes the cheque DATA onto the shipment (the assegni[] below);
 * the evidence behind it stays in the capture batch, because one sheet serves
 * eight or nine shipments and copying it onto each would mean nine identical
 * files on disk. This fetches the link the other way round instead.
 *
 * Loaded lazily, only when there are cheques to explain: a shipment with no COD
 * capture is the common case and must not pay a request for it.
 */
const captures = ref<CodCapture[]>([]);
const capturesLoaded = ref(false);
const viewing = ref<CodCapture | null>(null);

const viewingUrl = computed(() =>
  viewing.value && store.id
    ? codCapturesService.downloadUrl(Number(store.id), viewing.value)
    : "",
);

/**
 * Writable proxy so closing the dialog (ESC, backdrop) clears `viewing`.
 * Leaving it set would keep the old image loaded and flash it on the next open.
 */
const viewerOpen = computed({
  get: () => viewing.value !== null,
  set: (open: boolean) => {
    if (!open) {
      viewing.value = null;
    }
  },
});

async function loadCaptures(): Promise<void> {
  if (capturesLoaded.value || !store.id) {
    return;
  }
  capturesLoaded.value = true;
  try {
    const response = await codCapturesService.list(Number(store.id));
    captures.value = response.data?.captures ?? [];
  } catch {
    // Silent: the cheque data is already on screen and remains readable. A
    // failed photo lookup is not worth an error banner over it.
    captures.value = [];
  }
}

/**
 * The sheet a given cheque was read off.
 *
 * Matched by cheque number because that is what ties a row of assegni[] to a
 * capture — the metadata carries no file id.
 */
function captureFor(numero: string): CodCapture | null {
  const wanted = (numero ?? "").trim();
  if (wanted === "") {
    return null;
  }
  return (
    captures.value.find((c) => (c.numero_assegno ?? "").trim() === wanted) ??
    null
  );
}

// The watcher that triggers loadCaptures() lives further down, next to the
// `assegni` computed it depends on: `assegni` is a const declared below, so an
// immediate watcher here would read it inside its temporal dead zone.

/**
 * Only business-relevant metadata is shown. Carrier-integration plumbing
 * (ups_document_ids, ups_pickup, fedex_pickup, fedex_files…) is internal and
 * deliberately hidden. A scalar key must be declared here to appear as a
 * READ-ONLY curated row; the COD cheques (assegni[]) are handled separately
 * below because they are a list. Everything else scalar and not in
 * HIDDEN_KEYS shows up in the EDITABLE section further down.
 */
interface MetaSpec {
  icon: string;
  label: string;
  highlight?: boolean;
}

const SPECS: Record<string, MetaSpec> = {
  awb_reso_tnt: {
    icon: "mdi-cash-refund",
    label: "AWB retorno (COD)",
    highlight: true,
  },
};

/**
 * Internal plumbing keys never offered in the editor, even though they are
 * technically scalar or would otherwise pass the "not object" filter.
 * ups_document_ids / fedex_files / awb_reso_tnt / assegni are objects/arrays
 * already excluded by is Scalar; this list covers scalar-shaped plumbing
 * that is not meant for manual editing.
 */
const HIDDEN_KEYS = new Set<string>([
  "awb_reso_tnt", // shown read-only above via SPECS
  "ups_pickup",
  "fedex_pickup",
  "ups_document_ids",
  "fedex_files",
  "assegni",
]);

interface MetaRow {
  key: string;
  icon: string;
  label: string;
  hint?: string;
  value: string;
  highlight: boolean;
}

function scalarString(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "object") return "";
  return String(v);
}

function isScalar(v: unknown): boolean {
  return (
    v === null ||
    typeof v === "string" ||
    typeof v === "number" ||
    typeof v === "boolean"
  );
}

const meta = computed<Record<string, unknown>>(() => {
  const m = shipment.value?.metadata;
  return m && typeof m === "object" ? (m as Record<string, unknown>) : {};
});

const rows = computed<MetaRow[]>(() => {
  const out: MetaRow[] = [];
  for (const [key, spec] of Object.entries(SPECS)) {
    const value = scalarString(meta.value[key]);
    if (value === "") continue;
    out.push({
      key,
      icon: spec.icon,
      label: spec.label,
      hint:
        key === "awb_reso_tnt"
          ? t("shipment.cards.metadati.awb_reso_hint")
          : undefined,
      value,
      highlight: !!spec.highlight,
    });
  }
  out.sort((a, b) => (a.highlight === b.highlight ? 0 : a.highlight ? -1 : 1));
  return out;
});

/**
 * User-editable escalar pairs: everything in the metadata blob that is a
 * scalar (capa-2 only indexes root scalars, so nested objects/arrays are
 * never offered here) and not curated/hidden above.
 */
interface EditableRow {
  key: string;
  value: string;
}

const editableRows = computed<EditableRow[]>(() => {
  const out: EditableRow[] = [];
  for (const [key, value] of Object.entries(meta.value)) {
    if (HIDDEN_KEYS.has(key) || key in SPECS) continue;
    if (!isScalar(value)) continue;
    out.push({ key, value: scalarString(value) });
  }
  out.sort((a, b) => a.key.localeCompare(b.key));
  return out;
});

const canEdit = computed(() => Boolean(store.id));

/** COD cheques cast to this shipment (spedizioni_meta.assegni[]). */
interface AssegnoView {
  numero: string;
  importo: string;
  valuta: string;
  subtitle: string;
}

const MATCH_LABELS: Record<string, string> = {
  matched: "casado por AWB",
  return_match: "casado por viaje de retorno (+1)",
  manual: "casado manualmente",
};

const assegni = computed<AssegnoView[]>(() => {
  const raw = meta.value["assegni"];
  if (!Array.isArray(raw)) return [];
  return raw.map((a) => {
    const o = (a ?? {}) as Record<string, unknown>;
    const banca = String(o.banca ?? "").trim();
    const match = String(o.stato_match ?? "");
    const how = MATCH_LABELS[match] ?? match;
    const parts = [banca, how].filter(Boolean);
    return {
      numero: String(o.numero_assegno ?? o.documento ?? "—"),
      importo: String(o.importo ?? ""),
      valuta: String(o.valuta ?? "EUR"),
      subtitle: parts.join(" · "),
    };
  });
});

/**
 * Fetch the photos once there is a cheque to explain.
 *
 * Declared here, after `assegni`, and not up with the other capture state: an
 * immediate watcher placed before that const would read it inside its temporal
 * dead zone and throw on mount.
 */
watch(
  () => [store.id, assegni.value.length] as const,
  ([, count]) => {
    if (count > 0) {
      void loadCaptures();
    }
  },
  { immediate: true },
);

// ────────────────────────────────────────────────────────────
// Add / edit / delete
// ────────────────────────────────────────────────────────────

const dialogOpen = ref(false);
const editingKey = ref<string | null>(null);
const formKey = ref("");
const formValue = ref("");
const saving = ref(false);

function openAdd(): void {
  editingKey.value = null;
  formKey.value = "";
  formValue.value = "";
  dialogOpen.value = true;
}

function openEdit(key: string, value: string): void {
  editingKey.value = key;
  formKey.value = key;
  formValue.value = value;
  dialogOpen.value = true;
}

async function save(): Promise<void> {
  const key = formKey.value.trim();
  if (!key || !store.id) return;
  saving.value = true;
  try {
    const res = await metadataService.merge(Number(store.id), {
      [key]: formValue.value,
    });
    if (res.success && res.data && shipment.value) {
      shipment.value = { ...shipment.value, metadata: res.data.metadata };
    }
    dialogOpen.value = false;
  } finally {
    saving.value = false;
  }
}

async function confirmDelete(key: string): Promise<void> {
  if (!store.id) return;
  const res = await metadataService.deleteKey(Number(store.id), key);
  if (res.success && res.data && shipment.value) {
    shipment.value = { ...shipment.value, metadata: res.data.metadata };
  }
}
</script>

<style scoped>
.metadati-row--highlight {
  background: rgba(var(--v-theme-primary, 25, 118, 210), 0.06);
  border-radius: 6px;
}
/* The cheque row plus its photo button. The InfoRow keeps its own layout and
   takes the free space; the button sits at the end without shifting it. */
.assegno-line {
  display: flex;
  align-items: center;
  gap: 4px;
}
.assegno-line > :first-child {
  flex: 1 1 auto;
  min-width: 0;
}
.assegno-photo {
  flex: 0 0 auto;
  width: 26px;
  height: 26px;
  border-radius: 7px;
  display: grid;
  place-items: center;
  color: rgb(var(--v-theme-on-surface-variant));
  cursor: pointer;
}
.assegno-photo:hover {
  background: rgba(var(--v-theme-primary, 25, 118, 210), 0.1);
  color: rgb(var(--v-theme-primary));
}
.metadati-subhead {
  display: flex;
  align-items: center;
  margin: 10px 4px 2px;
  font-size: 0.78rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  color: var(--muted, #888);
}
.metadati-add-btn {
  width: 22px;
  height: 22px;
  border-radius: 7px;
  display: grid;
  place-items: center;
  color: rgb(var(--v-theme-on-surface-variant));
  opacity: 0.55;
  background: transparent;
  border: 0;
  cursor: pointer;
  transition:
    background 0.12s,
    color 0.12s,
    opacity 0.12s;
}
.metadati-add-btn:hover {
  background: rgb(var(--v-theme-surface));
  color: rgb(var(--v-theme-primary));
  opacity: 1;
}
.metadati-editable-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 4px 2px;
  font-size: 0.82rem;
}
.metadati-editable-row__main {
  min-width: 0;
  flex: 1;
}
.metadati-editable-row__key {
  font-weight: 600;
  color: var(--muted, #888);
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.02em;
}
.metadati-editable-row__value {
  overflow-wrap: anywhere;
}
.metadati-editable-row__actions {
  display: flex;
  gap: 2px;
  flex-shrink: 0;
}
.metadati-icon-btn {
  width: 22px;
  height: 22px;
  border-radius: 7px;
  display: grid;
  place-items: center;
  color: rgb(var(--v-theme-on-surface-variant));
  opacity: 0.55;
  background: transparent;
  border: 0;
  cursor: pointer;
  transition:
    background 0.12s,
    color 0.12s,
    opacity 0.12s;
}
.metadati-icon-btn:hover {
  background: rgb(var(--v-theme-surface));
  color: rgb(var(--v-theme-primary));
  opacity: 1;
}
</style>
