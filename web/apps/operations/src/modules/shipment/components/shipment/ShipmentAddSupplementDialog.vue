<template>
  <AppDialog
    :open="open"
    :title="t('shipment.add_supplement.title')"
    icon="mdi-plus-circle-outline"
    size="md"
    persistent
    :close-disabled="adding"
    card-class="add-supplement-dialog"
    @close="close"
  >
    <!-- Full-bleed body: counteract AppDialog's pa-4 wrapper so the search
         bar, tabs and list keep their original edge-to-edge layout. -->
    <div class="mx-n4 my-n4">
      <!-- Side badge (was a chip in the old title bar). -->
      <div class="px-4 pt-3">
        <v-chip
          v-if="mode === 'supplier'"
          size="x-small"
          color="warning"
          variant="tonal"
        >
          {{ t("shipment.add_supplement.supplier_side") }}
        </v-chip>
        <v-chip v-else size="x-small" color="primary" variant="tonal">
          {{ t("shipment.add_supplement.client_side") }}
        </v-chip>
      </div>

      <!-- Search bar -->
      <div class="px-4 pt-3 pb-2">
        <v-text-field
          ref="searchField"
          v-model="filter"
          density="comfortable"
          variant="outlined"
          :placeholder="t('shipment.add_supplement.search_placeholder')"
          prepend-inner-icon="mdi-magnify"
          clearable
          hide-details
          autofocus
        />
        <div v-if="filter" class="text-caption text-medium-emphasis mt-1 ms-1">
          {{
            t("shipment.add_supplement.match_count", {
              count: filteredAll.length,
            })
          }}
        </div>
      </div>

      <!-- Group tabs -->
      <v-tabs
        v-if="!filter"
        v-model="activeTab"
        density="compact"
        color="primary"
        align-tabs="start"
        show-arrows
        class="px-2"
      >
        <v-tab value="all">
          {{ t("shipment.add_supplement.all") }}
          <v-chip
            :text="String(groupCounts.all)"
            size="x-small"
            variant="tonal"
            class="ms-2"
          />
        </v-tab>
        <v-tab v-for="g in groupsMeta" :key="g.key" :value="g.key">
          {{ g.label }}
          <v-chip
            :text="String(g.count)"
            size="x-small"
            variant="tonal"
            class="ms-2"
          />
        </v-tab>
      </v-tabs>
      <v-divider v-if="!filter" />

      <!-- Body -->
      <div class="body-scroll" style="max-height: 60vh; overflow-y: auto">
        <v-progress-linear v-if="store.loading" indeterminate />
        <v-alert
          v-else-if="store.error"
          type="error"
          variant="tonal"
          density="compact"
          class="ma-3"
        >
          {{ store.error }}
        </v-alert>

        <v-list
          v-else-if="visibleItems.length > 0"
          density="compact"
          class="py-0"
          select-strategy="independent"
        >
          <template v-for="(item, idx) in visibleItems" :key="item.id">
            <!-- Sticky group divider (only when 'all' tab + no search) -->
            <div
              v-if="showGroupDivider(idx)"
              class="group-divider px-4 py-2 text-overline font-weight-medium"
            >
              {{ groupLabelFor(String(item.gruppo ?? "0")) }}
              <span class="text-caption text-medium-emphasis ms-2">
                {{ countInGroup(String(item.gruppo ?? "0")) }}
              </span>
            </div>

            <v-list-item
              :class="[
                'suppl-row',
                idx % 2 === 1 ? 'suppl-row--alt' : '',
                { 'is-selected': isSelected(item) },
              ]"
              @click="toggle(item)"
            >
              <template #prepend>
                <v-checkbox-btn
                  :model-value="isSelected(item)"
                  density="compact"
                  hide-details
                  @click.stop="toggle(item)"
                />
              </template>

              <v-list-item-title class="d-flex align-center">
                {{ nameOf(item) }}
                <v-chip
                  v-if="item.iso_paese"
                  :text="String(item.iso_paese)"
                  size="x-small"
                  variant="tonal"
                  color="info"
                  class="ms-2"
                />
              </v-list-item-title>
              <!-- One-line summary; the full help shows in the ℹ️ tooltip. -->
              <v-list-item-subtitle
                v-if="helpText(item)"
                class="text-caption suppl-help"
              >
                {{ helpText(item) }}
              </v-list-item-subtitle>

              <template #append>
                <v-tooltip
                  v-if="helpText(item)"
                  location="left"
                  max-width="360"
                >
                  <template #activator="{ props: tipProps }">
                    <v-icon
                      v-bind="tipProps"
                      icon="mdi-information-outline"
                      size="16"
                      color="info"
                      class="me-1"
                    />
                  </template>
                  <div class="text-body-2">
                    <div class="font-weight-medium mb-1">
                      {{ nameOf(item) }}
                    </div>
                    <div>{{ helpText(item) }}</div>
                  </div>
                </v-tooltip>
              </template>
            </v-list-item>
          </template>
        </v-list>

        <EmptyState
          v-else-if="!store.loading"
          icon="mdi-tag-search"
          :title="
            filter
              ? t('shipment.add_supplement.no_matches')
              : t('shipment.add_supplement.none_available')
          "
          :text="
            filter
              ? t('shipment.add_supplement.try_keyword')
              : t('shipment.add_supplement.catalog_empty')
          "
        />
      </div>
    </div>

    <!-- Footer -->
    <template #actions>
      <div class="text-body-2 text-medium-emphasis">
        <strong>{{ selectedIds.size }}</strong>
        {{ t("shipment.add_supplement.selected") }}
        <span v-if="selectedIds.size > 0" class="ms-1">
          · {{ selectedNamesPreview }}
        </span>
      </div>
      <v-spacer />
      <v-btn variant="text" :disabled="adding" @click="close">{{
        t("common.cancel")
      }}</v-btn>
      <v-btn
        color="primary"
        variant="flat"
        :loading="adding"
        :disabled="selectedIds.size === 0"
        prepend-icon="mdi-plus"
        @click="addSelected"
      >
        {{
          selectedIds.size > 0
            ? t("shipment.add_supplement.add_n", { n: selectedIds.size })
            : t("shipment.add_supplement.add")
        }}
      </v-btn>
    </template>
  </AppDialog>
