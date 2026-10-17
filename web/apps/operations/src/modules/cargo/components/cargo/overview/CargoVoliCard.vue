<template>
  <section class="card-tmwe">
    <CardHeader
      icon="mdi-airplane"
      :title="t('cargo.volo.title')"
      editable
      @edit="ui.openModal('servizio')"
    >
      <!-- OJO: este #actions SUSTITUYE al slot por defecto de CardHeader, asi
           que el boton ✎ que `editable` pintaria NO se renderiza y el @edit de
           arriba nunca se dispara. Por eso el acceso a `servizio` tiene que
           estar aqui explicitamente: es el formulario de servicio + vettore
           (CargoVettoriBox + CargoDatesBox) y, desde que la fila «Vettore» solo
           se pinta sin vuelo asignado, esta es su UNICA entrada cuando hay
           vuelo. -->
      <template #actions>
        <v-btn
          icon="mdi-tune-variant"
          variant="text"
          size="x-small"
          density="comfortable"
          :title="t('cargo.modal.servizio')"
          @click="ui.openModal('servizio')"
        />
        <v-btn
          icon="mdi-airplane-edit"
          variant="text"
          size="x-small"
          density="comfortable"
          :title="t('cargo.voli.manual_entry')"
          @click="ui.openModal('flight_legs_manual')"
        />
        <v-btn
          icon="mdi-pencil-outline"
          variant="text"
          size="x-small"
          density="comfortable"
          :title="t('cargo.voli.edit_flights')"
          @click="ui.openModal('flights')"
        />
        <!-- SIN boton de «quitar vuelo» aqui: lo pinta CargoFlightManagerCard
             (el ✕ rojo de la barra de acciones del vuelo), que es donde esta
             el vuelo del que se habla. Eran dos botones rojos para la misma
             intencion —este borraba ademas los tramos manuales, y esa era toda
             la diferencia—, asi que los tramos pasaron a ser una casilla del
             dialogo y el boton sobrante se fue. -->
      </template>
    </CardHeader>

    <!-- ─── Vettore (venia de CargoServizioCard, fusionada aqui) ───

         Solo SIN vuelo asignado. Con un rate o una reserva activa, el manager
         de abajo ya pinta la aerolinea con su logo, su codigo y las acciones
         que operan sobre ella; esta fila repetia el mismo dato una tercera vez
         (logo + valor) sin aportar nada que el manager no diga mejor.

         Sin vuelo NO sobra: es el acceso al modal `servizio` para elegir
         transportista a mano, que es justo lo que el manager no ofrece. -->
    <InfoRow
      v-if="!flightMgr.rate && !flightMgr.hasActiveBooking"
      icon="mdi-airplane"
      :title="t('cargo.servizio.carrier')"
      :subtitle="vettoreSubtitle"
      :value="vettoreLabel"
      clickable
      @click="ui.openModal('servizio')"
    >
      <!-- Cola/logo de la aerolínea seleccionada (por código IATA). Si no hay
           código o el logo falla al cargar, AirlineLogo pinta el avión dentro
           de su propia caja (el cargo SIEMPRE es aéreo — es un AWB, no un
           envío por carretera), así que la fila conserva la sangría. -->
      <template #prepend>
        <AirlineLogo :code="airlineLogo" :size="24">
          <template #placeholder>
            <v-icon icon="mdi-airplane" size="18" />
          </template>
        </AirlineLogo>
      </template>
    </InfoRow>

    <!-- ─── Flight manager (rate + booking lifecycle, paridad legacy) ───
         El chip verde «Booking wc_book_... ›» que pinta cuando hay reserva
         activa abre BookingDetailModal (segments/fees/history/evidence
         ticket/cancel) flotando. Antes esa misma información se repetía
         además inline, en WebcargoBookingPanelV2, deformando el layout de
         la ficha con una tarjeta larga entre el flight manager y el
         recorrido — el modal ya la cubre por completo, así que se retiró
         en vez de mantener dos superficies mostrando lo mismo. -->
    <CargoFlightManagerCard class="mb-3" />

    <!--
      ─── Recorrido ───

      CON TRAMOS: la tira compacta de CargoFlightLegList — origen → destino en
      UNA linea, con las escalas plegadas tras su propio dialogo. Antes se
      pintaba una fila por tramo (hasta CINCO), asi que asignar un vuelo con
      escalas hacia crecer la tarjeta de golpe y empujaba los botones
      MAWB/HAWB fuera de la vista.

      El componente ya existia y ya traia ese dialogo dentro, pero estaba
      enterrado tras el modal `flights`: habia que abrir un modal para llegar a
      esta misma tira, que abre otro. Ahora la tira ES la fila de la tarjeta y
      el detalle de escalas queda a UN clic.

      SIN TRAMOS: origen y destino, que es lo que mostraba CargoServizioCard.
      No se pintan junto a los tramos porque SON sus extremos —el primero y el
      ultimo—: ensenar ambas cosas era describir el mismo vuelo dos veces, que
      es justo la redundancia que esta fusion elimina.
    -->
    <CargoFlightLegList v-if="legs.length" />
    <div v-else class="od-grid">
      <InfoRow
        icon="mdi-airplane-takeoff"
        :title="t('cargo.servizio.origin')"
        :subtitle="originSubtitle"
        :value="originLabel"
        clickable
        @click="ui.openModal('servizio')"
      />
      <InfoRow
        icon="mdi-airplane-landing"
        :title="t('cargo.servizio.destination')"
        :subtitle="destSubtitle"
        :value="destLabel"
        clickable
        @click="ui.openModal('servizio')"
      />
    </div>

    <!-- ─── Air-waybill editors — everything is managed from the overview
         via modals (no separate page tab): MAWB form, HAWB list and the
         cargo consolidation panel each open their own modal. ─── -->
    <v-divider class="my-2" />
    <div class="d-flex flex-wrap ga-2 px-1 pb-1">
      <v-btn
        size="small"
        variant="tonal"
        color="primary"
        prepend-icon="mdi-file-document-outline"
        @click="ui.openModal('mawb')"
      >
        {{ t("cargo.voli.mawb_master") }}
      </v-btn>
      <v-btn
        size="small"
        variant="tonal"
        prepend-icon="mdi-file-multiple-outline"
        @click="ui.openModal('hawb_list')"
      >
        {{ t("cargo.voli.hawb_house") }}
      </v-btn>
      <v-btn
        size="small"
        variant="tonal"
        prepend-icon="mdi-set-merge"
        @click="ui.openModal('consolidation')"
      >
        {{ t("cargo.voli.consolidation") }}
      </v-btn>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { storeToRefs } from "pinia";
