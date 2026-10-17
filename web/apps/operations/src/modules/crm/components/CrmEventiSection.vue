<script setup lang="ts">
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";

import { useCrmStore } from "../stores/crm.store";
import type { CrmEvento, StatoPratica } from "../types";

const props = defineProps<{ idCrm: number }>();

const store = useCrmStore();
const { t } = useI18n();

const newDescriz = ref("");
const newStato = ref<StatoPratica>("A");
const adding = ref(false);
const detailOpen = ref(false);
const selected = ref<CrmEvento | null>(null);
const editDescriz = ref("");
const editStato = ref<StatoPratica>("A");
const editData = ref("");
const saving = ref(false);

const statoIcon: Record<StatoPratica, string> = {
  A: "mdi-circle-outline",
  L: "mdi-clock-outline",
  C: "mdi-check-circle",
};
const statoColor: Record<StatoPratica, string> = {
  A: "success",
  L: "warning",
  C: "grey",
};

const events = computed(() => store.events);

// Fecha legible a partir del valor crudo del backend ('YYYY-MM-DD HH:mm:ss').
// Sin dependencias: parseo tolerante + toLocale. Devuelve el original si no
// se puede interpretar (nunca rompe la fila).
function formatWhen(raw: string): string {
  if (!raw) return "";
  const iso = raw.includes("T") ? raw : raw.replace(" ", "T");
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return raw;
  return d.toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

async function addEvent(): Promise<void> {
  if (!newDescriz.value.trim()) return;
  adding.value = true;
  try {
    await store.addEvent(props.idCrm, newDescriz.value.trim(), newStato.value);
    newDescriz.value = "";
    newStato.value = "A";
  } finally {
    adding.value = false;
  }
}

async function removeEvent(id: number): Promise<void> {
  await store.removeEvent(id, props.idCrm);
}

function toDateTimeLocal(raw: string): string {
  if (!raw) return "";
  return raw.replace(" ", "T").slice(0, 16);
}

function openDetail(event: CrmEvento): void {
  selected.value = event;
  editDescriz.value = event.descriz;
  editStato.value = event.stato_pratica;
  editData.value = toDateTimeLocal(event.data);
  detailOpen.value = true;
}

async function saveDetail(): Promise<void> {
  if (!selected.value || !editDescriz.value.trim() || !editData.value) return;
  saving.value = true;
  try {
    await store.updateEvent(selected.value.id, {
      descriz: editDescriz.value.trim(),
      stato_pratica: editStato.value,
      data: editData.value,
    });
    detailOpen.value = false;
  } finally {
    saving.value = false;
  }
}

async function deleteSelected(): Promise<void> {
  if (!selected.value) return;
  await removeEvent(selected.value.id);
  detailOpen.value = false;
}
</script>

<template>
  <v-card variant="flat" border rounded="lg">
    <v-card-title
      class="text-subtitle-2 font-weight-medium d-flex align-center py-3"
    >
      <v-icon icon="mdi-timeline-text-outline" size="18" class="me-2" />
      {{ t("crm.eventi.title") }}
    </v-card-title>
    <v-divider />
    <v-card-text>
      <!-- Alta de evento -->
      <div class="d-flex flex-wrap ga-2 mb-4 align-start">
        <v-select
          v-model="newStato"
          :items="[
            { title: t('crm.stato.A'), value: 'A' },
            { title: t('crm.stato.L'), value: 'L' },
            { title: t('crm.stato.C'), value: 'C' },
          ]"
          :label="t('crm.eventi.stato')"
          density="compact"
          variant="outlined"
          hide-details
          style="max-width: 160px"
        />
        <v-text-field
          v-model="newDescriz"
          :label="t('crm.eventi.descriz')"
          density="compact"
          variant="outlined"
          hide-details
          style="min-width: 280px; flex: 1"
          @keyup.enter="addEvent"
        />
        <v-btn
          color="primary"
          :loading="adding"
          :disabled="!newDescriz.trim()"
          prepend-icon="mdi-plus"
          @click="addEvent"
        >
          {{ t("crm.eventi.add") }}
        </v-btn>
      </div>

      <v-divider class="mb-2" />

      <div v-if="!events.length" class="text-medium-emphasis text-center py-4">
        {{ t("crm.eventi.empty") }}
      </div>

      <v-timeline
        v-else
        side="end"
        align="start"
        density="compact"
        truncate-line="both"
        class="ev-timeline"
      >
        <v-timeline-item
          v-for="ev in events"
          :key="ev.id"
          :dot-color="statoColor[ev.stato_pratica]"
          :icon="statoIcon[ev.stato_pratica]"
          size="small"
        >
          <div class="ev-item">
            <!-- Metadatos: estado (chip) + autor + fecha, y borrar a la derecha. -->
            <div class="ev-meta">
              <v-chip
                :color="statoColor[ev.stato_pratica]"
                size="x-small"
                variant="tonal"
                label
              >
                {{ t(`crm.stato.${ev.stato_pratica}`) }}
              </v-chip>
              <span class="ev-author">
                <v-icon icon="mdi-account-outline" size="12" class="me-1" />
                {{ ev.sender_name || `#${ev.id_contatto ?? "—"}` }}
              </span>
              <span class="ev-when">{{ formatWhen(ev.data) }}</span>
              <v-spacer />
              <v-tooltip location="top" :text="t('crm.eventi.view')">
                <template #activator="{ props: tp }">
                  <v-btn
                    v-bind="tp"
                    icon="mdi-eye-outline"
                    variant="text"
                    size="x-small"
                    class="ev-action"
                    @click="openDetail(ev)"
                  />
                </template>
              </v-tooltip>
              <v-tooltip location="top" :text="t('common.delete')">
                <template #activator="{ props: tp }">
                  <v-btn
                    v-bind="tp"
                    icon="mdi-delete-outline"
                    variant="text"
                    size="x-small"
                    color="error"
                    class="ev-action"
                    @click="removeEvent(ev.id)"
                  />
                </template>
              </v-tooltip>
            </div>
            <div class="ev-descriz text-body-2" @dblclick="openDetail(ev)">
              {{ ev.descriz }}
            </div>
          </div>
        </v-timeline-item>
      </v-timeline>
    </v-card-text>

    <v-dialog v-model="detailOpen" max-width="620">
      <v-card v-if="selected">
        <v-card-title class="d-flex align-center">
          <v-icon icon="mdi-timeline-text-outline" class="me-2" />
          {{ t("crm.eventi.detail_title", { id: selected.id }) }}
        </v-card-title>
        <v-card-subtitle>
          {{ selected.sender_name || `#${selected.id_contatto ?? "—"}` }}
        </v-card-subtitle>
        <v-card-text class="pt-5">
          <div class="d-flex flex-wrap ga-3 mb-4">
            <v-select
              v-model="editStato"
              :items="[
                { title: t('crm.stato.A'), value: 'A' },
                { title: t('crm.stato.L'), value: 'L' },
                { title: t('crm.stato.C'), value: 'C' },
              ]"
              :label="t('crm.eventi.stato')"
              density="compact"
              variant="outlined"
              hide-details
              style="min-width: 180px; flex: 1"
            />
            <v-text-field
              v-model="editData"
              type="datetime-local"
              :label="t('crm.eventi.data')"
              density="compact"
              variant="outlined"
              hide-details
              style="min-width: 230px; flex: 1"
            />
          </div>
          <v-textarea
            v-model="editDescriz"
            :label="t('crm.eventi.descriz')"
            variant="outlined"
            auto-grow
            rows="3"
          />
        </v-card-text>
        <v-card-actions>
          <v-btn color="error" variant="text" @click="deleteSelected">
            {{ t("common.delete") }}
          </v-btn>
          <v-spacer />
          <v-btn variant="text" @click="detailOpen = false">
            {{ t("common.cancel") }}
          </v-btn>
          <v-btn
            color="primary"
            :loading="saving"
            :disabled="!editDescriz.trim() || !editData"
            @click="saveDetail"
          >
            {{ t("common.save") }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-card>
</template>

<style scoped>
/* Cada avance: fila de metadatos arriba (estado · autor · fecha · borrar) y la
   descripción editable debajo. El botón de borrar sólo aparece al pasar el
   ratón sobre el ítem, para no ensuciar la lista. */
.ev-item {
  padding-bottom: 4px;
}
.ev-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 24px;
  font-size: 11px;
  color: rgba(var(--v-theme-on-surface), 0.7);
}
.ev-author {
  display: inline-flex;
  align-items: center;
  font-weight: 600;
  white-space: nowrap;
}
.ev-when {
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.ev-action {
  opacity: 0.65;
  transition: opacity 0.12s ease;
}
.ev-item:hover .ev-action,
.ev-action:focus-visible {
  opacity: 1;
}

/* Descripción del evento editable pero discreta: sin el chrome de un input,
   con un realce sutil al enfocar para indicar que es editable (autosave). */
.ev-descriz {
  line-height: 1.35;
  padding: 2px 4px;
  border-radius: 6px;
  white-space: pre-wrap;
}
</style>