</template>

<script setup lang="ts">
import AppDialog from "@shared/ui/AppDialog.vue";
import EmptyState from "@shared/ui/EmptyState.vue";
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useSupplementsStore } from "@shipment/stores/supplements.store";
import { useShipmentStore } from "@shipment/stores/shipment.store";
import { useToastStore } from "@shipment/stores/toast.store";
import { http } from "@shipment/services/http";
import type { MasterSupplement } from "@shipment/services/master_supplements.service";
import type { ShipmentSupplement } from "@shipment/services/shipment.types";

const { t, locale } = useI18n();

// The supplementi catalog carries only IT and EN text in the DB
// (nome/nome_EN, help/help_EN). Pick by the active UI locale: 'it' → Italian,
// everything else → English (more international) with an Italian fallback.
// This is the same it/en resolution the field-help/tracking data use.
function nameOf(s: MasterSupplement): string {
  const it = (s.nome ?? "").trim();
  const en = (s.nome_EN ?? "").trim();
  const chosen = String(locale.value) === "it" ? it || en : en || it;
  return chosen || `#${s.id}`;
}
const props = defineProps<{
  modelValue: boolean;
  /** 'client' → delta='N', 'supplier' → delta='S'. */
  mode: "client" | "supplier";
}>();
const emit = defineEmits<{ (e: "update:modelValue", v: boolean): void }>();

const open = ref(props.modelValue);
watch(
  () => props.modelValue,
  (v) => {
    open.value = v;
    if (v) {
      void store.ensureLoaded();
      // Reset state when reopening.
      selectedIds.value = new Set();
      filter.value = "";
      activeTab.value = "all";
    }
  },
);
watch(open, (v) => emit("update:modelValue", v));

const store = useSupplementsStore();
const shipmentStore = useShipmentStore();
const toasts = useToastStore();

const filter = ref("");
const activeTab = ref<string>("all");
const adding = ref(false);

/**
 * Multi-selection: ids the user has ticked but not yet committed. Keyed
 * by string supplement_id for fast lookup; cleared on close/Add.
 */
const selectedIds = ref<Set<string>>(new Set());