import { useCargoStore } from "@cargo/stores/cargo.store";
import { useCargoFlightManagerStore } from "@cargo/stores/cargo_flight_manager.store";
import { useUiStore } from "@cargo/stores/ui.store";
import CardHeader from "@cargo/components/shell/CardHeader.vue";
import InfoRow from "@cargo/components/shell/InfoRow.vue";
import AirlineLogo from "@cargo/components/cargo/AirlineLogo.vue";
import CargoFlightLegList from "@cargo/components/cargo/CargoFlightLegList.vue";
import CargoFlightManagerCard from "@cargo/components/cargo/flight-manager/CargoFlightManagerCard.vue";
import { countryFlagEmoji, iataFlagEmoji } from "@cargo/utils/country";
import { stripCarrierMarkup } from "@cargo/utils/carrierName";

const { t } = useI18n();
const store = useCargoStore();
const { cargo, pickup, destination } = storeToRefs(store);
const ui = useUiStore();
// Solo para decidir si la fila «Vettore» sobra: cuando el manager tiene rate o
// reserva activa, ya es el que muestra la aerolinea. Misma instancia que monta
// CargoFlightManagerCard (Pinia), asi que no dispara una segunda hidratacion.
const flightMgr = useCargoFlightManagerStore();

/* ─── Vettore + origen/destino (fusionado desde CargoServizioCard) ───
   Copiado literal, no reescrito: conserva el fallback a pickup/destination del
   store y las banderas por IATA/pais, comportamiento que ya existia y que una
   reescritura habria perdido. */

