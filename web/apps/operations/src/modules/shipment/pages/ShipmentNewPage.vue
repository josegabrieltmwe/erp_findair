<template>
  <!--
    Alta express: cliente (obligatorio) + sede del cliente (opcional). El resto
    de datos se completa después en el detalle. Paridad legacy
    (winbody.php?pp=spedy&ti=new + selector de sede del cliente).
  -->
  <EntityNewPage
    :entity-label="t('shipment.new.entity')"
    icon="mdi-package-variant-plus"
    :search-clients="searchClients"
    :create-fn="createFn"
    :build-detail-path="(id) => detailHref('shipment', id)"
  >
    <template #extra-fields="{ clientId }">
      <!-- Sincroniza el clientId del slot con nuestro estado (dispara la carga
           de sedes). Un watcher declarativo sin marcado visible. -->
      <ClientWatcher :client-id="clientId" @change="loadSedes" />

      <!-- Selector de sede del cliente. Se puebla al elegir cliente; se resetea
           si el cliente cambia. Opcional: si no se elige, el alta procede sin
           sede (se completa luego en el detalle). -->
      <v-autocomplete
        v-if="clientId"
        :model-value="sedeId"
        :items="sedeItems"
        :loading="loadingSedes"
        item-title="displayLabel"
        item-value="id"
        :label="t('shipment.new.sede_label')"
        :placeholder="t('shipment.new.sede_placeholder')"
        :no-data-text="t('shipment.new.sede_no_data')"
        prepend-inner-icon="mdi-office-building-outline"
        variant="outlined"
        density="comfortable"
        clearable
        class="mt-3"
        @update:model-value="onPickSede"
      >
        <!-- Con :model-value one-way (solo el id), Vuetify no resuelve el
             item-title; renderizamos la selección nosotros con el displayLabel
             del item elegido (nombre + ubicación). -->
        <template #selection>
          <span v-if="selectedSede">{{ selectedSede.displayLabel }}</span>
        </template>
        <template #item="{ props: itemProps, item }">
          <v-list-item
            v-bind="itemProps"
            :title="item.raw.label"
            :subtitle="sedeSubtitle(item.raw)"
          >
            <template v-if="Number(item.raw.id) === mainSedeId" #append>
              <v-chip size="x-small" color="primary" variant="tonal">
                {{ t("shipment.new.sede_main") }}
              </v-chip>
            </template>
          </v-list-item>
        </template>
      </v-autocomplete>
    </template>
  </EntityNewPage>
</template>

<script setup lang="ts">
import { ref, computed, defineComponent, h, watch } from "vue";
import { useI18n } from "vue-i18n";
import EntityNewPage from "@shared/detail/EntityNewPage.vue";
import { detailHref } from "@shared/platform/navTargets";
import {
  toClientOptions,
  type ClientOption,
} from "@tmwe/shared-frontend/composables/useEntityCreate";
import {
  anagraficaService,
  type AnagraficaSede,
} from "@shared/services/anagrafica.service";
import { useShipmentStore } from "@shipment/stores/shipment.store";

const { t } = useI18n();
const store = useShipmentStore();

const sedeItems = ref<SedeOption[]>([]);
const sedeId = ref<number | null>(null);
const mainSedeId = ref<number>(0);
const loadingSedes = ref(false);
// Cliente para el que están cargadas las sedes (evita recargas redundantes).
const loadedForClient = ref<number | null>(null);

// Componente invisible que emite `change` cuando el clientId del slot cambia.
// Es la vía limpia de reaccionar a una prop de scope de slot desde <script setup>.
const ClientWatcher = defineComponent({
  props: {
    clientId: { type: Number as () => number | null, default: null },
  },
  emits: ["change"],
  setup(props, { emit }) {
    watch(
      () => props.clientId,
      (id) => emit("change", id),
      { immediate: true },
    );
    return () => h("span", { style: "display:none" });
  },
});

async function searchClients(text: string): Promise<ClientOption[]> {
  return toClientOptions(await anagraficaService.search(text));
}

// Sede con etiqueta de visualización (nombre + ubicación) para que el campo
// seleccionado y la lista muestren algo legible, no solo el `label` (que a
// veces es un código).
interface SedeOption extends AnagraficaSede {
  displayLabel: string;
}

function sedeSubtitle(s: AnagraficaSede): string {
  return [s.citta, s.cap, s.id_paese_iso].filter(Boolean).join(" · ");
}

/** "Nombre — Ciudad (PAÍS)". Si no hay ubicación, solo el nombre. */
function buildDisplayLabel(s: AnagraficaSede): string {
  const name = (s.label ?? "").trim() || `#${s.id}`;
  const loc = [s.citta, s.id_paese_iso].filter(Boolean).join(", ");
  return loc ? `${name} — ${loc}` : name;
}

function onPickSede(id: number | null): void {
  sedeId.value = id == null ? null : Number(id);
}

/** Sede actualmente seleccionada (para renderizar la selección con displayLabel). */
const selectedSede = computed<SedeOption | null>(
  () => sedeItems.value.find((s) => Number(s.id) === sedeId.value) ?? null,
);

/** Carga las sedes del cliente elegido; resetea al cambiar de cliente. */
async function loadSedes(clientId: number | null): Promise<void> {
  if (clientId === loadedForClient.value) return;
  loadedForClient.value = clientId;
  sedeId.value = null;
  sedeItems.value = [];
  mainSedeId.value = 0;
  if (!clientId) return;
  loadingSedes.value = true;
  try {
    // Sedes + anagrafica (para conocer la sede principal = id_sedi_interna_fatt)
    // en paralelo.
    const [sedes, anag] = await Promise.all([
      anagraficaService.sedes(clientId),
      anagraficaService.getById(clientId),
    ]);
    mainSedeId.value = Number(
      (anag as { id_sedi_interna_fatt?: number | string } | null)
        ?.id_sedi_interna_fatt ?? 0,
    );
    const main = mainSedeId.value;
    // Orden: la sede principal (facturación) SIEMPRE primero; el resto
    // alfabético por label (case/acento-insensitive, locale-aware). Se añade
    // displayLabel (nombre + ubicación) para el campo y la lista.
    sedeItems.value = sedes
      .map((s): SedeOption => ({ ...s, displayLabel: buildDisplayLabel(s) }))
      .sort((a, b) => {
        const aMain = Number(a.id) === main;
        const bMain = Number(b.id) === main;
        if (aMain !== bMain) return aMain ? -1 : 1;
        return (a.label ?? "").localeCompare(b.label ?? "", undefined, {
          sensitivity: "base",
          numeric: true,
        });
      });
    // Preseleccionar: la sede principal si existe; si no, y hay una sola, esa.
    if (main > 0 && sedeItems.value.some((s) => Number(s.id) === main))
      sedeId.value = main;
    else if (sedeItems.value.length === 1)
      sedeId.value = Number(sedeItems.value[0].id);
  } finally {
    loadingSedes.value = false;
  }
}

// Express nace con id_cliente y, si se eligió, id_sede. El resto se edita luego.
function createFn(customerId: number): Promise<number | null> {
  const extra = sedeId.value != null ? { id_sede: sedeId.value } : {};
  return store.create(customerId, extra);
}
</script>
