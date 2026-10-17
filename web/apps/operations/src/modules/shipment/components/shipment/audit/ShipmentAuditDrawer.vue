<template>
  <v-navigation-drawer v-model="open" location="right" width="520" temporary>
    <v-toolbar density="compact" color="surface">
      <v-icon icon="mdi-history" class="ms-3 me-2" />
      <v-toolbar-title>{{ t("shipment.layout.audit_trail") }}</v-toolbar-title>
      <v-spacer />
      <v-btn
        icon="mdi-refresh"
        variant="text"
        size="small"
        density="comfortable"
        title="Reload"
        :loading="loading"
        @click="load"
      />
      <v-btn
        icon="mdi-close"
        variant="text"
        size="small"
        density="comfortable"
        @click="ui.closeAllDrawers()"
      />
    </v-toolbar>
    <v-divider />

    <!-- Filter -->
    <div class="pa-3">
      <v-text-field
        v-model="filterCampo"
        label="Filter by field"
        density="compact"
        variant="outlined"
        hide-details
        prepend-inner-icon="mdi-filter-outline"
        clearable
        class="mb-2"
      />
    </div>
    <v-divider />

    <v-skeleton-loader v-if="loading" type="list-item-two-line@8" />

    <EmptyState
      v-else-if="!filtered.length"
      icon="mdi-history"
      title="No audit entries"
      :text="
        entries.length
          ? 'No matches for the current filter.'
          : 'No changes have been logged for this shipment.'
      "
      density="compact"
    />

    <v-list v-else density="compact">
      <v-list-item v-for="e in filtered" :key="e.id" class="audit-row">
        <template #prepend>
          <v-chip size="x-small" variant="tonal" class="me-1">
            {{ tableLabel(e.tabella) }}
          </v-chip>
        </template>
        <v-list-item-title class="text-body-2">
          <strong>{{ e.campo }}</strong
          >:
          <span class="text-medium-emphasis">{{ truncate(e.valore_old) }}</span>
          <v-icon icon="mdi-arrow-right" size="12" class="mx-1" />
          <span>{{ truncate(e.valore_new) }}</span>
        </v-list-item-title>
        <v-list-item-subtitle class="text-caption">
          <v-icon icon="mdi-account" size="12" />
          {{ e.user_name || `user #${e.user}` }}
          <span v-if="e.ip" class="ms-2 text-medium-emphasis">
            <v-icon icon="mdi-ip-network" size="12" /> {{ e.ip }}
          </span>
          <span class="ms-2 text-medium-emphasis">{{ e.ts }}</span>
        </v-list-item-subtitle>
      </v-list-item>
    </v-list>
  </v-navigation-drawer>
</template>

<script setup lang="ts">
import EmptyState from "@shared/ui/EmptyState.vue";
import { ref, computed, watch } from "vue";
import { useI18n } from "vue-i18n";
import { storeToRefs } from "pinia";
import { useUiStore } from "@shipment/stores/ui.store";
import { useShipmentStore } from "@shipment/stores/shipment.store";

const { t } = useI18n();
import {
  shipmentAuditService,
  type ShipmentAuditEntry,
} from "@shipment/services/shipment_drawers.service";

const ui = useUiStore();
const store = useShipmentStore();
const { id } = storeToRefs(store);

const entries = ref<ShipmentAuditEntry[]>([]);
const loading = ref(false);
const filterCampo = ref("");

const open = computed({
  get: () => ui.auditOpen,
  set: (v) => {
    if (!v) ui.closeAllDrawers();
  },
});

const filtered = computed(() => {
  const q = filterCampo.value?.trim().toLowerCase() ?? "";
  if (!q) return entries.value;
  return entries.value.filter(
    (e) =>
      e.campo.toLowerCase().includes(q) || e.tabella.toLowerCase().includes(q),
  );
});

async function load(): Promise<void> {
  if (!id.value) return;
  loading.value = true;
  try {
    const r = await shipmentAuditService.list(Number(id.value), 50);
    entries.value = r.items;
  } catch {
    entries.value = [];
  } finally {
    loading.value = false;
  }
}

function tableLabel(t: string): string {
  return t.replace("spedizioni_", "").replace("_", " ");
}

function truncate(v: string | null): string {
  if (v == null) return "—";
  const s = String(v);
  return s.length > 48 ? `${s.slice(0, 45)}…` : s;
}

watch(
  () => ui.auditOpen,
  (v) => {
    if (v) void load();
  },
);
</script>

<style scoped>
.audit-row {
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
}
</style>
