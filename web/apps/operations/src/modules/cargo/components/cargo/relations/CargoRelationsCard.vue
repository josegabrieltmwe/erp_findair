<template>
  <section class="card-tmwe">
    <CardHeader icon="mdi-link-variant" :title="t('cargo.relations.title')" />
    <div>
      <v-skeleton-loader v-if="loading" type="list-item-three-line" />
      <template v-else-if="data">
        <div class="rel-block">
          <div class="rel-block__label">
            <v-icon icon="mdi-account-cog-outline" size="14" /> CRM
          </div>
          <div
            v-if="data.crm && data.crm_allowed !== false"
            class="rel-block__value"
          >
            <button
              type="button"
              class="rel-link"
              data-testid="crm-open"
              @click="openCrm(data.crm.id)"
            >
              {{ crmStatusLabel(data.crm.stato_pratica) }}
              <v-chip
                v-if="crmItems.length > 1"
                size="x-small"
                variant="tonal"
                >{{ crmItems.length }}</v-chip
              >
            </button>
          </div>
          <!-- Sin pratica: crear (find-or-create, paridad legacy). -->
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
            {{ t("cargo.relations.create_crm") }}
          </button>
          <div v-else class="rel-unavailable" data-testid="crm-unavailable">
            <v-icon icon="mdi-information-outline" size="14" />
            {{ t("crm.context.unavailable_cargo") }}
          </div>
        </div>

        <div class="rel-block">
          <div class="rel-block__label">
            <v-icon icon="mdi-warehouse" size="14" />
            {{ t("cargo.relations.giacenze") }}
            <v-chip
              v-if="data.giacenze.length"
              size="x-small"
              variant="tonal"
              class="ms-1"
              >{{ data.giacenze.length }}</v-chip
            >
          </div>
          <ul v-if="data.giacenze.length" class="rel-list">
            <li v-for="g in data.giacenze" :key="g.id">
              <a :href="g.legacy_url" target="_blank" rel="noopener"
                >{{ g.code || t("cargo.relations.giac_item", { id: g.id }) }}
                <span v-if="g.quantity > 0">({{ g.quantity }})</span></a
              >
            </li>
          </ul>
          <!-- Las giacenze (retenciones en almacén) son un concepto COURIER;
               no hay giacenze de cargo aéreo (0 en BD). Solo se muestran si por
               algún motivo existiesen; no se ofrece crearlas desde el cargo. -->
          <div v-else class="rel-block__value rel-block__value--empty">—</div>
        </div>

        <div class="rel-block">
          <div class="rel-block__label">
            <v-icon icon="mdi-file-document-outline" size="14" />
            {{ t("cargo.relations.fatture") }}
            <v-chip size="x-small" variant="tonal" class="ms-1">{{
              data.fatture.length
            }}</v-chip>
          </div>
          <ul v-if="data.fatture.length" class="rel-list">
            <li v-for="f in data.fatture" :key="`${f.kind}-${f.id}`">
              <a :href="f.legacy_url" target="_blank" rel="noopener">{{
                fatturaLabel(f)
              }}</a>
            </li>
          </ul>
          <!-- Genera fattura de ESTE cargo (paridad legacy fattsw3): abre la SPA
               invoicing con el cliente preseleccionado y restringida a este cargo.
               Visible hasta que esté totalmente facturado. -->
          <a
            v-if="canBill"
            :href="billUrl"
            target="_blank"
            rel="noopener"
            class="rel-bill"
          >
            <v-icon
              icon="mdi-receipt-text-plus-outline"
              size="14"
              class="me-1"
            />
            {{ t("cargo.relations.generate_invoice") }}
          </a>
        </div>
      </template>
    </div>
  </section>
  <CrmContextDrawer
    v-if="data"
    ref="crmDrawer"
    v-model="crmDrawerOpen"
    entity-kind="cargo"
    :shipment-id="Number(id ?? 0)"
    :items="crmItems"
    :initial-id="crmInitialId"
    @changed="load"
  />
</template>

<script setup lang="ts">
import { useI18n } from "vue-i18n";
import { ref, computed, onMounted, watch } from "vue";
import { storeToRefs } from "pinia";
import { useCargoStore } from "@cargo/stores/cargo.store";
import { useToastStore } from "@cargo/stores/toast.store";
import CardHeader from "@cargo/components/shell/CardHeader.vue";
import {
  cargoRelationsService,
  type CargoRelations,
} from "@cargo/services/cargo_pricing.service";
import { crmService } from "@/modules/crm/services/crm.service";
import CrmContextDrawer, {
  type CrmContextItem,
  type CrmContextDrawerHandle,
} from "@/modules/crm/components/CrmContextDrawer.vue";
import type { CrmPratica } from "@/modules/crm/types";

