<template>
  <!-- Historial de cambios del cargo en un MODAL (antes un panel lateral de 520 px). -->
  <ModalWrapper
    name="audit"
    :title="t('cargo.audit.title')"
    icon="mdi-history"
    :max-width="760"
  >
    <v-text-field
      v-model="filterCampo"
      :label="t('cargo.audit.filter_field')"
      density="compact"
      variant="outlined"
      hide-details
      prepend-inner-icon="mdi-filter-outline"
      clearable
      class="mb-2"
    />

    <v-skeleton-loader v-if="loading" type="list-item-two-line@8" />

    <EmptyState
      v-else-if="!filtered.length"
      icon="mdi-history"
      :title="t('cargo.audit.empty')"
      :text="
        entries.length
          ? t('cargo.audit.no_matches')
          : t('cargo.audit.no_changes')
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

    <template #actions>
      <v-btn
        prepend-icon="mdi-refresh"
        variant="text"
        :loading="loading"
        @click="load"
        >{{ t("common.refresh") }}</v-btn
      >
      <v-spacer />
      <v-btn
        variant="text"
        data-testid="audit-close"
        @click="ui.closeModal()"
        >{{ t("common.close") }}</v-btn
      >
    </template>
  </ModalWrapper>
</template>

<script setup lang="ts">
import { useI18n } from "vue-i18n";
import EmptyState from "@shared/ui/EmptyState.vue";
import { ref, computed, watch } from "vue";
import { storeToRefs } from "pinia";
import { useUiStore } from "@cargo/stores/ui.store";
import { useCargoStore } from "@cargo/stores/cargo.store";
import {
  cargoAuditService,
  type AuditEntry,
} from "@cargo/services/cargo_pricing.service";
import ModalWrapper from "./ModalWrapper.vue";

const { t } = useI18n();
const ui = useUiStore();
const cargoStore = useCargoStore();
const { id } = storeToRefs(cargoStore);

const entries = ref<AuditEntry[]>([]);
const loading = ref(false);
const filterCampo = ref("");

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
    const r = await cargoAuditService.list(Number(id.value), 50);
    entries.value = r.items;
  } catch {
    entries.value = [];
  } finally {
    loading.value = false;
  }
}

function tableLabel(name: string): string {
  return name.replace("spedizioni_", "").replace("_", " ");
}

function truncate(v: string | null): string {
  if (v == null) return "—";
  const s = String(v);
  return s.length > 48 ? `${s.slice(0, 45)}…` : s;
}

// Se relee cada vez que se abre, para mostrar la actividad reciente.
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
