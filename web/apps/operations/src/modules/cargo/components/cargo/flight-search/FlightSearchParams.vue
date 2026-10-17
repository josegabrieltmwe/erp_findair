<template>
  <div class="fsp">
    <!--
      Problemas en los datos del envio, ARRIBA del todo: cotizar son hasta 35
      peticiones por aerolinea, y con peso 0 o sin dimensiones esas peticiones
      se gastan igual devolviendo un precio que no corresponde. Con severidad
      'error' el boton de buscar queda bloqueado (el servidor responde 422);
      con 'warning' se puede buscar, pero conviene saberlo antes.
    -->
    <v-alert
      v-if="hasDataIssues"
      :type="hasDataErrors ? 'error' : 'warning'"
      variant="tonal"
      density="compact"
      class="mb-3"
      :title="
        hasDataErrors
          ? t('cargo.flight.data_invalid_title')
          : t('cargo.flight.data_warning_title')
      "
    >
      <div class="fsp-issues">
        <div
          v-for="(iss, idx) in dataErrors"
          :key="`e${idx}`"
          class="fsp-issue"
        >
          <v-icon icon="mdi-alert-circle" size="14" class="me-1" />
          {{ issueMessage(iss) }}
        </div>
        <template v-if="issuesOpen || !hasDataErrors">
          <div
            v-for="(iss, idx) in dataWarnings"
            :key="`w${idx}`"
            class="fsp-issue"
          >
            <v-icon icon="mdi-alert-outline" size="14" class="me-1" />
            {{ issueMessage(iss) }}
          </div>
        </template>
        <a
          v-if="hasDataErrors && dataWarnings.length"
          class="fsp-issue-toggle"
          role="button"
          tabindex="0"
          @click="issuesOpen = !issuesOpen"
          @keydown.enter="issuesOpen = !issuesOpen"
        >
          {{
            issuesOpen
              ? t("cargo.flight.data_hide_warnings")
              : t("cargo.flight.data_show_warnings", {
                  count: dataWarnings.length,
                })
          }}
        </a>
      </div>
    </v-alert>

    <!--
      Secciones apiladas (FormSection), no v-row sueltas: es el primitivo que el
      proyecto usa para agrupar campos en modales, y a 720px un campo por linea
      se lee mejor que parejas con etiquetas largas ("Destination (IATA)").
    -->
    <FormSection
      :title="t('cargo.flight.section_route')"
      icon="mdi-airplane"
      flat
    >
      <!--
        Autocomplete, not a 3-char text box. Matching the NAME as well as the
        code is what makes a city with several airports usable — typing
        "milano" offers MXP, LIN and BGY instead of demanding the code from
        memory. It also validates by construction: "XXX" used to be accepted
        here and only failed at the carrier.
      -->
      <v-row dense>
        <v-col cols="6">
          <v-autocomplete
            :model-value="modelValue.origin"
            :items="originItems"
            :loading="originLoading"
            item-title="label"
            item-value="code"
            :label="t('cargo.flight.origin_iata')"
            density="compact"
            placeholder="MXP"
            prepend-inner-icon="mdi-airplane-takeoff"
            :readonly="searching"
            hide-no-data
            auto-select-first
            no-filter
            @update:search="onOriginSearch"
            @update:model-value="
              patch('origin', String($event ?? '').toUpperCase())
            "
          >
            <template #item="{ props: ip, item }">
              <v-list-item v-bind="ip" :subtitle="airportSubtitle(item.raw)" />
            </template>
          </v-autocomplete>
        </v-col>
        <v-col cols="6">
          <v-autocomplete
            :model-value="modelValue.destination"
            :items="destinationItems"
            :loading="destinationLoading"
            item-title="label"
            item-value="code"
            :label="t('cargo.flight.dest_iata')"
            density="compact"
            placeholder="JFK"
            prepend-inner-icon="mdi-airplane-landing"
            :readonly="searching"
            hide-no-data
            auto-select-first
            no-filter
            @update:search="onDestinationSearch"
            @update:model-value="
              patch('destination', String($event ?? '').toUpperCase())
            "
          >
            <template #item="{ props: ip, item }">
              <v-list-item v-bind="ip" :subtitle="airportSubtitle(item.raw)" />
            </template>
          </v-autocomplete>
        </v-col>
      </v-row>
    </FormSection>

    <FormSection
      :title="t('cargo.flight.section_when')"
      icon="mdi-calendar"
      flat
    >
      <!-- Media columna: un campo de fecha no gana nada con 720px. -->
      <v-text-field
        :model-value="modelValue.date"
        class="fsp-date"
        :label="t('cargo.dates.title_single')"
        type="date"
        :min="minDate"
        :error="Boolean(dateError)"
        :error-messages="dateError ? [dateError] : []"
        density="compact"
        prepend-inner-icon="mdi-calendar"
        :readonly="searching"
        @update:model-value="patch('date', String($event ?? ''))"
      />
    </FormSection>

    <!--
      Which sources to query, chosen BEFORE searching. Filters narrow what
      already arrived; these decide what is asked for at all. A search nobody
      needs still costs a round trip per carrier — and for KLM a firm quote
      that holds capacity for ~15 min — so opting out up front avoids work.

      Shown as a list, not a dropdown: the credential each source would quote
      with is the point, and inside a select it was invisible.
    -->
    <FormSection
      :title="t('cargo.flight.sources_label')"
      icon="mdi-key-outline"
      flat
      last
    >
      <div
        v-for="it in sourceItems"
        :key="it.value"
        class="fsp-source"
        :class="{ 'fsp-source--off': !isSourceAvailable(it.value) }"
      >
        <v-checkbox
          :model-value="modelValue[it.value] === true"
          :disabled="!isSourceAvailable(it.value) || searching"
          :label="it.title"
          density="compact"
          hide-details
          color="primary"
          @update:model-value="toggleSource(it.value, $event === true)"
        />
        <!-- Procedencia de la credencial: el dato que antes no se veia. -->
        <span v-if="!isSourceAvailable(it.value)" class="fsp-hint text-error">
          {{
            sourceMeta(it.value)?.reason || t("cargo.flight.src_no_credential")
          }}
        </span>
        <span
          v-else-if="sourceMeta(it.value)?.account?.mode === 'delegated'"
          class="fsp-hint text-warning"
        >
          <v-icon icon="mdi-account-arrow-right" size="13" class="me-1" />
          {{
            t("cargo.flight.src_by_partner", {
              partner: sourceMeta(it.value)?.account?.partner || "—",
            })
          }}
        </span>
        <span
          v-else-if="sourceMeta(it.value)"
          class="fsp-hint text-medium-emphasis"
        >
          {{ t("cargo.flight.src_own_account") }}
        </span>
      </div>

      <!--
        Credenciales aplicables a esta ruta, para la fuente realtime.

        La delegacion se ofrece, no se adivina: una ruta puede tocar al partner
        del pais de salida, al del pais de llegada y al que opera el envio, y
        ninguna regla automatica cubre los tres. El operario ve todas y elige.

        `selected` marca la que resolvio la precedencia — la que se usa si no se
        toca nada, y la unica que se aplica al cliente B2B, que no ve esto.
      -->
      <div
        v-if="
          credentialOptions.length > 1 && modelValue.include_realtime === true
        "
        class="fsp-creds"
      >
        <div class="text-caption text-medium-emphasis mb-1">
          {{ t("cargo.flight.credentials_label") }}
        </div>
        <div
          v-for="c in credentialOptions"
          :key="c.delegation_id"
          class="fsp-cred"
        >
          <v-checkbox
            :model-value="isCredentialOn(c)"
            :disabled="searching"
            density="compact"
            hide-details
            color="primary"
            @update:model-value="toggleCredential(c, $event === true)"
          >
            <template #label>
              <span class="fsp-cred-label">{{ c.label }}</span>
            </template>
          </v-checkbox>
          <span v-if="c.partner" class="fsp-hint text-medium-emphasis">
            {{ c.partner }}
          </span>
          <v-chip
            v-for="r in c.reasons"
            :key="r"
            size="x-small"
            variant="tonal"
            class="ms-1"
          >
            {{ t(`cargo.flight.cred_reason_${r}`) }}
          </v-chip>
        </div>
      </div>
    </FormSection>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch, type Ref } from "vue";
