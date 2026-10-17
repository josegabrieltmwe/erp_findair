<template>
  <v-navigation-drawer v-model="open" location="right" width="480" temporary>
    <v-toolbar density="compact" color="surface">
      <v-icon icon="mdi-truck-fast" class="ms-3 me-2" />
      <v-toolbar-title>{{
        t("shipment.tracking_drawer.title")
      }}</v-toolbar-title>
      <v-spacer />
      <v-btn
        variant="tonal"
        color="primary"
        size="small"
        density="comfortable"
        prepend-icon="mdi-radar"
        :loading="forcing"
        :title="t('tracking.force_hint')"
        class="me-1"
        @click="onForce"
      >
        {{ t("tracking.force") }}
      </v-btn>
      <v-btn
        icon="mdi-refresh"
        variant="text"
        size="small"
        density="comfortable"
        :title="t('tracking.reload')"
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

    <v-skeleton-loader v-if="loading" type="list-item-two-line@5" />

    <EmptyState
      v-else-if="!events.length"
      icon="mdi-truck-outline"
      title="No tracking events yet"
      text="The carrier has not reported events for this shipment yet."
      density="compact"
    />

    <v-list v-else density="compact">
      <v-list-item
        v-for="(e, idx) in events"
        :key="`${e.ts}-${idx}`"
        class="track-row"
      >
        <template #prepend>
          <v-chip v-if="e.code" size="x-small" variant="tonal" class="me-1">{{
            e.code
          }}</v-chip>
        </template>
        <v-list-item-title class="text-body-2">{{
          e.description || "—"
        }}</v-list-item-title>
        <v-list-item-subtitle>
          <span v-if="e.location" class="me-2">
            <v-icon icon="mdi-map-marker-outline" size="12" /> {{ e.location }}
          </span>
          <span class="text-medium-emphasis">{{ e.ts }}</span>
        </v-list-item-subtitle>
      </v-list-item>
    </v-list>
  </v-navigation-drawer>
</template>

<script setup lang="ts">
import EmptyState from "@shared/ui/EmptyState.vue";
import { ref, computed, watch } from "vue";
import { storeToRefs } from "pinia";
import { useI18n } from "vue-i18n";
import { useUiStore } from "@shipment/stores/ui.store";
import { useShipmentStore } from "@shipment/stores/shipment.store";
import { useToastStore } from "@shipment/stores/toast.store";
import {
  shipmentTrackingService,
  type TrackingEvent,
} from "@shipment/services/shipment_drawers.service";

const { t } = useI18n();
const ui = useUiStore();
const store = useShipmentStore();
const toasts = useToastStore();
const { id } = storeToRefs(store);

const events = ref<TrackingEvent[]>([]);
const loading = ref(false);
const forcing = ref(false);

const open = computed({
  get: () => ui.trackingOpen,
  set: (v) => {
    if (!v) ui.closeAllDrawers();
  },
});

async function load(): Promise<void> {
  if (!id.value) return;
  loading.value = true;
  try {
    const r = await shipmentTrackingService.list(Number(id.value));
    events.value = r.items;
  } catch {
    events.value = [];
  } finally {
    loading.value = false;
  }
}

/**
 * Force a live tracking query against the courier, then reload the history so
 * the new events show up. Distinct from the reload button, which only re-reads
 * what is already stored.
 */
async function onForce(): Promise<void> {
  if (!id.value || forcing.value) return;
  forcing.value = true;
  try {
    const r = await shipmentTrackingService.force(Number(id.value));
    if (r.success && (r.processed ?? 0) > 0) {
      toasts.push("success", t("tracking.force_ok"));
      await load();
    } else {
      toasts.push("error", r.error || t("tracking.force_failed"));
    }
  } catch (e) {
    toasts.push("error", (e as Error).message);
  } finally {
    forcing.value = false;
  }
}

watch(
  () => ui.trackingOpen,
  (v) => {
    if (v) void load();
  },
);
</script>

<style scoped>
.track-row {
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
}
</style>
