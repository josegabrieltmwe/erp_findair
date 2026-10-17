<template>
  <section class="card-tmwe">
    <CardHeader
      icon="mdi-link-variant"
      :title="t('shipment.cards.relations.title')"
    />
    <div class="rel-body">
      <!-- Cargo | CRM side by side: both are single short links/states that
           wasted a full row each before. -->
      <div class="rel-grid">
        <!-- Linked cargo (legacy spedy_form.php `spedcrg` button → pp=spedyc). -->
        <div v-if="cargoId > 0" class="rel-block">
          <div class="rel-block__label">
            <v-icon icon="mdi-cube-send" size="14" />
            {{ t("shipment.cards.relations.cargo_linked") }}
          </div>
          <div class="rel-block__value">
            <a :href="cargoUrl" target="_blank" rel="noopener">{{
              t("shipment.cards.relations.cargo_link", { id: cargoId })
            }}</a>
          </div>
        </div>

        <div v-if="data" class="rel-block">
          <div class="rel-block__label">
            <v-icon icon="mdi-account-cog-outline" size="14" />
            {{ t("shipment.cards.relations.crm") }}
          </div>
          <div
            v-if="data.crm && data.crm_allowed !== false"
            class="rel-block__value d-flex align-center ga-2"
          >
            <span
              class="rel-dot"
              :class="crmStatusClass"
              :title="crmStatusTitle"
            />
            <button
              type="button"
              class="rel-link"
              data-testid="crm-open"
              @click="openCrm(data.crm.id)"
            >
              {{ crmStatusLabel }}
              <span v-if="crmItems.length > 1" class="rel-count">{{
                crmItems.length
              }}</span>
            </button>
          </div>
          <!-- Sin pratica: botón crear (find-or-create, paridad legacy
               spedy_form.php botón crm → pp=crm&ti=new). -->
          <button
            v-else-if="data.crm_allowed !== false"
            type="button"
            class="rel-create"
            data-testid="crm-create"
            :disabled="crmBusy"
            @click="createCrm"
          >
            <v-icon
              :icon="crmBusy ? 'mdi-loading' : 'mdi-plus-circle-outline'"
              :class="{ 'rel-spin': crmBusy }"
              size="14"
            />
            {{ t("shipment.cards.relations.crm_create") }}
          </button>
          <div v-else class="rel-unavailable" data-testid="crm-unavailable">
            <v-icon icon="mdi-information-outline" size="14" />
            {{ t("crm.context.unavailable_shipment") }}
          </div>
        </div>
      </div>

      <v-skeleton-loader v-if="loading" type="list-item-three-line" />
      <!-- Giacenze | Fatture lists side by side. -->
      <div v-else-if="data" class="rel-grid rel-grid--lists">
        <div class="rel-block">
          <div class="rel-block__label">
            <v-icon icon="mdi-warehouse" size="14" />
            {{ t("shipment.cards.relations.giacenze") }}
            <span v-if="data.giacenze.length" class="rel-count">{{
              data.giacenze.length
            }}</span>
          </div>
          <div v-if="data.giacenze.length" class="rel-items">
            <a
              v-for="g in data.giacenze"
              :key="g.id"
              :href="g.legacy_url"
              target="_blank"
              rel="noopener"
              class="rel-item"
            >
              <span
                class="rel-dot rel-item__dot"
                :class="
                  g.is_open === false ? 'rel-dot--closed' : 'rel-dot--open'
                "
                :title="
                  g.is_open === false
                    ? t('shipment.cards.relations.giac_closed')
                    : t('shipment.cards.relations.giac_open')
                "
              />
              <span class="rel-item__text">
                <span class="rel-item__title">{{
                  g.code ||
                  t("shipment.cards.relations.giac_item", { id: g.id })
                }}</span>
              </span>
              <span v-if="g.quantity > 0" class="rel-item__qty"
                >×{{ g.quantity }}</span
              >
              <v-icon icon="mdi-open-in-new" size="12" class="rel-item__ext" />
            </a>
          </div>
          <!-- Sin giacenza: botón crear (find-or-create + notificación GIAc,
               paridad legacy spedy_form.php botón giac → pp=giacenze&ti=new). -->
          <button
            v-else
            type="button"
            class="rel-create"
            :disabled="giacBusy"
            @click="createGiacenza"
          >
            <v-icon
              :icon="giacBusy ? 'mdi-loading' : 'mdi-plus-circle-outline'"
              :class="{ 'rel-spin': giacBusy }"
              size="14"
            />
            {{ t("shipment.cards.relations.giac_create") }}
          </button>
        </div>

        <div class="rel-block">
          <div class="rel-block__label">
            <v-icon icon="mdi-file-document-outline" size="14" />
            {{ t("shipment.cards.relations.fatture") }}
            <span v-if="data.fatture.length" class="rel-count">{{
              data.fatture.length
            }}</span>
          </div>
          <div v-if="data.fatture.length" class="rel-items">
            <a
              v-for="f in data.fatture"
              :key="`${f.kind}-${f.id}`"
              :href="f.legacy_url"
              target="_blank"
              rel="noopener"
              class="rel-item"
              :class="`rel-item--${fatturaTone(f.kind)}`"
            >
              <v-icon
                :icon="fatturaIcon(f.kind)"
                size="15"
                class="rel-item__icon"
              />
              <span class="rel-item__text">
                <span class="rel-item__title">{{ fatturaTitle(f) }}</span>
                <span v-if="f.amount != null" class="rel-item__amount">{{
                  formatAmount(f.amount)
                }}</span>
              </span>
              <v-icon icon="mdi-open-in-new" size="12" class="rel-item__ext" />
            </a>
          </div>
          <div v-else class="rel-empty">—</div>
        </div>
      </div>
    </div>
  </section>
  <CrmContextDrawer
    v-if="data"
    ref="crmDrawer"
    v-model="crmDrawerOpen"
    entity-kind="shipment"
    :shipment-id="Number(id ?? 0)"
    :items="crmItems"
    :initial-id="crmInitialId"
    @changed="load"
  />
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";
import { storeToRefs } from "pinia";
import { useShipmentStore } from "@shipment/stores/shipment.store";
import { useToastStore } from "@shipment/stores/toast.store";
import CardHeader from "@shipment/components/shell/CardHeader.vue";
import {
  shipmentRelationsService,
  type ShipmentRelations,
  type FatturaPointer,
} from "@shipment/services/shipment_drawers.service";
import { crmService } from "@/modules/crm/services/crm.service";
import CrmContextDrawer, {
  type CrmContextItem,
  type CrmContextDrawerHandle,
} from "@/modules/crm/components/CrmContextDrawer.vue";
import type { CrmPratica } from "@/modules/crm/types";
import { giacenzeService } from "@/modules/giacenze/services/giacenze.service";

