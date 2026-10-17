<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useRouter } from "vue-router";
import { useI18n } from "vue-i18n";

import { useCrmStore } from "../stores/crm.store";
import CrmEventiSection from "../components/CrmEventiSection.vue";
import CrmMessaggiSection from "../components/CrmMessaggiSection.vue";
import CrmSendMessageDialog from "../components/CrmSendMessageDialog.vue";
import CrmHeaderLookups from "../components/CrmHeaderLookups.vue";
import FormSection from "@shared/ui/FormSection.vue";
import type { CrmPratica, StatoPratica } from "../types";

const props = defineProps<{ id: string }>();

const store = useCrmStore();
const router = useRouter();
const { t } = useI18n();

const idNum = computed(() => Number(props.id));
const saving = ref(false);
const showSend = ref(false);

// Copia editable de la cabecera (persist on blur, paridad FldUpd legacy).
const form = ref<Partial<CrmPratica>>({});

watch(
  () => store.current,
  (c) => {
    if (c) form.value = { ...c };
  },
  { immediate: true },
);

const statoColor: Record<StatoPratica, string> = {
  A: "success",
  L: "warning",
  C: "grey",
};

async function persistField(field: keyof CrmPratica): Promise<void> {
  if (!store.current) return;
  const value = form.value[field];
  if (value === (store.current as Record<string, unknown>)[field]) return;
  saving.value = true;
  try {
    await store.saveHeader(idNum.value, {
      [field]: value,
    } as Partial<CrmPratica>);
  } finally {
    saving.value = false;
  }
}

/** Persiste varios campos de la cabecera en una sola llamada. */
async function persistFields(patch: Partial<CrmPratica>): Promise<void> {
  if (!store.current) return;
  saving.value = true;
  try {
    Object.assign(form.value, patch);
    await store.saveHeader(idNum.value, patch);
  } finally {
    saving.value = false;
  }
}

function onPickContatto(payload: {
  id: number;
  nome: string;
  email: string;
  tel: string;
}): void {
  // Paridad ContattoDet legacy: al elegir contacto, propone nome/email/tel.
  // Solo rellena los campos que estén vacíos (no pisa datos ya escritos).
  const patch: Partial<CrmPratica> = { id_contatto: payload.id };
  if (!form.value.nome && payload.nome) patch.nome = payload.nome;
  if (!form.value.email && payload.email) patch.email = payload.email;
  if (!form.value.tel && payload.tel) patch.tel = payload.tel;
  void persistFields(patch);
}

function goBack(): void {
  router.push({ name: "crm-list" });
}

// Expedición vinculada: id_spedizione < 7.999.999 = cargo aéreo; el resto,
// courier (misma regla que el backend Crm_Service::create_from_shipment).
const linkedShipmentId = computed<number>(() =>
  Number(form.value.id_spedizione ?? 0),
);
function openShipment(): void {
  const sid = linkedShipmentId.value;
  if (sid <= 0) return;
  const isCargo = sid < 7999999;
  router.push({
    name: isCargo ? "cargo-detail" : "shipment-detail",
    params: { id: String(sid) },
  });
}

onMounted(() => {
  void store.fetchTypes();
  void store.fetchDetail(idNum.value);
});
</script>