/**
 * Human labels for the supplementi groups. Falls back to "Group N"
 * for any group_id without an explicit label here.
 *
 * Legacy reference: spedy_form.php renders `SPPGRP_${gruppo}` from
 * ERP_labels with categories "Generale" / "Spedizioni" /
 * "Delega partners" / "Gruppi supplementi".
 */
function groupLabelFor(g: string): string {
  const labels: Record<string, string> = {
    "0": t("shipment.add_supplement.group.0"),
    "1": t("shipment.add_supplement.group.1"),
    "2": t("shipment.add_supplement.group.2"),
    "3": t("shipment.add_supplement.group.3"),
    "4": t("shipment.add_supplement.group.4"),
    "5": t("shipment.add_supplement.group.5"),
  };
  return labels[g] ?? t("shipment.add_supplement.group_n", { n: g });
}

/**
 * Ids already attached to the shipment on this side — they must be
 * hidden from the picker so the operator doesn't try to add them again.
 */
const assignedIds = computed<Set<string>>(() => {
  return new Set(
    shipmentStore.supplements
      .filter((s) =>
        props.mode === "supplier" ? s.delta === "S" : s.delta !== "S",
      )
      .map((s) => String(s.id_supplementi)),
  );
});

/**
 * Full catalog minus the already-assigned items. Used to compute
 * counts and filtered views.
 */
const eligible = computed<MasterSupplement[]>(() => {
  return store.expressVisible.filter(
    (s) => !assignedIds.value.has(String(s.id)),
  );
});

/**
 * Items matching the free-text filter (case-insensitive against
 * `nome`, `nome_EN`, and the localised `help`).
 */
const filteredAll = computed<MasterSupplement[]>(() => {
  const needle = filter.value.trim().toLowerCase();
  if (!needle) return eligible.value;
  return eligible.value.filter((s) => {
    const haystack =
      `${s.nome ?? ""} ${s.nome_EN ?? ""} ${s.help ?? ""} ${s.help_EN ?? ""}`.toLowerCase();
    return haystack.includes(needle);
  });
});

/**
 * Tab metadata: one entry per group that has at least one eligible
 * item. Counts are computed against the eligible list, not the raw
 * catalog, so the operator sees only what they can still add.
 */
const groupCounts = computed<Record<string, number>>(() => {
  const out: Record<string, number> = { all: eligible.value.length };
  for (const s of eligible.value) {
    const g = String(s.gruppo ?? "0");
    out[g] = (out[g] ?? 0) + 1;
  }
  return out;
});

const groupsMeta = computed(() => {
  const keys = Object.keys(groupCounts.value)
    .filter((k) => k !== "all")
    .sort();
  return keys.map((k) => ({
    key: k,
    label: groupLabelFor(k),
    count: groupCounts.value[k],
  }));
});

/**
 * Items visible in the body — filter takes precedence; if active,
 * tabs are hidden and the result is flat. Otherwise the active tab
 * narrows down to a single group (or all).
 */
const visibleItems = computed<MasterSupplement[]>(() => {
  if (filter.value.trim()) return filteredAll.value;
  if (activeTab.value === "all") {
    return [...eligible.value].sort(
      (a, b) =>
        String(a.gruppo ?? "0").localeCompare(String(b.gruppo ?? "0")) ||
        nameOf(a).localeCompare(nameOf(b)),
    );
  }
  return eligible.value.filter(
    (s) => String(s.gruppo ?? "0") === activeTab.value,
  );
});

/**
 * Show the group divider only in 'all' mode and only when this row
 * starts a new group section.
 */
function showGroupDivider(idx: number): boolean {
  if (filter.value.trim() || activeTab.value !== "all") return false;
  if (idx === 0) return true;
  const prev = visibleItems.value[idx - 1];
  const curr = visibleItems.value[idx];
  return String(prev?.gruppo ?? "0") !== String(curr?.gruppo ?? "0");
}

function countInGroup(g: string): string {
  const n = groupCounts.value[g] ?? 0;
  return t("shipment.add_supplement.item_count", { count: n });
}

/** Strip the HTML markup (<b>, <br>, …) the supplementi `help` columns carry,
 *  so the picker shows clean plain text instead of raw tags. */
