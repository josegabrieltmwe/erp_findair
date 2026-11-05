<template>
  <v-dialog
    :model-value="modelValue"
    max-width="620"
    persistent
    @update:model-value="onToggle"
  >
    <v-card>
      <v-card-title class="text-subtitle-1">
        {{ t("payments.authorizations.create.title") }}
      </v-card-title>

      <!-- Fase 1: formulario (cliente, método y texto de consentimiento) -->
      <v-card-text v-if="phase === 'form'">
        <div class="text-body-2 text-medium-emphasis mb-3">
          {{ t("payments.authorizations.create.hint") }}
        </div>

        <CustomerPicker
          v-model="customerId"
          :label="t('payments.list.customer')"
          class="mb-3"
        />

        <v-radio-group v-model="method" inline density="comfortable" hide-details class="mb-3">
          <v-radio :label="t('payments.authorizations.method.card')" value="card" />
          <v-radio :label="t('payments.authorizations.method.sepa_debit')" value="sepa_debit" />
        </v-radio-group>

        <!-- Texto de consentimiento vigente con las cifras del vendedor: lo lee el cliente antes de aceptar. -->
        <div v-if="consentLoading" class="d-flex justify-center pa-4">
          <v-progress-circular indeterminate color="primary" size="24" />
        </div>
        <v-alert v-else-if="consentError" type="error" variant="tonal" density="compact" data-testid="consent-error">
          {{ t(`payments.surcharges.errors.${consentError}`) }}
        </v-alert>
        <template v-else-if="consent">
          <div class="text-subtitle-2 mb-1">{{ t("payments.authorizations.create.consent_title") }}</div>
          <div class="text-caption text-medium-emphasis mb-1">
            {{ t("payments.authorizations.create.version", { version: consent.version }) }}
          </div>
          <div class="consent-box" data-testid="consent-body">{{ consent.body }}</div>
          <div class="text-body-2 mt-2" data-testid="consent-terms">
            {{
              t("payments.authorizations.create.terms", {
                charge: formatMinor(consent.terms.max_charge_minor, consent.terms.currency),
                month: formatMinor(consent.terms.max_month_minor, consent.terms.currency),
                notice: consent.terms.notice_days,
                dispute: consent.terms.dispute_days,
              })
            }}
          </div>
          <!-- El consentimiento es del cliente: el personal solo lo registra si se dio de forma presencial y documentada. -->
          <v-checkbox
            v-model="accepted"
            :label="t('payments.authorizations.create.accept')"
            density="comfortable"
            hide-details
            class="mt-2"
            data-testid="consent-accept"
          />
        </template>

        <v-alert v-if="errorKind" type="error" variant="tonal" density="compact" class="mt-3" data-testid="create-error">
          {{ t(`payments.surcharges.errors.${errorKind}`) }}
        </v-alert>
      </v-card-text>

      <!-- Fase 2: el cliente teclea el medio de pago en la página alojada; se sondea hasta `active` (lo fija el webhook). -->
      <v-card-text v-else-if="phase === 'processing'">
        <div class="d-flex align-center ga-3 mb-3">
          <v-progress-circular indeterminate color="primary" size="24" />
          <span>{{ t("payments.authorizations.create.processing") }}</span>
        </div>
        <div class="text-body-2 text-medium-emphasis mb-3">
          {{ t("payments.authorizations.create.processing_hint") }}
        </div>
        <v-alert v-if="replayedNoUrl" type="info" variant="tonal" density="compact" class="mb-3">
          {{ t("payments.authorizations.create.replayed") }}
        </v-alert>
        <v-alert v-if="blocked" type="warning" variant="tonal" density="compact" class="mb-3">
          {{ t("payments.online.popup_blocked") }}
        </v-alert>
        <v-alert v-if="expired" type="warning" variant="tonal" density="compact" class="mb-3">
          {{ t("payments.authorizations.create.expired") }}
        </v-alert>
        <v-alert v-if="gaveUp" type="info" variant="tonal" density="compact" class="mb-3">
          {{ t("payments.online.gave_up") }}
        </v-alert>
        <div class="d-flex flex-wrap ga-2">
          <v-btn
            v-if="canReopen"
            size="small"
            variant="tonal"
            color="primary"
            prepend-icon="mdi-open-in-new"
            @click="openCheckout"
          >
            {{ t("payments.online.open_again") }}
          </v-btn>
          <v-btn size="small" variant="text" :loading="refreshing" @click="refreshNow">
            {{ t("payments.online.refresh") }}
          </v-btn>
        </div>
      </v-card-text>

      <!-- Fase 3: resultado definitivo -->
      <v-card-text v-else>
        <v-alert :type="outcome === 'active' ? 'success' : 'error'" variant="tonal" density="compact" data-testid="create-outcome">
          {{ t(`payments.authorizations.create.result.${outcome}`) }}
        </v-alert>
      </v-card-text>

      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="close">
          {{ phase === "form" ? t("common.cancel") : t("payments.online.close") }}
        </v-btn>
        <v-btn
          v-if="phase === 'form'"
          color="primary"
          :loading="saving"
          :disabled="!canSubmit"
          data-testid="create-submit"
          @click="submit"
        >
          {{ t("payments.authorizations.create.submit") }}
        </v-btn>
        <v-btn v-else-if="phase === 'done' && outcome !== 'active'" color="primary" @click="reset">
          {{ t("payments.online.retry") }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
/**
 * Alta de una autorización de cobro EN NOMBRE de un cliente del partner (consentimiento presencial documentado).
 *
 * Qué es: el permiso que el cliente firma una vez para que el vendedor le cobre después recargos con el método guardado
 * (tarjeta por defecto o adeudo SEPA) sin que él esté presente. Se usa Stripe Checkout `setup` ALOJADO: la tarjeta o el IBAN
 * los teclea el cliente en la página de la pasarela. Nada de eso toca el ERP ni TMWE; la pantalla solo ve marca y últimos 4.
 *
 * Flujo: (1) se elige cliente y método y se carga el texto de consentimiento vigente (`?view=consent_text`) con las
 * cifras del vendedor (topes y plazos); la persona marca que el cliente lo ha leído y aceptado; (2) `POST` con
 * `consent {text_version, locale, accepted: true}`, `return_to: 'erp'` y una clave de idempotencia por intento, y se abre
 * `checkout_url` en ventana nueva (si el navegador la bloquea se ofrece el enlace); (3) se sondea `GET ?id=pau_…` hasta
 * ver el estado definitivo. La AUTORIDAD es el webhook de la pasarela (`setup_intent.succeeded`), no el retorno del
 * navegador, igual que en `PayOnlineDialog`. La IP, el user agent y la persona de la prueba del consentimiento los pone
 * el servidor, nunca esta pantalla.
 *
 * Errores explicados por código: 409 `CONSENT_TEXT_NOT_CURRENT` (el texto cambió: se recarga), `AUTHORIZATION_ALREADY_ACTIVE`,
 * `PAYMENT_METHOD_NOT_AVAILABLE`; 404 cliente ajeno; 503 `PAYMENT_NOT_ACTIVE` (alta apagada en el servidor) o
 * `PAYMENT_RETURN_URL_NOT_CONFIGURED`. Un reintento con la misma clave responde 200 `replayed` SIN `checkout_url`: se
 * avisa y se sigue sondeando.
 *
 * Permiso: `payment_gateways:write` (la página solo ofrece el botón con él). Eventos: `update:modelValue` y `created`
 * (la autorización existe, aunque aún esté `pending`; la página recarga la lista). Lógica pura en `authorizationsModel.ts`
 * y `payOnlineModel.ts` (URL segura, ritmo del sondeo).
 */
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import {
  payAuthorizations,
  type PayAuthorization,
  type PayAuthorizationMethod,
  type PayConsentText,
} from "@shared/payment_gateways/services/paymentGateways.service";
import CustomerPicker from "./CustomerPicker.vue";
import { isAuthorizationSettled, newAuthorizationKey } from "./authorizationsModel";
import { POLL_MAX_ATTEMPTS, isCheckoutExpired, isSafeCheckoutUrl, pollDelay } from "./payOnlineModel";
import { classifySurchargeError, formatMinor, type SurchargeErrorKind } from "./surchargesModel";

/** Idioma del texto de consentimiento que se pide y se acepta (formato `xx-XX`). */
const CONSENT_LOCALE = "es-ES";

const props = defineProps<{ modelValue: boolean }>();
const emit = defineEmits<{
  "update:modelValue": [boolean];
  created: [];
}>();

const { t } = useI18n();

const phase = ref<"form" | "processing" | "done">("form");
const customerId = ref<number | null>(null);
const method = ref<PayAuthorizationMethod>("card");
const consent = ref<PayConsentText | null>(null);
const consentLoading = ref(false);
const consentError = ref<SurchargeErrorKind | null>(null);
const accepted = ref(false);
const saving = ref(false);
const refreshing = ref(false);
const errorKind = ref<SurchargeErrorKind | null>(null);
const authorization = ref<PayAuthorization | null>(null);
const outcome = ref<"active" | "failed" | "revoked" | "expired">("failed");
const blocked = ref(false);
const gaveUp = ref(false);
const replayedNoUrl = ref(false);
/** Clave del intento en curso; se renueva al cambiar la petición (cliente/método) o tras un resultado fallido. */
const idempotencyKey = ref(newAuthorizationKey());

let timer: ReturnType<typeof setTimeout> | null = null;
let attempt = 0;

const canSubmit = computed(
  () => !!customerId.value && !!consent.value && accepted.value && !saving.value && !consentLoading.value,
);
const expired = computed(() => isCheckoutExpired(authorization.value?.expires_at));
const canReopen = computed(() => isSafeCheckoutUrl(authorization.value?.checkout_url) && !expired.value);

/** Carga el texto de consentimiento vigente; un error se explica y deja el formulario sin poder enviarse. */
async function loadConsent(): Promise<void> {
  consentLoading.value = true;
  consentError.value = null;
  consent.value = null;
  try {
    consent.value = await payAuthorizations.consentText(CONSENT_LOCALE);
  } catch (e) {
    consentError.value = classifySurchargeError(e);
  } finally {
    consentLoading.value = false;
  }
}

function stopPolling(): void {
  if (timer) clearTimeout(timer);
  timer = null;
}

/** Vuelve al formulario con estado limpio y una clave nueva (intento nuevo). */
function reset(): void {
  stopPolling();
  phase.value = "form";
  customerId.value = null;
  method.value = "card";
  accepted.value = false;
  errorKind.value = null;
  authorization.value = null;
  blocked.value = false;
  gaveUp.value = false;
  replayedNoUrl.value = false;
  attempt = 0;
  idempotencyKey.value = newAuthorizationKey();
  void loadConsent();
}

watch(
  () => props.modelValue,
  (open) => {
    if (!open) return;
    // Si quedó un alta en proceso (se cerró sin terminar) se retoma su sondeo; si no, se empieza limpio.
    if (phase.value === "processing") {
      attempt = 0;
      void poll();
    } else {
      reset();
    }
  },
);

// Otro cliente o método es OTRA petición: reutilizar la clave daría 409. Se renueva (solo antes de enviar).
watch([customerId, method], () => {
  if (phase.value === "form") {
    idempotencyKey.value = newAuthorizationKey();
    errorKind.value = null;
  }
});

/** Abre la página alojada en ventana nueva; si el navegador la bloquea lo indica para ofrecer el enlace. */
function openCheckout(): void {
  const url = authorization.value?.checkout_url;
  if (!isSafeCheckoutUrl(url)) return;
  const w = window.open(url, "_blank", "noopener");
  blocked.value = w === null;
}

async function submit(): Promise<void> {
  if (!canSubmit.value || !consent.value || customerId.value === null) return;
  saving.value = true;
  errorKind.value = null;
  try {
    const res = await payAuthorizations.create({
      customer_id: customerId.value,
      method: method.value,
      consentTextVersion: consent.value.version,
      consentLocale: consent.value.locale,
      idempotency_key: idempotencyKey.value,
    });
    authorization.value = res.authorization;
    emit("created");
    if (isAuthorizationSettled(res.authorization.status)) {
      finish(res.authorization.status as typeof outcome.value);
      return;
    }
    phase.value = "processing";
    replayedNoUrl.value = res.replayed && !res.authorization.checkout_url;
    openCheckout();
    schedule();
  } catch (e) {
    const kind = classifySurchargeError(e);
    errorKind.value = kind;
    // El texto cambió mientras se leía: se recarga y hay que volver a aceptarlo. Un conflicto es intento nuevo.
    if (kind === "consent_stale") {
      accepted.value = false;
      void loadConsent();
    }
    if (kind === "conflict" || kind === "consent_stale") idempotencyKey.value = newAuthorizationKey();
  } finally {
    saving.value = false;
  }
}

/** Programa la próxima consulta de estado, espaciándolas y con tope de intentos. */
function schedule(): void {
  stopPolling();
  if (attempt >= POLL_MAX_ATTEMPTS) {
    gaveUp.value = true;
    return;
  }
  timer = setTimeout(() => void poll(), pollDelay(attempt));
  attempt += 1;
}

/** Consulta `GET ?id=` y cierra si el estado es definitivo; un fallo de red solo reintenta en el siguiente turno. */
async function poll(): Promise<void> {
  const id = authorization.value?.public_id;
  if (!id || phase.value !== "processing") return;
  try {
    const fresh = await payAuthorizations.get(id);
    authorization.value = { ...authorization.value, ...fresh, checkout_url: authorization.value?.checkout_url, expires_at: authorization.value?.expires_at };
    if (isAuthorizationSettled(fresh.status)) {
      finish(fresh.status as typeof outcome.value);
      return;
    }
  } catch {
    // Se ignora: la autoridad es el webhook y la siguiente consulta lo recogerá.
  }
  schedule();
}

async function refreshNow(): Promise<void> {
  refreshing.value = true;
  gaveUp.value = false;
  attempt = 0;
  try {
    await poll();
  } finally {
    refreshing.value = false;
  }
}

function finish(result: typeof outcome.value): void {
  stopPolling();
  outcome.value = result;
  phase.value = "done";
  emit("created");
}

/** Cerrar no cancela el alta: se deja de sondear y el estado final lo fija el webhook (se verá en el listado). */
function close(): void {
  stopPolling();
  emit("update:modelValue", false);
}

function onToggle(v: boolean): void {
  if (!v) close();
}

// Al volver a la pestaña del ERP tras firmar en la otra ventana se consulta de inmediato.
function onVisible(): void {
  if (document.visibilityState === "visible" && phase.value === "processing") void poll();
}
document.addEventListener("visibilitychange", onVisible);
onBeforeUnmount(() => {
  stopPolling();
  document.removeEventListener("visibilitychange", onVisible);
});
</script>

<style scoped>
.consent-box {
  white-space: pre-wrap;
  max-height: 220px;
  overflow: auto;
  padding: 12px;
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  border-radius: 6px;
  font-size: 0.85rem;
}
</style>
