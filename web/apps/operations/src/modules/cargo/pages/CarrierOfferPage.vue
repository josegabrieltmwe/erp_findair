<template>
  <div class="carrier-offer" data-testid="carrier-offer">
    <v-container class="carrier-offer__container">
      <header class="carrier-offer__head">
        <h1 class="carrier-offer__title" data-testid="carrier-title">{{ t("cargo.carrierOffer.title", { id: offerId }) }}</h1>
        <p v-if="view" class="carrier-offer__sub">
          {{ view.carrier }}<template v-if="requestedOn"> · {{ t("cargo.carrierOffer.requested_on", { date: requestedOn }) }}</template>
        </p>
      </header>

      <v-progress-linear v-if="phase === 'loading'" indeterminate color="primary" class="mb-4" data-testid="carrier-loading" />

      <v-alert
        v-else-if="phase === 'error' && failure"
        type="warning"
        variant="tonal"
        class="mb-4"
        data-testid="carrier-error"
        :data-reason="failureReason"
      >
        <div class="carrier-offer__alert-title">{{ t(`cargo.carrierOffer.${failure.title}`) }}</div>
        <div>{{ t(`cargo.carrierOffer.${failure.message}`) }}</div>
        <v-btn v-if="failure.retry" class="mt-3" variant="outlined" size="small" data-testid="carrier-retry" @click="reload">
          {{ t("cargo.carrierOffer.retry") }}
        </v-btn>
      </v-alert>

      <template v-else-if="view">
        <v-alert v-if="thanks" type="success" variant="tonal" class="mb-4" data-testid="carrier-thanks">
          <div class="carrier-offer__alert-title">{{ t("cargo.carrierOffer.thanks_title") }}</div>
          <div>{{ t("cargo.carrierOffer.thanks_body") }}</div>
          <div class="mt-2">{{ t("cargo.carrierOffer.thanks_total", { total: thanks.total }) }}</div>
          <v-btn class="mt-3" variant="outlined" size="small" data-testid="carrier-edit-again" @click="editAgain">
            {{ t("cargo.carrierOffer.edit_again") }}
          </v-btn>
        </v-alert>

        <v-alert v-else-if="banner" :type="banner.kind" variant="tonal" class="mb-4" data-testid="carrier-banner">
          {{ t(`cargo.carrierOffer.${banner.key}`, { date: answeredOn }) }}
        </v-alert>

        <v-card v-if="note" variant="outlined" class="mb-4" data-testid="carrier-note">
          <v-card-title class="carrier-offer__card-title">{{ t("cargo.carrierOffer.note_title") }}</v-card-title>
          <v-card-text class="carrier-offer__note">{{ note }}</v-card-text>
        </v-card>

        <div class="carrier-offer__stack">
          <CarrierFreightDetails :freight="view.freight" :parcels="view.parcels" />
          <CarrierChargesTable
            :charges="view.charges"
            :currency="view.currency"
            :total="shownTotal"
            :chargeable-weight="view.chargeable_weight"
            :form="editing ? form : null"
            :errors="errors"
          />

          <CarrierFilesCard :view="view" @uploaded="refreshView" />

          <CarrierReceiptCard v-if="view.answered_at" />

          <template v-if="editing && form">
            <CarrierReplyFields :form="form" :errors="errors" />
            <CarrierConfirmSend :form="form" :total="formatMoney(shownTotal, view.currency)" :sending="sending" :message="sendMessage" @send="send" />
          </template>

          <v-card v-else-if="hasReply" variant="outlined" data-testid="carrier-reply">
            <v-card-title class="carrier-offer__card-title">{{ t("cargo.carrierOffer.reply_title") }}</v-card-title>
            <v-card-text>
              <dl class="carrier-offer__reply">
                <template v-if="view.reply.note"><dt>{{ t("cargo.carrierOffer.reply_note") }}</dt><dd>{{ view.reply.note }}</dd></template>
                <template v-if="view.reply.schedule"><dt>{{ t("cargo.carrierOffer.reply_schedule") }}</dt><dd>{{ view.reply.schedule }}</dd></template>
                <template v-if="view.reply.reference"><dt>{{ t("cargo.carrierOffer.reply_reference") }}</dt><dd>{{ view.reply.reference }}</dd></template>
              </dl>
            </v-card-text>
          </v-card>
        </div>
      </template>
    </v-container>
  </div>
</template>

