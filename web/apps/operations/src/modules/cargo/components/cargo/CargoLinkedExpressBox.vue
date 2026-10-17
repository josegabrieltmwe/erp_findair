<template>
  <!--
    Bloque INDEPENDIENTE de envíos express vinculados (recogida/entrega/handler).
    Antes vivía enterrado en un modal (Azioni → linked_express); ahora es una
    card propia del overview, siempre visible.

    Creación SIMPLE, sin recarga: cada botón "+ Crear …" hace POST
    ajax_shipment_from_cargo (el backend puebla la nueva expedición con los
    datos del cargo) y, al recibir el shipment_id, abre su detalle por el router.
    Es el mismo resultado que el legacy (`spedy&ti=new&idcargo=…&tpc=…`: crea y
    muestra), pero dentro de la SPA.
  -->
  <component
    :is="embedded ? 'div' : 'section'"
    :class="embedded ? 'linked-embedded' : 'card-tmwe'"
  >
    <!-- Embebido (dentro de otra card): sub-header ligero en vez de CardHeader. -->
    <div v-if="embedded" class="linked-subhead">
      <v-icon icon="mdi-link-variant" size="14" />
      <span>{{ t("cargo.linked.title") }}</span>
      <v-chip
        v-if="links.length"
        size="x-small"
        variant="tonal"
        color="primary"
        class="ms-1"
      >
        {{ links.length }}
      </v-chip>
    </div>
    <CardHeader v-else icon="mdi-link-variant" :title="t('cargo.linked.title')">
      <template #badge>
        <v-chip
          v-if="links.length"
          size="x-small"
          variant="tonal"
          color="primary"
        >
          {{ links.length }}
        </v-chip>
      </template>
    </CardHeader>

    <!-- Legs ya creadas: abren su detalle express. -->
    <InfoRow
      v-for="link in links"
      :key="link.role"
      :icon="link.icon"
      :title="link.title"
      :subtitle="link.subtitle"
      clickable
      @click="openShipment(link.id)"
    >
      <template #append>
        <v-icon icon="mdi-open-in-new" size="16" class="text-medium-emphasis" />
      </template>
    </InfoRow>

    <!-- Sin ninguna leg todavía. -->
    <div v-if="!links.length && !missingRoles.length" class="linked-empty">
      {{ t("cargo.linked.none") }}
    </div>

    <!-- Crear las legs que faltan. -->
    <div v-if="missingRoles.length" class="linked-create">
      <div class="linked-create__label">
        {{ t("cargo.linked.create_prompt") }}
      </div>
      <div class="linked-create__btns">
        <v-btn
          v-for="r in missingRoles"
          :key="r.tpc"
          size="small"
          variant="tonal"
          :prepend-icon="r.icon"
          :loading="creating === r.tpc"
          :disabled="creating !== null"
          @click="createLeg(r.tpc)"
        >
          {{ r.label }}
        </v-btn>
      </div>
    </div>
  </component>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";
import { storeToRefs } from "pinia";
import { useCargoStore } from "@cargo/stores/cargo.store";
import { useToastStore } from "@cargo/stores/toast.store";
import {
  linkedExpressService,
  type LinkedExpressTpc,
} from "@cargo/services/linked_express.service";
import CardHeader from "@cargo/components/shell/CardHeader.vue";
import InfoRow from "@cargo/components/shell/InfoRow.vue";

defineProps<{
  /** Embebido dentro de otra card (Direcciones): sin marco/CardHeader propio,
      solo un sub-header ligero. */
  embedded?: boolean;
}>();

const { t } = useI18n();
const router = useRouter();
const store = useCargoStore();
const toasts = useToastStore();
const { cargo } = storeToRefs(store);

interface LinkItem {
  role: string;
  id: number;
  title: string;
  subtitle: string;
  icon: string;
}

const links = computed<LinkItem[]>(() => {
  const s = cargo.value;
  if (!s) return [];
  const out: LinkItem[] = [];
  const part = Number(s.id_spediz_part);
  if (part > 0) {
    out.push({
      role: "pickup",
      id: part,
      title: t("cargo.linked.pickup_express", { id: part }),
      subtitle: t("cargo.linked.pickup_sub"),
      icon: "mdi-arrow-up-right",
    });
  }
  const dest = Number(s.id_spediz_dest);
  if (dest > 0) {
    out.push({
      role: "delivery",
      id: dest,
      title: t("cargo.linked.delivery_express", { id: dest }),
      subtitle: t("cargo.linked.delivery_sub"),
      icon: "mdi-arrow-down-right",
    });
  }
  const handl = Number(s.id_spediz_handl);
  if (handl > 0) {
    out.push({
      role: "handler",
      id: handl,
      title: t("cargo.linked.handler_express", { id: handl }),
      subtitle: t("cargo.linked.handler_sub"),
      icon: "mdi-warehouse",
    });
  }
  return out;
});

// Roles cuya leg express aún no existe → se ofrece crearla. tpc: P/D/H.
const missingRoles = computed(() => {
  const s = cargo.value;
  if (!s) return [];
  const defs: Array<{
    tpc: LinkedExpressTpc;
    label: string;
    icon: string;
    has: boolean;
  }> = [
    {
      tpc: "P",
      label: t("cargo.linked.role_pickup"),
      icon: "mdi-arrow-up-right",
      has: Number(s.id_spediz_part) > 0,
    },
    {
      tpc: "D",
      label: t("cargo.linked.role_delivery"),
      icon: "mdi-arrow-down-right",
      has: Number(s.id_spediz_dest) > 0,
    },
    {
      tpc: "H",
      label: t("cargo.indirizzi.handler"),
      icon: "mdi-warehouse",
      has: Number(s.id_spediz_handl) > 0,
    },
  ];
  return defs.filter((d) => !d.has);
});

const currentCargoId = computed<number>(() => {
  const n = Number(cargo.value?.id ?? store.id ?? 0);
  return Number.isFinite(n) ? n : 0;
});

// Botón en curso (tpc) — bloquea el resto mientras se crea.
const creating = ref<LinkedExpressTpc | null>(null);

function openShipment(id: number): void {
  void router.push({ name: "shipment-detail", params: { id: String(id) } });
}

async function createLeg(tpc: LinkedExpressTpc): Promise<void> {
  const cargoId = currentCargoId.value;
  if (!cargoId || creating.value !== null) return;
  creating.value = tpc;
  try {
    const res = await linkedExpressService.createFromCargo(cargoId, tpc);
    if (res.success && res.shipment_id) {
      // Crear y abrir el detalle de la nueva expedición (paridad legacy).
      openShipment(res.shipment_id);
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
    creating.value = null;
  }
}
</script>

<style scoped>
/* Sub-header ligero cuando el bloque va embebido dentro de otra card. */
.linked-subhead {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: rgb(var(--v-theme-on-surface-variant));
  opacity: 0.75;
  margin-bottom: 4px;
}
.linked-embedded {
  margin-top: 12px;
  padding-top: 10px;
  border-top: 1px solid
    rgba(var(--v-border-color), calc(var(--v-border-opacity) * 0.6));
}
.linked-empty {
  padding: 8px 2px;
  font-size: 12.5px;
  color: rgb(var(--v-theme-on-surface-variant));
  opacity: 0.75;
}
.linked-create {
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid
    rgba(var(--v-border-color), calc(var(--v-border-opacity) * 0.6));
}
.linked-create__label {
  font-size: 12px;
  color: rgb(var(--v-theme-on-surface-variant));
  margin-bottom: 8px;
}
.linked-create__btns {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
</style>
