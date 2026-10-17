<template>
  <div class="shipment-v2" :data-theme="ui.v2Theme">
    <DetailShell storage-key="tmwe:sidebar:operations" hide-platform-nav>
      <!-- ============ TOP BAR ============ -->
      <template #topbar-title>
        <div class="hblock">
          <div class="topbar-shipnum">#{{ shipment?.id ?? "—" }}</div>
          <button
            type="button"
            class="topbar-hmeta topbar-hmeta--editable"
            :title="
              subtitle ? 'Modifica date spedizione' : 'Imposta date spedizione'
            "
            @click="ui.openModal('dates')"
          >
            <span>{{ subtitle || "Imposta date" }}</span>
            <v-icon
              icon="mdi-pencil-outline"
              size="12"
              class="topbar-hmeta-edit"
            />
          </button>
        </div>

        <div class="topbar-sep" />

        <button class="hclient" type="button" @click="ui.openModal('cliente')">
          <span class="hclient-icon">
            <v-icon icon="mdi-account-outline" size="18" />
          </span>
          <span class="hclient-txt">
            <span class="hclient-name">{{ clientName }}</span>
            <span class="hclient-sub">{{ clientSubtitle }}</span>
          </span>
          <v-icon icon="mdi-pencil-outline" class="hclient-edit" />
        </button>

        <ShipmentOwnerChip class="ms-2" />
        <!-- Mini-estado (barra de progreso + etiqueta de estado) en la barra de
             título, junto al cliente/owner — misma posición que en el detalle
             de cargo (CargoDetailLayoutV2). Antes vivía en una fila de tabs
             propia (ShipmentTabsV2), que quedaba casi vacía tras quitar el tab
             de direcciones. -->
        <MiniStatusBar class="ms-2" @click="ui.openModal('stato')" />
      </template>

      <template #topbar-actions>
        <button
          type="button"
          class="topbar-iconbtn"
          :title="chatButtonTitle"
          @click="ui.openChat()"
        >
          <v-icon icon="mdi-chat-outline" size="18" />
          <span v-if="chat.hasUnread" class="topbar-iconbtn-dot" />
        </button>

        <!-- Aviso de comunicación pendiente: RFQ/ofertas enviadas sin
             respuesta. NO duplica el menú (que vive en ServizioCard, junto al
             proveedor que se cotiza): solo señala y lleva hasta él. Mismo
             recurso que el punto de no leídos del chat. -->
        <button
          v-if="quotePending > 0"
          type="button"
          class="topbar-iconbtn"
          :title="t('shipment.quote_menu.pending_hint', { n: quotePending })"
          @click="scrollToQuoteMenu"
        >
          <v-icon icon="mdi-email-fast-outline" size="18" />
          <span class="topbar-iconbtn-dot" />
        </button>

        <button
          type="button"
          class="topbar-iconbtn"
          title="Tracking events"
          @click="ui.openTracking()"
        >
          <v-icon icon="mdi-truck-fast" size="18" />
        </button>

        <!-- Botón de documentos en la topbar, misma posición que en cargo. Antes
             el drawer de docs solo se abría desde la pestaña lateral flotante. -->
        <button
          type="button"
          class="topbar-iconbtn"
          title="Documenti"
          @click="ui.openDoc()"
        >
          <v-icon icon="mdi-file-document-multiple-outline" size="18" />
        </button>

        <button
          type="button"
          class="topbar-iconbtn"
          title="Audit trail"
          @click="ui.openAudit()"
        >
          <v-icon icon="mdi-history" size="18" />
        </button>
        <!-- LDV / AWB printing lives in the ServizioCard "Stampa LDV / AWB"
             dropdown (single source of truth). The topbar HVB/AWB buttons were
             removed to avoid a second, degraded entry point. -->
      </template>

      <!-- Sin fila de tabs: la única pestaña (overview) es la vista por defecto
           y el mini-estado se movió a la barra de título, igual que en cargo. -->

      <!-- ============ NAV (menú universal) ============
        El MISMO OperationsNav que se ve en #/home y en los listados: el menú
        lateral no cambia al entrar al detalle. Sustituye a PlatformSidebar
        (suprimido con `hide-platform-nav`). -->
      <template #nav="{ collapsed }">
        <OperationsNav :collapsed="collapsed" />
      </template>

      <!-- ============ SIDEBAR (records navigator) — bajo #nav ============ -->
      <template #sidebar="{ collapsed }">
        <RecordsSidebarContent
          :navigator="navigator"
          :current-id="currentId"
          :rail="collapsed"
        />
      </template>

      <!-- ============ MAIN ============ -->
      <div class="stage">
        <slot :tab="activeTab" />
      </div>
    </DetailShell>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted } from "vue";