import { useI18n } from "vue-i18n";
import FormSection from "@shared/ui/FormSection.vue";

import {
  rateSourcesService,
  type AirportItem,
  type RateSource,
  type RateCredentialOption,
  type RateSourceKey,
  type QuoteDataValidation,
  type QuoteDataIssue,
} from "@cargo/services/rate_sources.service";
import { translateQuoteIssue } from "@cargo/utils/quoteValidation";

// props/emits ANTES de cualquier uso: `watch(..., {immediate:true})`
// corre durante el setup, y si estas declaraciones quedan más abajo el
// callback toca `props` en su zona muerta temporal (TDZ) y el setup
// revienta con "can't access lexical declaration before initialization".
const props = defineProps<{
  modelValue: ParamsModel;
  canSearch: boolean;
  searching: boolean;
  /** Server "today" (YYYY-MM-DD) — min selectable date; blocks past dates. */
  minDate?: string;
  /** Validation message when the chosen date is in the past (server clock). */
  dateError?: string | null;
  /** Shipment whose client decides which credentials apply to this route. */
  shipmentId?: number;
}>();

const emit = defineEmits<{
  (e: "update:modelValue", v: ParamsModel): void;
  (e: "search"): void;
  (e: "stop"): void;
}>();

interface ParamsModel {
  origin: string;
  destination: string;
  weight: string;
  date: string;
  /** Source toggles. Undefined = on, matching the server-side defaults. */
  include_published?: boolean;
  include_realtime?: boolean;
  /** Cuenta directa de TMWE IT, ignorando la delegación de la ruta. */
  include_realtime_direct?: boolean;
  /** Credenciales elegidas (ids de delegacion; 0 = cuenta directa TMWE IT). */
  credential_ids?: number[];
  include_klm?: boolean;
  include_klm_quotes?: boolean;
  /** Partner credential accepted for this search; only set for delegated sources. */
  via_partner?: number;
}

