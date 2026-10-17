<template>
  <!--
    EntityNewPage — shared "create a new shipment" landing for the express
    SPAs (cargo + courier). Mirrors the legacy draft-on-client flow: pick a
    client, hit "Crea", the backend creates a draft and we navigate to the
    detail screen that already exists. Cargo and shipment differ only in
    labels, the create function, the detail path and any extra required
    fields — all injected via props / the `extra-fields` slot — so the page
    itself is written ONCE here.
  -->
  <div class="shipment-v2">
    <DetailShell storage-key="tmwe:detail-sidebar">
      <template #topbar-title>
        <div class="enp-title">
          <v-icon :icon="icon" size="20" class="mr-2" />
          <span>{{ t('platform.entity_new.topbar_title', { entity: entityLabel }) }}</span>
        </div>
      </template>

      <v-card border class="enp-card pa-6 ma-4" max-width="640">
        <v-card-title class="text-h6 px-0 pt-0">
          {{ t('platform.entity_new.card_title', { entity: entityLabel }) }}
        </v-card-title>
        <v-card-subtitle class="px-0">
          {{ t('platform.entity_new.subtitle') }}
        </v-card-subtitle>

        <v-card-text class="px-0">
          <v-autocomplete
            :model-value="clientId"
            :items="mergedItems"
            :loading="searching"
            item-title="label"
            item-value="id"
            :label="t('platform.entity_new.client_label')"
            :placeholder="t('platform.entity_new.client_placeholder')"
            prepend-inner-icon="mdi-account-search"
            variant="outlined"
            density="comfortable"
            no-filter
            hide-no-data
            clearable
            autofocus
            @update:search="onSearch"
            @update:model-value="onPick"
          >
            <template #item="{ props: itemProps, item }">
              <v-list-item v-bind="itemProps" :title="item.raw.label" />
            </template>
          </v-autocomplete>

          <!-- Per-entity extra fields (e.g. express sede selection). The slot
               receives the currently-selected client id so the wrapper can load
               dependent data (sedi_interne) and reset when the client changes.
               The wrapper owns its own refs and drives validity via
               `extra-valid` + the create payload. -->
          <slot name="extra-fields" :client-id="clientId" />
        </v-card-text>

        <v-card-actions class="px-0">
          <span v-if="disabledReason" class="text-caption text-medium-emphasis">
            {{ disabledReason }}
          </span>
          <v-spacer />
          <v-btn variant="text" :href="cancelHref">{{ t('platform.entity_new.cancel') }}</v-btn>
          <v-btn
            color="primary"
            variant="flat"
            :loading="saving"
            :disabled="!canSubmit"
            prepend-icon="mdi-check"
            @click="submit"
          >
            {{ t('platform.entity_new.create') }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </DetailShell>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import DetailShell from './DetailShell.vue';
import { moduleHref } from '../platform/navTargets';

const { t } = useI18n();

interface ClientItem {
  id: number;
  label: string;
}

const props = withDefaults(
  defineProps<{
    /** Lowercase entity noun for labels, e.g. 'cargo' | 'spedizione'. */
    entityLabel: string;
    /** Topbar/card icon. */
    icon?: string;
    /** Free-text client search — injected by the app's anagrafica service. */
    searchClients: (text: string) => Promise<ClientItem[]>;
    /** Performs the POST and resolves to the new entity id (or null). */
    createFn: (customerId: number, extra: Record<string, unknown>) => Promise<number | null>;
    /** Builds the absolute detail URL for the created entity. */
    buildDetailPath: (id: number) => string;
    /** Extra payload merged into the create call (e.g. {destination_address}). */
    extraPayload?: Record<string, unknown>;
    /**
     * Gate submit on extra required fields. Default TRUE (no extra fields).
     * NB: must be a real default, not `?? true` at the use site — Vue casts an
     * *unpassed* Boolean prop to `false` (not undefined), so a page that omits
     * `:extra-valid` (e.g. shipment/new: client only) would otherwise disable
     * the button forever.
     */
    extraValid?: boolean;
    /** Where "Annulla" goes. Default the global home. */
    cancelHref?: string;
  }>(),
  {
    icon: undefined,
    extraPayload: undefined,
    extraValid: true,
    cancelHref: undefined,
  },
);

const icon = computed(() => props.icon ?? 'mdi-plus-box');
// Default vía moduleHref('home'): bajo el cutover → `/operations#/home`
// (cambio de hash, sin recarga ni 302); en apps viejas → `/home`.
const cancelHref = computed(() => props.cancelHref ?? moduleHref('home'));

// v-model is the numeric id (item-value). We keep the chosen option around
// separately and MERGE it into the items list so its title always resolves
// even after the search results are replaced — without `return-object`, which
// in Vuetify 3.7 silently drops the selection when the items array changes.
const clientId = ref<number | null>(null);
const clientItems = ref<ClientItem[]>([]);
const selectedItem = ref<ClientItem | null>(null);
const searching = ref(false);
const saving = ref(false);

/** Items shown by the autocomplete: search results plus the current pick. */
const mergedItems = computed<ClientItem[]>(() => {
  const sel = selectedItem.value;
  if (!sel) return clientItems.value;
  return clientItems.value.some((i) => i.id === sel.id)
    ? clientItems.value
    : [sel, ...clientItems.value];
});

/**
 * Single source of truth for the selection. We drive the autocomplete with
 * `:model-value` (one-way) + this handler instead of `v-model` so nothing can
 * race us: we set BOTH the id (gates the button) and the full option (keeps
 * the title in the merged list) here, atomically.
 */
function onPick(id: number | null): void {
  clientId.value = id == null ? null : Number(id);
  selectedItem.value =
    id == null ? null : mergedItems.value.find((i) => i.id === Number(id)) ?? selectedItem.value;
}

let searchToken = 0;
async function onSearch(text: string): Promise<void> {
  const q = (text ?? '').trim();
  // Vuetify fires update:search with the selected option's title right after
  // a pick — ignore it so we don't run a pointless second search.
  if (selectedItem.value && q === selectedItem.value.label) return;
  if (q.length < 2) {
    clientItems.value = [];
    return;
  }
  const token = ++searchToken;
  searching.value = true;
  try {
    const items = await props.searchClients(q);
    // Drop stale responses if a newer search started meanwhile.
    if (token === searchToken) clientItems.value = items;
  } finally {
    if (token === searchToken) searching.value = false;
  }
}

const canSubmit = computed(
  () => clientId.value !== null && props.extraValid && !saving.value,
);

/** Tell the operator why "Crea" is still disabled (client vs extra fields). */
const disabledReason = computed<string | null>(() => {
  if (saving.value) return null;
  if (clientId.value === null) return t('platform.entity_new.select_client') as string;
  if (!props.extraValid) return t('platform.entity_new.complete_required') as string;
  return null;
});

async function submit(): Promise<void> {
  if (clientId.value === null || !canSubmit.value) return;
  saving.value = true;
  try {
    const id = await props.createFn(clientId.value, props.extraPayload ?? {});
    if (id) {
      // Real browser navigation into the (separately-bundled) detail SPA.
      window.location.assign(props.buildDetailPath(id));
    }
  } finally {
    saving.value = false;
  }
}
</script>

<style scoped>
.enp-title {
  display: flex;
  align-items: center;
  font-weight: 600;
}
.enp-card {
  width: 100%;
}
</style>
