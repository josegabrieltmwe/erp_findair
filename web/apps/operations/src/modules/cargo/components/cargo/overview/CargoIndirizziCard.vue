<template>
  <section class="card-tmwe">
    <CardHeader
      icon="mdi-map-marker-path"
      :title="t('cargo.indirizzi.title')"
    />

    <!-- Compact summary rows en grilla 2×2 para aprovechar el ancho de la card
         (antes se apilaban en 1 columna dejando medio bloque vacío a la
         derecha). Clicar una fila abre el modal de esa dirección, que edita en
         buffer local y persiste solo con su botón "Salva". -->
    <!-- Grilla 2×2. Cada dirección lleva DEBAJO su expedición express vinculada
         (recogida bajo la dirección de recogida, entrega bajo la de entrega),
         con el botón de abrir (nueva pestaña) o crear alineado a su columna. -->
    <div class="indirizzi-grid">
      <div class="indirizzi-cell">
        <AddressRow
          :icon="usesSede ? 'mdi-office-building-marker' : 'mdi-routes'"
          :caption="t('cargo.indirizzi.pickup_sender')"
          :main="pickupMain"
          :sub="pickupSub"
          :sub2="pickupSub2"
          @click="ui.openModal('pickup')"
        />
        <CargoLegExpress role="pickup" />
      </div>

      <div class="indirizzi-cell">
        <AddressRow
          icon="mdi-map-marker-outline"
          :caption="t('cargo.indirizzi.arrival_recipient')"
          :main="destMain"
          :sub="destSub"
          :sub2="destSub2"
          @click="ui.openModal('dest')"
        />
        <CargoLegExpress role="delivery" />
      </div>

      <!-- Agenzia y handler son direcciones igual que presa/destino (misma tabla
           spedizioni_indirizzi). El handler lleva su leg express debajo. -->
      <div class="indirizzi-cell">
        <AddressRow
          icon="mdi-domain"
          :caption="t('cargo.indirizzi.agency_forwarder')"
          :main="agencyMain"
          :sub="agencySub"
          :sub2="agencySub2"
          @click="ui.openModal('agency')"
        />
      </div>

      <div class="indirizzi-cell">
        <AddressRow
          icon="mdi-warehouse"
          :caption="t('cargo.indirizzi.handler')"
          :main="handlerMain"
          :sub="handlerSub"
          :sub2="handlerSub2"
          @click="ui.openModal('handler')"
        />
        <CargoLegExpress role="handler" />
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { storeToRefs } from "pinia";
import { useCargoStore } from "@cargo/stores/cargo.store";
import { useUiStore } from "@cargo/stores/ui.store";
import CardHeader from "@cargo/components/shell/CardHeader.vue";
import AddressRow from "@cargo/components/shell/AddressRow.vue";
import CargoLegExpress from "@cargo/components/cargo/CargoLegExpress.vue";
import { cargoService, type CargoAddress } from "@cargo/services/cargo.service";
import { countryFlagEmoji } from "@cargo/utils/country";

const { t } = useI18n();
const store = useCargoStore();
const {
  pickup,
  destination,
  agency,
  sede,
  usesSedeAddress: usesSede,
} = storeToRefs(store);
const ui = useUiStore();

function compose(a: CargoAddress | null): {
  main: string;
  sub: string;
  sub2: string;
} {
  if (!a) {
    return { main: t("cargo.indirizzi.not_set"), sub: "", sub2: "" };
  }
  const main = a.nome || "—";
  const cap = a.cap || "";
  const city = a.citta || "";
  const prov = a.prov || "";
  const country = a.id_paese_iso || "";
  const addressRaw = a.adress || "";
  const subParts: string[] = [];
  if (addressRaw) subParts.push(addressRaw);
  const subParts2: string[] = [];
  if (cap || city || prov) {
    const left = [cap, city].filter(Boolean).join(" ");
    subParts2.push(prov ? `${left} (${prov})` : left);
  }
  if (country) {
    const flag = countryFlagEmoji(country);
    subParts2.push(flag ? `${flag} ${country}` : country);
  }
  return {
    main,
    sub: subParts.join(" · "),
    sub2: subParts2.join(" · "),
  };
}