<script setup lang="ts">
/**
 * Pantalla donde una aerolínea ve y RESPONDE a la solicitud de cotización que le llegó por correo (legado: vttoff.php y
 * vttoff_exe.php).
 *
 * No hay usuario ni login: la sesión la abrió el OTP del enlace (`bootstrapOtp`, en main.ts) y las peticiones las firma el BFF con
 * el Bearer de la aplicación. Mientras la oferta no esté revisada la aerolínea escribe sus importes, el peso tasable, notas,
 * horario y referencia, confirma y envía; el total que ve mientras teclea es orientativo, el que se guarda lo calcula el servidor.
 * Los textos van en inglés, como el correo: la aerolínea no tiene idioma asociado.
 */
import { computed, onBeforeUnmount, onMounted, reactive, ref } from "vue";
import { useI18n } from "vue-i18n";
import { ApiError, getOtpBootstrap, onOtpSessionLost } from "@tmwe/shared-frontend/http";
import { carrierOfferService, type CarrierOfferView } from "@cargo/services/carrier_offer.service";
import { bannerFor, failureKeys, formatMoney, plainNote, shortDate } from "@cargo/composables/carrierOffer";
import { buildPayload, formFromView, liveTotal, mapServerFields, validateForm, type QuoteForm } from "@cargo/composables/carrierOfferForm";
import CarrierFreightDetails from "@cargo/components/carrier-offer/CarrierFreightDetails.vue";
import CarrierChargesTable from "@cargo/components/carrier-offer/CarrierChargesTable.vue";
import CarrierReplyFields from "@cargo/components/carrier-offer/CarrierReplyFields.vue";
import CarrierConfirmSend from "@cargo/components/carrier-offer/CarrierConfirmSend.vue";
import CarrierFilesCard from "@cargo/components/carrier-offer/CarrierFilesCard.vue";
import CarrierReceiptCard from "@cargo/components/carrier-offer/CarrierReceiptCard.vue";

type Phase = "loading" | "ready" | "error";
type Reason = Parameters<typeof failureKeys>[0];

const { t, locale } = useI18n();
const phase = ref<Phase>("loading");
const view = ref<CarrierOfferView | null>(null);
const failureReason = ref<Reason>("invalid");
const sessionLost = ref(false);

const form = ref<QuoteForm | null>(null);
const errors = reactive<Record<string, string>>({});
const sending = ref(false);
const sendMessage = ref("");
const thanks = ref<{ total: string } | null>(null);
const editingAgain = ref(false);

const bootstrap = getOtpBootstrap();
const offerId = computed(() => view.value?.id ?? (bootstrap && bootstrap.ok ? bootstrap.resource.id : ""));
const failure = computed(() => (phase.value === "error" ? failureKeys(failureReason.value) : null));
const banner = computed(() => (view.value ? bannerFor(view.value) : null));
const note = computed(() => plainNote(view.value?.request_note));
const requestedOn = computed(() => shortDate(view.value?.requested_at));
const answeredOn = computed(() => shortDate(view.value?.answered_at));
const hasReply = computed(() => !!view.value && (view.value.reply.note || view.value.reply.schedule || view.value.reply.reference));
/** ¿Puede responder? Mientras la oferta no esté revisada, y no mientras se muestra el agradecimiento. */
const canAnswer = computed(() => !!view.value && view.value.scopes.includes("answer"));
const editing = computed(() => canAnswer.value && !!form.value && (!thanks.value || editingAgain.value));
const shownTotal = computed(() => (editing.value && view.value && form.value ? liveTotal(view.value, form.value) : (view.value?.total ?? 0)));

function fail(reason: Reason): void {
  failureReason.value = reason;
  phase.value = "error";
}

function clearErrors(): void {
  for (const k of Object.keys(errors)) delete errors[k];
  sendMessage.value = "";
}

function apply(next: CarrierOfferView): void {
  view.value = next;
  form.value = formFromView(next);
}

async function fetchView(): Promise<CarrierOfferView | null> {
  const res = await carrierOfferService.get();
  return res.success && res.found && res.data ? res.data : null;
}

async function load(): Promise<void> {
  phase.value = "loading";
  if (!bootstrap) return fail("unavailable");
  if (!bootstrap.ok) return fail(bootstrap.reason);
  try {
    const data = await fetchView();
    if (!data) return fail("not_found");
    apply(data);
    phase.value = "ready";
  } catch {
    // Un 401 ya lo avisó onOtpSessionLost; el resto (red, 5xx) se puede reintentar.
    if (!sessionLost.value) fail("unavailable");
  }
}