<template>
  <div class="crm-pratica">
    <!-- ── Header de página ─────────────────────────────────── -->
    <header class="crm-head">
      <v-btn
        variant="text"
        icon="mdi-arrow-left"
        size="small"
        @click="goBack"
      />
      <div class="crm-head__title">
        <div class="d-flex align-center ga-2">
          <h2 class="text-h6 mb-0">{{ t("crm.detail.title") }} #{{ id }}</h2>
          <v-chip
            v-if="store.current"
            :color="statoColor[store.current.stato_pratica]"
            size="small"
            label
          >
            {{ t(`crm.stato.${store.current.stato_pratica}`) }}
          </v-chip>
        </div>
        <div
          v-if="store.current?.oggetto"
          class="text-caption text-medium-emphasis text-truncate"
        >
          {{ store.current.oggetto }}
        </div>
      </div>
      <v-spacer />
      <v-fade-transition>
        <v-progress-circular
          v-if="saving"
          indeterminate
          size="18"
          width="2"
          color="primary"
        />
      </v-fade-transition>
      <v-btn
        color="primary"
        variant="flat"
        prepend-icon="mdi-email-fast"
        :disabled="!store.current"
        @click="showSend = true"
      >
        {{ t("crm.send.button") }}
      </v-btn>
    </header>

    <v-alert
      v-if="store.error"
      type="error"
      variant="tonal"
      density="compact"
      class="mb-4"
    >
      {{ store.error }}
    </v-alert>

    <v-progress-linear v-if="store.loadingDetail" indeterminate class="mb-4" />

    <template v-if="store.current">
      <!-- Esquema de bloques a dos columnas (como el overview del courier) para
           aprovechar el ancho: izquierda la cabecera de la pratica, derecha la
           actividad (eventi + mensajes). En pantalla angosta cae a una columna. -->
      <div class="crm-grid">
        <!-- ── Columna izq: Cabecera, agrupada en secciones ────── -->
        <div class="crm-card">
          <!-- Cliente + contacto -->
          <FormSection
            :title="t('crm.detail.sec_client')"
            icon="mdi-account-outline"
            flat
          >
            <CrmHeaderLookups
              :id-anagrafica="form.id_anagrafica ?? null"
              :id-contatto="form.id_contatto ?? null"
              cliente-readonly
              :cliente-label="store.current?.cliente_rag_soc ?? null"
              class="mb-2"
              @pick-contatto="onPickContatto"
            />
            <v-row dense>
              <v-col cols="12" md="4">
                <v-text-field
                  v-model="form.nome"
                  :label="t('crm.field.nome')"
                  density="compact"
                  variant="outlined"
                  hide-details
                  @blur="persistField('nome')"
                />
              </v-col>
              <v-col cols="12" md="4">
                <v-text-field
                  v-model="form.email"
                  :label="t('crm.field.email')"
                  density="compact"
                  variant="outlined"
                  hide-details
                  prepend-inner-icon="mdi-email-outline"
                  @blur="persistField('email')"
                />
              </v-col>
              <v-col cols="12" md="4">
                <v-text-field
                  v-model="form.tel"
                  :label="t('crm.field.tel')"
                  density="compact"
                  variant="outlined"
                  hide-details
                  prepend-inner-icon="mdi-phone-outline"
                  @blur="persistField('tel')"
                />
              </v-col>
            </v-row>
          </FormSection>

          <!-- Clasificación: asunto, tipo, expedición, referencia -->
          <FormSection
            :title="t('crm.detail.sec_classify')"
            icon="mdi-tag-outline"
            flat
          >
            <v-row dense>
              <v-col cols="12" md="6">
                <v-text-field
                  v-model="form.oggetto"
                  :label="t('crm.field.oggetto')"
                  density="compact"
                  variant="outlined"
                  hide-details
                  @blur="persistField('oggetto')"
                />
              </v-col>
              <v-col cols="12" md="6">
                <v-select
                  v-model="form.id_crm_tipo"
                  :items="
                    store.types.map((tp) => ({ title: tp.descr, value: tp.id }))
                  "
                  :label="t('crm.field.tipo')"
                  density="compact"
                  variant="outlined"
                  hide-details
                  @update:model-value="persistField('id_crm_tipo')"
                />
              </v-col>
              <v-col cols="12" md="6">
                <v-text-field
                  :model-value="form.id_spedizione"
                  :label="t('crm.field.id_spedizione')"
                  density="compact"
                  variant="outlined"
                  readonly
                  prepend-inner-icon="mdi-package-variant-closed"
                  :hint="t('crm.detail.id_spedizione_readonly')"
                  persistent-hint
                >
                  <!-- La expedición vinculada NO se edita a mano (rompería la
                     relación creada por find-or-create); solo se navega a ella.
                     Paridad de intención con el legacy, donde id_spedizione se
                     hereda de la creación desde la ficha de expedición. -->
                  <template v-if="linkedShipmentId > 0" #append-inner>
                    <v-tooltip
                      location="top"
                      :text="t('crm.detail.open_shipment')"
                    >
                      <template #activator="{ props: tip }">
                        <v-btn
                          v-bind="tip"
                          icon="mdi-open-in-app"
                          size="x-small"
                          variant="text"
                          color="primary"
                          density="comfortable"
                          @click.stop="openShipment"
                        />
                      </template>
                    </v-tooltip>
                  </template>
                </v-text-field>
              </v-col>
              <v-col cols="12" md="6">
                <v-text-field
                  v-model="form.rif_cliente"
                  :label="t('crm.field.rif_cliente')"
                  density="compact"
                  variant="outlined"
                  hide-details
                  @blur="persistField('rif_cliente')"
                />
              </v-col>
            </v-row>
          </FormSection>

          <!-- Seguimiento: próximo contacto -->
          <FormSection
            :title="t('crm.detail.sec_followup')"
            icon="mdi-calendar-clock-outline"
            flat
          >
            <v-row dense>
              <v-col cols="12" md="6">
                <v-text-field
                  v-model="form.data_next"
                  :label="t('crm.field.data_next')"
                  density="compact"
                  variant="outlined"
                  hide-details
                  type="datetime-local"
                  @blur="persistField('data_next')"
                />
              </v-col>
            </v-row>
          </FormSection>

          <!-- Notas: descripción pública + notas internas -->
          <FormSection
            :title="t('crm.detail.sec_notes')"
            icon="mdi-note-text-outline"
            flat
            last
          >
            <v-row dense>
              <v-col cols="12" md="6">
                <v-textarea
                  v-model="form.descriz"
                  :label="t('crm.field.descriz')"
                  density="compact"
                  variant="outlined"
                  hide-details
                  rows="2"
                  auto-grow
                  @blur="persistField('descriz')"
                />
              </v-col>
              <v-col cols="12" md="6">
                <v-textarea
                  v-model="form.note_interne"
                  :label="t('crm.field.note_interne')"
                  density="compact"
                  variant="outlined"
                  hide-details
                  rows="2"
                  auto-grow
                  @blur="persistField('note_interne')"
                />
              </v-col>
            </v-row>
          </FormSection>
        </div>

        <!-- ── Columna der: actividad (eventi + mensajes) ──────── -->
        <div class="crm-activity">
          <CrmEventiSection :id-crm="idNum" />
          <CrmMessaggiSection :id-crm="idNum" />
        </div>
      </div>
    </template>

    <!-- ── Zona B: Enviar mensaje al cliente ─────────────────── -->
    <CrmSendMessageDialog
      v-if="store.current"
      v-model="showSend"
      :id-crm="idNum"
      :default-email="store.current.email"
    />
  </div>
</template>

<style scoped>
.crm-pratica {
  padding: 16px 20px 40px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* Esquema de bloques a dos columnas (como el overview del courier): cabecera a
   la izquierda, actividad a la derecha, aprovechando todo el ancho. La derecha
   es algo más estrecha (la timeline no necesita tanto). */
.crm-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr);
  gap: 16px;
  align-items: start;
}
.crm-activity {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-width: 0;
}
@media (max-width: 960px) {
  .crm-grid {
    grid-template-columns: 1fr;
  }
}

/* Cabecera de página: back + título + estado + acción, alineada como el resto
   de páginas de detalle del proyecto (InvoiceDetailPage). */
.crm-head {
  display: flex;
  align-items: center;
  gap: 8px;
}
.crm-head__title {
  min-width: 0;
}

/* Tarjeta contenedora de la cabecera: un solo marco con las FormSection flat
   apiladas dentro (mismo patrón que ShipmentAmountsBox / PostInvoiceBox). */
.crm-card {
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  border-radius: 12px;
  background: rgb(var(--v-theme-surface));
  padding: 8px 12px 4px;
}
</style>
