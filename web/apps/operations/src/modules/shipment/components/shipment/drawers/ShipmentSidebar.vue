<template>
  <Teleport to="body">
    <div
      class="shipment-v2 v-application"
      :class="`v-theme--${activeTheme}`"
      :data-theme="ui.v2Theme"
    >
      <button
        v-if="ui.sidebarOpen"
        class="backdrop"
        type="button"
        :title="t('common.close')"
        @click="ui.closeAllDrawers()"
      />
      <aside class="sidebar" :class="{ 'is-open': ui.sidebarOpen }">
        <div class="sb-top">
          <v-icon icon="mdi-view-grid-outline" size="16" />
          <h3>{{ t("shipment.sidebar.selected") }}</h3>
          <button
            type="button"
            class="mclose"
            title="Chiudi"
            @click="ui.closeAllDrawers()"
          >
            <v-icon icon="mdi-close" size="16" />
          </button>
        </div>
        <div class="sb-sub">
          {{
            t("shipment.sidebar.records_filtered", {
              n: navigator.total.value,
            })
          }}
        </div>

        <button
          v-for="r in navigator.records.value"
          :key="r.id"
          type="button"
          class="sb-rec"
          :class="{ cur: String(r.id) === String(currentId) }"
          @click="goTo(r.id)"
        >
          <div>
            <div class="rn">#{{ r.id }}</div>
            <div class="rc">
              {{ r.cliente ?? "—"
              }}<template v-if="r.consegna_label">
                · {{ r.consegna_label }}</template
              >
            </div>
          </div>
          <span class="rs" :class="{ on: isDelivered(r.consegna_label) }" />
        </button>

        <div
          v-if="!navigator.loading.value && navigator.total.value === 0"
          class="sb-empty"
        >
          <v-icon icon="mdi-magnify" size="22" />
          <div>{{ t("shipment.sidebar.empty") }}</div>
        </div>
      </aside>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, onMounted, watch } from "vue";
import { storeToRefs } from "pinia";
import { useRoute } from "vue-router";
import { useI18n } from "vue-i18n";
import { useTheme } from "vuetify";
import { useShipmentStore } from "@shipment/stores/shipment.store";
import { useUiStore } from "@shipment/stores/ui.store";
import { useRecordNavigator } from "@shipment/composables/useRecordNavigator";

const { t } = useI18n();
const ui = useUiStore();
const theme = useTheme();
const activeTheme = computed(() => theme.global.name.value);
const store = useShipmentStore();
const route = useRoute();
const { id: currentIdRef } = storeToRefs(store);

const currentId = computed<number | null>(() => currentIdRef.value);

const navigator = useRecordNavigator(currentId);

function goTo(id: number | string): void {
  navigator.goTo(id);
  ui.closeAllDrawers();
}

function isDelivered(label: string | undefined): boolean {
  if (!label) return false;
  return /consegnat/i.test(label) || /delivered/i.test(label);
}

onMounted(() => {
  if (ui.sidebarOpen) void navigator.ensureLoaded(route.query);
});
watch(
  () => ui.sidebarOpen,
  (open) => {
    if (open) void navigator.ensureLoaded(route.query);
  },
);
</script>