/** Recarga la solicitud sin tocar lo que la aerolínea está escribiendo (p. ej. tras subir un fichero). */
async function refreshView(): Promise<void> {
  const fresh = await fetchView().catch(() => null);
  if (fresh && view.value) view.value = { ...view.value, own_files: fresh.own_files, upload: fresh.upload };
}

function reload(): void {
  // Sin un OTP válido en la sesión no hay nada que reintentar salvo recargar la página con el enlace.
  window.location.reload();
}

function editAgain(): void {
  editingAgain.value = true;
  thanks.value = null;
  clearErrors();
  window.scrollTo?.({ top: 0 });
}

function errorText(e: unknown): { fields: Record<string, string>; message: string } {
  if (e instanceof ApiError) {
    const body = e.payload as { error?: { code?: string; details?: { fields?: Record<string, string> } } } | undefined;
    const code = e.errorCode ?? body?.error?.code;
    if (code === "VALIDATION_ERROR") return { fields: mapServerFields(body?.error?.details?.fields), message: t("cargo.carrierOffer.err_validation") };
    if (code === "CONFIRMATION_REQUIRED") return { fields: { confirm: "validation_confirm" }, message: t("cargo.carrierOffer.validation_confirm") };
    if (code === "OFFER_LOCKED" || e.status === 409) return { fields: {}, message: t("cargo.carrierOffer.err_locked") };
    if (e.status === 429) return { fields: {}, message: t("cargo.carrierOffer.err_rate") };
  }
  return { fields: {}, message: t("cargo.carrierOffer.err_generic") };
}

async function send(): Promise<void> {
  if (!form.value || !view.value || sending.value) return;
  clearErrors();
  const local = validateForm(form.value);
  if (Object.keys(local).length) {
    Object.assign(errors, local);
    sendMessage.value = t(local.confirm && Object.keys(local).length === 1 ? "cargo.carrierOffer.validation_confirm" : "cargo.carrierOffer.err_validation");
    return;
  }
  sending.value = true;
  try {
    const res = await carrierOfferService.submit(buildPayload(form.value));
    if (!res.success) throw new Error("not ok");
    // El total que cuenta es el del servidor; se recarga la solicitud para mostrar lo guardado.
    const fresh = await fetchView().catch(() => null);
    if (fresh) apply(fresh);
    thanks.value = { total: formatMoney(res.total ?? shownTotal.value, res.currency ?? view.value.currency) };
    editingAgain.value = false;
    window.scrollTo?.({ top: 0 });
  } catch (e) {
    if (sessionLost.value) return;
    const mapped = errorText(e);
    Object.assign(errors, mapped.fields);
    sendMessage.value = mapped.message;
    if (e instanceof ApiError && (e.errorCode === "OFFER_LOCKED" || e.status === 409)) {
      // Mientras tanto el operador la revisó: se recarga para mostrarla cerrada.
      const fresh = await fetchView().catch(() => null);
      if (fresh) apply(fresh);
    }
  } finally {
    sending.value = false;
  }
}

onMounted(() => {
  // La aerolínea no tiene idioma asociado: el correo va en inglés y la pantalla también.
  locale.value = "en";
  onOtpSessionLost(() => {
    sessionLost.value = true;
    fail("session_lost");
  });
  void load();
});
onBeforeUnmount(() => onOtpSessionLost(null));
</script>

<style scoped lang="scss">
.carrier-offer { min-height: 100%; padding: 24px 0 64px; }
.carrier-offer__container { max-width: 980px; }
.carrier-offer__head { margin-bottom: 20px; }
.carrier-offer__title { font-size: 1.6rem; font-weight: 700; line-height: 1.2; margin: 0; }
.carrier-offer__sub { margin: 6px 0 0; opacity: 0.7; }
.carrier-offer__stack { display: flex; flex-direction: column; gap: 16px; }
.carrier-offer__card-title { font-size: 1rem; font-weight: 600; }
.carrier-offer__alert-title { font-weight: 600; margin-bottom: 2px; }
.carrier-offer__note { white-space: pre-line; }
.carrier-offer__reply { display: grid; grid-template-columns: max-content 1fr; gap: 6px 16px; margin: 0; }
.carrier-offer__reply dt { opacity: 0.7; }
.carrier-offer__reply dd { margin: 0; white-space: pre-line; }
</style>
