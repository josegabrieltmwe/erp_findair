<template>
  <AppDialog
    :open="modelValue"
    :title="t('cargo.bookingconfirm.title')"
    icon="mdi-shield-airplane"
    size="sm"
    persistent
    @close="close"
  >
    <p class="mb-3">
      {{ t("cargo.bookingconfirm.intro") }}
    </p>
    <div v-if="rate" class="mb-3">
      <div class="text-caption text-medium-emphasis">
        {{ t("cargo.servizio.carrier") }}
      </div>
      <div class="font-weight-medium">
        {{ rate.airline_code }}
        <span
          v-if="rate.airline_name && rate.airline_name !== rate.airline_code"
        >
          ({{ rate.airline_name }})
        </span>
      </div>
      <div v-if="rate.route" class="text-body-2 text-medium-emphasis">
        {{ rate.route.origin }} → {{ rate.route.destination }}
      </div>
      <div v-if="rate.client_price" class="font-weight-bold mt-1">
        {{ rate.currency ?? "EUR" }}
        {{ Number(rate.client_price).toFixed(2) }}
      </div>
    </div>

    <!-- De donde sale el AWB. `carrier` es el defecto: la aerolinea sabe
         emitirlo, y no gastar numeracion propia cuando no hace falta es lo que
         evita que el stock caduque sin usarse. Pool y manual son a peticion. -->
    <div class="text-caption text-medium-emphasis mb-1">
      {{ t("cargo.bookingconfirm.awb_mode") }}
    </div>
    <v-radio-group
      v-model="awbMode"
      density="compact"
      hide-details
      :disabled="busy"
      class="mb-2"
    >
      <v-radio value="carrier" :label="t('cargo.bookingconfirm.awb_carrier')" />
      <v-radio
        value="pool"
        :label="t('cargo.bookingconfirm.awb_pool')"
        :disabled="busy || !hasStock"
      />
      <v-radio value="manual" :label="t('cargo.bookingconfirm.awb_manual_mode')" />
    </v-radio-group>

    <!-- POOL: se elige un numero concreto del stock. Se ordena por caducidad,
         asi que el primero es el que conviene gastar (FEFO). -->
    <template v-if="awbMode === 'pool'">
      <v-select
        v-model="awbFromPool"
        :items="stockItems"
        item-title="label"
        item-value="awb"
        :label="t('cargo.bookingconfirm.awb_from_stock')"
        variant="outlined"
        density="comfortable"
        hide-details
        :disabled="busy || vettori.loadingAwbs"
        :loading="vettori.loadingAwbs"
      />
      <!-- De QUE partner sale el numero. Con la tarifa cotizada por la cuenta
           de otro partner, el AWB sale de ESE partner y no del cliente de la
           expedicion: verlo evita descubrirlo cuando ya esta emitido. -->
      <div v-if="stockOwner" class="text-caption text-medium-emphasis mt-1">
        {{ t("cargo.bookingconfirm.awb_pool_owner", { owner: stockOwner }) }}
      </div>
    </template>

    <!-- Pool vacio: decirlo y ofrecer la salida, en vez de dejar la opcion
         desactivada sin explicacion. -->
    <v-alert
      v-if="awbMode !== 'manual' && !hasStock && !vettori.loadingAwbs"
      type="info"
      density="compact"
      variant="tonal"
      class="mb-2"
    >
      {{ t("cargo.bookingconfirm.awb_no_stock") }}
    </v-alert>

    <v-text-field
      v-if="awbMode === 'manual'"
      v-model="awbManual"
      :label="t('cargo.bookingconfirm.awb_manual')"
      :placeholder="t('cargo.bookingconfirm.awb_placeholder')"
      variant="outlined"
      density="comfortable"
      :hint="t('cargo.bookingconfirm.awb_manual_hint')"
      persistent-hint
      :disabled="busy"
    />

    <v-alert
      v-if="rate?.bookable === false"
      type="warning"
      density="compact"
      variant="tonal"
      class="mt-3"
    >
      {{ t("cargo.bookingconfirm.not_bookable") }}
      <strong>{{
        rate.not_bookable_reason ?? t("cargo.bookingconfirm.reason_unspecified")
      }}</strong
      >.
      {{ t("cargo.bookingconfirm.manual_portal") }}
    </v-alert>
    <template #actions>
      <v-spacer />
      <v-btn variant="text" :disabled="busy" @click="close">{{
        t("common.cancel")
      }}</v-btn>
      <v-btn
        color="primary"
        variant="flat"
        prepend-icon="mdi-shield-check"
        :loading="busy"
        :disabled="busy || rate?.bookable === false"
        @click="confirm"
      >
        {{ t("cargo.bookingconfirm.confirm") }}
      </v-btn>
    </template>
  </AppDialog>
