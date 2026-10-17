<template>
  <div class="datos-fiscales">
    <div class="d-flex align-center flex-wrap ga-2 mb-3">
      <v-icon icon="mdi-card-account-details-outline" color="primary" />
      <div>
        <div class="text-subtitle-1 font-weight-medium">
          {{ t("invoicing.fiscal.datos.title") }}
          <span v-if="data?.entidad.rag_soc" class="text-medium-emphasis">
            · {{ data.entidad.rag_soc }}
          </span>
        </div>
        <div v-if="data" class="text-caption text-medium-emphasis">
          {{
            t("invoicing.fiscal.datos.emisor", {
              partner: data.entidad.id_partner_emisor,
              pais: data.entidad.iso_emisor || "—",
            })
          }}
          <span v-if="data.entidad.iso_cliente">
            ·
            {{
              t("invoicing.fiscal.datos.pais_cliente", {
                pais: data.entidad.iso_cliente,
              })
            }}
          </span>
        </div>
      </div>
      <v-spacer />
      <v-chip
        v-if="data"
        :color="errores === 0 ? 'success' : 'error'"
        variant="flat"
        size="small"
        :prepend-icon="errores === 0 ? 'mdi-check-circle' : 'mdi-alert-circle'"
      >
        {{
          errores === 0
            ? t("invoicing.fiscal.datos.check_ok")
            : t("invoicing.fiscal.datos.check_ko", { n: errores })
        }}
      </v-chip>
      <v-text-field
        v-model="fecha"
        type="date"
        :label="t('invoicing.fiscal.datos.fecha')"
        density="compact"
        hide-details
        class="datos-fecha"
        @update:model-value="load"
      />
      <v-btn
        variant="text"
        icon="mdi-refresh"
        size="small"
        :title="t('common.refresh')"
        :loading="loading"
        @click="load"
      />
      <v-btn
        v-if="data?.puede_escribir"
        size="small"
        color="primary"
        prepend-icon="mdi-plus"
        @click="openSet(null)"
      >
        {{ t("invoicing.fiscal.datos.add") }}
      </v-btn>
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
    <v-progress-linear v-if="loading && !data" indeterminate />

    <template v-if="data">
      <v-alert
        v-if="!data.entidad.iso_emisor && data.entidad.ambito !== 'USUARIO'"
        type="warning"
        variant="tonal"
        density="compact"
        class="mb-3"
      >
        {{ t("invoicing.fiscal.datos.no_country") }}
      </v-alert>

      <!-- Datos exigidos por la tabla de validación (DISENO §6) -->
      <div class="text-subtitle-2 mb-1">
        {{ t("invoicing.fiscal.datos.required") }}
      </div>
      <v-table density="compact" class="mb-4">
        <thead>
          <tr>
            <th>{{ t("invoicing.fiscal.field.dato") }}</th>
            <th>{{ t("invoicing.fiscal.datos.estado") }}</th>
            <th>{{ t("invoicing.fiscal.datos.valor") }}</th>
            <th>{{ t("invoicing.fiscal.field.condicion") }}</th>
            <th>{{ t("invoicing.fiscal.datos.aplica") }}</th>
            <th>{{ t("invoicing.fiscal.field.obligatorio") }}</th>
            <th />
          </tr>
        </thead>
        <tbody>
          <tr v-if="data.requeridos.length === 0">
            <td colspan="7" class="text-medium-emphasis">
              {{ t("invoicing.fiscal.datos.none_required") }}
            </td>
          </tr>
          <tr
            v-for="r in data.requeridos"
            :key="`${r.dato}#${r.condicion}#${r.id_requisito}`"
          >
            <td>
              <div class="font-weight-medium">{{ r.claves.join(" | ") }}</div>
              <div
                v-if="r.mensaje_error"
                class="text-caption text-medium-emphasis"
              >
                {{ r.mensaje_error }}
              </div>
              <div
                v-if="r.base_legal"
                class="text-caption text-medium-emphasis"
              >
                {{ r.base_legal }}
              </div>
            </td>
            <td>
              <v-chip size="x-small" variant="flat" :color="estadoColor(r)">
                {{ t(`invoicing.fiscal.datos.estados.${r.estado}`) }}
              </v-chip>
            </td>
            <td class="datos-valor">
              <span v-if="r.valor">{{ r.valor }}</span>
              <v-chip
                v-if="r.origen && r.origen !== 'NINGUNO'"
                size="x-small"
                variant="tonal"
                class="ml-1"
                :color="r.origen === 'EXCEPCION' ? 'warning' : 'info'"
              >
                {{ t(`invoicing.fiscal.datos.origen_v.${r.origen}`) }}
              </v-chip>
              <span
                v-if="r.clave_valor && r.claves.length > 1"
                class="text-caption text-medium-emphasis"
              >
                ({{ r.clave_valor }})
              </span>
            </td>
            <td class="text-caption">{{ r.condicion }}</td>
            <td>
              <v-chip
                size="x-small"
                variant="tonal"
                :color="aplicaColor(r.aplica)"
              >
                {{ t(`invoicing.fiscal.datos.aplica_v.${r.aplica}`) }}
              </v-chip>
            </td>
            <td>{{ r.obligatorio ? t("common.yes") : t("common.no") }}</td>
            <td class="text-right">
              <v-btn
                v-if="data.puede_escribir"
                size="x-small"
                variant="tonal"
                @click="openSet(r.clave_valor ?? r.claves[0])"
              >
                {{ t("invoicing.fiscal.datos.set") }}
              </v-btn>
            </td>
          </tr>
        </tbody>
      </v-table>

      <!-- Valores resueltos: excepción > origen vivo (LIGERA) -->
      <div class="text-subtitle-2 mb-1">
        {{ t("invoicing.fiscal.datos.values") }}
      </div>
      <div class="text-caption text-medium-emphasis mb-1">
        {{ t("invoicing.fiscal.datos.values_hint") }}
      </div>
      <v-table density="compact" class="mb-4">
        <thead>
          <tr>
            <th>{{ t("invoicing.fiscal.field.chiave") }}</th>
            <th>{{ t("invoicing.fiscal.datos.valor") }}</th>
            <th>{{ t("invoicing.fiscal.datos.origen") }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="v in data.valores" :key="v.chiave">
            <td class="font-weight-medium">{{ v.chiave }}</td>
            <td class="datos-valor">
              <span v-if="v.valor">{{ v.valor }}</span>
              <span v-else class="text-medium-emphasis">—</span>
              <v-icon
                v-if="v.estado === 'FORMATO_INVALIDO'"
                icon="mdi-alert"
                color="warning"
                size="14"
                :title="t('invoicing.fiscal.datos.bad_format')"
              />
            </td>
            <td class="text-caption">
              <v-chip
                size="x-small"
                variant="tonal"
                :color="
                  v.origen === 'EXCEPCION'
                    ? 'warning'
                    : v.origen === 'ORIGEN_VIVO'
                      ? 'info'
                      : 'grey'
                "
              >
                {{ t(`invoicing.fiscal.datos.origen_v.${v.origen}`) }}
              </v-chip>
              <span
                v-if="v.origen === 'ORIGEN_VIVO'"
                class="ml-1"
                :title="v.ref"
              >
                {{ fuenteTexto(v.ref) }}
              </span>
              <span
                v-else-if="v.origen === 'NINGUNO' && v.origen_vivo"
                class="ml-1"
                :title="v.origen_vivo"
              >
                {{ fuenteTexto(v.origen_vivo) }}
              </span>
              <span v-if="v.difiere_ficha" class="ml-1 text-warning">
                {{
                  t("invoicing.fiscal.datos.differs", { ficha: v.valor_ficha })
                }}
              </span>
            </td>
          </tr>
        </tbody>
      </v-table>

      <!-- Excepciones vigentes -->
      <div class="text-subtitle-2 mb-1">
        {{ t("invoicing.fiscal.datos.current") }}
      </div>
      <v-table density="compact" class="mb-4">
        <thead>
          <tr>
            <th>{{ t("invoicing.fiscal.field.chiave") }}</th>
            <th>{{ t("invoicing.fiscal.datos.valor") }}</th>
            <th>{{ t("invoicing.fiscal.vigencia") }}</th>
            <th />
          </tr>
        </thead>
        <tbody>
          <tr v-if="data.vigentes.length === 0">
            <td colspan="4" class="text-medium-emphasis">
              {{ t("invoicing.fiscal.empty") }}
            </td>
          </tr>
          <tr v-for="a in data.vigentes" :key="a.id">
            <td class="font-weight-medium">{{ a.chiave }}</td>
            <td class="datos-valor">
              {{ a.valore }}
              <v-icon
                v-if="a.formato_ok === false"
                icon="mdi-alert"
                color="warning"
                size="14"
                :title="t('invoicing.fiscal.datos.bad_format')"
              />
            </td>
            <td class="text-no-wrap">
              {{ a.data_inizio }} →
              {{ a.data_fine ?? t("invoicing.fiscal.open") }}
            </td>
            <td class="text-right">
              <v-btn
                v-if="data.puede_escribir"
                size="x-small"
                variant="text"
                icon="mdi-calendar-arrow-right"
                :title="t('invoicing.fiscal.actions.change')"
                @click="openSet(a.chiave)"
              />
            </td>
          </tr>
        </tbody>
      </v-table>

      <!-- Historial -->
      <v-expansion-panels variant="accordion">
        <v-expansion-panel>
          <v-expansion-panel-title>
            {{
              t("invoicing.fiscal.datos.history", { n: data.historial.length })
            }}
          </v-expansion-panel-title>
          <v-expansion-panel-text>
            <v-table density="compact">
              <tbody>
                <tr v-for="h in data.historial" :key="h.id">
                  <td class="font-weight-medium">{{ h.chiave }}</td>
                  <td class="datos-valor">{{ h.valore }}</td>
                  <td class="text-no-wrap">
                    {{ h.data_inizio }} →
                    {{ h.data_fine ?? t("invoicing.fiscal.open") }}
                  </td>
                  <td class="text-caption text-medium-emphasis">#{{ h.id }}</td>
                </tr>
              </tbody>
            </v-table>
          </v-expansion-panel-text>
        </v-expansion-panel>
      </v-expansion-panels>
    </template>

    <!-- Ajuste desde una fecha (cierra el anterior) -->
    <v-dialog v-model="setOpen" max-width="560">
      <v-card>
        <v-card-title class="text-subtitle-1">
          {{ t("invoicing.fiscal.datos.set_title") }}
        </v-card-title>
        <v-card-text>
          <p class="text-body-2 mb-3">
            {{ t("invoicing.fiscal.datos.set_intro") }}
          </p>
          <v-autocomplete
            v-model="form.clave"
            :items="claveItems"
            item-title="title"
            item-value="value"
            :label="t('invoicing.fiscal.field.chiave') + ' *'"
            :error-messages="formErrors.clave ? [formErrors.clave] : []"
            density="compact"
          />
          <v-text-field
            v-model="form.valor"
            :label="t('invoicing.fiscal.datos.valor') + ' *'"
            :hint="formatoHint"
            persistent-hint
            :error-messages="valorErrors"
            density="compact"
          />
          <div class="d-flex ga-2 mt-2">
            <v-text-field
              v-model="form.desde"
              type="date"
              :label="t('invoicing.fiscal.change.desde') + ' *'"
              density="compact"
            />
            <v-text-field
              v-model="form.hasta"
              type="date"
              :label="t('invoicing.fiscal.change.hasta')"
              density="compact"
            />
          </div>
          <v-text-field
            v-model="form.motivo"
            :label="t('invoicing.fiscal.motivo') + ' *'"
            :hint="t('invoicing.fiscal.motivo_hint')"
            persistent-hint
            density="compact"
          />
          <v-alert
            v-if="setError"
            type="error"
            variant="tonal"
            density="compact"
            class="mt-3"
          >
            {{ setError }}
          </v-alert>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="setOpen = false">{{
            t("common.cancel")
          }}</v-btn>
          <v-btn
            color="primary"
            variant="flat"
            :loading="busy"
            :disabled="!canSave"
            @click="save"
          >
            {{ t("common.save") }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { toUserMessage } from "@tmwe/shared-frontend/http";
import {
  fieldErrors,
  fiscConfigService,
  type AplicaRequisito,
  type DatosFiscales,
  type EntidadTipo,
  type RequisitoEntidad,
} from "../../services/fiscConfig.service";
import { useToastStore } from "../../stores/toast.store";

/**
 * Sección «Datos fiscales» de un cliente, partner o usuario (DISENO §5):
 * datos que exige la tabla de validación con su estado, ajustes vigentes,
 * historial y alta de un ajuste desde una fecha (solo operadores de TMWE;
 * el backend lo vuelve a comprobar). Reutilizable: ficha de anagrafica y
 * ruta #/invoicing/datos-fiscales/:tipo/:id.
 */
const props = defineProps<{
  tipo: EntidadTipo;
  id: number;
}>();

const { t, te } = useI18n();
const toasts = useToastStore();

/**
 * Origen de un dato en palabras: «sedi_interne.PEC» → «Sede de facturación ·
 * PEC», «config/einvoice_de.php» → «Configuración del emisor». Sin
 * traducción, el texto técnico (también queda en el tooltip).
 */
function fuenteTexto(ref: string | null | undefined): string {
  const raw = String(ref ?? "").trim();
  if (raw === "") return "";
  if (raw.startsWith("config/"))
    return t("invoicing.fiscal.datos.fuente.config");
  const m = raw.match(/^([a-z_]+)\.([A-Za-z_]+)\s*(.*)$/);
  if (!m) return raw;
  const [, tabla, campo, resto] = m;
  const kt = `invoicing.fiscal.datos.fuente.tabla.${tabla}`;
  const kc = `invoicing.fiscal.datos.fuente.campo.${campo}`;
  if (!te(kt) || !te(kc)) return raw;
  const extra = resto
    .replace(/\((\d+) car\.\)/, (_x, n: string) =>
      t("invoicing.fiscal.datos.fuente.caracteres", { n }),
    )
    .replace(/del partner/, t("invoicing.fiscal.datos.fuente.del_partner"));
  return `${t(kt)} · ${t(kc)}${extra ? ` ${extra}` : ""}`;
}

const today = new Date().toISOString().slice(0, 10);
const fecha = ref(today);
const data = ref<DatosFiscales | null>(null);
const loading = ref(false);
const error = ref<string | null>(null);

const errores = computed(
  () => data.value?.requeridos.filter((r) => r.nivel === "ERROR").length ?? 0,
);

async function load(): Promise<void> {
  if (!props.id) return;
  loading.value = true;
  error.value = null;
  try {
    data.value = await fiscConfigService.datosFiscales(
      props.tipo,
      props.id,
      fecha.value || today,
    );
  } catch (e) {
    data.value = null;
    error.value = toUserMessage(e, String(e));
  } finally {
    loading.value = false;
  }
}

watch(() => [props.tipo, props.id], load, { immediate: true });

function estadoColor(r: RequisitoEntidad): string {
  if (r.estado === "OK") return "success";
  return r.nivel === "ERROR" ? "error" : "warning";
}

function aplicaColor(a: AplicaRequisito): string {
  return a === "SI" ? "primary" : a === "NO" ? "grey" : "info";
}

// ── Ajuste desde fecha ───────────────────────────────────────────────
const setOpen = ref(false);
const busy = ref(false);
const setError = ref("");
const formErrors = ref<Record<string, string>>({});
const form = reactive({
  clave: "",
  valor: "",
  desde: today,
  hasta: "",
  motivo: "",
});

const claveItems = computed(() =>
  (data.value?.claves ?? []).map((k) => ({
    value: k.chiave,
    title: k.descrizione ? `${k.chiave} — ${k.descrizione}` : k.chiave,
  })),
);

const formato = computed(
  () => data.value?.claves.find((k) => k.chiave === form.clave)?.formato ?? "",
);

const formatoHint = computed(() =>
  formato.value
    ? t("invoicing.fiscal.datos.format_hint", { formato: formato.value })
    : "",
);

const formatoOk = computed(() => {
  if (!formato.value || !form.valor) return true;
  try {
    return new RegExp(formato.value, "u").test(form.valor);
  } catch {
    return true; // La validación real la hace el servidor.
  }
});

const valorErrors = computed(() => {
  const errs: string[] = [];
  if (!formatoOk.value) errs.push(t("invoicing.fiscal.datos.bad_format"));
  if (formErrors.value.valor) errs.push(formErrors.value.valor);
  return errs;
});

const canSave = computed(
  () =>
    !!form.clave &&
    !!form.valor.trim() &&
    !!form.desde &&
    !!form.motivo.trim() &&
    formatoOk.value,
);

function openSet(clave: string | null): void {
  form.clave = clave ?? "";
  const current = data.value?.vigentes.find((a) => a.chiave === clave);
  form.valor = current?.valore ?? "";
  form.desde = today;
  form.hasta = "";
  form.motivo = "";
  setError.value = "";
  formErrors.value = {};
  setOpen.value = true;
}

async function save(): Promise<void> {
  busy.value = true;
  setError.value = "";
  formErrors.value = {};
  try {
    await fiscConfigService.settingSet({
      tipo: props.tipo,
      id: props.id,
      clave: form.clave,
      valor: form.valor.trim(),
      desde: form.desde,
      hasta: form.hasta || null,
      motivo: form.motivo,
    });
    setOpen.value = false;
    toasts.push("success", t("invoicing.fiscal.toast.saved"));
    await load();
  } catch (e) {
    formErrors.value = fieldErrors(e);
    setError.value = toUserMessage(e, String(e));
  } finally {
    busy.value = false;
  }
}
</script>

<style scoped>
.datos-fecha {
  max-width: 180px;
}

.datos-valor {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.82rem;
  word-break: break-all;
}
</style>
