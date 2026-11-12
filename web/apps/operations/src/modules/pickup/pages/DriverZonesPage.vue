<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { driverService } from "../services/driver.service";
import { isValidCap, zoneChanges, zoneFailures } from "../logic";
import type { DriverZone, Province, ZoneSaveItem } from "../types";

const { t } = useI18n();

const provinces = ref<Province[]>([]);
const selectedProvincia = ref<string | null>(null);
const zones = ref<DriverZone[]>([]);
const loading = ref(false);
const saving = ref(false);
const error = ref<string | null>(null);

/** Ediciones pendientes: CAP → nuevo contacto (0 = quitar). Nada se guarda hasta «Guardar». */
const edits = ref<Record<string, number>>({});
const saveResult = ref<ZoneSaveItem[] | null>(null);

// alta de un CAP nuevo (queda pendiente como una edición más)
const newCap = ref("");
const newContatto = ref<number | null>(null);

const changes = computed(() => zoneChanges(zones.value, edits.value));
const failed = computed(() => zoneFailures(saveResult.value ?? []));
const newCapValid = computed(() => isValidCap(newCap.value));

/** CAP que se muestran: los de la provincia más los nuevos pendientes. */
const rows = computed(() => {
  const known = new Set(zones.value.map((z) => z.cap));
  const extra = Object.keys(edits.value)
    .filter((cap) => !known.has(cap))
    .map((cap) => ({ cap, id_contatto: 0, nome_autista: "", isNew: true }));
  return [
    ...zones.value.map((z) => ({ ...z, isNew: false })),
    ...extra,
  ];
});

function valueOf(cap: string, original: number): number {
  return cap in edits.value ? edits.value[cap] : original;
}

function isDirty(cap: string): boolean {
  return changes.value.some((c) => c.cap === cap);
}

function setEdit(cap: string, value: unknown): void {
  const n = Number(value);
  edits.value = { ...edits.value, [cap]: Number.isFinite(n) && n > 0 ? Math.trunc(n) : 0 };
}

function markRemove(cap: string): void {
  edits.value = { ...edits.value, [cap]: 0 };
}

function discard(): void {
  edits.value = {};
  saveResult.value = null;
}

function addPending(): void {
  if (!newCapValid.value || !newContatto.value) return;
  edits.value = { ...edits.value, [newCap.value.trim()]: newContatto.value };
  newCap.value = "";
  newContatto.value = null;
}

async function loadProvinces(): Promise<void> {
  try {
    provinces.value = await driverService.provinces();
  } catch (e) {
    error.value = e instanceof Error ? e.message : t("errors.load");
  }
}

async function loadZones(): Promise<void> {
  if (!selectedProvincia.value) return;
  loading.value = true;
  error.value = null;
  edits.value = {};
  saveResult.value = null;
  try {
    const res = await driverService.zonesByProvincia(selectedProvincia.value);
    zones.value = res.zones;
  } catch (e) {
    error.value = e instanceof Error ? e.message : t("errors.load");
  } finally {
    loading.value = false;
  }
}

/** Guarda en lote; los CAP que fallan siguen pendientes para reintentar. */
async function save(): Promise<void> {
  if (changes.value.length === 0) return;
  saving.value = true;
  error.value = null;
  try {
    const items = await driverService.saveZones(changes.value);
    const failedCaps = new Set(zoneFailures(items).map((i) => i.cap));
    const remaining: Record<string, number> = {};
    for (const [cap, v] of Object.entries(edits.value)) {
      if (failedCaps.has(cap)) remaining[cap] = v;
    }
    saveResult.value = items;
    if (selectedProvincia.value) {
      const res = await driverService.zonesByProvincia(selectedProvincia.value);
      zones.value = res.zones;
    }
    edits.value = remaining;
  } catch (e) {
    error.value = e instanceof Error ? e.message : t("errors.action");
  } finally {
    saving.value = false;
  }
}

onMounted(loadProvinces);
</script>

