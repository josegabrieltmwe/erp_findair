<template>
  <div class="courier-offer" data-testid="courier-offer">
    <v-container class="courier-offer__container">
      <header class="courier-offer__head">
        <h1 class="courier-offer__title" data-testid="courier-title">{{ t("shipment.courierOffer.title", { id: requestNo }) }}</h1>
        <p v-if="view" class="courier-offer__sub">
          {{ view.recipient }}<template v-if="requestedOn"> · {{ t("shipment.courierOffer.requested_on", { date: requestedOn }) }}</template>
        </p>
      </header>

      <v-progress-linear v-if="phase === 'loading'" indeterminate color="primary" class="mb-4" data-testid="courier-loading" />

      <v-alert v-else-if="phase === 'error' && failure" type="warning" variant="tonal" class="mb-4" data-testid="courier-error" :data-reason="failureReason">
        <div class="courier-offer__alert-title">{{ t(`cargo.carrierOffer.${failure.title}`) }}</div>
        <div>{{ t(`cargo.carrierOffer.${failure.message}`) }}</div>
        <v-btn v-if="failure.retry" class="mt-3" variant="outlined" size="small" data-testid="courier-retry" @click="reload">
          {{ t("cargo.carrierOffer.retry") }}
        </v-btn>
      </v-alert>

      <template v-else-if="view">
        <v-alert v-if="thanks" type="success" variant="tonal" class="mb-4" data-testid="courier-thanks">
          <div class="courier-offer__alert-title">{{ t("shipment.courierOffer.thanks_title") }}</div>
          <div>{{ t("shipment.courierOffer.thanks_body") }}</div>
          <div class="mt-2">{{ t("shipment.courierOffer.thanks_total", { total: thanks.total }) }}</div>
        </v-alert>
        <v-alert v-else-if="banner" :type="banner.kind" variant="tonal" class="mb-4" data-testid="courier-banner">
          {{ t(`shipment.courierOffer.${banner.key}`, { date: answeredOn }) }}
        </v-alert>

        <v-card v-if="note" variant="outlined" class="mb-4" data-testid="courier-note">
          <v-card-title class="courier-offer__card-title">{{ t("shipment.courierOffer.note_title") }}</v-card-title>
          <v-card-text class="courier-offer__note">{{ note }}</v-card-text>
        </v-card>

        <div class="courier-offer__stack">
          <v-card variant="outlined" data-testid="courier-shipment">
            <v-card-title class="courier-offer__card-title">{{ t("shipment.courierOffer.shipment_title") }}</v-card-title>
            <v-card-text>
              <dl class="courier-offer__facts">
                <dt>{{ t("shipment.courierOffer.origin") }}</dt><dd>{{ view.shipment.origin || "—" }}</dd>
                <dt>{{ t("shipment.courierOffer.destination") }}</dt><dd>{{ view.shipment.destination || "—" }}</dd>
                <dt>{{ t("shipment.courierOffer.weight") }}</dt><dd>{{ kg(view.shipment.weight) }}</dd>
                <dt v-if="view.shipment.weight_taxed">{{ t("shipment.courierOffer.weight_taxed") }}</dt><dd v-if="view.shipment.weight_taxed">{{ kg(view.shipment.weight_taxed) }}</dd>
                <dt>{{ t("shipment.courierOffer.parcels") }}</dt><dd>{{ view.shipment.colli ?? "—" }}</dd>
                <dt v-if="view.shipment.volume_m3">{{ t("shipment.courierOffer.volume") }}</dt><dd v-if="view.shipment.volume_m3">{{ view.shipment.volume_m3 }} m³</dd>
                <dt>{{ t("shipment.courierOffer.contents") }}</dt><dd>{{ view.shipment.contents || "—" }}</dd>
                <dt v-if="view.shipment.supplements.length">{{ t("shipment.courierOffer.supplements") }}</dt>
                <dd v-if="view.shipment.supplements.length">{{ view.shipment.supplements.map((s) => s.name).join(", ") }}</dd>
                <dt v-if="view.shipment.cod">{{ t("shipment.courierOffer.cod") }}</dt>
                <dd v-if="view.shipment.cod">{{ view.shipment.cod.amount }} {{ view.shipment.cod.currency }}</dd>
              </dl>

              <v-alert v-if="view.shipment.is_dgr" type="warning" variant="tonal" density="compact" class="mt-3" data-testid="courier-dgr">
                <strong>{{ t("shipment.courierOffer.dgr_title") }}</strong>
                <ul v-if="view.shipment.dgr.length" class="courier-offer__dgr">
                  <li v-for="(d, i) in view.shipment.dgr" :key="i">UN {{ d.un_number }} · {{ t("shipment.courierOffer.dgr_class") }} {{ d.hazard_class }} · {{ t("shipment.courierOffer.dgr_group") }} {{ d.packing_group }}</li>
                </ul>
              </v-alert>

              <table v-if="view.shipment.packages.length" class="courier-offer__parcels" data-testid="courier-parcels">
                <thead><tr><th>#</th><th>{{ t("shipment.courierOffer.dimensions") }}</th><th>{{ t("shipment.courierOffer.weight") }}</th></tr></thead>
                <tbody>
                  <tr v-for="p in view.shipment.packages" :key="p.n">
                    <td>{{ p.n }}</td><td>{{ p.lung }} × {{ p.larg }} × {{ p.alt }} cm</td><td>{{ kg(p.peso) }}</td>
                  </tr>
                </tbody>
              </table>
            </v-card-text>
          </v-card>

          <v-card v-if="editing && form" variant="outlined" data-testid="courier-form">
            <v-card-title class="courier-offer__card-title">{{ t("shipment.courierOffer.reply_title") }}</v-card-title>
            <v-card-text>
              <div class="courier-offer__row">
                <v-text-field v-model="form.costo" :label="t('shipment.courierOffer.price')" inputmode="decimal" variant="outlined" density="comfortable"
                  :error-messages="fieldError('costo')" data-testid="courier-price" />
                <v-select v-model="form.currency" :items="currencies" :label="t('shipment.courierOffer.currency')" variant="outlined" density="comfortable"
                  :error-messages="fieldError('currency')" data-testid="courier-currency" />
              </div>
              <v-textarea v-model="form.schedule" :label="t('shipment.courierOffer.schedule')" rows="2" auto-grow variant="outlined" density="comfortable"
                :error-messages="fieldError('schedule')" data-testid="courier-schedule" />
              <v-textarea v-model="form.note" :label="t('shipment.courierOffer.notes')" rows="3" auto-grow variant="outlined" density="comfortable"
                :error-messages="fieldError('note')" data-testid="courier-notes" />
              <v-checkbox v-model="form.confirmPrice" :label="t('shipment.courierOffer.confirm_price', { total: shownPrice })" hide-details density="comfortable" data-testid="courier-confirm-price" />
              <v-checkbox v-model="form.confirmTerms" :label="t('shipment.courierOffer.confirm_terms')" hide-details density="comfortable" data-testid="courier-confirm-terms" />
              <v-alert v-if="sendMessage" type="error" variant="tonal" density="compact" class="mt-2" data-testid="courier-send-error">{{ sendMessage }}</v-alert>
              <div class="courier-offer__actions">
                <v-btn color="primary" size="large" :loading="sending" :disabled="sending" data-testid="courier-send" @click="send">
                  {{ t("shipment.courierOffer.send") }}
                </v-btn>
              </div>
            </v-card-text>
          </v-card>

          <v-card v-else-if="hasReply" variant="outlined" data-testid="courier-reply">
            <v-card-title class="courier-offer__card-title">{{ t("shipment.courierOffer.your_reply") }}</v-card-title>
            <v-card-text>
              <dl class="courier-offer__facts">
                <dt>{{ t("shipment.courierOffer.price") }}</dt><dd>{{ savedPrice }}</dd>
                <template v-if="view.txt_schedule"><dt>{{ t("shipment.courierOffer.schedule") }}</dt><dd>{{ view.txt_schedule }}</dd></template>
                <template v-if="view.txt_risposta"><dt>{{ t("shipment.courierOffer.notes") }}</dt><dd>{{ view.txt_risposta }}</dd></template>
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
 * Pantalla donde un courier o una anagrafica de tipo partner ve y RESPONDE a la solicitud de cotización de una expedición
 * courier que le llegó por correo (sustituye a la página del ERP legado `express_offer`).
 *
 * No hay usuario ni login: la sesión la abrió el OTP del enlace (`bootstrapOtp`, en main.ts) y las peticiones las firma el BFF
 * con el Bearer de la aplicación. Se responde UNA vez (precio, divisa, plazo y notas, con doble confirmación); el servidor
 * valida de nuevo. Nunca se muestra el cliente final ni el precio de venta. Los textos van en inglés, como el correo.
 */
