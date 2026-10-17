<template>
  <ModalWrapper
    name="booking_detail"
    :title="t('cargo.modal.booking_detail')"
    icon="mdi-airplane-check"
    :max-width="720"
  >
    <div v-if="loading" class="text-center py-4">
      <v-progress-circular indeterminate color="primary" />
    </div>

    <template v-else-if="booking">
      <!-- Header summary -->
      <v-row dense class="mb-3">
        <v-col cols="12" sm="6">
          <div class="text-caption text-medium-emphasis">
            {{ t("cargo.bookingdetail.booking_id") }}
          </div>
          <div class="text-body-2 font-weight-medium metric-mono">
            {{ booking.booking_id }}
          </div>
        </v-col>
        <v-col cols="12" sm="6">
          <div class="text-caption text-medium-emphasis">
            {{ t("cargo.col.status") }}
          </div>
          <v-chip
            :color="statusColor"
            size="small"
            variant="flat"
            class="font-weight-bold"
          >
            {{ String(booking.status ?? "").toUpperCase() }}
          </v-chip>
          <span
            v-if="detail?.status_reason"
            class="text-caption text-medium-emphasis ms-2"
          >
            {{ detail.status_reason }}
          </span>
        </v-col>
        <v-col v-if="booking.awb_number" cols="12" sm="6">
          <div class="text-caption text-medium-emphasis">AWB</div>
          <div class="text-body-2 metric-mono">{{ booking.awb_number }}</div>
        </v-col>
        <v-col v-if="detail?.airline_code" cols="12" sm="6">
          <div class="text-caption text-medium-emphasis">
            {{ t("cargo.col.carrier") }}
          </div>
          <div class="text-body-2">{{ detail.airline_code }}</div>
        </v-col>
        <v-col v-if="detail?.credential_account" cols="12" sm="6">
          <div class="text-caption text-medium-emphasis">
            {{ t("cargo.bookingdetail.credential_account") }}
          </div>
          <div class="text-body-2">
            <template v-if="detail.credential_account.is_house">
              {{ t("cargo.bookingdetail.credential_house") }}
            </template>
            <template v-else-if="detail.credential_account.resolved">
              {{
                detail.credential_account.partner_name ||
                detail.credential_account.label ||
                "—"
              }}
              <v-chip
                v-if="
                  detail.credential_account.relationship ===
                  'represented_partner'
                "
                size="x-small"
                variant="tonal"
                color="info"
                class="ms-1"
              >
                {{ t("cargo.bookingdetail.credential_represented") }}
              </v-chip>
              <v-chip
                v-if="!detail.credential_account.active"
                size="x-small"
                variant="tonal"
                color="warning"
                class="ms-1"
              >
                {{ t("cargo.bookingdetail.credential_inactive") }}
              </v-chip>
            </template>
            <template v-else>
              <span class="text-medium-emphasis">
                {{ detail.credential_account.label || "—" }}
              </span>
              <v-chip size="x-small" variant="tonal" color="default" class="ms-1">
                {{ t("cargo.bookingdetail.credential_unverified") }}
              </v-chip>
            </template>
          </div>
        </v-col>
        <v-col v-if="detail?.short_id" cols="12" sm="6">
          <div class="text-caption text-medium-emphasis">
            {{ t("cargo.bookingdetail.short_id") }}
          </div>
          <div class="text-body-2 metric-mono">{{ detail.short_id }}</div>
        </v-col>
        <v-col v-if="booking.created_at" cols="12" sm="6">
          <div class="text-caption text-medium-emphasis">
            {{ t("cargo.bookingdetail.created") }}
          </div>
          <div class="text-caption">{{ formatDt(booking.created_at) }}</div>
        </v-col>
        <v-col v-if="detail?.confirmed_at" cols="12" sm="6">
          <div class="text-caption text-medium-emphasis">
            {{ t("cargo.bookingdetail.confirmed") }}
          </div>
          <div class="text-caption">{{ formatDt(detail.confirmed_at) }}</div>
        </v-col>
        <v-col v-if="booking.cancelled_at" cols="12" sm="6">
          <div class="text-caption text-medium-emphasis">
            {{ t("cargo.bookingdetail.cancelled") }}
          </div>
          <div class="text-caption">
            {{ formatDt(booking.cancelled_at) }}
            <span v-if="detail?.cancel_reason" class="text-medium-emphasis"
              >— {{ detail.cancel_reason }}</span
            >
          </div>
        </v-col>
        <v-col v-if="detail?.latest_acceptance_at" cols="12" sm="6">
          <div class="text-caption text-medium-emphasis">
            {{ t("cargo.bookingdetail.latest_acceptance") }}
          </div>
          <div class="text-caption">
            {{ formatDt(detail.latest_acceptance_at) }}
            <span
              v-if="minutesUntilLat !== null"
              :class="latColorClass"
              class="font-weight-medium ms-1"
            >
              ({{ latLabel }})
            </span>
          </div>
        </v-col>
      </v-row>

      <!-- Shipment / cargo details -->
      <template v-if="hasShipmentInfo">
        <v-divider class="my-2" />
        <div class="text-subtitle-2 mb-2">
          <v-icon icon="mdi-package-variant-closed" size="16" class="me-1" />
          {{ t("cargo.bookingdetail.shipment_info") }}
        </div>
        <v-row dense class="mb-3">
          <v-col v-if="detail?.origin_address" cols="12">
            <div class="text-caption text-medium-emphasis">
              {{ t("cargo.bookingdetail.origin_address") }}
            </div>
            <div class="text-caption">{{ detail.origin_address }}</div>
          </v-col>
          <v-col v-if="detail?.destination_address" cols="12">
            <div class="text-caption text-medium-emphasis">
              {{ t("cargo.bookingdetail.destination_address") }}
            </div>
            <div class="text-caption">{{ detail.destination_address }}</div>
          </v-col>
          <v-col v-if="detail?.product_description" cols="6" sm="4">
            <div class="text-caption text-medium-emphasis">
              {{ t("cargo.bookingdetail.product") }}
            </div>
            <div class="text-caption">
              {{ detail.product_description
              }}<span v-if="detail.product_code"
                > ({{ detail.product_code }})</span
              >
            </div>
          </v-col>
          <v-col v-if="detail?.commodity_description" cols="6" sm="4">
            <div class="text-caption text-medium-emphasis">
              {{ t("cargo.bookingdetail.commodity") }}
            </div>
            <div class="text-caption">
              {{ detail.commodity_description
              }}<span v-if="detail.commodity_class"
                > ({{ detail.commodity_class }})</span
              >
            </div>
          </v-col>
          <v-col v-if="detail?.chargeable_weight_kg" cols="6" sm="4">
            <div class="text-caption text-medium-emphasis">
              {{ t("cargo.bookingdetail.chargeable_weight") }}
            </div>
            <div class="text-caption">{{ detail.chargeable_weight_kg }} kg</div>
          </v-col>
          <v-col v-if="detail?.time_of_availability_at" cols="6" sm="4">
            <div class="text-caption text-medium-emphasis">
              {{ t("cargo.bookingdetail.time_of_availability") }}
            </div>
            <div class="text-caption">
              {{ formatDt(detail.time_of_availability_at) }}
            </div>
          </v-col>
          <v-col v-if="detail?.agent_iata_confirmed" cols="6" sm="4">
            <div class="text-caption text-medium-emphasis">
              {{ t("cargo.bookingdetail.agent_iata") }}
            </div>
            <div class="text-caption metric-mono">
              {{ detail.agent_iata_confirmed }}
            </div>
          </v-col>
          <v-col v-if="detail?.known_shipper !== null && detail?.known_shipper !== undefined" cols="6" sm="4">
            <div class="text-caption text-medium-emphasis">
              {{ t("cargo.bookingdetail.known_shipper") }}
            </div>
            <div class="text-caption">
              {{
                detail.known_shipper
                  ? t("common.yes")
                  : t("common.no")
              }}
            </div>
          </v-col>
          <v-col v-if="co2eTotal !== null" cols="6" sm="4">
            <div class="text-caption text-medium-emphasis">
              {{ t("cargo.bookingdetail.co2e") }}
            </div>
            <div class="text-caption">{{ co2eTotal.toFixed(2) }} kg</div>
          </v-col>
        </v-row>
      </template>

      <!-- Quotation (the rate that produced this booking) -->
      <template v-if="detail?.quotation">
        <v-divider class="my-2" />
        <div class="text-subtitle-2 mb-2">
          <v-icon icon="mdi-file-document-outline" size="16" class="me-1" />
          {{ t("cargo.bookingdetail.quotation") }}
        </div>
        <v-row dense class="mb-2">
          <v-col cols="6" sm="3">
            <div class="text-caption text-medium-emphasis">
              {{ t("cargo.bookingdetail.supplier_total") }}
            </div>
            <div class="text-caption">
              {{ detail.quotation.currency ?? "EUR" }}
              {{ Number(detail.quotation.supplier_total ?? 0).toFixed(2) }}
            </div>
          </v-col>
          <v-col cols="6" sm="3">
            <div class="text-caption text-medium-emphasis">
              {{ t("cargo.bookingdetail.client_total") }}
            </div>
            <div class="text-caption font-weight-medium">
              {{ detail.quotation.currency ?? "EUR" }}
              {{ Number(detail.quotation.client_total ?? 0).toFixed(2) }}
            </div>
          </v-col>
          <v-col v-if="detail.quotation.margin_percent !== null" cols="6" sm="3">
            <div class="text-caption text-medium-emphasis">
              {{ t("cargo.bookingdetail.margin") }}
            </div>
            <div class="text-caption">{{ detail.quotation.margin_percent }}%</div>
          </v-col>
          <v-col cols="6" sm="3">
            <div class="text-caption text-medium-emphasis">
              {{ t("cargo.bookingdetail.quote_type") }}
            </div>
            <div class="text-caption">
              <v-chip
                size="x-small"
                :color="detail.quotation.is_firm_quote ? 'success' : 'default'"
                variant="tonal"
              >
                {{
                  detail.quotation.is_firm_quote
                    ? t("cargo.bookingdetail.firm_quote")
                    : t("cargo.bookingdetail.estimated_quote")
                }}
              </v-chip>
            </div>
          </v-col>
        </v-row>
        <v-table
          v-if="detail.quotation.components?.length"
          density="compact"
          class="mb-3"
        >
          <thead>
            <tr>
              <th>{{ t("cargo.col.code") }}</th>
              <th>{{ t("cargo.col.description") }}</th>
              <th class="text-end">{{ t("cargo.bookingdetail.supplier_total") }}</th>
              <th class="text-end">{{ t("cargo.bookingdetail.client_total") }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(c, idx) in detail.quotation.components" :key="idx">
              <td class="text-caption">{{ c.code }}</td>
              <td class="text-caption">{{ c.name }}</td>
              <td class="text-caption text-end">
                {{ Number(c.supplier_amount ?? 0).toFixed(2) }}
              </td>
              <td class="text-caption text-end">
                {{ Number(c.client_amount ?? 0).toFixed(2) }}
              </td>
            </tr>
          </tbody>
        </v-table>
      </template>

      <!-- Segments -->
      <template v-if="detail?.segments?.length">
        <v-divider class="my-2" />
        <div class="text-subtitle-2 mb-2">
          <v-icon icon="mdi-airplane" size="16" class="me-1" />
          {{ t("cargo.flight.segments") }}
        </div>
        <v-list density="compact" class="rounded border mb-3" lines="two">
          <v-list-item v-for="(seg, idx) in detail.segments" :key="idx">
            <template #prepend>
              <v-avatar size="26" color="primary" variant="tonal">
                <span class="text-caption">{{ idx + 1 }}</span>
              </v-avatar>
            </template>
            <v-list-item-title>
              <strong>{{ seg.carrier }}{{ seg.flight_number ?? "" }}</strong>
              · {{ seg.origin ?? "—" }} → {{ seg.destination ?? "—" }}
            </v-list-item-title>
            <v-list-item-subtitle class="text-caption">
              <span v-if="seg.departure">{{ formatDt(seg.departure) }}</span>
              <span v-if="seg.arrival"> → {{ formatDt(seg.arrival) }}</span>
              <span v-if="seg.aircraft" class="ms-2 text-medium-emphasis"
                >· {{ seg.aircraft }}</span
              >
            </v-list-item-subtitle>
          </v-list-item>
        </v-list>
      </template>

      <!-- Fees -->
      <template v-if="detail?.fees?.length">
        <v-divider class="my-2" />
        <div class="text-subtitle-2 mb-2">
          <v-icon icon="mdi-cash-multiple" size="16" class="me-1" />
          {{ t("cargo.costi.title") }}
        </div>
        <v-table density="compact">
          <thead>
            <tr>
              <th>{{ t("cargo.col.code") }}</th>
              <th>{{ t("cargo.col.description") }}</th>
              <th class="text-end">{{ t("cargo.wcb.col_amount") }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(f, idx) in detail.fees" :key="idx">
              <td class="text-caption">{{ f.code }}</td>
              <td class="text-caption">{{ f.name }}</td>
              <td class="text-caption text-end">
                {{ f.currency ?? "EUR" }} {{ Number(f.amount ?? 0).toFixed(2) }}
              </td>
            </tr>
          </tbody>
          <tfoot v-if="feesTotal !== null">
            <tr>
              <td colspan="2" class="text-caption font-weight-bold text-end">
                {{ t("cargo.col.total") }}
              </td>
              <td class="text-caption font-weight-bold text-end">
                {{ feesTotalCurrency ?? "EUR" }} {{ feesTotal.toFixed(2) }}
              </td>
            </tr>
          </tfoot>
        </v-table>
      </template>

      <!-- History -->
      <template v-if="history.length">
        <v-divider class="my-2" />
        <div class="text-subtitle-2 mb-2">
          <v-icon icon="mdi-clock-outline" size="16" class="me-1" />
          {{ t("cargo.booking.history") }}
        </div>
        <v-list density="compact" lines="two" class="rounded border">
          <v-list-item v-for="(h, idx) in history" :key="idx">
            <v-list-item-title class="text-caption">{{
              h.event
            }}</v-list-item-title>
            <v-list-item-subtitle class="text-caption text-medium-emphasis">
              {{ formatDt(h.ts) }}
            </v-list-item-subtitle>
          </v-list-item>
        </v-list>
      </template>
    </template>

    <EmptyState
      v-else
      icon="mdi-airplane-off"
      :title="t('cargo.bookingdetail.no_booking')"
      :text="t('cargo.bookingdetail.no_booking_text')"
    />

    <template #actions>
      <v-btn variant="text" @click="ui.closeModal()">{{
        t("common.close")
      }}</v-btn>
      <v-spacer />
      <v-btn
        v-if="booking?.booking_id"
        prepend-icon="mdi-ticket-confirmation-outline"
        variant="outlined"
        size="small"
        @click="openEvidenceTicket"
      >
        {{ t("cargo.booking.boarding_pass") }}
      </v-btn>
      <v-btn
        v-if="canCancel"
        prepend-icon="mdi-cancel"
        color="error"
        variant="outlined"
        size="small"
        @click="openCancel"
      >
        {{ t("cargo.booking.cancel") }}
      </v-btn>
      <!--
        Sólo si el carrier soporta la etapa `status`. WebCargo sí (GET /booking,
        una lectura barata); KLM no la declara a propósito, porque su
        equivalente es una escritura. Antes el botón salía siempre y con una
        reserva KLM no hacía nada útil.
      -->
      <v-btn
        v-if="booking?.booking_id && canRefreshStatus"
        prepend-icon="mdi-refresh"
        variant="text"
        size="small"
        @click="refresh"
      >
        {{ t("cargo.booking.refresh_status") }}
      </v-btn>
    </template>
  </ModalWrapper>
</template>

<script setup lang="ts">
import { useI18n } from "vue-i18n";
import EmptyState from "@shared/ui/EmptyState.vue";
import { computed, ref, watch } from "vue";
import { useUiStore } from "@cargo/stores/ui.store";
import { useCargoFlightManagerStore } from "@cargo/stores/cargo_flight_manager.store";
import { useCargoStore } from "@cargo/stores/cargo.store";
import {
  bookingService,
  type BookingDetail,
  type BookingHistoryEntry,
} from "@cargo/services/booking.service";
import { idSupportsStage } from "@cargo/services/booking_provider";
import ModalWrapper from "./ModalWrapper.vue";

const { t } = useI18n();
const ui = useUiStore();
const store = useCargoFlightManagerStore();
const cargoStore = useCargoStore();

const loading = ref(false);

const booking = computed(() => store.booking);
const detail = ref<BookingDetail | null>(null);
const history = ref<BookingHistoryEntry[]>([]);

const statusColor = computed(() => {
  switch (booking.value?.status) {
    case "confirmed":
    case "completed":
      return "success";
    case "cancelled":
    case "rejected":
    case "failed":
      return "error";
    case "pending":
      return "warning";
    default:
      return "primary";
  }
});

/**
 * ¿El carrier de esta reserva soporta refrescar el estado?
 *
 * Se pregunta al contrato en vez de asumir: WebCargo declara la etapa `status`,
 * KLM no. Sustituye al `v-if` que sólo miraba si había booking_id.
 */
const canRefreshStatus = computed(() =>
  idSupportsStage(booking.value?.booking_id, "status"),
);

const canCancel = computed(() => {
  const s = booking.value?.status;
  return s === "confirmed" || s === "pending";
});

const feesTotal = computed(() => {
  const v = detail.value?.computed?.fees_total;
  return typeof v === "number" ? v : null;
});
const feesTotalCurrency = computed(() => {
  const v = detail.value?.computed?.fees_total_currency;
  return typeof v === "string" ? v : null;
});
const minutesUntilLat = computed(() => {
  const v = detail.value?.computed?.minutes_until_latest_acceptance;
  return typeof v === "number" ? v : null;
});
const latLabel = computed(() => {
  const m = minutesUntilLat.value;
  if (m === null) return "";
  if (m < 0) {
    return t("cargo.bookingdetail.lat_passed");
  }
  const hours = Math.floor(m / 60);
  const mins = m % 60;
  return hours > 0
    ? t("cargo.bookingdetail.lat_in_hm", { h: hours, m: mins })
    : t("cargo.bookingdetail.lat_in_m", { m: mins });
});
const latColorClass = computed(() => {
  const m = minutesUntilLat.value;
  if (m === null) return "";
  if (m < 0) return "text-error";
  if (m < 120) return "text-warning";
  return "text-medium-emphasis";
});

const hasShipmentInfo = computed(() => {
  const d = detail.value;
  if (!d) return false;
  return Boolean(
    d.origin_address ||
      d.destination_address ||
      d.product_description ||
      d.commodity_description ||
      d.chargeable_weight_kg ||
      d.time_of_availability_at ||
      d.agent_iata_confirmed ||
      d.known_shipper !== null ||
      co2eTotal.value !== null,
  );
});

const co2eTotal = computed(() => {
  const d = detail.value;
  if (!d) return null;
  // gt = gate-to-gate total; the single headline figure. gw/ew/et are the
  // WTW breakdown (well-to-wake / energy-to-wake / etc.) — not shown
  // individually here, gt already summarizes them for a booking-detail view.
  return typeof d.co2e_gt_kg === "number" ? d.co2e_gt_kg : null;
});

watch(
  () => ui.activeModal,
  async (n) => {
    if (n !== "booking_detail" || !booking.value?.booking_id) return;
    loading.value = true;
    detail.value = null;
    history.value = [];
    try {
      const id = booking.value.booking_id;
      const [d, h] = await Promise.all([
        bookingService.getDetail(id),
        bookingService.getHistory(id),
      ]);
      detail.value = d;
      history.value = h;
    } finally {
      loading.value = false;
    }
  },
);

function formatDt(iso?: string | null): string {
  if (!iso) return "—";
  const t = new Date(iso);
  if (Number.isNaN(t.getTime())) return iso;
  const dd = String(t.getDate()).padStart(2, "0");
  const mm = String(t.getMonth() + 1).padStart(2, "0");
  const hh = String(t.getHours()).padStart(2, "0");
  const mi = String(t.getMinutes()).padStart(2, "0");
  return `${dd}/${mm} ${hh}:${mi}`;
}

function openEvidenceTicket(): void {
  if (!booking.value?.booking_id) return;
  window.open(
    bookingService.evidenceTicketUrl(booking.value.booking_id),
    "_blank",
  );
}

function openCancel(): void {
  ui.openModal("booking_cancel");
}

async function refresh(): Promise<void> {
  // "Aggiorna stato" — re-pull the live booking status from the carrier.
  const changed = await store.refreshBookingStatus();
  // A confirmed carrier status change can rewrite flight columns/AWB on
  // spedizioni_cargo (useCargoStore, a separate store from the booking
  // lifecycle one above) — reload it so the ficha reflects that outside
  // this modal too. Skipped when nothing changed to avoid a round trip on
  // every click of "Aggiorna stato".
  if (changed && cargoStore.id) {
    await cargoStore.load(Number(cargoStore.id));
  }
}
</script>

<style scoped>
.metric-mono {
  font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace;
  font-size: 12px;
}
</style>
