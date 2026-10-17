<template>
  <!--
    Leg express de un cargo (recogida/entrega/handler) alineada BAJO su dirección
    en la card Direcciones. Si existe → chip "Abrir #id" (abre el detalle de la
    expedición en NUEVA pestaña). Si no → botón "+ Crear" (POST from_cargo →
    abre la nueva en pestaña nueva).
  -->
  <div class="leg-express">
    <button
      v-if="legId > 0"
      type="button"
      class="leg-express__open"
      :title="t('cargo.linked.open_express', { id: legId })"
      @click="openInNewTab(legId)"
    >
      <v-icon icon="mdi-truck-fast-outline" size="14" />
      <span>{{ t(openLabelKey, { id: legId }) }}</span>
      <v-icon icon="mdi-open-in-new" size="12" class="leg-express__ext" />
    </button>

    <button
      v-else
      type="button"
      class="leg-express__create"
      :disabled="creating"
      @click="createLeg"
    >
      <v-icon
        :icon="creating ? 'mdi-loading mdi-spin' : 'mdi-plus'"
        size="14"
      />
      <span>{{ t(createLabelKey) }}</span>
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import { storeToRefs } from "pinia";
import { useCargoStore } from "@cargo/stores/cargo.store";
import { useToastStore } from "@cargo/stores/toast.store";
import {
  linkedExpressService,
  type LinkedExpressTpc,
} from "@cargo/services/linked_express.service";
import { detailHref } from "@shared/platform/navTargets";

const props = defineProps<{ role: "pickup" | "delivery" | "handler" }>();

const { t } = useI18n();
const store = useCargoStore();
const toasts = useToastStore();
const { cargo } = storeToRefs(store);

const ROLE = {
  pickup: {
    field: "id_spediz_part",
    tpc: "P" as LinkedExpressTpc,
    open: "cargo.linked.pickup_express",
    create: "cargo.linked.role_pickup",
  },
  delivery: {
    field: "id_spediz_dest",
    tpc: "D" as LinkedExpressTpc,
    open: "cargo.linked.delivery_express",
    create: "cargo.linked.role_delivery",
  },
  handler: {
    field: "id_spediz_handl",
    tpc: "H" as LinkedExpressTpc,
    open: "cargo.linked.handler_express",
    create: "cargo.indirizzi.handler",
  },
} as const;

const cfg = computed(() => ROLE[props.role]);
const legId = computed<number>(() => {
  const v = (cargo.value as Record<string, unknown> | null)?.[cfg.value.field];
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
});
const openLabelKey = computed(() => cfg.value.open);
const createLabelKey = computed(() => cfg.value.create);

const creating = ref(false);

/** Abre el detalle de la expedición express en una NUEVA pestaña. */
function openInNewTab(id: number): void {
  window.open(detailHref("shipment", id), "_blank", "noopener");
}

async function createLeg(): Promise<void> {
  const cargoId = Number(cargo.value?.id ?? store.id ?? 0);
  if (!cargoId || creating.value) return;
  creating.value = true;
  try {
    const res = await linkedExpressService.createFromCargo(
      cargoId,
      cfg.value.tpc,
    );
    if (res.success && res.shipment_id) {
      // Crea y abre la nueva expedición en pestaña nueva.
      openInNewTab(res.shipment_id);
      // Refresca el cargo para que aparezca el enlace (id_spediz_*).
      await store.load(cargoId);
    } else {
      toasts.push(
        "error",
        res.error || res.message || t("cargo.linked.create_error"),
      );
    }
  } catch (err) {
    toasts.push(
      "error",
      (err as Error).message || t("cargo.linked.create_error"),
    );
  } finally {
    creating.value = false;
  }
}
</script>

<style scoped>
.leg-express {
  margin-top: 4px;
}
.leg-express__open,
.leg-express__create {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 9px;
  border-radius: 999px;
  font-size: 11.5px;
  font-weight: 600;
  cursor: pointer;
  border: 1px solid transparent;
  transition:
    background-color 0.14s ease,
    border-color 0.14s ease;
}
.leg-express__open {
  background: rgba(var(--v-theme-primary), 0.1);
  color: rgb(var(--v-theme-primary));
}
.leg-express__open:hover {
  background: rgba(var(--v-theme-primary), 0.18);
}
.leg-express__ext {
  opacity: 0.6;
}
.leg-express__create {
  background: transparent;
  color: rgb(var(--v-theme-on-surface-variant));
  border-color: rgba(
    var(--v-border-color),
    calc(var(--v-border-opacity) * 0.8)
  );
}
.leg-express__create:hover {
  background: rgba(var(--v-theme-on-surface), 0.05);
}
.leg-express__create:disabled {
  opacity: 0.6;
  cursor: default;
}
</style>