const { t } = useI18n();

// ── Airport type-ahead ──────────────────────────────────────────────────────
const originItems = ref<AirportItem[]>([]);
const destinationItems = ref<AirportItem[]>([]);
const originLoading = ref(false);
const destinationLoading = ref(false);

/**
 * Debounced remote lookup.
 *
 * v-autocomplete fires `update:search` on every keystroke; without the delay a
 * three-letter code means three round trips. 250ms is below the threshold where
 * the list feels laggy and well above typing speed.
 */
function makeAirportSearch(
  items: Ref<AirportItem[]>,
  loading: Ref<boolean>,
): (q: string) => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let seq = 0;
  return (q: string) => {
    if (timer) clearTimeout(timer);
    const query = (q ?? "").trim();
    if (query.length < 2) {
      items.value = [];
      return;
    }
    timer = setTimeout(async () => {
      const mine = ++seq;
      loading.value = true;
      try {
        const res = await rateSourcesService.searchAirports(query);
        // Drop out-of-order replies: a slow early request must not overwrite a
        // newer, narrower result.
        if (mine === seq) items.value = res;
      } catch {
        if (mine === seq) items.value = [];
      } finally {
        if (mine === seq) loading.value = false;
      }
    }, 250);
  };
}

const onOriginSearch = makeAirportSearch(originItems, originLoading);
const onDestinationSearch = makeAirportSearch(
  destinationItems,
  destinationLoading,
);

// ── Source availability + credential provenance ─────────────────────────────
const sourcesMeta = ref<RateSource[]>([]);

/** Ruta cuyas casillas ya se inicializaron, para no repisar al operador. */
const seededRoute = ref<string>("");

// ── Validación de los datos del envío ───────────────────────────────────────
/** null = sin shipment en contexto, o el lookup falló. */
const dataValidation = ref<QuoteDataValidation | null>(null);

const dataErrors = computed(() =>
  (dataValidation.value?.issues ?? []).filter((i) => i.severity === "error"),
);
const dataWarnings = computed(() =>
  (dataValidation.value?.issues ?? []).filter((i) => i.severity === "warning"),
);

function issueMessage(issue: QuoteDataIssue): string {
  return translateQuoteIssue(issue, (key, params) => t(key, params));
}

/** Con errores no se cotiza: el servidor responde 422 y no llama al carrier. */
const hasDataErrors = computed(() => dataErrors.value.length > 0);
const hasDataIssues = computed(
  () => dataErrors.value.length + dataWarnings.value.length > 0,
);

/** Detalle abierto/cerrado del panel de problemas. */
const issuesOpen = ref(false);

/**
 * Metadatos de credencial de una fuente, a partir de su FLAG de formulario.
 *
 * Los dos vocabularios no coinciden: el formulario habla en flags
 * (`include_published`) y el servidor en claves de fuente (`published`). Sin
 * traducir, el `find` no casaba nunca y los subtitulos de procedencia
 * (cuenta propia / by <partner> / sin credencial) salian siempre vacios.
 */
function sourceMeta(flag: string): RateSource | undefined {
  const key = SOURCE_BY_FLAG[flag as SourceKey];
  if (!key) return undefined;
  return sourcesMeta.value.find((x) => x.key === key);
}

