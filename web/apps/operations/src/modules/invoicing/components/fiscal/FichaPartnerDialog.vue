<template>
  <v-dialog
    :model-value="modelValue"
    max-width="1100"
    scrollable
    @update:model-value="(v: boolean) => emit('update:modelValue', v)"
  >
    <v-card>
      <v-card-title class="d-flex align-center ga-2 flex-wrap">
        <v-icon icon="mdi-card-account-details-outline" color="primary" />
        <span>{{
          ficha
            ? t("invoicing.fiscal.ficha.titulo", {
                partner: ficha.partner.nombre,
                pais: ficha.iso_paese || "—",
              })
            : t("common.loading")
        }}</span>
        <v-chip
          v-if="ficha"
          size="small"
          :color="SEM_COLOR[ficha.semaforo]"
          variant="flat"
        >
          {{ t(`invoicing.fiscal.panorama.sem.${ficha.semaforo}`) }}
        </v-chip>
        <v-spacer />
        <v-btn
          icon="mdi-close"
          variant="text"
          :aria-label="t('common.close')"
          @click="emit('update:modelValue', false)"
        />
      </v-card-title>

      <v-card-text>
        <v-progress-linear v-if="loading" indeterminate class="mb-3" />
        <v-alert
          v-if="error"
          type="error"
          variant="tonal"
          density="compact"
          class="mb-3"
        >
          {{ error }}
        </v-alert>

        <template v-if="ficha">
          <!-- Qué falta -->
          <v-alert
            v-if="ficha.motivos.length"
            :type="ficha.semaforo === 'ROJO' ? 'error' : 'warning'"
            variant="tonal"
            density="compact"
            class="mb-4"
          >
            <div class="font-weight-medium mb-1">
              {{ t("invoicing.fiscal.ficha.que_falta") }}
            </div>
            <ul class="pl-4">
              <li
                v-for="m in ficha.motivos"
                :key="m.codigo + m.texto"
                :title="m.texto"
              >
                {{ motivoTexto(m) }}
              </li>
            </ul>
          </v-alert>
          <v-alert
            v-else
            type="success"
            variant="tonal"
            density="compact"
            class="mb-4"
          >
            {{ t("invoicing.fiscal.ficha.lista") }}
          </v-alert>

          <!-- Resumen -->
          <div class="resumen mb-4">
            <div>
              <div class="text-caption text-medium-emphasis">
                {{ t("invoicing.fiscal.ficha.impuesto") }}
              </div>
              <div class="text-body-1">{{ ficha.resumen.impuesto || "—" }}</div>
            </div>
            <div>
              <div class="text-caption text-medium-emphasis">
                {{ t("invoicing.fiscal.ficha.formato") }}
              </div>
              <div class="text-body-1">{{ ficha.resumen.formato || "—" }}</div>
            </div>
            <div>
              <div class="text-caption text-medium-emphasis">
                {{ t("invoicing.fiscal.ficha.canal") }}
              </div>
              <div class="text-body-1">{{ ficha.resumen.canal || "—" }}</div>
            </div>
            <div>
              <div class="text-caption text-medium-emphasis">
                {{ t("invoicing.fiscal.ficha.proceso") }}
              </div>
              <div class="text-body-1">
                {{ procesoTexto(ficha.proceso.estado) }}
              </div>
            </div>
          </div>

          <!-- Impuesto -->
          <h3 class="text-subtitle-1 font-weight-medium mb-1">
            {{ t("invoicing.fiscal.ficha.sec.impuesto") }}
          </h3>
          <v-table density="compact" class="mb-4">
            <thead>
              <tr>
                <th>{{ t("invoicing.fiscal.ficha.cuando") }}</th>
                <th class="text-right">%</th>
                <th>{{ t("invoicing.fiscal.ficha.motivo_legal") }}</th>
                <th>{{ t("invoicing.fiscal.ficha.vigencia") }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="i in ficha.impuestos" :key="i.id">
                <td>
                  {{ condicion(i.condicion) }}
                  <v-chip
                    v-if="i.general"
                    size="x-small"
                    variant="tonal"
                    class="ml-1"
                    >{{ t("invoicing.fiscal.ficha.general") }}</v-chip
                  >
                </td>
                <td class="text-right">
                  {{ i.perc === null ? "—" : `${i.perc} %` }}
                </td>
                <td>
                  <span v-if="i.codigo_legal" class="font-weight-medium"
                    >{{ i.codigo_legal }} ·
                  </span>
                  {{ i.rif_normativo || i.mencion || "—" }}
                </td>
                <td class="text-no-wrap">{{ vigencia(i.desde, i.hasta) }}</td>
              </tr>
              <tr v-if="!ficha.impuestos.length">
                <td colspan="4" class="text-error">
                  {{ t("invoicing.fiscal.ficha.vacio.impuesto") }}
                </td>
              </tr>
            </tbody>
          </v-table>

          <!-- Envío -->
          <h3 class="text-subtitle-1 font-weight-medium mb-1">
            {{ t("invoicing.fiscal.ficha.sec.envio") }}
          </h3>
          <v-table density="compact" class="mb-4">
            <thead>
              <tr>
                <th>{{ t("invoicing.fiscal.ficha.canal") }}</th>
                <th>{{ t("invoicing.fiscal.ficha.formato") }}</th>
                <th>{{ t("invoicing.fiscal.ficha.quien_entrega") }}</th>
                <th>{{ t("invoicing.fiscal.ficha.cuando") }}</th>
                <th>{{ t("invoicing.fiscal.ficha.vigencia") }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="c in ficha.canales" :key="c.id">
                <td>{{ c.tipo }}</td>
                <td>{{ c.formato }}</td>
                <td>
                  {{ c.intermediario || "—" }}
                  <v-chip
                    v-if="c.modo === 'TEST'"
                    size="x-small"
                    color="warning"
                    variant="tonal"
                    class="ml-1"
                    >{{ t("invoicing.fiscal.ficha.modo_test") }}</v-chip
                  >
                </td>
                <td>{{ condicion(c.condicion) }}</td>
                <td class="text-no-wrap">{{ vigencia(c.desde, c.hasta) }}</td>
              </tr>
              <tr v-if="!ficha.canales.length">
                <td colspan="5" class="text-error">
                  {{ t("invoicing.fiscal.ficha.vacio.canal") }}
                </td>
              </tr>
            </tbody>
          </v-table>

          <div class="grid2 mb-4">
            <!-- Plazos -->
            <div>
              <h3 class="text-subtitle-1 font-weight-medium mb-1">
                {{ t("invoicing.fiscal.ficha.sec.plazos") }}
              </h3>
              <ul v-if="ficha.plazos.length" class="pl-4 text-body-2">
                <li v-for="p in ficha.plazos" :key="p.id">
                  {{ p.descripcion || `${p.caso}: ${p.dias}` }}
                  <span v-if="p.base_legal" class="text-medium-emphasis">
                    ({{ p.base_legal }})</span
                  >
                </li>
              </ul>
              <p v-else class="text-body-2 text-medium-emphasis">
                {{ t("invoicing.fiscal.ficha.vacio.plazos") }}
              </p>
            </div>

            <!-- Datos del emisor -->
            <div>
              <h3 class="text-subtitle-1 font-weight-medium mb-1">
                {{ t("invoicing.fiscal.ficha.sec.emisor") }}
              </h3>
              <ul
                v-if="ficha.emisor.errores.length || ficha.emisor.avisos.length"
                class="pl-4 text-body-2"
              >
                <li
                  v-for="e in ficha.emisor.errores"
                  :key="`e-${e}`"
                  class="text-error"
                >
                  {{ e }}
                </li>
                <li v-for="a in ficha.emisor.avisos" :key="`a-${a}`">
                  {{ a }}
                </li>
              </ul>
              <p v-else class="text-body-2 text-success">
                {{ t("invoicing.fiscal.ficha.emisor_ok") }}
              </p>
              <router-link
                :to="{
                  name: 'invoicing-datos-fiscales',
                  params: { tipo: 'partner', id: String(ficha.partner.id) },
                }"
                class="text-caption"
                >{{ t("invoicing.fiscal.ficha.ver_datos") }}</router-link
              >
            </div>
          </div>

          <!-- Requisitos -->
          <h3 class="text-subtitle-1 font-weight-medium mb-1">
            {{ t("invoicing.fiscal.ficha.sec.requisitos") }}
          </h3>
          <v-table density="compact" class="mb-4">
            <tbody>
              <tr v-for="r in ficha.requisitos" :key="r.id">
                <td>{{ r.mensaje || r.dato }}</td>
                <td>{{ condicion(r.condicion) }}</td>
                <td>
                  {{ r.documento || t("invoicing.fiscal.ficha.todos_docs") }}
                </td>
                <td>
                  <v-chip
                    size="x-small"
                    :color="r.obligatorio ? 'error' : undefined"
                    variant="tonal"
                    >{{
                      r.obligatorio
                        ? t("invoicing.fiscal.ficha.bloquea")
                        : t("invoicing.fiscal.ficha.avisa")
                    }}</v-chip
                  >
                </td>
              </tr>
              <tr v-if="!ficha.requisitos.length">
                <td class="text-medium-emphasis">
                  {{ t("invoicing.fiscal.ficha.vacio.requisitos") }}
                </td>
              </tr>
            </tbody>
          </v-table>

          <!-- Reglas activas -->
          <h3 class="text-subtitle-1 font-weight-medium mb-1">
            {{ t("invoicing.fiscal.ficha.sec.reglas") }}
          </h3>
          <ul v-if="ficha.reglas.length" class="pl-4 text-body-2">
            <li v-for="r in ficha.reglas" :key="r.id_regla">
              <span class="font-weight-medium">{{ r.nombre || r.codigo }}</span>
              — {{ resumenRegla(r) }}
              <span class="text-medium-emphasis">
                ({{ vigencia(r.desde, r.hasta) }})</span
              >
            </li>
          </ul>
          <p v-else class="text-body-2 text-medium-emphasis">
            {{ t("invoicing.fiscal.ficha.vacio.reglas") }}
          </p>
        </template>
      </v-card-text>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { toUserMessage } from "@tmwe/shared-frontend/http";
import {
  fiscConfigService,
  type FichaPartner,
  type MotivoSemaforo,
  type Semaforo,
} from "../../services/fiscConfig.service";
import { explainAtajo } from "./conditionModel";
import { resumenAccion } from "./reglas/reglasModel";

/**
 * «Cómo factura este partner en este país» (propuesta 2 del informe para
 * dirección): impuesto, envío, plazos, datos del emisor, requisitos y
 * reglas activas en una sola vista, con lo que falta arriba.
 */
const props = defineProps<{
  modelValue: boolean;
  partner: number;
  pais?: string;
}>();
const emit = defineEmits<{ (e: "update:modelValue", v: boolean): void }>();

const { t, te, locale } = useI18n();

const SEM_COLOR: Record<Semaforo, string> = {
  VERDE: "success",
  AMBAR: "warning",
  ROJO: "error",
};

const ficha = ref<FichaPartner | null>(null);
const loading = ref(false);
const error = ref<string | null>(null);

/** Condición de una fila en palabras («cliente UE con IVA»); «siempre» si no tiene. */
function condicion(c: string): string {
  if (!c || c.trim() === "") return t("invoicing.fiscal.cond.atajo.SIEMPRE");
  return explainAtajo(c, t);
}

/** Motivo en el idioma de la interfaz; el texto del backend si no hay traducción. */
function motivoTexto(m: MotivoSemaforo): string {
  const key = `invoicing.fiscal.panorama.motivo.${m.codigo}`;
  return te(key) ? t(key, { dato: m.dato ?? "" }) : m.texto;
}

function vigencia(desde: string, hasta: string | null): string {
  return `${desde} → ${hasta ?? t("invoicing.fiscal.ficha.abierta")}`;
}

function procesoTexto(estado: string): string {
  const key = `invoicing.fiscal.ficha.estado_proceso.${estado}`;
  return te(key) ? t(key) : estado;
}

function resumenRegla(r: FichaPartner["reglas"][number]): string {
  return resumenAccion(
    r.accion,
    r.params,
    locale.value,
    (k, n) => (te(k) ? t(k, n ?? {}) : null),
    r.resumen,
  );
}

async function load(): Promise<void> {
  if (!props.partner) return;
  loading.value = true;
  error.value = null;
  ficha.value = null;
  try {
    ficha.value = await fiscConfigService.fichaPartner(
      props.partner,
      props.pais,
    );
  } catch (e) {
    error.value = toUserMessage(e, String(e));
  } finally {
    loading.value = false;
  }
}

watch(
  () => [props.modelValue, props.partner, props.pais] as const,
  ([open]) => {
    if (open) void load();
  },
);
</script>

<style scoped>
.resumen {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}
.grid2 {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}
@media (max-width: 700px) {
  .resumen,
  .grid2 {
    grid-template-columns: 1fr;
  }
}
</style>