// Sin fila de presa el origen es la sede del cliente: se muestran sus datos
// en lugar de "non impostato" (paridad spedyc_form.php:74).
const pickupMain = computed(() =>
  usesSede.value ? sede.value?.label || "—" : compose(pickup.value).main,
);
const pickupSub = computed(() =>
  usesSede.value ? sede.value?.indirizzo || "" : compose(pickup.value).sub,
);
const pickupSub2 = computed(() => {
  if (usesSede.value) {
    const s = sede.value;
    const left = [s?.cap, s?.citta, s?.prov].filter(Boolean).join(" ");
    const iso = s?.id_paese_iso || "";
    const flag = iso ? countryFlagEmoji(iso) : "";
    const isoLabel = iso ? (flag ? `${flag} ${iso}` : iso) : "";
    return [left, isoLabel, t("cargo.addr.from_sede")]
      .filter(Boolean)
      .join(" · ");
  }
  const base = compose(pickup.value).sub2;
  const airport = pickup.value?.dhl_airport || "";
  return airport
    ? [base, t("cargo.indirizzi.airport", { code: airport })]
        .filter(Boolean)
        .join(" · ")
    : base;
});

const destMain = computed(() => compose(destination.value).main);
const destSub = computed(() => compose(destination.value).sub);
const destSub2 = computed(() => {
  const base = compose(destination.value).sub2;
  const d = destination.value;
  const airport = d?.dhl_airport || "";
  const attn = d?.attenzione || "";
  const tel = d?.tel || d?.cell || "";
  const extras = [
    airport ? t("cargo.indirizzi.airport", { code: airport }) : "",
    attn,
    tel,
  ].filter(Boolean);
  return [base, extras.join(" · ")].filter(Boolean).join(" · ");
});

// Agenzia comparte el mismo compose() que presa/destino (es una dirección).
const agencyMain = computed(() => compose(agency.value).main);
const agencySub = computed(() => compose(agency.value).sub);
const agencySub2 = computed(() => compose(agency.value).sub2);

// El HANDLER NO es una dirección (spedizioni_indirizzi tipo H): es un FK
// handler_id → tabla handlers (ALHA/MLE/…). Antes se pasaba por compose(), que
// leía la dirección vacía y mostraba "Sin definir" aunque el handler estuviera
// asignado. Ahora se resuelve el NOMBRE del handler por su id.
const handlerId = computed(() => Number(store.cargo?.handler_id ?? 0));
const handlerName = ref("");
async function resolveHandlerName(): Promise<void> {
  const id = handlerId.value;
  if (!id) {
    handlerName.value = "";
    return;
  }
  try {
    const list = await cargoService.listHandlers(Number(store.id));
    handlerName.value = list.find((h) => Number(h.id) === id)?.nome ?? `#${id}`;
  } catch {
    handlerName.value = `#${id}`;
  }
}
watch([() => store.id, handlerId], resolveHandlerName, { immediate: true });

const handlerMain = computed(() =>
  handlerId.value
    ? handlerName.value || `#${handlerId.value}`
    : t("cargo.indirizzi.not_set"),
);
const handlerSub = computed(() =>
  handlerId.value ? t("cargo.indirizzi.handler") : "",
);
const handlerSub2 = computed(() => "");
</script>

<style scoped lang="scss">
/* Grilla 2×2 de tarjetas de dirección — aprovecha el ancho de la card. En
   pantallas estrechas (o columna angosta) cae a 1 columna. Cada `.arow` es un
   botón a ancho completo de su celda. */
.indirizzi-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px 8px;
  align-items: start;
}
/* Cada celda: dirección + su leg express debajo, alineada a la columna. */
.indirizzi-cell {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.indirizzi-grid :deep(.arow) {
  width: 100%;
  align-items: flex-start;
}
@media (max-width: 640px) {
  .indirizzi-grid {
    grid-template-columns: 1fr;
  }
}
</style>
