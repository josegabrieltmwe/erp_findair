<template>
  <v-chip
    v-if="store.hasActiveBooking"
    :color="chipColor"
    size="small"
    variant="flat"
    class="ms-1"
    :prepend-icon="chipIcon"
    @click="openDetail"
  >
    <span class="font-weight-bold me-1">{{ shortLabel }}</span>
    <span class="text-caption">{{ idShort }}</span>
  </v-chip>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useCargoFlightManagerStore } from "@cargo/stores/cargo_flight_manager.store";
import { useUiStore } from "@cargo/stores/ui.store";

const store = useCargoFlightManagerStore();
const ui = useUiStore();

const chipColor = computed(() => {
  switch (store.bookingStatus) {
    case "confirmed":
    case "completed":
      return "success";
    case "cancelled":
    case "canceled":
    case "rejected":
    case "failed":
      return "error";
    case "pending":
      return "warning";
    default:
      return "primary";
  }
});

const chipIcon = computed(() => {
  switch (store.bookingStatus) {
    case "confirmed":
    case "completed":
      return "mdi-check-circle";
    case "cancelled":
    case "canceled":
      return "mdi-close-circle";
    case "rejected":
    case "failed":
      return "mdi-alert-circle";
    case "pending":
      return "mdi-progress-clock";
    default:
      return "mdi-airplane-check";
  }
});

const shortLabel = computed(() => {
  const s = String(store.bookingStatus ?? "").toUpperCase();
  return s || "BOOKED";
});

const idShort = computed(() => {
  const id = store.bookingId ?? "";
  return id.length > 10 ? `…${id.slice(-8)}` : id;
});

function openDetail(): void {
  ui.openModal("booking_detail");
}
</script>