import { computed, onBeforeUnmount, onMounted, reactive, ref } from "vue";
import { useI18n } from "vue-i18n";
import { ApiError, getOtpBootstrap, onOtpSessionLost } from "@tmwe/shared-frontend/http";
import { courierOfferService, type CourierOfferView } from "@shipment/services/courier_offer.service";
import { failureKeys, formatMoney, plainNote, shortDate } from "@cargo/composables/carrierOffer";
import { buildPayload, CURRENCIES, formFromView, mapServerFields, parseAmount, validateForm, type CourierQuoteForm } from "@shipment/composables/courierOfferForm";

type Phase = "loading" | "ready" | "error";
type Reason = Parameters<typeof failureKeys>[0];

const { t, locale } = useI18n();
const phase = ref<Phase>("loading");
const view = ref<CourierOfferView | null>(null);
const failureReason = ref<Reason>("invalid");
const sessionLost = ref(false);
const form = ref<CourierQuoteForm | null>(null);
const errors = reactive<Record<string, string>>({});
const sending = ref(false);
const sendMessage = ref("");
const thanks = ref<{ total: string } | null>(null);
const currencies = [...CURRENCIES];

const bootstrap = getOtpBootstrap();
const requestNo = computed(() => view.value?.id_spedizione ?? (bootstrap && bootstrap.ok ? bootstrap.resource.id : ""));
const failure = computed(() => (phase.value === "error" ? failureKeys(failureReason.value) : null));
const note = computed(() => plainNote(view.value?.txt_richiesta));
const requestedOn = computed(() => shortDate(view.value?.data_rich));
const answeredOn = computed(() => shortDate(view.value?.data_risp));
const canAnswer = computed(() => !!view.value && view.value.scopes.includes("answer"));
const editing = computed(() => canAnswer.value && !!form.value && !thanks.value);
const hasReply = computed(() => !!view.value && view.value.state !== "open");
const banner = computed(() => {
  if (!view.value || thanks.value) return null;
  if (view.value.state === "locked") return { kind: "warning" as const, key: "banner_locked" };
  if (view.value.state === "answered") return { kind: "info" as const, key: "banner_answered" };
  return null;
});
const shownPrice = computed(() => {
  const n = form.value ? parseAmount(form.value.costo) : null;
  return n === null || !form.value ? "—" : formatMoney(n, form.value.currency);
});
const savedPrice = computed(() => (view.value ? formatMoney(Number(view.value.costo ?? 0), view.value.change_valuta || "EUR") : ""));

