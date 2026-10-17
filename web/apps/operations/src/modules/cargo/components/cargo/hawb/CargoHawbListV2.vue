<template>
  <v-card border rounded="lg">
    <v-card-title
      class="d-flex align-center text-subtitle-2 font-weight-medium px-4 py-3"
    >
      <v-icon icon="mdi-package-variant" size="18" class="me-2" />
      {{ t("cargo.hawb.title") }}
      <v-chip size="x-small" color="primary" variant="tonal" class="ms-2">
        {{ store.rows.length }}
      </v-chip>
      <v-spacer />
      <v-btn
        size="small"
        variant="tonal"
        color="primary"
        rounded="lg"
        prepend-icon="mdi-plus"
        :loading="store.saving"
        @click="addOpen = true"
      >
        {{ t("cargo.hawb.add") }}
      </v-btn>
    </v-card-title>
    <v-divider />

    <v-data-table
      :headers="headers"
      :items="store.rows"
      :items-per-page="-1"
      hide-default-footer
      density="comfortable"
      :loading="store.loading"
    >

      <template #item.peso_house="{ item }">
        <v-text-field
          :model-value="item.peso_house ?? ''"
          type="number"
          step="0.01"
          variant="plain"
          density="compact"
          hide-details
          class="text-right"
          @change="
            (v: string) => onPatch(Number(item.id), { peso_house: Number(v) })
          "
        />
      </template>

      <template #item.goods_descr="{ item }">
        <v-text-field
          :model-value="item.goods_descr ?? ''"
          variant="plain"
          density="compact"
          hide-details
          @change="(v: string) => onPatch(Number(item.id), { goods_descr: v })"
        />
      </template>

      <template #item.actions="{ item }">
        <div class="d-flex">
          <v-btn
            icon="mdi-pencil-outline"
            size="small"
            variant="text"
            density="comfortable"
            :title="t('cargo.hawb.edit')"
            @click="ui.openHawbFormModal(Number(item.id))"
          />
          <v-btn
            icon="mdi-trash-can-outline"
            size="small"
            variant="text"
            color="error"
            density="comfortable"
            :title="t('cargo.hawb.remove')"
            @click="confirmRemove(Number(item.id))"
          />
        </div>
      </template>

      <template #no-data>
        <EmptyState
          icon="mdi-package-variant-closed-remove"
          :title="t('cargo.hawb.empty_title')"
          :text="t('cargo.hawb.empty_text')"
        />
      </template>
    </v-data-table>

    <v-dialog v-model="addOpen" max-width="480">
      <v-card>
        <v-card-title>{{ t("cargo.hawb.add") }}</v-card-title>
        <v-card-text>
          <!-- Sin campo de número: una house no tiene AWB propio en el modelo
               (ver comentario de `headers`). Lo que la identifica es la
               expedición express asociada. -->
          <v-text-field
            v-model.number="newRow.id_spediz"
            :label="t('cargo.hawb.linked_express_id')"
            type="number"
            density="compact"
            variant="outlined"
            class="mb-2"
          />
          <v-text-field
            v-model.number="newRow.peso_house"
            :label="t('cargo.hawb.weight')"
            type="number"
            step="0.01"
            density="compact"
            variant="outlined"
            class="mb-2"
          />
          <v-text-field
            v-model="newRow.goods_descr"
            :label="t('cargo.hawb.goods_description')"
            density="compact"
            variant="outlined"
          />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" size="small" @click="addOpen = false">{{
            t("common.cancel")
          }}</v-btn>
          <v-btn
            variant="flat"
            color="primary"
            rounded="lg"
            :loading="store.saving"
            @click="submitAdd"
          >
            {{ t("cargo.charges.add") }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-card>
</template>

<script setup lang="ts">
import EmptyState from "@shared/ui/EmptyState.vue";
import { ref, reactive, onMounted, watch, computed } from "vue";
import { useI18n } from "vue-i18n";
import { storeToRefs } from "pinia";
import { useCargoStore } from "@cargo/stores/cargo.store";
import { useCargoHawbStore } from "@cargo/stores/cargo_hawb.store";
import { useUiStore } from "@cargo/stores/ui.store";
import type { HawbCreate, HawbPatch } from "@cargo/services/cargo_hawb.service";

const { t } = useI18n();
const cargo = useCargoStore();
const { id } = storeToRefs(cargo);
const store = useCargoHawbStore();
const ui = useUiStore();

// Sin columna `awb_number`: NO existe en `awb_cargo` (la tabla del HAWB) ni en
// ninguna otra — una house no tiene número propio de AWB en este modelo. Se
// renderizaba como campo editable y cada edición PATCHeaba un campo que
// `Awb_Cargo::ALLOWED_FIELDS` descarta, así que devolvía 400 y no guardaba
// nada. El identificador real de la house es la expedición express asociada
// (`id_spediz`), que es lo que imprime el documento legacy en esa casilla y ya
// tiene su propia columna aquí abajo.
const headers = computed(() => [
  { title: t("cargo.hawb.col_linked_express"), key: "id_spediz", width: 140 },
  {
    title: t("cargo.col.weight"),
    key: "peso_house",
    width: 100,
    align: "end" as const,
  },
  { title: t("cargo.hawb.goods_description"), key: "goods_descr" },
  {
    title: "",
    key: "actions",
    width: 96,
    sortable: false,
    align: "end" as const,
  },
]);

async function load(): Promise<void> {
  if (!id.value) return;
  await store.load(Number(id.value));
}

async function onPatch(hawb_id: number, patch: HawbPatch): Promise<void> {
  if (!id.value) return;
  await store.update(Number(id.value), hawb_id, patch);
}

async function confirmRemove(hawb_id: number): Promise<void> {
  if (!id.value) return;
  if (!window.confirm(t("cargo.hawb.remove_confirm"))) return;
  await store.remove(Number(id.value), hawb_id);
}

const addOpen = ref(false);
const newRow = reactive<HawbCreate>({
  id_spediz: undefined,
  peso_house: undefined,
  goods_descr: "",
});

async function submitAdd(): Promise<void> {
  if (!id.value) return;
  const created = await store.create(Number(id.value), { ...newRow });
  if (created) {
    addOpen.value = false;
    Object.assign(newRow, {
      id_spediz: undefined,
      peso_house: undefined,
      goods_descr: "",
    });
  }
}

onMounted(load);
watch(id, load);
</script>