const { t } = useI18n();
const router = useRouter();
const toasts = useToastStore();
const store = useShipmentStore();
const { id, shipment } = storeToRefs(store);
const data = ref<ShipmentRelations | null>(null);
const loading = ref(false);
const crmDrawerOpen = ref(false);
const crmDrawer = ref<CrmContextDrawerHandle | null>(null);
const crmInitialId = ref<number | null>(null);
const crmItems = computed<CrmContextItem[]>(() => {
  if (data.value?.crm_allowed === false) return [];
  return data.value?.crms?.length
    ? data.value.crms
    : data.value?.crm
      ? [data.value.crm]
      : [];
});

async function openCrm(crmId?: number, seed: CrmPratica | null = null) {
  if (data.value?.crm_allowed === false) return null;
  const nextId = crmId ?? crmItems.value[0]?.id ?? null;
  crmInitialId.value = nextId;
  if (!nextId) return null;
  if (crmDrawer.value) return crmDrawer.value.open(nextId, seed);
  crmDrawerOpen.value = true;
  return null;
}

// Invoice pointer presentation (legacy fattsw/fattsw1/fattfw). Kind →
// i18n title key, mdi icon and semantic tone (cliente vs proveedor).
const FATT_KIND_KEY: Record<string, string> = {
  FATT_A1: "shipment.cards.relations.fatt_client",
  FATT_A2: "shipment.cards.relations.fatt_client_post",
  FATT_P: "shipment.cards.relations.fatt_supplier",
};
const FATT_KIND_ICON: Record<string, string> = {
  FATT_A1: "mdi-receipt-text-outline",
  FATT_A2: "mdi-receipt-text-plus-outline",
  FATT_P: "mdi-receipt-text-arrow-left-outline",
};
const FATT_KIND_TONE: Record<string, string> = {
  FATT_A1: "client",
  FATT_A2: "client",
  FATT_P: "supplier",
};

// Título: "<tipo> n.<numero>" (o "#<id>" si no está enriquecido). El importe
// va aparte (rel-item__amount) para poder alinearlo a la derecha.
function fatturaTitle(f: FatturaPointer): string {
  const kind = FATT_KIND_KEY[f.kind] ? t(FATT_KIND_KEY[f.kind]) : f.kind;
  const num = f.number && f.number !== "0" ? ` n.${f.number}` : ` #${f.id}`;
  return `${kind}${num}`;
}
function fatturaIcon(kind: string): string {
  return FATT_KIND_ICON[kind] ?? "mdi-receipt-text-outline";
}
function fatturaTone(kind: string): string {
  return FATT_KIND_TONE[kind] ?? "client";
}
function formatAmount(amount: number): string {
  return `${amount.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} €`;
}