function kg(n: string | number | null): string {
  return n === null || n === undefined || n === "" ? "—" : `${Number(n).toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kg`;
}
function fieldError(field: string): string[] {
  return errors[field] ? [t(`shipment.courierOffer.${errors[field]}`)] : [];
}
function fail(reason: Reason): void {
  failureReason.value = reason;
  phase.value = "error";
}
function clearErrors(): void {
  for (const k of Object.keys(errors)) delete errors[k];
  sendMessage.value = "";
}
function apply(next: CourierOfferView): void {
  view.value = next;
  form.value = formFromView(next);
}
async function fetchView(): Promise<CourierOfferView | null> {
  const res = await courierOfferService.get();
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
    if (!sessionLost.value) fail("unavailable");
  }
}
function reload(): void {
  window.location.reload();
}

function errorText(e: unknown): { fields: Record<string, string>; message: string } {
  if (e instanceof ApiError) {
    const body = e.payload as { error?: { code?: string; details?: { fields?: Record<string, string> } } } | undefined;
    const code = e.errorCode ?? body?.error?.code;
    if (code === "VALIDATION_ERROR") return { fields: mapServerFields(body?.error?.details?.fields), message: t("shipment.courierOffer.err_validation") };
    if (code === "CONFIRMATION_REQUIRED") return { fields: { confirm: "validation_confirm" }, message: t("shipment.courierOffer.validation_confirm") };
    if (code === "OFFER_LOCKED" || e.status === 409) return { fields: {}, message: t("shipment.courierOffer.err_locked") };
    if (e.status === 429) return { fields: {}, message: t("shipment.courierOffer.err_rate") };
  }
  return { fields: {}, message: t("shipment.courierOffer.err_generic") };
}