import { storeToRefs } from "pinia";
import { useRoute } from "vue-router";
import { useTheme } from "vuetify";
import { useShipmentStore } from "@shipment/stores/shipment.store";
import { useUiStore } from "@shipment/stores/ui.store";
import { useChatStore } from "@shipment/stores/chat.store";
import { useI18n } from "vue-i18n";
import { useExpressOffersStore } from "@shipment/stores/express_offers.store";
import { usePartnerOffersStore } from "@shipment/stores/partner_offers.store";
import { useRecordNavigator } from "@shipment/composables/useRecordNavigator";
import MiniStatusBar from "@shipment/components/shell/MiniStatusBar.vue";
import ShipmentOwnerChip from "@shipment/components/shipment/owner/ShipmentOwnerChip.vue";
import DetailShell from "@shared/detail/DetailShell.vue";
import OperationsNav from "@shared/platform/OperationsNav.vue";
import RecordsSidebarContent from "@shared/detail/RecordsSidebarContent.vue";

const ui = useUiStore();
const chat = useChatStore();

const { t } = useI18n();
const rfqStore = useExpressOffersStore();
const partnerStore = usePartnerOffersStore();

/**
 * Solicitudes enviadas (a couriers y partners) que aun no han contestado.
 * Solo alimenta el AVISO de la barra: el menu real vive en ServizioCard, junto
 * al proveedor que se esta cotizando.
 */
function pendingOf(rows: Array<{ data_risp?: string | null }>): number {
  return rows.filter(
    (o) => !o.data_risp || o.data_risp === "0000-00-00 00:00:00",
  ).length;
}

const quotePending = computed(
  () => pendingOf(rfqStore.offers) + pendingOf(partnerStore.offers),
);

/** Lleva al menu de comunicacion en lugar de duplicarlo en la barra. */
function scrollToQuoteMenu(): void {
  document
    .querySelector("[data-quote-menu]")
    ?.scrollIntoView({ behavior: "smooth", block: "center" });
}
const theme = useTheme();
const store = useShipmentStore();
const { shipment, id: currentIdRef } = storeToRefs(store);

const activeTab = ref<"overview">("overview");

const currentId = computed<number | null>(() => currentIdRef.value);

/**
 * Records navigator — promoted from the old off-canvas `ShipmentSidebar`
 * drawer to a persistent sidebar slot. The composable owns fetching and
 * caching; mounting it here lets the operator browse records without the
 * sidebar drawer ever taking over the screen.
 */
const navigator = useRecordNavigator(currentId);
const route = useRoute();

const chatButtonTitle = computed<string>(() => {
  if (!chat.hasUnread) return "Chat partner";
  const total = chat.counter?.total ?? 0;
  return `Chat partner · ${total} ${total === 1 ? "nuovo" : "nuovi"}`;
});

const clientName = computed<string>(
  () => (shipment.value?.cliente as string | undefined) || "Cliente —",
);

const clientSubtitle = computed<string>(() => {
  const parts: string[] = [];
  const codCliente = (shipment.value as { cod_cliente?: string } | null)
    ?.cod_cliente;
  if (codCliente) parts.push(`cod. ${codCliente}`);
  const city = (shipment.value as { city_cliente?: string } | null)
    ?.city_cliente;
  if (city) parts.push(city);
  return parts.length ? `Cliente · ${parts.join(" ")}` : "Cliente";
});

const subtitle = computed<string>(() => {
  const date =
    (shipment.value as { data_sped0?: string } | null)?.data_sped0 ||
    (shipment.value as { data_sped1?: string } | null)?.data_sped1;
  if (!date) return "";
  const m = date.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return "";
  return `spedita il ${m[3]}/${m[2]}/${m[1]}`;
});

onMounted(() => {
  // `<v-app :theme="ui.vuetifyThemeName">` already drives the global
  // theme; this just nudges Vuetify in case the prop hasn't propagated
  // yet on first mount (e.g. SSR-style hydration timing).
  theme.global.name.value = ui.vuetifyThemeName;
  // Eagerly load the navigator since the sidebar is always mounted now
  // (previously deferred until the user opened the off-canvas drawer).
  // `ensureLoaded` requires the current route query to parse list filters —
  // calling it bare with no argument bubbled an "undefined.type" TypeError
  // through Vue's onMounted, leaving the whole tree in a skeleton state.
  void navigator.ensureLoaded(route.query);
});
</script>

<style scoped lang="scss">
.shipment-v2 {
  min-height: 100vh;
  background: rgb(var(--v-theme-background));
  color: rgb(var(--v-theme-on-background));
}

/* Local typography helpers used inside the topbar-title slot — the
   classes themselves are defined in mockup2.scss but we re-state the
   layout glue here so the template stays self-contained. */
.hblock {
  display: flex;
  flex-direction: column;
}
.topbar-hmeta--editable {
  background: transparent;
  border: none;
  padding: 0;
  font: inherit;
  color: inherit;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  text-align: left;
}
.topbar-hmeta-edit {
  opacity: 0;
  transition: opacity 0.15s ease;
}
.topbar-hmeta--editable:hover {
  color: rgb(var(--v-theme-primary));
}
.topbar-hmeta--editable:hover .topbar-hmeta-edit {
  opacity: 0.8;
}
.hclient-txt {
  display: flex;
  flex-direction: column;
  text-align: left;
}
</style>
