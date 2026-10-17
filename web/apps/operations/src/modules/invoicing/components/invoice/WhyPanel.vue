<template>
  <v-card v-if="visible" variant="flat" class="invoice-list-card mt-4">
    <v-card-title class="text-subtitle-1 d-flex align-center ga-2">
      <v-icon icon="mdi-help-circle-outline" size="20" />
      {{ t("invoicing.invoice.why.title") }}
      <v-spacer />
      <v-btn
        v-if="held && config.canWrite"
        color="warning"
        size="small"
        variant="tonal"
        prepend-icon="mdi-send-lock-outline"
        @click="releaseOpen = true"
      >
        {{ t("invoicing.invoice.why.release") }}
      </v-btn>
    </v-card-title>
    <v-card-text>
      <v-progress-linear v-if="loading" indeterminate class="mb-2" />
      <v-alert
        v-if="error"
        type="error"
        variant="tonal"
        density="compact"
        class="mb-2"
        role="alert"
      >
        {{ error }}
      </v-alert>

      <template v-if="why">
        <v-alert
          v-if="held"
          type="warning"
          variant="tonal"
          density="compact"
          class="mb-3"
        >
          {{ t("invoicing.invoice.why.held") }}
          <span v-for="h in heldRules" :key="h.id_regla">
            «{{ resumen(h) }}»
          </span>
          <template v-if="!config.canWrite">
            {{ t("invoicing.invoice.why.held_no_permission") }}
          </template>
        </v-alert>
        <v-alert
          v-if="released"
          type="success"
          variant="tonal"
          density="compact"
          class="mb-3"
          role="status"
        >
          {{ t("invoicing.invoice.why.released") }}
        </v-alert>
        <v-alert
          v-for="l in why.liberadas ?? []"
          :key="`lib-${l.id_regla}-${l.fecha_liberacion}`"
          type="info"
          variant="tonal"
          density="compact"
          class="mb-3"
        >
          {{ liberadaTexto(l) }}
        </v-alert>

        <p v-if="cambiosTexto" class="text-body-1 mb-1">
          {{ cambiosTexto }}
        </p>
        <p class="text-body-2 text-medium-emphasis mb-3">
          {{
            hasRules
              ? t("invoicing.invoice.why.intro")
              : t("invoicing.invoice.why.none")
          }}
        </p>

        <!-- Importe a pagar -->
        <v-table v-if="why.importe_a_pagar" density="compact" class="mb-3">
          <caption class="text-caption text-medium-emphasis text-left pb-1">
            {{
              t("invoicing.invoice.why.payable")
            }}
          </caption>
          <tbody>
            <tr>
              <th scope="row">{{ t("invoicing.invoice.total") }}</th>
              <td class="text-right">{{ money(why.importe_a_pagar.total) }}</td>
            </tr>
            <tr v-if="why.importe_a_pagar.retenciones">
              <th scope="row">{{ t("invoicing.invoice.why.withholding") }}</th>
              <td class="text-right">
                −{{ money(why.importe_a_pagar.retenciones) }}
              </td>
            </tr>
            <tr v-if="why.importe_a_pagar.iva_split">
              <th scope="row">{{ t("invoicing.invoice.why.split") }}</th>
              <td class="text-right">
                −{{ money(why.importe_a_pagar.iva_split) }}
              </td>
            </tr>
            <tr v-if="why.importe_a_pagar.bollo">
              <th scope="row">{{ t("invoicing.invoice.why.stamp") }}</th>
              <td class="text-right">
                +{{ money(why.importe_a_pagar.bollo) }}
              </td>
            </tr>
            <tr class="font-weight-bold">
              <th scope="row">{{ t("invoicing.invoice.why.to_pay") }}</th>
              <td class="text-right">
                {{ money(why.importe_a_pagar.importe_a_pagar) }}
              </td>
            </tr>
          </tbody>
        </v-table>

        <!-- Por línea -->
        <v-table v-if="why.lineas.length" density="compact" class="mb-3">
          <thead>
            <tr>
              <th scope="col">{{ t("invoicing.invoice.title") }}</th>
              <th scope="col" class="text-right">
                {{ t("invoicing.invoice.net") }}
              </th>
              <th scope="col" class="text-right">
                {{ t("invoicing.invoice.vat") }}
              </th>
              <th scope="col">{{ t("invoicing.invoice.why.rules") }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="l in why.lineas" :key="l.id">
              <td>
                <span>{{ plain(l.descriz) }}</span>
                <span class="text-caption text-medium-emphasis ml-1">
                  {{ l.cod_iva }}
                </span>
              </td>
              <td class="text-right">{{ money(l.importo_netto) }}</td>
              <td class="text-right">
                {{ money(l.importo_iva) }}
                <span class="text-caption text-medium-emphasis">
                  ({{ l.aliquota_iva }} %)
                </span>
              </td>
              <td>
                <span
                  v-if="l.reglas.length === 0"
                  class="text-caption text-medium-emphasis"
                >
                  {{ t("invoicing.invoice.why.no_rule") }}
                </span>
                <div v-for="r in l.reglas" :key="`${r.id_regla}-${r.accion}`">
                  <router-link :to="ruleLink(r.id_regla)" class="rule-link">
                    {{ r.codigo }}
                  </router-link>
                  <v-chip
                    size="x-small"
                    variant="tonal"
                    class="ml-1"
                    :title="r.accion"
                    >{{ nombreAccion(r.accion) }}</v-chip
                  >
                  <span class="text-caption ml-1">{{ resumen(r) }}</span>
                  <div
                    v-if="r.rif_normativo"
                    class="text-caption text-medium-emphasis"
                  >
                    {{ r.rif_normativo }}
                  </div>
                </div>
              </td>
            </tr>
          </tbody>
        </v-table>

        <!-- Reglas de la factura entera -->
        <div v-if="why.factura.length">
          <div class="text-subtitle-2 mb-1">
            {{ t("invoicing.invoice.why.invoice_rules") }}
          </div>
          <ul class="text-body-2 pl-4">
            <li v-for="r in why.factura" :key="`${r.id_regla}-${r.accion}`">
              <router-link :to="ruleLink(r.id_regla)" class="rule-link">
                {{ r.codigo }}
              </router-link>
              <v-chip
                size="x-small"
                variant="tonal"
                class="ml-1"
                :title="r.accion"
                >{{ nombreAccion(r.accion) }}</v-chip
              >
              {{ resumen(r) }}
              <template v-if="r.importe"> · {{ money(r.importe) }} </template>
            </li>
          </ul>
        </div>
      </template>
    </v-card-text>

    <!-- Liberar el envío (con motivo) -->
    <v-dialog v-model="releaseOpen" max-width="520">
      <v-card aria-labelledby="release-title">
        <v-card-title id="release-title" class="text-subtitle-1">
          {{ t("invoicing.invoice.why.release_title") }}
        </v-card-title>
        <v-card-text>
          <p class="text-body-2 mb-3">
            {{ t("invoicing.invoice.why.release_intro") }}
          </p>
          <v-alert
            v-if="releaseError"
            type="error"
            variant="tonal"
            density="compact"
            class="mb-3"
            role="alert"
          >
            {{ releaseError }}
          </v-alert>
          <v-text-field
            v-model="motivo"
            :label="t('invoicing.fiscal.motivo') + ' *'"
            :hint="t('invoicing.fiscal.motivo_hint')"
            persistent-hint
            maxlength="255"
            density="comfortable"
            variant="outlined"
          />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn
            variant="text"
            :disabled="releasing"
            @click="releaseOpen = false"
          >
            {{ t("common.cancel") }}
          </v-btn>
          <v-btn
            color="warning"
            :loading="releasing"
            :disabled="!motivo.trim()"
            @click="release"
          >
            {{ t("invoicing.invoice.why.release") }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-card>
</template>

<script setup lang="ts">
/**
 * WhyPanel — panel «Por qué» de la ficha de factura (REGLAS_DINAMICAS §3.8,
 * F6b): qué reglas de `fisc_reglas` produjeron cada línea (exención, tipo de
 * IVA, inversión, exigibilidad, recargos ajustados…), cuáles actuaron sobre la
 * factura entera (bollo, retenciones, menciones, cargos fijos) y el importe a
 * pagar. Cada regla enlaza a la pestaña «Reglas» de Configuración fiscal.
 *
 * Si la factura está retenida por una regla RETENER_ENVIO (no se certifica ni
 * se envía), un banner lo dice y, con permiso (`canWrite` de la configuración
 * fiscal: operadores de TMWE; el backend lo vuelve a comprobar), el botón
 * «Liberar envío» pide un motivo y libera la retención.
 *
 * Se lee con `GET api_fisc_reglas?op=explicar&id_fattura=N`; un partner solo
 * ve sus facturas. Si la factura no existe o no es visible (404) el panel se
 * oculta; cualquier otro error se muestra dentro.
 *
 * Props: `invoiceId` (id de la factura activa). Emits: ninguno.
 *
 * Ejemplo:
 *   <WhyPanel :invoice-id="store.id ?? 0" />
 */
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { ApiError, toUserMessage } from "@tmwe/shared-frontend/http";
import {
  fiscReglasService,
  type WhyRegla,
  type WhyResult,
} from "../../services/fiscReglas.service";
import { useFiscConfigStore } from "../../stores/fiscConfig.store";
import {
  accionNombre,
  money,
  resumenAccion,
} from "../fiscal/reglas/reglasModel";

const props = defineProps<{ invoiceId: number }>();

const { t, te, locale } = useI18n();

/** Frase de una retención liberada: regla, cuándo y quién, y el motivo (si constan). */
function liberadaTexto(l: NonNullable<WhyResult["liberadas"]>[number]): string {
  const partes = [
    `${t("invoicing.invoice.why.released_by_rule")} «${resumen(l)}» (${l.codigo}).`,
  ];
  if (l.fecha_liberacion) {
    partes.push(
      t("invoicing.invoice.why.released_when", {
        fecha: l.fecha_liberacion,
        usuario: l.usuario_liberacion,
      }),
    );
  }
  if (l.motivo_liberacion) {
    partes.push(
      `${t("invoicing.invoice.why.released_motivo")}: «${l.motivo_liberacion}».`,
    );
  }
  return partes.join(" ");
}

/**
 * En una frase, qué cambió respecto al cálculo normal: cada regla que actuó
 * (una vez) con su resumen y, si es de línea, en qué líneas.
 */
const cambiosTexto = computed(() => {
  const w = why.value;
  if (!w) return "";
  const porRegla = new Map<number, { r: WhyRegla; lineas: string[] }>();
  for (const l of w.lineas ?? []) {
    for (const r of l.reglas) {
      const e = porRegla.get(r.id_regla) ?? { r, lineas: [] };
      e.lineas.push(plain(l.descriz));
      porRegla.set(r.id_regla, e);
    }
  }
  for (const r of w.factura ?? []) {
    if (!porRegla.has(r.id_regla)) porRegla.set(r.id_regla, { r, lineas: [] });
  }
  if (porRegla.size === 0) return "";
  const partes = [...porRegla.values()].map(({ r, lineas }) => {
    const unicas = [...new Set(lineas)];
    return unicas.length
      ? t("invoicing.invoice.why.cambio_linea", {
          regla: resumen(r),
          lineas: unicas.join(", "),
        })
      : resumen(r);
  });
  return t("invoicing.invoice.why.cambios", {
    n: porRegla.size,
    lista: partes.join("; "),
  });
});

/** Nombre de negocio de una acción (el código queda en el tooltip). */
function nombreAccion(codigo: string): string {
  return accionNombre(codigo, (k, n) => (te(k) ? t(k, n ?? {}) : null));
}

/** Resumen de una regla citada en el idioma de la interfaz (parámetros de `why.reglas`). */
function resumen(r: WhyRegla): string {
  return resumenAccion(
    r.accion,
    why.value?.reglas[String(r.id_regla)]?.parametros,
    locale.value,
    (k, n) => (te(k) ? t(k, n ?? {}) : null),
    r.resumen,
  );
}
const config = useFiscConfigStore();

const why = ref<WhyResult | null>(null);
const loading = ref(false);
const error = ref<string | null>(null);
const visible = ref(true);
const releaseOpen = ref(false);
const motivo = ref("");
const releasing = ref(false);
const releaseError = ref("");
const released = ref(false);

/** Reglas RETENER_ENVIO que siguen vigentes en la factura. */
const heldRules = computed(() =>
  (why.value?.factura ?? []).filter((r) => r.accion === "RETENER_ENVIO"),
);
const held = computed(() => heldRules.value.length > 0);
const hasRules = computed(
  () =>
    (why.value?.factura.length ?? 0) > 0 ||
    (why.value?.liberadas?.length ?? 0) > 0 ||
    (why.value?.lineas ?? []).some((l) => l.reglas.length > 0),
);

/** Texto de una descripción de línea sin etiquetas HTML (los textos de línea pueden traer `<br>`). */
function plain(html: string): string {
  return String(html ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Enlace a la regla en la pestaña «Reglas» de Configuración fiscal. */
function ruleLink(id: number): {
  name: string;
  query: Record<string, string>;
} {
  return {
    name: "invoicing-fiscal-config",
    query: { tab: "reglas", regla: String(id) },
  };
}

async function load(): Promise<void> {
  if (!props.invoiceId) return;
  loading.value = true;
  error.value = null;
  visible.value = true;
  try {
    await config.load();
    why.value = await fiscReglasService.explicar(props.invoiceId);
  } catch (e) {
    why.value = null;
    // 404: factura inexistente, pasiva o de otro partner → no hay nada que explicar.
    if (e instanceof ApiError && e.status === 404) visible.value = false;
    else error.value = toUserMessage(e, String(e));
  } finally {
    loading.value = false;
  }
}

async function release(): Promise<void> {
  releasing.value = true;
  releaseError.value = "";
  try {
    await fiscReglasService.releaseHold(props.invoiceId, motivo.value);
    releaseOpen.value = false;
    motivo.value = "";
    released.value = true;
    await load();
  } catch (e) {
    releaseError.value = toUserMessage(e, String(e));
  } finally {
    releasing.value = false;
  }
}

watch(() => props.invoiceId, load, { immediate: true });
</script>

<style scoped>
.rule-link {
  font-weight: 500;
  color: rgb(var(--v-theme-primary));
}
</style>