const { t } = useI18n();

const toasts = useToastStore();
const cargo = useCargoStore();
const { id, cargo: cargoData } = storeToRefs(cargo);
const data = ref<CargoRelations | null>(null);
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

function crmStatusLabel(status: string): string {
  return status === "A" || status === "C" || status === "L"
    ? t(`crm.stato.${status}`)
    : status || "—";
}

async function openCrm(crmId?: number, seed: CrmPratica | null = null) {
  if (data.value?.crm_allowed === false) return null;
  const nextId = crmId ?? crmItems.value[0]?.id ?? null;
  crmInitialId.value = nextId;
  if (!nextId) return null;
  if (crmDrawer.value) return crmDrawer.value.open(nextId, seed);
  crmDrawerOpen.value = true;
  return null;
}

// ── Crear pratica CRM desde el cargo (find-or-create, paridad legacy
//    spedyc_form.php botón crm). El CRM soporta cargo (id_spedizione LIKE '5%').
//    Las giacenze NO aplican al cargo (concepto courier). ──────
const crmBusy = ref(false);

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
          : "cargo.relations.crm_create_failed",
      ),
    );
  } finally {
    crmBusy.value = false;
  }
}

// Etiqueta legible de una factura (paridad con el card courier). El backend
// enriquece kind/numero/importo; se cae al id cuando no viene enriquecido.
type FatturaPointer = CargoRelations["fatture"][number];
const FATT_KIND_KEY: Record<string, string> = {
  FATT_A1: "cargo.relations.fatt_client",
  FATT_A2: "cargo.relations.fatt_client_post",
  FATT_P: "cargo.relations.fatt_supplier",
};
function fatturaLabel(f: FatturaPointer): string {
  const kind = FATT_KIND_KEY[f.kind] ? t(FATT_KIND_KEY[f.kind]) : f.kind;
  const num = f.number && f.number !== "0" ? ` n.${f.number}` : ` #${f.id}`;
  const amt = f.amount != null ? ` · ${f.amount.toLocaleString()} €` : "";
  return `${kind}${num}${amt}`;
}

function field<T = string>(name: string): T | undefined {
  return (cargoData.value as unknown as Record<string, T> | null)?.[name];
}

// Genera fattura (legacy fattsw3): visible hasta que el cargo esté totalmente
// facturado (id_fattura_a==0 OR id_fattura_a2==0).
const canBill = computed<boolean>(() => {
  const a1 = Number(field<string | number>("id_fattura_a") ?? 0);
  const a2 = Number(field<string | number>("id_fattura_a2") ?? 0);
  return a1 === 0 || a2 === 0;
});
const billUrl = computed<string>(() => {
  const base =
    (typeof window !== "undefined" && window.__TMWE_CARGO__?.basePath) ||
    "/bff/v1";
  const client = Number(field<string | number>("id_cliente") ?? 0);
  const shipId = Number(id.value ?? 0);
  const qs = new URLSearchParams({ new: "1" });
  if (client > 0) qs.set("client", String(client));
  if (shipId > 0) {
    qs.set("shipment", String(shipId));
    qs.set("tipo", "cargo");
  }
  return `${base}/invoicing?${qs.toString()}`;
});

async function load(): Promise<void> {
  if (!id.value) return;
  loading.value = true;
  try {
    data.value = await cargoRelationsService.get(Number(id.value));
  } finally {
    loading.value = false;
  }
}
onMounted(load);
watch(id, load);
</script>

<style scoped>
.rel-block {
  margin-bottom: 10px;
}
.rel-block__label {
  font-size: 11px;
  opacity: 0.7;
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
.rel-list {
  font-size: 12px;
  margin: 4px 0 0 0;
  padding-left: 16px;
}
.rel-list li {
  line-height: 1.4;
}
a {
  color: rgb(var(--v-theme-primary));
  text-decoration: none;
}
a:hover {
  text-decoration: underline;
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
.rel-bill {
  display: inline-flex;
  align-items: center;
  font-size: 12px;
  margin-top: 6px;
}
/* Botón crear (pratica/giacenza) cuando no existe. */
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
</style>
