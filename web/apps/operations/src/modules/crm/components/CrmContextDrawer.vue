<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import { useRouter } from "vue-router";
import { useI18n } from "vue-i18n";

import { useCrmStore, type CrmDetailLoadResult } from "../stores/crm.store";
import type { CrmPratica } from "../types";
import CrmEventiSection from "./CrmEventiSection.vue";
import CrmMessaggiSection from "./CrmMessaggiSection.vue";
import CrmSendMessageDialog from "./CrmSendMessageDialog.vue";

export interface CrmContextItem {
  id: number;
  stato_pratica: string;
  oggetto?: string;
  data_next?: string | null;
  last_activity?: string | null;
}

export interface CrmContextDrawerHandle {
  open: (id: number, seed?: CrmPratica | null) => Promise<CrmDetailLoadResult>;
}

const props = withDefaults(
  defineProps<{
    modelValue: boolean;
    shipmentId: number;
    entityKind?: "shipment" | "cargo";
    items: CrmContextItem[];
    initialId?: number | null;
  }>(),
  { entityKind: "shipment", initialId: null },
);
const emit = defineEmits<{
  (e: "update:modelValue", value: boolean): void;
  (e: "changed"): void;
}>();

const store = useCrmStore();
const router = useRouter();
const { t } = useI18n();
const selectedId = ref<number | null>(null);
const tab = ref<"events" | "messages">("events");
const showSend = ref(false);
let programmaticOpenId: number | null = null;

type DrawerState = "loading" | "ready" | "partial" | "error" | "empty";

const selectedSummary = computed(
  () => props.items.find((item) => item.id === selectedId.value) ?? null,
);
const visibleId = computed(
  () => selectedId.value ?? props.initialId ?? props.items[0]?.id ?? null,
);
const contextTitleKey = computed(() =>
  props.entityKind === "cargo"
    ? "crm.context.cargo_title"
    : "crm.context.shipment_title",
);
const drawerState = computed<DrawerState>(() => {
  if (store.loadingDetail) return "loading";
  if (
    store.current &&
    (store.error || store.eventsError || store.messagesError)
  ) {
    return "partial";
  }
  if (store.current) return "ready";
  if (store.error) return "error";
  return "empty";
});
const fullPageHref = computed(() => {
  if (!selectedId.value) return "";
  return router.resolve({
    name: "crm-detail",
    params: { id: String(selectedId.value) },
    query: { from_shipment: String(props.shipmentId) },
  }).href;
});
const selectorItems = computed(() =>
  props.items.map((item) => ({
    title:
      item.oggetto?.trim() || t("crm.context.case_fallback", { id: item.id }),
    subtitle: t("crm.context.case_option", {
      subject: item.oggetto?.trim() || t("crm.detail.title"),
      status: t(`crm.stato.${item.stato_pratica}`),
      id: item.id,
    }),
    value: item.id,
  })),
);

async function loadSelected(
  seed: CrmPratica | null = null,
): Promise<CrmDetailLoadResult> {
  if (!selectedId.value) return { state: "error", crm: null };
  return store.fetchDetail(selectedId.value, seed);
}

async function open(
  id: number,
  seed: CrmPratica | null = null,
): Promise<CrmDetailLoadResult> {
  programmaticOpenId = id;
  selectedId.value = id;
  tab.value = "events";
  emit("update:modelValue", true);
  const result = loadSelected(seed);
  await nextTick();
  if (programmaticOpenId === id) programmaticOpenId = null;
  return result;
}

defineExpose<CrmContextDrawerHandle>({ open });

function close(): void {
  store.cancelDetailLoad(selectedId.value);
  emit("update:modelValue", false);
  emit("changed");
}

function onDrawerModel(value: boolean): void {
  emit("update:modelValue", value);
  if (!value) {
    store.cancelDetailLoad(selectedId.value);
    emit("changed");
  }
}

function retry(): void {
  void loadSelected();
}

function retryEvents(): void {
  if (selectedId.value) void store.fetchEvents(selectedId.value);
}

function retryMessages(): void {
  if (selectedId.value) void store.fetchMessages(selectedId.value);
}

