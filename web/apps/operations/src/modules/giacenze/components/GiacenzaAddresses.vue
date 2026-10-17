<template>
  <div class="giac-addr">
    <div v-if="loading" class="giac-addr__loading">
      <v-progress-circular indeterminate size="20" width="2" />
      <span>{{ t("giacenze.giacenze.addr.loading") }}</span>
    </div>

    <template v-else>
      <!-- Entrega actual (D) -->
      <div class="giac-addr__block">
        <div class="giac-addr__head">
          <v-icon size="18" icon="mdi-map-marker" />
          <span>{{ t("giacenze.giacenze.addr.delivery") }}</span>
        </div>
        <AddressLines v-if="addresses?.delivery" :addr="addresses.delivery" />
        <div v-else class="giac-addr__empty">
          {{ t("giacenze.giacenze.addr.none") }}
        </div>
      </div>

      <!-- Entrega original (V) — solo si la entrega se redirigió -->
      <div
        v-if="addresses?.delivery_original"
        class="giac-addr__block giac-addr__block--original"
      >
        <div class="giac-addr__head">
          <v-icon size="18" icon="mdi-history" />
          <span>{{ t("giacenze.giacenze.addr.deliveryOriginal") }}</span>
          <v-chip size="x-small" variant="tonal" class="ms-2">
            {{ t("giacenze.giacenze.addr.readonly") }}
          </v-chip>
        </div>
        <AddressLines :addr="addresses.delivery_original" />
      </div>

      <div class="giac-addr__actions">
        <v-btn
          v-if="shipmentId"
          variant="text"
          size="small"
          prepend-icon="mdi-pencil"
          :href="editHref"
          target="_blank"
        >
          {{ t("giacenze.giacenze.addr.editDelivery") }}
        </v-btn>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { giacenzeService } from "../services/giacenze.service";
import { detailHref } from "@shared/platform/navTargets";
import type { ShipmentAddresses, ShipmentAddress } from "../types";
import { defineComponent, h } from "vue";

const { t } = useI18n();

const props = defineProps<{ shipmentId: number | null }>();

const addresses = ref<ShipmentAddresses | null>(null);
const loading = ref(false);

/**
 * La EDICION de la direccion de entrega se hace en el formulario de expedicion,
 * cuyo endpoint (api_shipment_addresses) es el que dispara el clonado D->V para
 * preservar el destino original. La SPA de giacenze solo MUESTRA — asi no se
 * duplica la logica de direcciones ni el autocompletado CAP.
 */
const editHref = computed(() =>
  props.shipmentId ? detailHref("shipment", props.shipmentId) : "#",
);

async function load(): Promise<void> {
  if (!props.shipmentId) {
    addresses.value = null;
    return;
  }
  loading.value = true;
  try {
    addresses.value = await giacenzeService.getShipmentAddresses(
      props.shipmentId,
    );
  } catch {
    // El bloque de direcciones es complementario: si falla, no rompe el detalle.
    addresses.value = null;
  } finally {
    loading.value = false;
  }
}

watch(() => props.shipmentId, load, { immediate: true });

// Render inline de las lineas de una direccion (nombre, calle, CAP ciudad prov,
// pais, atencion, tel). Componente ligero local: no justifica un .vue aparte.
const AddressLines = defineComponent({
  props: { addr: { type: Object as () => ShipmentAddress, required: true } },
  setup(p) {
    return () => {
      const a = p.addr;
      const line = (txt: string) =>
        txt ? h("div", { class: "giac-addr__line" }, txt) : null;
      const cityLine = [a.cap, a.citta, a.prov].filter(Boolean).join(" ");
      return h("div", { class: "giac-addr__body" }, [
        a.nome ? h("div", { class: "giac-addr__name" }, a.nome) : null,
        line(a.adress ?? ""),
        line(cityLine),
        line(a.id_paese_iso ?? ""),
        a.attenzione
          ? line(`${a.attenzione}${a.tel ? " · " + a.tel : ""}`)
          : line(a.tel ?? ""),
      ]);
    };
  },
});
</script>

<style scoped>
.giac-addr {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.giac-addr__loading {
  display: flex;
  align-items: center;
  gap: 8px;
  color: rgba(0, 0, 0, 0.6);
}
.giac-addr__block {
  border: 1px solid rgba(0, 0, 0, 0.12);
  border-radius: 6px;
  padding: 10px 12px;
}
.giac-addr__block--original {
  background: rgba(0, 0, 0, 0.02);
  border-style: dashed;
}
.giac-addr__head {
  display: flex;
  align-items: center;
  gap: 6px;
  font-weight: 600;
  font-size: 0.85rem;
  margin-bottom: 6px;
}
.giac-addr__name {
  font-weight: 600;
}
.giac-addr__line {
  font-size: 0.85rem;
  line-height: 1.35;
}
.giac-addr__empty {
  font-style: italic;
  color: rgba(0, 0, 0, 0.5);
}
.giac-addr__actions {
  display: flex;
  justify-content: flex-end;
}
</style>
