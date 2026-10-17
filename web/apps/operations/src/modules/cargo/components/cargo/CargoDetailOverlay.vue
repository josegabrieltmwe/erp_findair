<template>
  <!--
    NO teleportar a <body>. `v-navigation-drawer` se inscribe en el layout de
    Vuetify y tiene que quedar DENTRO del `v-app`, que la app monta en
    #app-wrapper (main.ts). Un `<Teleport to="body">` lo saca fuera del v-app
    y Vuetify ya no puede posicionarlo.
  -->
  <v-navigation-drawer
    :model-value="modelValue"
    location="right"
    :width="drawerWidth"
    temporary
    class="cdo-drawer"
    @update:model-value="(value) => $emit('update:modelValue', value)"
  >
    <v-card class="cdo-card" height="100%" rounded="0">
      <div class="cdo-bar">
        <div class="cdo-nav">
          <v-btn
            icon="mdi-chevron-left"
            size="small"
            variant="text"
            :disabled="!navigator.hasPrev.value"
            :title="t('cargo.overlay.prev')"
            @click="navigator.goPrev()"
          />
          <span class="cdo-pos">
            <template v-if="navigator.index.value >= 0">
              {{ navigator.index.value + 1 }} /
              {{ navigator.total.value || navigator.cached.value }}
            </template>
          </span>
          <v-btn
            icon="mdi-chevron-right"
            size="small"
            variant="text"
            :disabled="!navigator.hasNext.value"
            :title="t('cargo.overlay.next')"
            @click="navigator.goNext()"
          />
        </div>

        <span class="cdo-title">
          <v-icon icon="mdi-airplane" size="18" class="me-2" />
          {{ t("cargo.overlay.cargo") }}
          <code v-if="viewId">#{{ viewId }}</code>
          <span v-if="store.loading" class="cdo-loading">
            {{ t("cargo.overlay.loading") }}
          </span>
        </span>

        <v-spacer />
        <v-btn
          :href="fullPageHref"
          target="_blank"
          rel="noopener"
          variant="text"
          size="small"
          icon="mdi-open-in-new"
          :title="t('cargo.overlay.open_full_page')"
        />
        <v-btn
          variant="text"
          size="small"
          icon="mdi-close"
          :title="t('cargo.overlay.close')"
          @click="close"
        />
      </div>

      <div class="cdo-body">
        <v-alert
          v-if="store.error"
          type="error"
          density="compact"
          class="ma-3"
        >
          {{ store.error }}
        </v-alert>
        <v-skeleton-loader
          v-else-if="store.loading && !store.cargo"
          type="card-avatar, list-item-three-line, table-tbody"
          class="ma-3"
        />
        <CargoOverviewV2 v-else-if="store.cargo" />
      </div>
    </v-card>
    <CargoModals />
  </v-navigation-drawer>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useRoute, useRouter } from "vue-router";
import { useDisplay } from "vuetify";
import { storeToRefs } from "pinia";
import { useCargoStore } from "@cargo/stores/cargo.store";
import { useUiStore } from "@cargo/stores/ui.store";
import { useRecordNavigator } from "@cargo/composables/useRecordNavigator";
import CargoOverviewV2 from "@cargo/components/cargo/overview/CargoOverviewV2.vue";
import CargoModals from "@cargo/components/cargo/modals/CargoModals.vue";

const props = defineProps<{ modelValue: boolean; viewId: number | null }>();
const emit = defineEmits<{ (e: "update:modelValue", value: boolean): void }>();

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const { width: viewportWidth } = useDisplay();

/**
 * Ancho del drawer: 70% del viewport como minimo operativo (peticion de Luca),
 * con tope de 1280px para que en pantallas muy anchas el contenido no quede
 * disperso, y pantalla completa por debajo de 900px.
 *
 * `v-navigation-drawer` espera un numero de pixeles: un valor en `vw` no lo
 * interpreta, por eso se calcula aqui en vez de en CSS.
 */
const drawerWidth = computed<number>(() => {
  const vw = viewportWidth.value;
  if (vw <= 900) return vw;
  return Math.min(Math.max(Math.round(vw * 0.7), 720), 1280);
});

const store = useCargoStore();
const ui = useUiStore();
const { id: storeId } = storeToRefs(store);
const currentId = computed<number | null>(() => storeId.value);
const navigator = useRecordNavigator(currentId, { overlay: true });

async function loadView(): Promise<void> {
  if (props.viewId != null) await store.load(props.viewId);
}

watch(
  () => props.viewId,
  (id) => {
    if (id != null) void loadView();
  },
);
watch(
  () => props.modelValue,
  (open) => {
    if (open) {
      void navigator.ensureLoaded(route.query);
      void loadView();
    } else {
      ui.closeModal();
    }
  },
);

function close(): void {
  emit("update:modelValue", false);
}

function onKey(event: KeyboardEvent): void {
  if (!props.modelValue) return;
  const target = event.target as HTMLElement | null;
  if (
    target &&
    (target.matches("input,textarea,select") || target.isContentEditable)
  )
    return;
  if (event.key === "ArrowLeft" && navigator.hasPrev.value) {
    event.preventDefault();
    navigator.goPrev();
  } else if (event.key === "ArrowRight" && navigator.hasNext.value) {
    event.preventDefault();
    navigator.goNext();
  }
}

onMounted(() => {
  document.addEventListener("keydown", onKey);
  if (props.modelValue) {
    void navigator.ensureLoaded(route.query);
    void loadView();
  }
});
onBeforeUnmount(() => document.removeEventListener("keydown", onKey));

/** URL de la ficha dedicada, sin el `view` que mantiene abierto el drawer. */
const fullPageHref = computed(() => {
  if (!props.viewId) return undefined;
  const query = { ...route.query };
  delete query.view;
  return router.resolve({
    name: "cargo-detail",
    params: { id: String(props.viewId) },
    query,
  }).href;
});
</script>

<style scoped>
.cdo-card {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.cdo-drawer {
  /* El ancho lo fija `drawerWidth` (70% del viewport, tope 1280px). Aqui solo
     se garantiza que nunca desborde en pantallas estrechas. */
  max-width: 100vw;
}
.cdo-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  border-bottom: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  background: rgb(var(--v-theme-surface));
  flex: 0 0 auto;
}
.cdo-nav {
  display: flex;
  align-items: center;
  gap: 2px;
}
.cdo-pos {
  min-width: 56px;
  text-align: center;
  font-size: 12px;
  color: rgb(var(--v-theme-on-surface-variant));
  font-variant-numeric: tabular-nums;
}
.cdo-title {
  display: flex;
  align-items: center;
  font-size: 14px;
  font-weight: 600;
}
.cdo-loading {
  margin-left: 6px;
  font-size: 12px;
  font-weight: 400;
  opacity: 0.6;
}
.cdo-body {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  padding: 8px;
}
</style>