async function send(): Promise<void> {
  if (!form.value || !view.value || sending.value) return;
  clearErrors();
  const local = validateForm(form.value);
  if (Object.keys(local).length) {
    Object.assign(errors, local);
    sendMessage.value = t(local.confirm && Object.keys(local).length === 1 ? "shipment.courierOffer.validation_confirm" : "shipment.courierOffer.err_validation");
    return;
  }
  sending.value = true;
  try {
    const res = await courierOfferService.submit(buildPayload(form.value));
    if (!res.success) throw new Error("not ok");
    const total = formatMoney(res.total ?? parseAmount(form.value.costo) ?? 0, res.currency ?? form.value.currency);
    // Se recarga lo guardado: la solicitud queda respondida y ya no se puede cambiar.
    const fresh = await fetchView().catch(() => null);
    if (fresh) apply(fresh);
    thanks.value = { total };
    window.scrollTo?.({ top: 0 });
  } catch (e) {
    if (sessionLost.value) return;
    const mapped = errorText(e);
    Object.assign(errors, mapped.fields);
    sendMessage.value = mapped.message;
    if (e instanceof ApiError && (e.errorCode === "OFFER_LOCKED" || e.status === 409)) {
      const fresh = await fetchView().catch(() => null);
      if (fresh) apply(fresh);
    }
  } finally {
    sending.value = false;
  }
}

onMounted(() => {
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
.courier-offer { min-height: 100%; padding: 24px 0 64px; }
.courier-offer__container { max-width: 880px; }
.courier-offer__head { margin-bottom: 20px; }
.courier-offer__title { font-size: 1.6rem; font-weight: 700; line-height: 1.2; margin: 0; }
.courier-offer__sub { margin: 6px 0 0; opacity: 0.7; }
.courier-offer__stack { display: flex; flex-direction: column; gap: 16px; }
.courier-offer__card-title { font-size: 1rem; font-weight: 600; }
.courier-offer__alert-title { font-weight: 600; margin-bottom: 2px; }
.courier-offer__note { white-space: pre-line; }
.courier-offer__facts { display: grid; grid-template-columns: max-content 1fr; gap: 6px 16px; margin: 0; }
.courier-offer__facts dt { opacity: 0.7; }
.courier-offer__facts dd { margin: 0; white-space: pre-line; }
.courier-offer__dgr { margin: 6px 0 0; padding-left: 18px; }
.courier-offer__parcels { margin-top: 16px; border-collapse: collapse; width: 100%; font-size: 0.9rem; }
.courier-offer__parcels th, .courier-offer__parcels td { text-align: left; padding: 4px 12px 4px 0; border-bottom: 1px solid rgba(128, 128, 128, 0.2); }
.courier-offer__row { display: grid; grid-template-columns: 2fr 1fr; gap: 12px; }
.courier-offer__actions { display: flex; justify-content: flex-end; margin-top: 12px; }
</style>