function stripHtml(raw: string): string {
  return raw
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function helpText(s: MasterSupplement): string {
  const it = stripHtml(s.help || "");
  const en = stripHtml(s.help_EN || "");
  // Same locale rule as nameOf: IT for Italian UI, EN otherwise (fallback IT).
  return String(locale.value) === "it" ? it || en : en || it;
}

function isSelected(s: MasterSupplement): boolean {
  return selectedIds.value.has(String(s.id));
}

function toggle(s: MasterSupplement): void {
  const id = String(s.id);
  const next = new Set(selectedIds.value);
  if (next.has(id)) {
    next.delete(id);
  } else {
    next.add(id);
  }
  selectedIds.value = next;
}

const selectedNamesPreview = computed<string>(() => {
  if (selectedIds.value.size === 0) return "";
  const idMap = new Map(
    store.expressVisible.map((s) => [String(s.id), nameOf(s)]),
  );
  const names = [...selectedIds.value].map((id) => idMap.get(id) ?? `#${id}`);
  if (names.length <= 2) return names.join(", ");
  return t("shipment.add_supplement.names_more", {
    names: names.slice(0, 2).join(", "),
    n: names.length - 2,
  });
});

function close(): void {
  // Preserve the original guard: the old title-bar close X carried
  // :disabled="adding" so the dialog couldn't be dismissed mid-batch.
  // AppDialog's built-in X can't be disabled, so we no-op here instead.
  if (adding.value) return;
  open.value = false;
  filter.value = "";
  selectedIds.value = new Set();
}

async function addSelected(): Promise<void> {
  if (!shipmentStore.id || selectedIds.value.size === 0) return;
  adding.value = true;
  let okCount = 0;
  const errors: string[] = [];
  try {
    for (const id of selectedIds.value) {
      try {
        const body = {
          shipment_id: shipmentStore.id,
          id: shipmentStore.id, // legacy guard reads `id` from $_GET/$_POST
          supplement_id: id,
          id_supplementi: id,
          delta: props.mode === "supplier" ? "S" : "N",
          attivo: "S",
        };
        const res = await http<{
          success: boolean;
          data?: ShipmentSupplement;
          error?: string;
        }>("/ajax_shipment_supplements", { method: "POST", body });
        if (res.success) okCount += 1;
        else errors.push(res.error ?? `failed for ${id}`);
      } catch (e) {
        errors.push((e as Error).message);
      }
    }
    if (okCount > 0) {
      toasts.push(
        "success",
        t("shipment.add_supplement.toast_added", { count: okCount }),
      );
      // Partial refresh: pull only the supplements slice instead of a full
      // shipment reload. The full load() re-fetches packages + files and
      // added a ~4s lag, during which the table stayed empty and the add
      // looked like it had failed.
      await shipmentStore.refreshSupplements();
    }
    if (errors.length > 0) {
      toasts.push(
        "error",
        t("shipment.add_supplement.toast_failed", {
          error: errors[0],
          extra:
            errors.length > 1
              ? t("shipment.add_supplement.and_more", { n: errors.length - 1 })
              : "",
        }),
      );
    }
    if (okCount > 0 && errors.length === 0) {
      // Clear the busy flag before closing so close()'s in-flight guard
      // (which blocks user-initiated dismissal mid-batch) lets this
      // success-path close through.
      adding.value = false;
      close();
    }
  } finally {
    adding.value = false;
  }
}
</script>

<style scoped>
.add-supplement-dialog .group-divider {
  background: rgb(var(--v-theme-surface-variant), 0.5);
  border-top: 1px solid rgb(var(--v-theme-on-surface), 0.06);
  border-bottom: 1px solid rgb(var(--v-theme-on-surface), 0.06);
  position: sticky;
  top: 0;
  z-index: 2;
}
/* Zebra striping for the item list (parity with the app's other listings). */
.add-supplement-dialog .suppl-row--alt {
  background: rgba(var(--v-theme-on-surface), 0.03);
}
/* Selection highlight wins over the zebra stripe and the hover. */
.add-supplement-dialog .suppl-row.is-selected {
  background: rgb(var(--v-theme-primary), 0.08);
}
/* Keep the help summary to a single line; the ℹ️ tooltip carries the rest. */
.add-supplement-dialog .suppl-help {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
