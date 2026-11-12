<template>
  <v-dialog
    :model-value="modelValue"
    max-width="560"
    persistent
    @update:model-value="onToggle"
  >
    <v-card data-testid="giac-create-dialog">
      <v-card-title class="giac-create__title">{{
        t("giacenze.giacenze.create.title")
      }}</v-card-title>
      <v-card-text>
        <p class="giac-create__lead">
          {{ t("giacenze.giacenze.create.lead") }}
        </p>

        <!-- Buscador de envío: por id, AWB o texto; evita teclear el id a ciegas. -->
        <v-autocomplete
          v-model="shipmentId"
          v-model:search="query"
          :items="options"
          :loading="searching"
          :label="t('giacenze.giacenze.create.shipment')"
          :hint="t('giacenze.giacenze.create.shipmentHint')"
          persistent-hint
          item-title="title"
          item-value="id"
          no-filter
          clearable
          autofocus
          data-testid="giac-create-shipment"
          :no-data-text="
            query.length < 2
              ? t('giacenze.giacenze.create.typeToSearch')
              : t('common.noData')
          "
          @update:model-value="onPick"
        >
          <template #item="{ props: itemProps, item }">
            <v-list-item v-bind="itemProps" :subtitle="item.raw.subtitle" />
          </template>
        </v-autocomplete>

        <v-alert
          v-if="existingOpen > 0"
          type="info"
          variant="tonal"
          density="compact"
          class="mt-3"
          data-testid="giac-create-existing"
        >
          {{ t("giacenze.giacenze.create.existing") }}
        </v-alert>
        <v-alert
          v-else-if="shipmentId"
          type="warning"
          variant="tonal"
          density="compact"
          class="mt-3"
          data-testid="giac-create-notice"
        >
          {{ t("giacenze.giacenze.create.willNotify") }}
        </v-alert>
        <p v-if="error" class="giac-create__error" role="alert">{{ error }}</p>
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="close">{{ t("common.cancel") }}</v-btn>
        <v-btn
          color="primary"
          :disabled="!shipmentId"
          :loading="saving"
          data-testid="giac-create-submit"
          @click="submit"
        >
          {{
            existingOpen > 0
              ? t("giacenze.giacenze.create.openExisting")
              : t("giacenze.giacenze.create.submit")
          }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { giacenzeService } from "../services/giacenze.service";
import { shipmentListService } from "../../shipment/services/shipment.service";
import { emptyFilters, type Giacenza } from "../types";

const props = defineProps<{ modelValue: boolean }>();
const emit = defineEmits<{
  "update:modelValue": [value: boolean];
  created: [giacenza: Giacenza];
}>();

const { t } = useI18n();

interface Option {
  id: number;
  title: string;
  subtitle: string;
}

const shipmentId = ref<number | null>(null);
const query = ref("");
const options = ref<Option[]>([]);
const searching = ref(false);
const saving = ref(false);
const error = ref("");
/** Giacenze abiertas que ya tiene el envío elegido (find-or-create: se abriría esa). */
const existingOpen = ref(0);
let timer: ReturnType<typeof setTimeout> | undefined;

function toOption(r: {
  id: number;
  awb: string;
  cliente: string;
  destination?: { name?: string; city?: string };
}): Option {
  const dest = [r.destination?.name, r.destination?.city]
    .filter(Boolean)
    .join(" · ");
  return {
    id: r.id,
    title: `#${r.id}${r.awb ? ` · ${r.awb}` : ""} · ${r.cliente ?? ""}`.trim(),
    subtitle: dest,
  };
}

async function search(text: string): Promise<void> {
  searching.value = true;
  try {
    const res = await shipmentListService.fetch({
      search: text,
      per_page: 15,
    } as never);
    const found = (res.data ?? []).map(toOption);
    // Conserva la opción ya elegida para que el campo no pierda su etiqueta.
    const keep = options.value.find((o) => o.id === shipmentId.value);
    options.value =
      keep && !found.some((o) => o.id === keep.id) ? [keep, ...found] : found;
  } catch {
    options.value = options.value.filter((o) => o.id === shipmentId.value);
  } finally {
    searching.value = false;
  }
}

watch(query, (text) => {
  clearTimeout(timer);
  const q = (text ?? "").trim();
  // Al elegir, el campo vuelve a mostrar el título: no relanzar la búsqueda con ese texto.
  if (q.length < 2 || options.value.some((o) => o.title === q)) return;
  timer = setTimeout(() => void search(q), 300);
});

async function onPick(id: number | null): Promise<void> {
  existingOpen.value = 0;
  error.value = "";
  if (!id) return;
  try {
    existingOpen.value = await giacenzeService.count({
      ...emptyFilters(),
      id_spedizione: id,
      closed: "N",
    });
  } catch {
    existingOpen.value = 0;
  }
}

async function submit(): Promise<void> {
  if (!shipmentId.value) return;
  saving.value = true;
  error.value = "";
  try {
    const g = await giacenzeService.createFromShipment(shipmentId.value);
    emit("created", g);
    close();
  } catch (e) {
    error.value =
      e instanceof Error && e.message
        ? e.message
        : t("giacenze.giacenze.create.failed");
  } finally {
    saving.value = false;
  }
}

function close(): void {
  emit("update:modelValue", false);
}

function onToggle(v: boolean): void {
  if (!v) close();
}

watch(
  () => props.modelValue,
  (open) => {
    if (!open) return;
    shipmentId.value = null;
    query.value = "";
    options.value = [];
    existingOpen.value = 0;
    error.value = "";
  },
);
</script>

<style scoped>
.giac-create__title {
  font-size: 1.1rem;
  font-weight: 600;
}
.giac-create__lead {
  margin: 0 0 12px;
  color: var(--cm-text-secondary, #64748b);
  font-size: 0.9rem;
}
.giac-create__error {
  margin: 12px 0 0;
  color: rgb(var(--v-theme-error));
}
</style>