// Linked cargo (legacy spedy_form.php spedcrg button → pp=spedyc).
const cargoId = computed<number>(() => Number(shipment.value?.id_cargo ?? 0));
const cargoUrl = computed<string>(() => {
  const base =
    (typeof window !== "undefined" && window.__TMWE_SHIPMENT__?.basePath) ||
    "/bff/v1";
  return `${base}/cargo/${cargoId.value}`;
});

// CRM status colour (legacy: A=aperta→red, C/closed→green, else→grey).
const crmStatusClass = computed<string>(() => {
  const s = data.value?.crm?.stato_pratica ?? "";
  if (s === "A") return "rel-dot--open";
  if (s === "C") return "rel-dot--closed";
  return s !== "" ? "rel-dot--other" : "rel-dot--none";
});
const crmStatusTitle = computed<string>(() => {
  const s = data.value?.crm?.stato_pratica ?? "";
  if (s === "A") return t("shipment.cards.relations.crm_open");
  if (s === "C") return t("shipment.cards.relations.crm_closed");
  return s !== ""
    ? t("shipment.cards.relations.crm_state", { s })
    : t("shipment.cards.relations.crm_none");
});
// Texto legible del enlace CRM (antes se mostraba la letra cruda A/C).
const crmStatusLabel = computed<string>(() => {
  const s = data.value?.crm?.stato_pratica ?? "";
  if (s === "A") return t("shipment.cards.relations.crm_open");
  if (s === "C") return t("shipment.cards.relations.crm_closed");
  return s !== "" ? s : "—";
});

// ── Crear pratica / giacenza desde la expedición (find-or-create, paridad
//    legacy: los botones crm/giac de spedy_form.php abren-o-crean). ──────
const crmBusy = ref(false);
const giacBusy = ref(false);

async function createCrm(): Promise<void> {
  const sid = Number(id.value ?? 0);
  if (!sid || crmBusy.value || data.value?.crm_allowed === false) return;
  crmBusy.value = true;
  let caseResolved = false;
  let wasCreated = false;
  try {
    const pratica = await crmService.createFromShipment(sid);
    caseResolved = true;
    wasCreated = pratica.created === true;
    const refreshRelations = load().then(
      () => true,
      () => false,
    );
    const result = await openCrm(pratica.id, pratica);
    await refreshRelations;
    if (result?.state === "ready") {
      toasts.push(
        "success",
        t(wasCreated ? "crm.context.created" : "crm.context.existing_opened"),
      );
    } else if (result?.state === "partial") {
      toasts.push(
        "warning",
        t(
          wasCreated
            ? "crm.context.created_partial"
            : "crm.context.existing_partial",
        ),
      );
    } else {
      toasts.push(
        "warning",
        t(
          wasCreated
            ? "crm.context.created_open_error"
            : "crm.context.existing_open_error",
        ),
      );
    }
  } catch {
    toasts.push(
      caseResolved ? "warning" : "error",
      t(
        caseResolved
          ? wasCreated
            ? "crm.context.created_open_error"
            : "crm.context.existing_open_error"
          : "shipment.cards.relations.crm_create_failed",
      ),
    );
  } finally {
    crmBusy.value = false;
  }
}

async function createGiacenza(): Promise<void> {
  const sid = Number(id.value ?? 0);
  if (!sid || giacBusy.value) return;
  giacBusy.value = true;
  try {
    const g = await giacenzeService.createFromShipment(sid);
    toasts.push("success", t("shipment.cards.relations.giac_created"));
    router.push({ name: "giacenze", query: { id: String(g.id) } });
    // Refresca el bloque para que aparezca el enlace en vez del botón.
    await load();
  } catch {
    toasts.push("error", t("shipment.cards.relations.giac_create_failed"));
  } finally {
    giacBusy.value = false;
  }
}

async function load(): Promise<void> {
  if (!id.value) return;
  loading.value = true;
  try {
    data.value = await shipmentRelationsService.get(Number(id.value));
  } finally {
    loading.value = false;
  }
}
onMounted(load);
watch(id, load);
</script>

<style scoped>
/* Now wrapped in .card-tmwe + CardHeader like every other overview card, for a
   consistent frame (padding / radius / header). */
.card-tmwe {
  container-type: inline-size;
}
/* Two relation blocks side by side (cargo|crm, giacenze|fatture) — they were
   single short links/short lists wasting a full row each. */