/**
 * Ask which sources are possible for this route, and with whose credential.
 *
 * Re-runs whenever origin or destination change because credentials resolve by
 * COUNTRY: the same operator has an own contract for one lane and a delegation
 * for another. Purely a lookup — no carrier is called.
 */
async function refreshSources(): Promise<void> {
  const o = props.modelValue.origin;
  const d = props.modelValue.destination;
  if (!o && !d) {
    sourcesMeta.value = [];
    return;
  }
  try {
    const res = await rateSourcesService.forRoute({
      origin: o,
      destination: d,
      shipmentId: props.shipmentId,
    });
    sourcesMeta.value = res.sources ?? [];
    // Problemas en los datos del envío (peso, bultos, dimensiones). Se conocen
    // aquí, al abrir el modal, así que el operador los ve antes de lanzar nada.
    dataValidation.value = res.validation ?? null;

    // Estado INICIAL de las casillas para esta ruta: lo no disponible queda
    // apagado (no puede responderse) y lo delegado tambien (usar la cuenta de
    // otro partner debe decidirse, no heredarse).
    //
    // Solo la primera vez que se ve la ruta: si se reaplicara en cada refresco,
    // desmarcaria la delegada justo despues de que el operador la marcase —la
    // casilla parecia no responder— porque marcarla dispara este mismo camino.
    const routeKey = `${o}|${d}`;
    if (seededRoute.value === routeKey) return;
    seededRoute.value = routeKey;

    const next = { ...props.modelValue };
    let changed = false;
    for (const src of sourcesMeta.value) {
      const flag = FLAG_BY_SOURCE[src.key];
      if (!flag) continue;
      const allowed = src.available && src.account?.mode !== "delegated";
      if (!allowed && next[flag] !== false) {
        next[flag] = false;
        changed = true;
      }
    }
    if (changed) emit("update:modelValue", next);
  } catch {
    // A lookup failure must not block searching: fall back to the old
    // behaviour of offering everything.
    sourcesMeta.value = [];
    dataValidation.value = null;
  }
}

const FLAG_BY_SOURCE: Record<string, SourceKey> = {
  published: "include_published",
  realtime: "include_realtime",
  realtime_direct: "include_realtime_direct",
  klm: "include_klm",
  klm_quote: "include_klm_quotes",
};

/** Inverso de FLAG_BY_SOURCE: flag del formulario -> clave de fuente del servidor. */
const SOURCE_BY_FLAG: Record<SourceKey, RateSourceKey> = {
  include_published: "published",
  include_realtime: "realtime",
  include_realtime_direct: "realtime_direct",
  include_klm: "klm",
  include_klm_quotes: "klm_quote",
};

// Clave STRING, no un array: un getter que devuelve `[a, b]` crea un objeto
// nuevo en cada evaluacion y watch lo compara por referencia, asi que cualquier
// cambio del modelo —marcar una fuente— relanzaba la consulta de credenciales.
watch(
  () => `${props.modelValue.origin}|${props.modelValue.destination}`,
  () => {
    void refreshSources();
  },
  { immediate: true },
);

/** "Amsterdam · NL" under the code — the country matters: credentials resolve by it. */
function airportSubtitle(a: AirportItem): string {
  return [a.city, a.country].filter(Boolean).join(" · ");
}

/**
 * Sources the operator can switch off before searching.
 *
 * Keys mirror the API flags one-to-one; `undefined` means "on", the same
 * default the server applies, so an untouched form behaves exactly as before.
 */
const sourceItems = computed(() => [
  {
    value: "include_published" as const,
    title: t("cargo.flight.src_wc_rates"),
  },
  { value: "include_realtime" as const, title: t("cargo.flight.src_wc_quote") },
  {
    value: "include_realtime_direct" as const,
    title: t("cargo.flight.src_wc_quote_direct"),
  },
  { value: "include_klm" as const, title: t("cargo.flight.src_klm_rates") },
  {
    value: "include_klm_quotes" as const,
    title: t("cargo.flight.src_klm_quote"),
  },
]);

type SourceKey =
  | "include_published"
  | "include_realtime"
  | "include_realtime_direct"
  | "include_klm"
  | "include_klm_quotes";

function patch<K extends keyof ParamsModel>(
  key: K,
  value: ParamsModel[K],
): void {
  emit("update:modelValue", { ...props.modelValue, [key]: value });
}

