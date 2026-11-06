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
        <v-alert v-if="banner" :type="banner.kind" variant="tonal" class="mb-4" data-testid="carrier-banner">
          {{ t(`cargo.carrierOffer.${banner.key}`, { date: answeredOn }) }}
        </v-alert>

        <v-card v-if="note" variant="outlined" class="mb-4" data-testid="carrier-note">
          <v-card-title class="carrier-offer__card-title">{{ t("cargo.carrierOffer.note_title") }}</v-card-title>
          <v-card-text class="carrier-offer__note">{{ note }}</v-card-text>
        </v-card>

        <div class="carrier-offer__stack">
          <CarrierFreightDetails :freight="view.freight" :parcels="view.parcels" />
          <CarrierChargesTable :charges="view.charges" :currency="view.currency" :total="view.total" :chargeable-weight="view.chargeable_weight" />

          <v-card v-if="hasReply" variant="outlined" data-testid="carrier-reply">
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
 * Pantalla donde una aerolínea ve la solicitud de cotización que le llegó por correo (legado: vttoff.php).
 *
 * No hay usuario ni login: la sesión la abrió el OTP del enlace (`bootstrapOtp`, en main.ts) y las peticiones las firma el
 * BFF con el Bearer de la aplicación. La página es de lectura; la respuesta de la aerolínea llega en la fase siguiente.
 * Los textos van en inglés, como el correo: la aerolínea no tiene idioma asociado.
 */
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { getOtpBootstrap, onOtpSessionLost } from "@tmwe/shared-frontend/http";
import { carrierOfferService, type CarrierOfferView } from "@cargo/services/carrier_offer.service";
import { bannerFor, failureKeys, plainNote, shortDate } from "@cargo/composables/carrierOffer";
import CarrierFreightDetails from "@cargo/components/carrier-offer/CarrierFreightDetails.vue";
import CarrierChargesTable from "@cargo/components/carrier-offer/CarrierChargesTable.vue";

type Phase = "loading" | "ready" | "error";
type Reason = Parameters<typeof failureKeys>[0];

const { t, locale } = useI18n();
const phase = ref<Phase>("loading");
const view = ref<CarrierOfferView | null>(null);
const failureReason = ref<Reason>("invalid");
const sessionLost = ref(false);

const bootstrap = getOtpBootstrap();
const offerId = computed(() => view.value?.id ?? (bootstrap && bootstrap.ok ? bootstrap.resource.id : ""));
const failure = computed(() => (phase.value === "error" ? failureKeys(failureReason.value) : null));
const banner = computed(() => (view.value ? bannerFor(view.value) : null));
const note = computed(() => plainNote(view.value?.request_note));
const requestedOn = computed(() => shortDate(view.value?.requested_at));
const answeredOn = computed(() => shortDate(view.value?.answered_at));
const hasReply = computed(() => !!view.value && (view.value.reply.note || view.value.reply.schedule || view.value.reply.reference));

function fail(reason: Reason): void {
  failureReason.value = reason;
  phase.value = "error";
}

async function load(): Promise<void> {
  phase.value = "loading";
  if (!bootstrap) return fail("unavailable");
  if (!bootstrap.ok) return fail(bootstrap.reason);
  try {
    const res = await carrierOfferService.get();
    if (!res.success || !res.found || !res.data) return fail("not_found");
    view.value = res.data;
    phase.value = "ready";
  } catch {
    // Un 401 ya lo avisó onOtpSessionLost; el resto (red, 5xx) se puede reintentar.
    if (!sessionLost.value) fail("unavailable");
  }
}

function reload(): void {
  // Sin un OTP válido en la sesión no hay nada que reintentar salvo recargar la página con el enlace.
  window.location.reload();
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
