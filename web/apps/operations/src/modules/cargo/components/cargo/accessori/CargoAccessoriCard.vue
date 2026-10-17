<template>
  <section class="card-tmwe">
    <CardHeader
      icon="mdi-toggle-switch-outline"
      :title="t('cargo.acccompliance.title')"
    >
      <template #badge>
        <v-chip
          size="x-small"
          variant="tonal"
          :title="
            t('cargo.acccompliance.active_count', {
              n: activeCount,
              total: flagList.length,
            })
          "
        >
          {{ activeCount }}/{{ flagList.length }}
        </v-chip>
      </template>
    </CardHeader>

    <div class="acc-grid">
      <div v-for="f in flagList" :key="f.key" class="acc-row">
        <v-switch
          :model-value="isOn(f.key)"
          density="compact"
          color="primary"
          hide-details
          inset
          :disabled="cargo.saving"
          @change="(v: boolean) => toggle(f.key, v)"
        />
        <div>
          <div class="acc-row__label">{{ f.label }}</div>
          <div class="acc-row__hint">{{ f.hint }}</div>
        </div>
      </div>
    </div>

    <!-- Declaración DGR estructurada (número UN, clase, PG, régimen LQ/EQ) —
         paridad legacy: botón siempre disponible. Persiste en spedizioni_dgr
         (is_cargo='S') vía DgrDeclarationDialog, aparte del flag booleano. -->
    <div class="acc-dgr">
      <v-btn
        size="small"
        variant="tonal"
        :color="dgrUnrActive ? 'warning' : undefined"
        prepend-icon="mdi-hazard-lights"
        @click="ui.openModal('dgr')"
      >
        {{ t("cargo.acccompliance.declare_dgr") }}
      </v-btn>
      <span v-if="dgrUnrActive" class="acc-dgr__hint">
        {{ t("shipment.dgr.banner") }}
      </span>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { useCargoStore } from "@cargo/stores/cargo.store";
import { useUiStore } from "@cargo/stores/ui.store";
import CardHeader from "@cargo/components/shell/CardHeader.vue";
import type { Cargo } from "@cargo/services/cargo.types";

type AccFlag = "acc_dryice" | "acc_danggoods" | "acc_bancale";

const { t } = useI18n();
const cargo = useCargoStore();
const ui = useUiStore();

// El banner UNR se revela cuando la carga declara mercancía peligrosa o dry ice
// (flags booleanos de spedizioni_cargo). La declaración estructurada (número UN,
// clase, régimen) se gestiona aparte en el diálogo DGR.
const dgrUnrActive = computed<boolean>(
  () => isOn("acc_danggoods") || isOn("acc_dryice"),
);

/**
 * Compliance / accessoriali flags that exist as columns in
 * `spedizioni_cargo`. Each is persisted as 'S'/'N'.
 *
 * NOTE: the 6 ground-leg flags from the legacy `spedyc_form` (acc_al_piano,
 * acc_privati_p/d, acc_sponda_p/d, acc_consegna_gdo, acc_aree_remote and
 * fermo_deposito) only exist on `spedizioni` (express courier), NOT on
 * `spedizioni_cargo`. They were previously listed here but silently
 * failed to persist. The cargo's pickup/delivery legs handle those via
 * their linked express shipments (`id_spediz_part` / `id_spediz_dest`).
 */
const flagList = computed<{ key: AccFlag; label: string; hint: string }[]>(
  () => [
    {
      key: "acc_dryice",
      label: t("cargo.acccompliance.dry_ice"),
      hint: t("cargo.acccompliance.dry_ice_hint"),
    },
    {
      key: "acc_danggoods",
      label: t("cargo.acccompliance.dangerous"),
      hint: t("cargo.acccompliance.dangerous_hint"),
    },
    {
      key: "acc_bancale",
      label: t("cargo.acccompliance.pallet"),
      hint: t("cargo.acccompliance.pallet_hint"),
    },
    // acc_export / acc_import se editan en el modal de Aduanas (bloques
    // EXPORT/IMPORT) — no se duplican aquí.
  ],
);

const activeCount = computed(
  () => flagList.value.filter((f) => isOn(f.key)).length,
);

function isOn(key: AccFlag): boolean {
  return cargo.cargo?.[key] === "S";
}

async function toggle(key: AccFlag, on: boolean): Promise<void> {
  if (!cargo.id) return;
  await cargo.update({ [key]: on ? "S" : "N" } as Partial<Cargo>);
}
</script>

<style scoped>
.acc-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 8px 16px;
}
.acc-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.acc-row__label {
  font-size: 13px;
  font-weight: 500;
  line-height: 1.2;
}
.acc-row__hint {
  font-size: 11px;
  opacity: 0.65;
  line-height: 1.2;
}
.acc-dgr {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 12px;
  padding-top: 10px;
  border-top: 1px solid
    rgba(var(--v-border-color), calc(var(--v-border-opacity) * 0.6));
}
.acc-dgr__hint {
  font-size: 11.5px;
  color: rgb(var(--v-theme-warning));
}
</style>