// Código IATA de la aerolínea (vettore_sigla) para pintar su cola/logo.
const airlineLogo = computed<string>(() =>
  (cargo.value?.vettore_sigla ?? "").trim(),
);

const vettoreLabel = computed<string>(() => {
  const nome = stripCarrierMarkup(cargo.value?.vettore_nome);
  return nome || cargo.value?.vettore_sigla || "—";
});
const vettoreSubtitle = computed<string>(() => {
  const tipo = cargo.value?.vettore_tipo;
  return tipo
    ? t("cargo.servizio.type_x", { type: tipo })
    : t("cargo.servizio.click_to_choose");
});

const originLabel = computed<string>(() => {
  const iata = cargo.value?.terminal_part || pickup.value?.dhl_airport || "";
  if (!iata) return "—";
  const flag =
    iataFlagEmoji(iata) || countryFlagEmoji(pickup.value?.id_paese_iso);
  return flag ? `${flag} ${iata}` : iata;
});
const originSubtitle = computed<string>(() => {
  return pickup.value?.citta || pickup.value?.id_paese_iso || "";
});

const destLabel = computed<string>(() => {
  const iata =
    cargo.value?.terminal_dest || destination.value?.dhl_airport || "";
  if (!iata) return "—";
  const flag =
    iataFlagEmoji(iata) || countryFlagEmoji(destination.value?.id_paese_iso);
  return flag ? `${flag} ${iata}` : iata;
});
const destSubtitle = computed<string>(() => {
  return destination.value?.citta || destination.value?.id_paese_iso || "";
});

/**
 * Cargo can have up to 5 flight legs (flight_num1..5 / flight_data1..5 /
 * flight_airp1..5 / flight_datad1..5 / flight_aird1..5). We render only
 * the legs that have a flight number set.
 */
const legs = computed(() => {
  const c = cargo.value;
  if (!c) return [];
  const out: Array<{
    index: number;
    icon: string;
    label: string;
    subtitle: string;
    value: string;
  }> = [];
  for (let i = 1; i <= 5; i++) {
    const num = (c as Record<string, string | undefined>)[`flight_num${i}`];
    if (!num || !String(num).trim()) continue;
    const fromAirport =
      (c as Record<string, string | undefined>)[`flight_airp${i}`] ?? "";
    const toAirport =
      (c as Record<string, string | undefined>)[`flight_aird${i}`] ?? "";
    const dep =
      (c as Record<string, string | undefined>)[`flight_data${i}`] ?? "";
    const arr =
      (c as Record<string, string | undefined>)[`flight_datad${i}`] ?? "";
    out.push({
      index: i,
      icon: i === 1 ? "mdi-airplane-takeoff" : "mdi-airplane",
      label: t("cargo.voli.leg", { index: i, num }),
      subtitle: `${formatDate(dep)} → ${formatDate(arr)}`,
      value: `${fromAirport} → ${toAirport}`,
    });
  }
  return out;
});

function formatDate(d: string | undefined): string {
  if (!d) return "—";
  const m = d.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return "—";
  return `${m[3]}/${m[2]}`;
}
</script>

<style scoped lang="scss">
/* Origen | Destino en dos columnas — solo se pintan cuando NO hay tramos.
   En columna angosta cae a apilado. */
.od-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px;
}
.od-grid > * {
  min-width: 0;
}
@media (max-width: 640px) {
  .od-grid {
    grid-template-columns: 1fr;
  }
}
</style>