.rel-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  column-gap: 16px;
}
.rel-grid--lists {
  align-items: start;
}
@container (max-width: 420px) {
  .rel-grid {
    grid-template-columns: 1fr;
  }
}
.rel-block {
  margin-bottom: 10px;
}
.rel-block:last-child {
  margin-bottom: 0;
}
.rel-link {
  appearance: none;
  border: 0;
  padding: 0;
  background: transparent;
  color: rgb(var(--v-theme-primary));
  font: inherit;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.rel-link:hover {
  text-decoration: underline;
}
.rel-link:focus-visible {
  outline: 2px solid rgb(var(--v-theme-primary));
  outline-offset: 3px;
  border-radius: 2px;
}
.rel-unavailable {
  margin-top: 3px;
  display: flex;
  align-items: center;
  gap: 5px;
  color: rgba(var(--v-theme-on-surface), 0.55);
  font-size: 12px;
}
.rel-block__label {
  font-size: 11px;
  opacity: 0.6;
  display: flex;
  align-items: center;
  gap: 4px;
}
.rel-block__value {
  font-size: 13px;
  margin-top: 2px;
}
.rel-block__value--empty {
  opacity: 0.4;
}

/* Contador junto al label (pill discreto en vez de v-chip pesado). */
.rel-count {
  font-size: 10px;
  font-weight: 700;
  line-height: 1;
  padding: 2px 6px;
  border-radius: 999px;
  background: rgba(var(--v-theme-primary), 0.12);
  color: rgb(var(--v-theme-primary));
}

/* Botón "crear" (pratica/giacenza) cuando no existe — discreto, tonal. */
.rel-create {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin-top: 4px;
  padding: 4px 10px;
  font-size: 12px;
  font-weight: 600;
  border-radius: 8px;
  color: rgb(var(--v-theme-primary));
  background: rgba(var(--v-theme-primary), 0.1);
  cursor: pointer;
  transition: background-color 0.12s ease;
}
.rel-create:hover:not(:disabled) {
  background: rgba(var(--v-theme-primary), 0.18);
}
.rel-create:disabled {
  opacity: 0.5;
  cursor: default;
}
.rel-spin {
  animation: rel-spin 0.8s linear infinite;
}
@keyframes rel-spin {
  to {
    transform: rotate(360deg);
  }
}
/* Punto de estado dentro de la fila giacenza (semáforo abierto/cerrado). */
.rel-item__dot {
  flex: 0 0 auto;
}

/* Lista de relaciones como filas clicables (icono · texto · abrir), en vez de
   <li> con bullet + link subrayado. */
.rel-items {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-top: 4px;
}
.rel-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 5px 8px;
  border-radius: 8px;
  text-decoration: none;
  color: rgb(var(--v-theme-on-surface));
  transition: background-color 0.12s ease;
}
.rel-item:hover {
  background: rgba(var(--v-theme-on-surface), 0.06);
  text-decoration: none;
}
.rel-item__icon {
  flex: 0 0 auto;
  color: rgb(var(--v-theme-primary));
  opacity: 0.85;
}
/* Tono semántico del icono por tipo de factura. */
.rel-item--supplier .rel-item__icon {
  color: rgb(var(--v-theme-warning));
}
.rel-item__text {
  flex: 1 1 auto;
  min-width: 0;
  display: flex;
  flex-direction: column;
  line-height: 1.25;
  font-size: 12.5px;
}
/* Trunca el título/código largo con puntos suspensivos en vez de romper la
   fila (giacenze y facturas usan la misma estructura anidada). */
.rel-item__title {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.rel-item__amount {
  font-size: 11px;
  opacity: 0.6;
  font-variant-numeric: tabular-nums;
}
.rel-item__qty {
  flex: 0 0 auto;
  font-size: 11px;
  font-weight: 600;
  opacity: 0.55;
  font-variant-numeric: tabular-nums;
}
.rel-item__ext {
  flex: 0 0 auto;
  opacity: 0;
  color: rgb(var(--v-theme-primary));
  transition: opacity 0.12s ease;
}
.rel-item:hover .rel-item__ext {
  opacity: 0.7;
}
.rel-empty {
  font-size: 12px;
  opacity: 0.35;
  margin-top: 4px;
  padding-left: 2px;
}
.rel-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  display: inline-block;
  flex: 0 0 auto;
}
.rel-dot--open {
  background: rgb(var(--v-theme-error));
}
.rel-dot--closed {
  background: rgb(var(--v-theme-success));
}
.rel-dot--other {
  background: rgb(var(--v-theme-warning));
}
.rel-dot--none {
  background: rgba(var(--v-theme-on-surface), 0.2);
}
a {
  color: rgb(var(--v-theme-primary));
  text-decoration: none;
}
a:hover {
  text-decoration: underline;
}
</style>