watch(
  () => props.modelValue,
  (open) => {
    if (!open) return;
    const nextId =
      programmaticOpenId ?? props.initialId ?? props.items[0]?.id ?? null;
    tab.value = "events";
    if (selectedId.value !== nextId) {
      selectedId.value = nextId;
      return;
    }
    if (programmaticOpenId === nextId) {
      programmaticOpenId = null;
      return;
    }
    void loadSelected();
  },
  { immediate: true },
);

watch(selectedId, (id, previous) => {
  if (props.modelValue && id && id !== previous && programmaticOpenId !== id) {
    void loadSelected();
  }
});
</script>

<template>
  <v-navigation-drawer
    :model-value="modelValue"
    location="right"
    temporary
    :width="720"
    class="crm-context"
    data-testid="crm-context-drawer"
    :data-crm-state="drawerState"
    :aria-busy="drawerState === 'loading'"
    @update:model-value="onDrawerModel"
  >
    <div class="crm-context__head">
      <v-btn
        icon="mdi-close"
        variant="text"
        size="small"
        :aria-label="t('common.close')"
        data-testid="crm-close"
        @click="close"
      />
      <div class="crm-context__heading">
        <div class="text-subtitle-1 font-weight-medium">
          {{ t(contextTitleKey, { id: shipmentId }) }}
        </div>
        <div v-if="selectedSummary" class="text-caption text-medium-emphasis">
          {{
            selectedSummary.oggetto ||
            t("crm.context.case_fallback", { id: selectedSummary.id })
          }}
        </div>
        <div v-else-if="visibleId" class="text-caption text-medium-emphasis">
          {{ t("crm.context.case_fallback", { id: visibleId }) }}
        </div>
      </div>
      <v-chip v-if="store.current" size="small" variant="tonal" label>
        {{ t(`crm.stato.${store.current.stato_pratica}`) }}
      </v-chip>
      <v-spacer />
      <v-btn
        v-if="store.current && !store.error"
        color="primary"
        variant="tonal"
        size="small"
        prepend-icon="mdi-email-fast-outline"
        @click="showSend = true"
      >
        {{ t("crm.send.button") }}
      </v-btn>
      <v-btn
        v-if="fullPageHref"
        :href="fullPageHref"
        target="_blank"
        rel="noopener"
        icon="mdi-open-in-new"
        variant="text"
        size="small"
        :title="t('crm.context.open_full')"
      />
    </div>

    <v-divider />

    <div class="crm-context__body">
      <v-select
        v-if="items.length > 1"
        v-model="selectedId"
        :items="selectorItems"
        item-title="title"
        item-value="value"
        :label="t('crm.context.case_selector')"
        density="compact"
        variant="outlined"
        hide-details
        class="mb-3"
      />

      <v-alert
        v-if="store.error && store.current"
        type="warning"
        variant="tonal"
        density="compact"
        class="mb-3"
      >
        {{ t("crm.context.partial_error") }}
        <template #append>
          <v-btn
            variant="text"
            size="small"
            data-testid="crm-retry"
            @click="retry"
          >
            {{ t("common.retry") }}
          </v-btn>
        </template>
      </v-alert>

      <v-progress-linear
        v-if="store.loadingDetail"
        indeterminate
        class="mb-3"
      />

      <v-skeleton-loader
        v-if="store.loadingDetail && !store.current"
        type="list-item-two-line, divider, list-item-three-line"
        data-testid="crm-loading"
      />

      <div
        v-else-if="store.error && !store.current"
        class="crm-context__state"
        role="alert"
        data-testid="crm-error"
      >
        <v-icon icon="mdi-alert-circle-outline" size="34" color="error" />
        <div class="text-subtitle-1 font-weight-medium">
          {{ t("crm.context.load_error_title") }}
        </div>
        <div class="text-body-2 text-medium-emphasis">
          {{ t("crm.context.load_error_body", { id: visibleId || "—" }) }}
        </div>
        <div class="d-flex ga-2 mt-2">
          <v-btn
            color="primary"
            variant="tonal"
            prepend-icon="mdi-refresh"
            data-testid="crm-retry"
            @click="retry"
          >
            {{ t("common.retry") }}
          </v-btn>
          <v-btn variant="text" data-testid="crm-error-close" @click="close">
            {{ t("common.close") }}
          </v-btn>
        </div>
      </div>

      <div
        v-else-if="!store.current"
        class="crm-context__state"
        data-testid="crm-empty"
      >
        <v-icon
          icon="mdi-folder-open-outline"
          size="34"
          class="text-medium-emphasis"
        />
        <div class="text-subtitle-1 font-weight-medium">
          {{ t("crm.context.empty_title") }}
        </div>
        <div class="text-body-2 text-medium-emphasis">
          {{ t("crm.context.empty_body") }}
        </div>
        <v-btn variant="text" class="mt-2" @click="close">
          {{ t("common.close") }}
        </v-btn>
      </div>

      <template v-else>
        <div class="crm-context__summary">
          <div>
            <span class="crm-context__label">{{
              t("crm.field.data_next")
            }}</span>
            <span>{{ store.current.data_next || "—" }}</span>
          </div>
          <div>
            <span class="crm-context__label">{{ t("crm.field.nome") }}</span>
            <span>{{ store.current.nome || store.current.email || "—" }}</span>
          </div>
        </div>

        <v-tabs v-model="tab" density="compact" color="primary" class="mb-3">
          <v-tab value="events" prepend-icon="mdi-timeline-text-outline">
            {{ t("crm.eventi.title") }} ({{ store.events.length }})
            <v-progress-circular
              v-if="store.loadingEvents"
              indeterminate
              size="14"
              width="2"
              class="ms-2"
            />
          </v-tab>
          <v-tab value="messages" prepend-icon="mdi-email-outline">
            {{ t("crm.messaggi.title") }} ({{ store.messages.length }})
            <v-progress-circular
              v-if="store.loadingMessages"
              indeterminate
              size="14"
              width="2"
              class="ms-2"
            />
          </v-tab>
        </v-tabs>

        <v-window v-model="tab">
          <v-window-item value="events">
            <v-alert
              v-if="store.eventsError"
              type="warning"
              variant="tonal"
              density="compact"
              class="mb-3"
              data-testid="crm-events-error"
            >
              {{ t("crm.context.events_error") }}
              <template #append>
                <v-btn variant="text" size="small" @click="retryEvents">
                  {{ t("common.retry") }}
                </v-btn>
              </template>
            </v-alert>
            <v-skeleton-loader
              v-if="store.loadingEvents && !store.events.length"
              type="list-item-three-line, list-item-three-line"
            />
            <CrmEventiSection v-else :id-crm="store.current.id" />
          </v-window-item>
          <v-window-item value="messages">
            <v-alert
              v-if="store.messagesError"
              type="warning"
              variant="tonal"
              density="compact"
              class="mb-3"
              data-testid="crm-messages-error"
            >
              {{ t("crm.context.messages_error") }}
              <template #append>
                <v-btn variant="text" size="small" @click="retryMessages">
                  {{ t("common.retry") }}
                </v-btn>
              </template>
            </v-alert>
            <v-skeleton-loader
              v-if="store.loadingMessages && !store.messages.length"
              type="table-heading, table-tbody"
            />
            <CrmMessaggiSection v-else :id-crm="store.current.id" />
          </v-window-item>
        </v-window>
      </template>
    </div>

    <CrmSendMessageDialog
      v-if="store.current"
      v-model="showSend"
      :id-crm="store.current.id"
      :default-email="store.current.email"
      @update:model-value="!$event && emit('changed')"
    />
  </v-navigation-drawer>
</template>

<style scoped>
.crm-context__head {
  min-height: 64px;
  padding: 10px 12px;
  display: flex;
  align-items: center;
  gap: 8px;
}
.crm-context__heading {
  min-width: 0;
}
.crm-context__body {
  padding: 16px;
}
.crm-context__state {
  min-height: 260px;
  padding: 32px 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  text-align: center;
}
.crm-context__summary {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  padding: 12px;
  margin-bottom: 12px;
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  border-radius: 10px;
}
.crm-context__summary > div {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.crm-context__label {
  font-size: 11px;
  color: rgba(var(--v-theme-on-surface), 0.6);
}
@media (max-width: 700px) {
  .crm-context {
    width: 100% !important;
  }
  .crm-context__summary {
    grid-template-columns: 1fr;
  }
}
</style>
