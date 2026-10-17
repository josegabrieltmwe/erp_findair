<template>
  <div>
    <v-alert type="info" variant="tonal" density="compact" class="mb-3">
      {{ t("invoicing.fiscal.panorama.intro") }}
    </v-alert>

    <div class="d-flex flex-wrap ga-3 align-center mb-3">
      <v-btn-toggle
        v-model="filtro"
        density="comfortable"
        variant="outlined"
        divided
        mandatory
      >
        <v-btn value="">
          {{ t("invoicing.fiscal.panorama.todos") }} ({{ partners.length }})
        </v-btn>
        <v-btn v-for="s in SEMAFOROS" :key="s" :value="s">
          <span class="sem" :class="`sem--${s}`" />
          {{ t(`invoicing.fiscal.panorama.sem.${s}`) }} ({{ count(s) }})
        </v-btn>
      </v-btn-toggle>
      <v-text-field
        v-model="buscar"
        :label="t('invoicing.fiscal.panorama.buscar')"
        prepend-inner-icon="mdi-magnify"
        density="compact"
        variant="outlined"
        hide-details
        clearable
        style="max-width: 320px"
      />
      <v-spacer />
      <v-btn
        icon="mdi-refresh"
        variant="text"
        :loading="loading"
        :title="t('invoicing.fiscal.panorama.actualizar')"
        @click="load"
      />
    </div>

    <v-alert
      v-if="error"
      type="error"
      variant="tonal"
      density="compact"
      class="mb-3"
    >
      {{ error }}
    </v-alert>

    <v-data-table
      :headers="headers"
      :items="visibles"
      :loading="loading"
      item-value="id_partner"
      density="comfortable"
      hover
      :items-per-page="25"
      @click:row="onRow"
    >
      <template #[`item.semaforo`]="{ item }">
        <span class="sem" :class="`sem--${item.semaforo}`" />
        <span class="text-caption">{{
          t(`invoicing.fiscal.panorama.sem.${item.semaforo}`)
        }}</span>
      </template>
      <template #[`item.nombre`]="{ item }">
        <div class="font-weight-medium">{{ item.nombre }}</div>
        <div class="text-caption text-medium-emphasis">
          #{{ item.id_partner }}
          <template v-if="item.facturas_ultimo_ano">
            ·
            {{
              t("invoicing.fiscal.panorama.facturas", {
                n: item.facturas_ultimo_ano,
              })
            }}
          </template>
        </div>
      </template>
      <template #[`item.impuesto`]="{ item }">
        {{ item.impuesto || "—" }}
      </template>
      <template #[`item.envio`]="{ item }">
        <div>{{ item.formato || "—" }}</div>
        <div class="text-caption text-medium-emphasis">{{ item.canal }}</div>
      </template>
      <template #[`item.motivos`]="{ item }">
        <div class="d-flex flex-wrap ga-1 py-1">
          <v-chip
            v-for="m in item.motivos"
            :key="m.codigo + m.texto"
            size="x-small"
            :color="m.nivel === 'ROJO' ? 'error' : 'warning'"
            variant="tonal"
          >
            <span :title="m.texto">{{ motivoCorto(m) }}</span>
          </v-chip>
          <span v-if="!item.motivos.length" class="text-caption text-success">{{
            t("invoicing.fiscal.panorama.listo")
          }}</span>
        </div>
      </template>
    </v-data-table>

    <FichaPartnerDialog
      v-model="fichaOpen"
      :partner="seleccionado?.id_partner ?? 0"
      :pais="seleccionado?.iso_paese ?? ''"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { toUserMessage } from "@tmwe/shared-frontend/http";
import {
  fiscConfigService,
  type MotivoSemaforo,
  type PanoramaPartner,
  type Semaforo,
} from "../../services/fiscConfig.service";
import FichaPartnerDialog from "./FichaPartnerDialog.vue";

/**
 * Semáforo de preparación por partner y país (propuesta 3 del informe para
 * dirección): rojo = no puede facturar o enviar, ámbar = factura pero los
 * envíos quedan retenidos o hay alertas, verde = listo. Clic en una fila:
 * la ficha «cómo factura este partner en este país» (propuesta 2).
 */
const { t, te } = useI18n();

const SEMAFOROS: Semaforo[] = ["ROJO", "AMBAR", "VERDE"];

const partners = ref<PanoramaPartner[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);
const filtro = ref<"" | Semaforo>("");
const buscar = ref<string | null>("");
const fichaOpen = ref(false);
const seleccionado = ref<PanoramaPartner | null>(null);

const headers = computed(() => [
  {
    title: t("invoicing.fiscal.panorama.col.estado"),
    key: "semaforo",
    width: 110,
  },
  { title: t("invoicing.fiscal.panorama.col.partner"), key: "nombre" },
  {
    title: t("invoicing.fiscal.panorama.col.pais"),
    key: "iso_paese",
    width: 70,
  },
  {
    title: t("invoicing.fiscal.panorama.col.impuesto"),
    key: "impuesto",
    sortable: false,
  },
  {
    title: t("invoicing.fiscal.panorama.col.envio"),
    key: "envio",
    sortable: false,
  },
  {
    title: t("invoicing.fiscal.panorama.col.motivos"),
    key: "motivos",
    sortable: false,
  },
]);

const visibles = computed(() => {
  const q = (buscar.value ?? "").trim().toLowerCase();
  return partners.value.filter(
    (p) =>
      (!filtro.value || p.semaforo === filtro.value) &&
      (!q ||
        p.nombre.toLowerCase().includes(q) ||
        String(p.id_partner) === q ||
        p.iso_paese.toLowerCase() === q),
  );
});

function count(s: Semaforo): number {
  return partners.value.filter((p) => p.semaforo === s).length;
}

/** Motivo en el idioma de la interfaz; el texto del backend si no hay traducción. */
function motivoCorto(m: MotivoSemaforo): string {
  const key = `invoicing.fiscal.panorama.motivo.${m.codigo}`;
  return te(key) ? t(key, { dato: m.dato ?? "" }) : m.texto;
}

function onRow(_e: unknown, row: { item: PanoramaPartner }): void {
  abrir(row.item);
}

function abrir(p: PanoramaPartner): void {
  seleccionado.value = p;
  fichaOpen.value = true;
}

async function load(): Promise<void> {
  loading.value = true;
  error.value = null;
  try {
    partners.value = (await fiscConfigService.panorama()).partners;
  } catch (e) {
    error.value = toUserMessage(e, String(e));
  } finally {
    loading.value = false;
  }
}

onMounted(load);
</script>

<style scoped>
.sem {
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  margin-right: 6px;
  vertical-align: middle;
}
.sem--VERDE {
  background: rgb(var(--v-theme-success));
}
.sem--AMBAR {
  background: rgb(var(--v-theme-warning));
}
.sem--ROJO {
  background: rgb(var(--v-theme-error));
}
</style>
