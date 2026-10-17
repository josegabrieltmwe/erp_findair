<template>
  <!--
    Dropdown de cotización de la barra superior del detalle de cargo.

    Por qué vive aquí y no en una card del Overview: pedir precio a las
    aerolíneas y ofertar al cliente son actos de COMUNICACIÓN, no datos de la
    ficha — igual que el chat, los documentos o el histórico, que ya viven en
    esta barra. Una card ocupaba una franja del Overview para mostrar dos
    cifras y dos accesos que el propio modal repite.

    El menú conserva el dato de un vistazo (mejor coste + estado de la oferta)
    y abre el modal en la pestaña correcta, que es lo único que la card
    aportaba de verdad.
  -->
  <v-menu location="bottom end">
    <template #activator="{ props: menuProps }">
      <button
        type="button"
        class="topbar-iconbtn"
        :title="t('cargo.cotizacion.title')"
        v-bind="menuProps"
      >
        <v-icon icon="mdi-tag-multiple-outline" size="18" />
        <!-- Punto de aviso cuando hay RFQ enviadas sin respuesta: el operador
             ve desde la barra que hay algo pendiente sin abrir nada. -->
        <span v-if="hasPending" class="topbar-iconbtn-dot" />
      </button>
    </template>

    <v-list density="compact" min-width="300" class="quote-menu">
      <v-list-subheader>{{ t("cargo.cotizacion.title") }}</v-list-subheader>

      <!-- ── Lado vettori: lo que nos CUESTA ───────────────────────── -->
      <v-list-item
        prepend-icon="mdi-airplane"
        :disabled="!id"
        @click="ui.openCotizacionModal('carriers')"
      >
        <v-list-item-title>
          {{ t("cargo.cotizacion.tab_carriers") }}
        </v-list-item-title>
        <v-list-item-subtitle>
          <template v-if="highlight">
            {{
              highlight.isWinner
                ? t("cargo.offers.summary_winner")
                : t("cargo.offers.summary_best")
            }}
            · {{ highlight.carrier }} · {{ highlight.amount }}
          </template>
          <template v-else>
            {{
              store.total
                ? t("cargo.offers.summary_awaiting", { n: store.total })
                : t("cargo.offers.empty_title")
            }}
          </template>
        </v-list-item-subtitle>
        <template v-if="store.total" #append>
          <v-chip
            size="x-small"
            variant="tonal"
            color="primary"
            :title="t('cargo.offers.summary_replied')"
          >
            {{ repliedCount }}/{{ store.total }}
          </v-chip>
        </template>
      </v-list-item>

      <!-- ── Lado cliente: lo que OFRECEMOS ────────────────────────── -->
      <v-list-item
        prepend-icon="mdi-account-tie-outline"
        :disabled="!id"
        @click="ui.openCotizacionModal('client')"
      >
        <v-list-item-title>
          {{ t("cargo.cotizacion.tab_client") }}
        </v-list-item-title>
        <template #append>
          <v-chip
            size="x-small"
            variant="tonal"
            :color="clientOfferState.color"
          >
            {{ clientOfferState.label }}
          </v-chip>
        </template>
      </v-list-item>
    </v-list>
  </v-menu>
</template>

<script setup lang="ts">
import { computed, onMounted, watch } from "vue";
import { useI18n } from "vue-i18n";
import { storeToRefs } from "pinia";
import { useRoute } from "vue-router";
import { useUiStore } from "@cargo/stores/ui.store";
import { useCargoStore } from "@cargo/stores/cargo.store";
import { useCargoOffersStore } from "@cargo/stores/cargo_offers.store";
import type { CargoOffer } from "@cargo/services/cargo_offers.service";

const { t } = useI18n();
const ui = useUiStore();
const store = useCargoOffersStore();
const cargoStore = useCargoStore();
const { cargo } = storeToRefs(cargoStore);
const route = useRoute();

const id = computed(() => route.params.id as string | undefined);

function hasReply(o: CargoOffer): boolean {
  const s = String(o.data_risp ?? "");
  return !!s && s !== "0000-00-00 00:00:00";
}

const repliedCount = computed(() => store.rows.filter(hasReply).length);

/** Hay RFQ enviadas que aún no han contestado: se avisa en la barra. */
const hasPending = computed(
  () => store.total > 0 && repliedCount.value < store.total,
);

/**
 * Lado vettori — la oferta aceptada (ganadora) si existe; si no, la más
 * barata que haya respondido con un coste real.
 */
const highlight = computed(() => {
  const winner = store.rows.find((o) => o.accettata === "S");
  const pick =
    winner ??
    store.rows
      .filter((o) => hasReply(o) && Number(o.costo) > 0)
      .sort((a, b) => Number(a.costo) - Number(b.costo))[0];
  if (!pick) return null;
  const carrier =
    String(pick.vettore_nome ?? "") || String(pick.vettore_sigla ?? "") || "—";
  const cost = Number(pick.costo);
  const amount =
    cost > 0
      ? `${cost.toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })} ${pick.change_valuta ?? ""}`.trim()
      : "—";
  return { carrier, amount, isWinner: pick.accettata === "S" };
});

/**
 * Lado cliente — mismo mapeo de estado (N/V/A/R) que CargoOfferteBox, para
 * que barra y modal digan lo mismo.
 */
const clientOfferState = computed(() => {
  switch (String(cargo.value?.offerta ?? "N")) {
    case "A":
      return { label: t("cargo.offerte.off_accepted"), color: "success" };
    case "R":
      return { label: t("cargo.offerte.off_refused"), color: "error" };
    case "V":
      return { label: t("cargo.offerte.off_viewed"), color: "primary" };
    default:
      return { label: t("cargo.offerte.off_new"), color: "warning" };
  }
});

async function load(): Promise<void> {
  if (!id.value) return;
  await store.load(Number(id.value));
}

onMounted(load);
watch(id, load);
</script>

<style scoped>
.quote-menu :deep(.v-list-item-subtitle) {
  font-size: 11.5px;
}
</style>