<template>
  <div class="pk-page">
    <header class="pk-page-head">
      <h1 class="pk-page-title">{{ t("pickup.zones.title") }}</h1>
      <v-select
        v-model="selectedProvincia"
        :items="provinces"
        item-title="id_provincia"
        item-value="id_provincia"
        :label="t('pickup.zones.provincia')"
        density="compact"
        variant="outlined"
        hide-details
        style="max-width: 200px"
        :disabled="changes.length > 0"
        @update:model-value="loadZones"
      />
    </header>

    <v-alert
      v-if="error"
      type="error"
      variant="tonal"
      density="compact"
      class="mb-3"
    >
      {{ error }}
    </v-alert>

    <v-alert
      v-if="saveResult"
      :type="failed.length ? 'warning' : 'success'"
      variant="tonal"
      density="compact"
      class="mb-3"
    >
      {{
        t("pickup.zones.save_summary", {
          ok: saveResult.length - failed.length,
          failed: failed.length,
        })
      }}
      <ul v-if="failed.length" class="pk-fail">
        <li v-for="f in failed" :key="f.cap">{{ f.cap }} — {{ f.error }}</li>
      </ul>
    </v-alert>

    <div class="pk-add-zone mb-4">
      <v-text-field
        v-model="newCap"
        :label="t('pickup.zones.cap')"
        :error="newCap !== '' && !newCapValid"
        density="compact"
        variant="outlined"
        hide-details
        style="max-width: 140px"
      />
      <v-text-field
        v-model.number="newContatto"
        :label="t('pickup.zones.autista')"
        :hint="t('pickup.zones.autista_hint')"
        type="number"
        density="compact"
        variant="outlined"
        hide-details
        style="max-width: 160px"
      />
      <v-btn
        color="primary"
        variant="tonal"
        :disabled="!newCapValid || !newContatto"
        @click="addPending"
      >
        {{ t("pickup.zones.add") }}
      </v-btn>
    </div>

    <v-progress-linear v-if="loading" indeterminate class="mb-3" />

    <div v-if="!selectedProvincia && rows.length === 0" class="pk-empty">
      {{ t("pickup.zones.pick_provincia") }}
    </div>
    <div v-else-if="rows.length === 0 && !loading" class="pk-empty">
      {{ t("pickup.zones.empty") }}
    </div>

    <v-table v-else density="compact" class="pk-table">
      <thead>
        <tr>
          <th>{{ t("pickup.zones.cap") }}</th>
          <th>{{ t("pickup.zones.autista") }}</th>
          <th>{{ t("pickup.zones.current") }}</th>
          <th style="width: 60px"></th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="z in rows" :key="z.cap" :class="{ 'pk-dirty': isDirty(z.cap) }">
          <td>
            {{ z.cap }}
            <v-chip v-if="z.isNew" size="x-small" color="info" class="ml-1">{{
              t("pickup.zones.new")
            }}</v-chip>
          </td>
          <td>
            <v-text-field
              :model-value="valueOf(z.cap, z.id_contatto)"
              type="number"
              density="compact"
              variant="outlined"
              hide-details
              style="max-width: 140px"
              @update:model-value="setEdit(z.cap, $event)"
            />
          </td>
          <td>{{ z.nome_autista || (z.id_contatto ? `#${z.id_contatto}` : "—") }}</td>
          <td>
            <v-btn
              icon="mdi-delete"
              size="x-small"
              variant="text"
              color="error"
              :title="t('pickup.zones.delete_title')"
              @click="markRemove(z.cap)"
            />
          </td>
        </tr>
      </tbody>
    </v-table>

    <div v-if="changes.length" class="pk-savebar">
      <span>{{ t("pickup.zones.pending", { n: changes.length }) }}</span>
      <v-spacer />
      <v-btn variant="text" :disabled="saving" @click="discard">{{
        t("pickup.zones.discard")
      }}</v-btn>
      <v-btn color="primary" variant="flat" :loading="saving" @click="save">{{
        t("pickup.zones.save")
      }}</v-btn>
    </div>
  </div>
</template>

<style scoped>
.pk-page {
  padding: 24px;
  max-width: 700px;
}
.pk-page-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}
.pk-page-title {
  font-size: 1.5rem;
  font-weight: 600;
}
.pk-add-zone {
  display: flex;
  gap: 12px;
  align-items: center;
  flex-wrap: wrap;
}
.pk-empty {
  padding: 40px;
  text-align: center;
  color: rgba(var(--v-theme-on-surface), 0.5);
  border: 1px dashed rgba(var(--v-theme-on-surface), 0.15);
  border-radius: 8px;
}
.pk-table {
  border: 1px solid rgba(var(--v-theme-on-surface), 0.1);
  border-radius: 8px;
}
.pk-dirty {
  background: rgba(var(--v-theme-warning), 0.1);
}
.pk-savebar {
  position: sticky;
  bottom: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 12px;
  padding: 10px 12px;
  border-radius: 8px;
  background: rgb(var(--v-theme-surface));
  border: 1px solid rgba(var(--v-theme-on-surface), 0.15);
}
.pk-fail {
  margin: 4px 0 0;
  padding-left: 18px;
}
</style>
