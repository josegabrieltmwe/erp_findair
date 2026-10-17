<template>
  <section class="card-tmwe">
    <CardHeader
      icon="mdi-package-variant"
      :title="t('cargo.misure.title')"
      editable
      alt
      @edit="ui.openModal('colli')"
    />
    <!-- Filas horizontales (icono + label a la izquierda, valor a la derecha),
         mismo componente y altura que las de Accesorios (InfoRow). -->
    <div class="stat-grid">
      <InfoRow
        icon="mdi-package-variant-closed"
        :title="t('cargo.misure.packages')"
        :value="colli"
        clickable
        @click="ui.openModal('colli')"
      />
      <InfoRow
        icon="mdi-weight-kilogram"
        :title="t('cargo.misure.weight')"
        :value="`${pesoLabel} kg`"
        clickable
        @click="ui.openModal('colli')"
      />
      <InfoRow
        icon="mdi-cube-outline"
        :title="t('cargo.misure.volume')"
        :value="`${volumeLabel} m³`"
        clickable
        @click="ui.openModal('colli')"
      />
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { storeToRefs } from "pinia";
import { useCargoStore } from "@cargo/stores/cargo.store";
import { useUiStore } from "@cargo/stores/ui.store";
import CardHeader from "@cargo/components/shell/CardHeader.vue";
import InfoRow from "@cargo/components/shell/InfoRow.vue";

const { t } = useI18n();
const store = useCargoStore();
const { cargo, packages } = storeToRefs(store);
const ui = useUiStore();

function formatNum(v: unknown, decimals = 0): string {
  const n = Number(v ?? 0);
  if (!Number.isFinite(n)) return "—";
  return decimals > 0 ? n.toFixed(decimals) : String(Math.round(n));
}

const colli = computed<string>(() => {
  const fromCargo = cargo.value?.colli;
  if (fromCargo) return formatNum(fromCargo);
  // Fallback: count packages array
  return String(packages.value?.length ?? 0);
});

const pesoLabel = computed<string>(() => formatNum(cargo.value?.peso, 1));
const volumeLabel = computed<string>(() => {
  // Se calcula el m³ a partir de las DIMENSIONES (dim_a·dim_l·dim_p en cm ÷ 1e6),
  // NO del campo `volume` almacenado: ese campo es inconsistente en la BD —
  // las filas legacy guardan cm³ y las creadas por el flujo modern guardan m³
  // (Shipment_Packages_Service::calculate_volume). Recalcular desde las dims es
  // unit-agnostic y coincide con CargoPackagesBox.volumeOfMetric. Antes se
  // sumaba `volume` crudo y el tile mostraba millones de "m³" (eran cm³).
  const m3 = (packages.value ?? []).reduce((sum, p) => {
    const a = Number(p.dim_a ?? 0) || 0;
    const l = Number(p.dim_l ?? 0) || 0;
    const d = Number(p.dim_p ?? 0) || 0;
    return sum + (a * l * d) / 1_000_000;
  }, 0);
  return formatNum(m3, 3);
});
</script>

<style scoped lang="scss">
/* La card se estira a la altura de Accesorios (pair-row align-items:stretch);
   flex-column permite que el bloque de KPIs ocupe todo el alto disponible. */
.card-tmwe {
  display: flex;
  flex-direction: column;
}
/* Filas (bultos/peso/volumen) apiladas; se reparten el alto sobrante para que
   la card iguale la altura de Accesorios. Cada fila mantiene su contenido
   verticalmente centrado al estirarse. */
.stat-grid {
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex: 1;
}
.stat-grid > * {
  flex: 1;
}
.stat-grid :deep(.inforow) {
  align-items: center;
}
/* Sin línea separadora entre filas (anula el separador global de mockup2). */
.stat-grid :deep(.inforow + .inforow) {
  border-top: 0;
}
</style>
