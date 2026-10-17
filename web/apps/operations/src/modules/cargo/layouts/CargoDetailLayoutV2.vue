<template>
  <div class="shipment-v2" :data-theme="ui.v2Theme">
    <DetailShell storage-key="tmwe:sidebar:operations" hide-platform-nav>
      <!-- ============ TOP BAR ============ -->
      <template #topbar-title>
        <div class="hblock">
          <div class="topbar-shipnum">#{{ cargo?.id ?? "—" }}</div>
          <div class="topbar-hmeta">{{ subtitle }}</div>
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

        <BookingStatusBadge />
        <CargoOwnerChip class="ms-2" />
        <!-- Mini-estado (barra de progreso + "En proceso") movido aquí desde la
             fila de tabs: vive en la barra de título junto al cliente/estado. -->
        <CargoMiniStatusBar class="ms-2" @click="ui.openModal('stato')" />
      </template>

      <template #topbar-actions>
        <!-- Menú de impresión: todo lo que genera PDF/imagen (docs AWB + LDV),
             con imprimir y descargar en ambos formatos donde aplique. -->
        <CargoPrintMenu />

        <!-- Cotización (RFQ a vettori + oferta al cliente). Vive en la barra
             junto a chat/documentos porque es COMUNICACIÓN, no un dato de la
             ficha: sustituye a la card del Overview, que gastaba una franja
             para dos cifras que el modal ya repite. -->
        <CargoQuoteMenu />

        <button
          type="button"
          class="topbar-iconbtn"
          :title="chatButtonTitle"
          @click="ui.openChat()"
        >
          <v-icon icon="mdi-chat-outline" size="18" />
          <span v-if="chat.hasUnread" class="topbar-iconbtn-dot" />
        </button>

        <button
          type="button"
          class="topbar-iconbtn"
          :title="t('cargo.azioni.documents')"
          @click="ui.openDoc()"
        >
          <v-icon icon="mdi-file-document-multiple-outline" size="18" />
        </button>

        <button
          type="button"
          class="topbar-iconbtn"
          :title="t('cargo.audit.title')"
          @click="ui.openAudit()"
        >
          <v-icon icon="mdi-history" size="18" />
        </button>

        <!-- "Envíos express vinculados" se movió a la card Direcciones (acceso
             claro con botones de crear); ya no vive en un popover de la topbar. -->

        <!--
          The MAWB/HAWB print fast-path buttons were removed from the topbar:
          all AWB document actions (print + email + share) now live in a single
          place — AwbDocsBar inside the MAWB modal's "Docs y HAWB" tab — so the
          topbar no longer duplicates them.
        -->
      </template>

      <!-- Sin fila de tabs: no hay selector de pestañas (vista única por
           modales) y el mini-estado se movió a la barra de título. -->

      <!-- ============ NAV (menú universal) ============
        El MISMO OperationsNav que se ve en #/home y en los listados: el menú
        lateral no cambia al entrar al detalle. Sustituye a PlatformSidebar
        (suprimido con `hide-platform-nav`). -->
      <template #nav="{ collapsed }">
        <OperationsNav :collapsed="collapsed" />
      </template>

      <!-- ============ SIDEBAR (records navigator) ============
        Only injected when the URL carries filter params; without filters
        the operator is viewing a single cargo and the cross-record list
        is meaningless. The slot is omitted entirely so the sidebar shows
        just the navigation. Renders BELOW #nav. -->
      <template v-if="navigator.total.value > 0" #sidebar="{ collapsed }">
        <RecordsSidebarContent
          :navigator="navigator"
          :current-id="currentId"
          :rail="collapsed"
          :filter-label="filterLabel"
          :on-back="backToList"
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
import { useI18n } from "vue-i18n";
import { computed, ref, onMounted, onBeforeUnmount } from "vue";
import { storeToRefs } from "pinia";
import { useRoute, useRouter } from "vue-router";
import { useTheme } from "vuetify";
import { useCargoStore } from "@cargo/stores/cargo.store";
import { useUiStore } from "@cargo/stores/ui.store";
import { useChatStore } from "@cargo/stores/chat.store";
import { useRecordNavigator } from "@cargo/composables/useRecordNavigator";
import CargoMiniStatusBar from "@cargo/components/shell/CargoMiniStatusBar.vue";
import CargoPrintMenu from "@cargo/components/cargo/CargoPrintMenu.vue";
import CargoQuoteMenu from "@cargo/components/cargo/CargoQuoteMenu.vue";
import BookingStatusBadge from "@cargo/components/cargo/booking/BookingStatusBadge.vue";
import CargoOwnerChip from "@cargo/components/cargo/owner/CargoOwnerChip.vue";
import DetailShell from "@shared/detail/DetailShell.vue";
import OperationsNav from "@shared/platform/OperationsNav.vue";
import RecordsSidebarContent from "@shared/detail/RecordsSidebarContent.vue";
import {
  findKpiForListing,
  kpiLabel,
} from "@shared/dashboard/home_kpi_catalog";

