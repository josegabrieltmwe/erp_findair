<template>
  <!-- Vista previa del proyecto (`?view=ID` en el listado): resumen y acciones rápidas. -->
  <v-navigation-drawer
    :model-value="modelValue"
    location="right"
    width="460"
    temporary
    @update:model-value="emit('update:modelValue', $event)"
  >
    <v-toolbar density="comfortable" flat color="surface-variant">
      <v-toolbar-title class="text-subtitle-1 font-weight-medium">
        {{
          project
            ? `#${project.id} · ${project.titolo}`
            : t("consolidata.preview.title")
        }}
      </v-toolbar-title>
      <v-btn
        icon="mdi-close"
        variant="text"
        size="small"
        :aria-label="t('consolidata.common.close')"
        @click="emit('update:modelValue', false)"
      />
    </v-toolbar>

    <v-progress-linear v-if="loading" indeterminate />
    <div class="pa-4">
      <ConsolidataApiError :error="error" @close="error = null" />
      <template v-if="project">
        <div class="d-flex flex-wrap ga-2 mb-3">
          <v-chip :color="stateColor(project.stato)" size="small">{{
            t(stateI18nKey(project.stato))
          }}</v-chip>
          <v-chip
            v-if="project.fase"
            :color="phaseColor(project.fase)"
            size="small"
            variant="tonal"
            >{{ t(phaseI18nKey(project.fase)) }}</v-chip
          >
        </div>
        <dl class="cons-dl">
          <dt>{{ t("filters.group.client") }}</dt>
          <dd>{{ project.cliente_nome || `#${project.id_cliente}` }}</dd>
          <dt>{{ t("consolidata.detail.routeLabel") }}</dt>
          <dd>
            {{ project.hub_terminal || "—" }} →
            {{ project.dest_country || "—" }}
          </dd>
          <dt>{{ t("consolidata.detail.assigneeLabel") }}</dt>
          <dd>
            {{
              project.assegnato_a
                ? project.assegnato_nome || `#${project.assegnato_a}`
                : t("consolidata.list.unassigned")
            }}
          </dd>
          <dt>{{ t("consolidata.list.headers.totale") }}</dt>
          <dd>{{ money(project.totale, project.valuta) }}</dd>
          <template v-if="project.risposta_at">
            <dt>{{ t("consolidata.list.headers.risposta") }}</dt>
            <dd>
              {{ answerMoney }}
              <span
                v-if="project.risposta_valida_fino"
                class="text-medium-emphasis"
              >
                · {{ shortDate(project.risposta_valida_fino) }}
              </span>
            </dd>
          </template>
          <dt>{{ t("consolidata.list.headers.n_spedizioni") }}</dt>
          <dd>{{ legsCount }}</dd>
          <template v-if="project.id_cargo">
            <dt>{{ t("consolidata.detail.cargoLabel") }}</dt>
            <dd>
              <router-link
                :to="{
                  name: 'cargo-detail',
                  params: { id: String(project.id_cargo) },
                }"
              >
                #{{ project.id_cargo }}
              </router-link>
            </dd>
          </template>
          <dt>{{ t("consolidata.detail.updatedLabel") }}</dt>
          <dd>{{ shortDate(project.modif_datetime) || "—" }}</dd>
        </dl>
        <p v-if="project.note_specialist" class="text-body-2 mt-3">
          {{ project.note_specialist }}
        </p>

        <div class="d-flex flex-wrap ga-2 mt-4">
          <v-btn
            color="primary"
            prepend-icon="mdi-open-in-app"
            :to="{
              name: 'consolidata-detail',
              params: { id: String(project.id) },
            }"
          >
            {{ t("consolidata.preview.open") }}
          </v-btn>
          <v-btn v-if="canTake" variant="tonal" :loading="taking" @click="take">
            {{ t("consolidata.actions.take") }}
          </v-btn>
        </div>
      </template>
    </div>
  </v-navigation-drawer>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useToastStore } from "@shared/anagrafiche/stores/toast.store";
import ConsolidataApiError from "./ConsolidataApiError.vue";
import {
  consolidataService,
  ConsolidataRequestError,
} from "../services/consolidata.service";
import { useConsolidataStore } from "../stores/consolidata.store";
import { useConsolidataListStore } from "../stores/consolidata_list.store";
import { useFormat } from "../composables/useFormat";
import {
  canTakeRow,
  normalizeApiError,
  phaseColor,
  phaseI18nKey,
  shortDate,
  stateColor,
  stateI18nKey,
} from "../logic";
import type { ConsolidataError, ProjectDetail } from "../types";

const props = defineProps<{ modelValue: boolean; viewId: number | null }>();
const emit = defineEmits<{
  (e: "update:modelValue", v: boolean): void;
  (e: "changed"): void;
}>();
const { t } = useI18n();
const { money } = useFormat();
const toast = useToastStore();
const detailStore = useConsolidataStore();
const listStore = useConsolidataListStore();

const project = ref<ProjectDetail | null>(null);
const loading = ref(false);
const taking = computed(() => listStore.takingId === project.value?.id);
const error = ref<ConsolidataError | null>(null);

const answerMoney = computed(() =>
  project.value
    ? money(
        project.value.risposta_prezzo ?? 0,
        project.value.risposta_valuta || project.value.valuta,
      )
    : "",
);
const legsCount = computed(() => project.value?.tratte?.length ?? 0);
const canTake = computed(() =>
  project.value
    ? canTakeRow(detailStore.actions, {
        stato: project.value.stato,
        assegnato_a: project.value.assegnato_a ?? null,
      })
    : false,
);

async function load(id: number): Promise<void> {
  loading.value = true;
  error.value = null;
  try {
    const res = await consolidataService.detail(id);
    if (props.viewId === id) project.value = res;
  } catch (err) {
    error.value =
      err instanceof ConsolidataRequestError
        ? err.info
        : normalizeApiError(err);
    project.value = null;
  } finally {
    loading.value = false;
  }
}

async function take(): Promise<void> {
  if (!project.value) return;
  const id = project.value.id;
  error.value = null;
  const err = await listStore.take(id);
  if (err) {
    error.value = err;
    return;
  }
  toast.success(t("consolidata.messages.taken"));
  emit("changed");
  await load(id);
}

watch(
  () => props.viewId,
  (id) => {
    project.value = null;
    if (id) void load(id);
  },
  { immediate: true },
);
</script>

<style scoped>
.cons-dl {
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: 6px 16px;
  font-size: 0.875rem;
}
.cons-dl dt {
  color: rgb(var(--v-theme-on-surface-variant));
}
.cons-dl dd {
  margin: 0;
}
</style>