/**
 * Una fuente es utilizable salvo que el servidor diga que no hay credencial.
 * Mientras no han llegado los metadatos se asume disponible: bloquear el
 * formulario por una consulta aun en vuelo seria peor que dejar intentarlo.
 */
function isSourceAvailable(flag: string): boolean {
  const meta = sourceMeta(flag);
  return meta ? meta.available : true;
}

/**
 * Marca/desmarca una fuente y recalcula `via_partner`.
 *
 * `via_partner` viaja solo cuando se acepta a proposito una fuente delegada:
 * es lo que autoriza al backend a cotizar con la cuenta de otro partner.
 */
function toggleSource(flag: SourceKey, on: boolean): void {
  const next = { ...props.modelValue, [flag]: on };
  const accepted = sourcesMeta.value.find(
    (src) =>
      src.account?.mode === "delegated" &&
      src.account?.ref_id != null &&
      next[FLAG_BY_SOURCE[src.key]] === true,
  );
  next.via_partner = accepted?.account?.ref_id ?? undefined;
  emit("update:modelValue", next);
}

/** Ninguna fuente marcada: buscar no puede devolver nada. */
const noSourceSelected = computed<boolean>(() =>
  sourceItems.value.every((it) => props.modelValue[it.value] !== true),
);

/** Por que esta bloqueado el boton, para el tooltip. */
const searchBlockedReason = computed<string>(() => {
  // Los datos van primero: sin peso o sin dimensiones el servidor responde 422
  // y no llega a llamar al carrier, así que es lo más útil que decir aquí.
  if (hasDataErrors.value) return t("cargo.flight.data_invalid_short");
  if (noSourceSelected.value) return t("cargo.flight.search_no_sources");
  if (!props.canSearch) return t("cargo.flight.search_blocked");
  return "";
});
/**
 * El pie con Cancel/Search vive en el dialogo padre, no aqui: es el que conoce
 * su propio estado de apertura. Estos valores dependen de las fuentes marcadas
 * y de la validacion de datos, que si son de este componente.
 */
defineExpose({ noSourceSelected, searchBlockedReason, hasDataErrors });
// ─── Credenciales elegibles (solo ERP) ──────────────────────────────────────

/** Alternativas que el backend ofrece para la fuente realtime. */
const credentialOptions = computed<RateCredentialOption[]>(
  () => sourcesMeta.value.find((x) => x.key === "realtime")?.accounts ?? [],
);

/**
 * Credenciales marcadas. `undefined` = "la que decida la precedencia", que es
 * el comportamiento por defecto y el unico del cliente B2B.
 */
function selectedCredentialIds(): number[] {
  const raw = props.modelValue.credential_ids;
  if (Array.isArray(raw)) return raw;
  // Sin eleccion explicita: la que el backend marco como `selected`.
  const pre = credentialOptions.value.find((c) => c.selected);
  return pre ? [pre.delegation_id] : [];
}

function isCredentialOn(c: RateCredentialOption): boolean {
  return selectedCredentialIds().includes(c.delegation_id);
}

/**
 * Marca/desmarca una credencial.
 *
 * Se permite marcar varias: cada una lanza su propia consulta y el listado
 * muestra de cual salio cada tarifa, que es lo que hace comparables dos
 * cuentas sobre la misma ruta. Desmarcarlas todas vuelve al automatico.
 */
function toggleCredential(c: RateCredentialOption, on: boolean): void {
  const cur = new Set(selectedCredentialIds());
  if (on) cur.add(c.delegation_id);
  else cur.delete(c.delegation_id);
  const next = [...cur];
  emit("update:modelValue", {
    ...props.modelValue,
    credential_ids: next.length ? next : undefined,
  });
}
</script>

<style scoped lang="scss">
.fsp-date {
  max-width: 260px;
}

.fsp-source {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 34px;
}
.fsp-source--off {
  opacity: 0.6;
}
.fsp-creds {
  margin-top: 8px;
  padding: 8px 12px;
  border-left: 2px solid rgb(var(--v-theme-surface-light));
}
.fsp-cred {
  display: flex;
  align-items: center;
  gap: 6px;
  min-height: 30px;
}
.fsp-cred-label {
  font-size: 0.8125rem;
}
.fsp-hint {
  font-size: 0.75rem;
  white-space: nowrap;
}

.fsp-issues {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.fsp-issue {
  font-size: 0.8125rem;
  line-height: 1.35;
}

.fsp-issue-toggle {
  font-size: 0.75rem;
  text-decoration: underline;
  cursor: pointer;
  align-self: flex-start;
  margin-top: 2px;
}
</style>