const { t } = useI18n();
const ui = useUiStore();
const chat = useChatStore();
const theme = useTheme();
const cargoStore = useCargoStore();
const route = useRoute();
const router = useRouter();
const { cargo, clientName: clientNameRef } = storeToRefs(cargoStore);

/**
 * Compact label of the active listing filter — used by the records
 * sidebar header so the operator knows what cohort of cargos they're
 * stepping through. Falls back to a generic copy.
 */
const filterLabel = computed<string>(() => {
  const type = String(route.query.type ?? "");
  const kpi = findKpiForListing(
    "cargo-list",
    type,
    String(route.query.kpi ?? ""),
  );
  if (kpi) return kpiLabel(t, kpi);
  if (type && type !== "all") return type;
  return t("shell.recnav.filtered_list");
});

function backToList(): void {
  void router.push({
    name: "cargo-list",
    query: { ...route.query, restore: "1" },
  });
}

/* ---------- vim-style chord state for "g g" (first record) ---------- */
let chord: "idle" | "g" = "idle";
let chordTimer: number | null = null;
function clearChord(): void {
  chord = "idle";
  if (chordTimer !== null) window.clearTimeout(chordTimer);
  chordTimer = null;
}
function goFirstRecord(): void {
  const first = navigator.records.value[0];
  if (first) navigator.goTo(first.id);
}
function goLastRecord(): void {
  const arr = navigator.records.value;
  const last = arr[arr.length - 1];
  if (last) navigator.goTo(last.id);
}

function onKey(e: KeyboardEvent): void {
  // Only act when the navigator is actually populated; otherwise the
  // detail page was opened directly and the operator doesn't have a
  // cohort to step through.
  if (navigator.total.value === 0) return;

  const t = e.target as HTMLElement | null;
  if (t && (t.matches("input,textarea,select") || t.isContentEditable)) return;
  if (e.metaKey || e.ctrlKey || e.altKey) return;

  if (chord === "g") {
    clearChord();
    if (e.key === "g") {
      e.preventDefault();
      goFirstRecord();
      return;
    }
    return;
  }

  switch (e.key) {
    case "Escape":
      e.preventDefault();
      backToList();
      return;
    case "ArrowLeft":
    case "k":
      if (navigator.hasPrev.value) {
        e.preventDefault();
        navigator.goPrev();
      }
      return;
    case "ArrowRight":
    case "j":
      if (navigator.hasNext.value) {
        e.preventDefault();
        navigator.goNext();
      }
      return;
    case "g":
      chord = "g";
      if (chordTimer !== null) window.clearTimeout(chordTimer);
      chordTimer = window.setTimeout(clearChord, 800);
      return;
    case "G":
      e.preventDefault();
      goLastRecord();
      return;
  }
}

// Active tab is held in the ui store so overview cards can deep-link into the
// "Voli & MAWB" tab (ui.goToTab('flights')).
const activeTab = computed({
  get: () => ui.activeCargoTab,
  set: (v: "overview" | "flights") => ui.goToTab(v),
});

const currentId = computed<number | null>(() => cargoStore.id);
const navigator = useRecordNavigator(currentId);

const chatButtonTitle = computed<string>(() => {
  if (!chat.hasUnread) return "Chat partner";
  const total = chat.counter?.total ?? 0;
  return `Chat partner · ${total} ${total === 1 ? "nuovo" : "nuovi"}`;
});

const clientName = computed<string>(
  () =>
    clientNameRef.value ||
    (cargo.value?.cliente as string | undefined) ||
    "Cliente —",
);

const clientSubtitle = computed<string>(() => {
  const parts: string[] = [];
  const paese = cargo.value?.paese_sed as string | undefined;
  if (paese) parts.push(paese);
  const rif = cargo.value?.RIF_cliente || cargo.value?.rif_cliente;
  if (rif) parts.push(`rif ${rif}`);
  return parts.length ? `Cliente · ${parts.join(" · ")}` : "Cliente";
});

const subtitle = computed<string>(() => {
  const date = cargo.value?.data_sped0 || cargo.value?.data_sped1;
  if (!date) return "";
  const m = String(date).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return "";
  return `del ${m[3]}/${m[2]}/${m[1]}`;
});

onMounted(() => {
  theme.global.name.value = ui.v2VuetifyThemeName;
  void navigator.ensureLoaded(route.query);
  document.addEventListener("keydown", onKey);
});
onBeforeUnmount(() => {
  document.removeEventListener("keydown", onKey);
  clearChord();
});
</script>

<style scoped lang="scss">
.shipment-v2 {
  min-height: 100vh;
  background: rgb(var(--v-theme-background));
  color: rgb(var(--v-theme-on-background));
}

.hblock {
  display: flex;
  flex-direction: column;
}
.hclient-txt {
  display: flex;
  flex-direction: column;
  text-align: left;
}
.ldvbtn.is-loading {
  pointer-events: none;
  opacity: 0.7;
}
</style>