</template>

<script setup lang="ts">
import { useI18n } from "vue-i18n";
import { computed, ref, watch } from "vue";
import AppDialog from "@shared/ui/AppDialog.vue";
import type { WebcargoRate } from "@cargo/services/webcargo_rate.service";
import { useVettoriStore } from "@cargo/stores/vettori.store";

const { t, locale } = useI18n();
const props = defineProps<{
  modelValue: boolean;
  rate: WebcargoRate | null;
  busy: boolean;
  /** Expedición, para consultar el stock de AWB de su vettore. */
  cargoId?: number | null;
}>();

const emit = defineEmits<{
  (e: "update:modelValue", v: boolean): void;
  (
    e: "confirm",
    payload: { awbManual?: string; awbMode?: "carrier" | "pool" | "manual" },
  ): void;
}>();

const vettori = useVettoriStore();

type AwbMode = "carrier" | "pool" | "manual";

/** `carrier` por defecto: que lo emita la aerolínea salvo petición expresa. */
const awbMode = ref<AwbMode>("carrier");
const awbManual = ref("");
const awbFromPool = ref<string>("");

const hasStock = computed(() => vettori.awbStock.length > 0);

/**
 * Stock para el desplegable, con la caducidad visible.
 *
 * El backend ya lo entrega ordenado por vencimiento, así que el primero es el
 * que conviene gastar; se muestra la fecha para que la elección sea informada
 * y no un número opaco.
 */
const stockItems = computed(() =>
  vettori.awbStock.map((a) => ({
    awb: a.awb,
    label: a.expires_at
      ? `${a.awb} — ${new Date(a.expires_at).toLocaleDateString(locale.value)}`
      : a.awb,
  })),
);

/** Partner titular del stock, para que un cross-partner sea visible. */
const stockOwner = computed<string>(() => {
  const p = vettori.awbStockPartnerId;
  return p ? String(p) : "";
});

watch(
  () => props.modelValue,
  (open) => {
    if (!open) return;
    awbMode.value = "carrier";
    awbManual.value = "";
    awbFromPool.value = "";
    // El stock es compartido entre operadores: se relee en cada apertura en
    // vez de fiarse de lo que quedó de la última vez.
    if (props.cargoId) {
      void vettori.fetchAwbStock(Number(props.cargoId));
    }
  },
);

/** Preselecciona el primero (el más próximo a vencer) al entrar en modo pool. */
watch(awbMode, (mode) => {
  if (mode === "pool" && !awbFromPool.value && stockItems.value.length) {
    awbFromPool.value = stockItems.value[0].awb;
  }
});

function close(): void {
  emit("update:modelValue", false);
}

function confirm(): void {
  // El AWB viaja en `awbManual` en los dos modos que llevan número: el backend
  // distingue por `awbMode`, y en modo pool valida además que el número siga
  // libre y lo reserva.
  const awb =
    awbMode.value === "manual"
      ? awbManual.value.trim()
      : awbMode.value === "pool"
        ? awbFromPool.value.trim()
        : "";

  emit("confirm", {
    awbMode: awbMode.value,
    ...(awb ? { awbManual: awb } : {}),
  });
}
</script>
