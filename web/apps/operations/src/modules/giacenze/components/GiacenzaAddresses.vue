<template>
  <div class="giac-addr">
    <div v-if="loading" class="giac-addr__loading">
      <v-progress-circular indeterminate size="20" width="2" />
      <span>{{ t("giacenze.giacenze.addr.loading") }}</span>
    </div>

    <template v-else>
      <!-- Entrega actual (D) -->
      <div class="giac-addr__block">
        <div class="giac-addr__head">
          <v-icon size="18" icon="mdi-map-marker" />
          <span>{{ t("giacenze.giacenze.addr.delivery") }}</span>
        </div>
        <template v-if="editing">
          <div class="giac-addr__form" data-testid="giac-addr-form">
            <v-text-field
              v-model="draft.nome"
              :label="t('giacenze.giacenze.addr.name')"
              density="compact"
              hide-details
            />
            <v-text-field
              v-model="draft.adress"
              :label="t('giacenze.giacenze.addr.street')"
              density="compact"
              hide-details
              :error="submitted && !draft.adress"
            />
            <div class="giac-addr__row">
              <v-text-field
                v-model="draft.cap"
                :label="t('giacenze.giacenze.addr.zip')"
                density="compact"
                hide-details
                :error="submitted && !draft.cap"
              />
              <v-text-field
                v-model="draft.citta"
                :label="t('giacenze.giacenze.addr.city')"
                density="compact"
                hide-details
                :error="submitted && !draft.citta"
              />
              <v-text-field
                v-model="draft.prov"
                :label="t('giacenze.giacenze.addr.province')"
                density="compact"
                hide-details
              />
            </div>
            <div class="giac-addr__row">
              <v-text-field
                v-model="draft.id_paese_iso"
                :label="t('giacenze.giacenze.addr.country')"
                density="compact"
                hide-details
                maxlength="2"
              />
              <v-text-field
                v-model="draft.attenzione"
                :label="t('giacenze.giacenze.addr.attention')"
                density="compact"
                hide-details
              />
              <v-text-field
                v-model="draft.tel"
                :label="t('giacenze.giacenze.addr.phone')"
                density="compact"
                hide-details
              />
            </div>
            <p class="giac-addr__note">
              {{ t("giacenze.giacenze.addr.keepsOriginal") }}
            </p>
            <p v-if="saveError" class="giac-addr__error" role="alert">
              {{ saveError }}
            </p>
            <div class="giac-addr__actions">
              <v-btn variant="text" size="small" @click="cancelEdit">{{
                t("common.cancel")
              }}</v-btn>
              <v-btn
                color="primary"
                size="small"
                :loading="saving"
                data-testid="giac-addr-save"
                @click="saveEdit"
              >
                {{ t("common.save") }}
              </v-btn>
            </div>
          </div>
        </template>
        <AddressLines
          v-else-if="addresses?.delivery"
          :addr="addresses.delivery"
        />
        <div v-else class="giac-addr__empty">
          {{ t("giacenze.giacenze.addr.none") }}
        </div>
      </div>

      <!-- Entrega original (V) — solo si la entrega se redirigió -->
      <div
        v-if="addresses?.delivery_original"
        class="giac-addr__block giac-addr__block--original"
      >
        <div class="giac-addr__head">
          <v-icon size="18" icon="mdi-history" />
          <span>{{ t("giacenze.giacenze.addr.deliveryOriginal") }}</span>
          <v-chip size="x-small" variant="tonal" class="ms-2">
            {{ t("giacenze.giacenze.addr.readonly") }}
          </v-chip>
        </div>
        <AddressLines :addr="addresses.delivery_original" />
      </div>

      <div
        v-if="!editing && addresses?.delivery && !readonly"
        class="giac-addr__actions"
      >
        <v-btn
          variant="text"
          size="small"
          prepend-icon="mdi-pencil"
          data-testid="giac-addr-edit"
          @click="startEdit"
        >
          {{ t("giacenze.giacenze.addr.editDelivery") }}
        </v-btn>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { giacenzeService } from "../services/giacenze.service";
import type { ShipmentAddresses, ShipmentAddress } from "../types";
import { defineComponent, h } from "vue";

const { t } = useI18n();

const props = defineProps<{ shipmentId: number | null; readonly?: boolean }>();
const emit = defineEmits<{ changed: [] }>();

const addresses = ref<ShipmentAddresses | null>(null);
const loading = ref(false);

const editing = ref(false);
const saving = ref(false);
const submitted = ref(false);
const saveError = ref("");
type AddressDraft = {
  nome: string;
  adress: string;
  cap: string;
  citta: string;
  prov: string;
  id_paese_iso: string;
  attenzione: string;
  tel: string;
};
const draft = reactive<AddressDraft>({
  nome: "",
  adress: "",
  cap: "",
  citta: "",
  prov: "",
  id_paese_iso: "",
  attenzione: "",
  tel: "",
});

/**
 * La dirección de entrega se edita aquí (como en el legado). El API (`api_shipment_addresses`) clona la
 * dirección original a un registro de tipo V la primera vez que se toca con una giacenza activa, así que la
 * original sigue visible en solo lectura debajo.
 */
function startEdit(): void {
  const a = addresses.value?.delivery;
  if (!a) return;
  draft.nome = a.nome ?? "";
  draft.adress = a.adress ?? "";
  draft.cap = a.cap ?? "";
  draft.citta = a.citta ?? "";
  draft.prov = a.prov ?? "";
  draft.id_paese_iso = a.id_paese_iso ?? "";
  draft.attenzione = a.attenzione ?? "";
  draft.tel = a.tel ?? "";
  submitted.value = false;
  saveError.value = "";
  editing.value = true;
}

function cancelEdit(): void {
  editing.value = false;
}

async function saveEdit(): Promise<void> {
  const a = addresses.value?.delivery;
  if (!a) return;
  submitted.value = true;
  // Un campo vacío no se envía (no borra datos), pero la calle, el CAP y la ciudad son obligatorios.
  if (!draft.adress.trim() || !draft.cap.trim() || !draft.citta.trim()) return;
  const fields: Record<string, string> = {};
  for (const [k, v] of Object.entries(draft))
    if (v.trim() !== "") fields[k] = v.trim();
  saving.value = true;
  saveError.value = "";
  try {
    await giacenzeService.updateDeliveryAddress(a.id, fields);
    editing.value = false;
    await load();
    emit("changed");
  } catch (e) {
    saveError.value =
      e instanceof Error && e.message
        ? e.message
        : t("giacenze.giacenze.addr.saveFailed");
  } finally {
    saving.value = false;
  }
}

async function load(): Promise<void> {
  if (!props.shipmentId) {
    addresses.value = null;
    return;
  }
  loading.value = true;
  try {
    addresses.value = await giacenzeService.getShipmentAddresses(
      props.shipmentId,
    );
  } catch {
    // El bloque de direcciones es complementario: si falla, no rompe el detalle.
    addresses.value = null;
  } finally {
    loading.value = false;
  }
}

watch(() => props.shipmentId, load, { immediate: true });

// Render inline de las lineas de una direccion (nombre, calle, CAP ciudad prov,
// pais, atencion, tel). Componente ligero local: no justifica un .vue aparte.
const AddressLines = defineComponent({
  props: { addr: { type: Object as () => ShipmentAddress, required: true } },
  setup(p) {
    return () => {
      const a = p.addr;
      const line = (txt: string) =>
        txt ? h("div", { class: "giac-addr__line" }, txt) : null;
      const cityLine = [a.cap, a.citta, a.prov].filter(Boolean).join(" ");
      return h("div", { class: "giac-addr__body" }, [
        a.nome ? h("div", { class: "giac-addr__name" }, a.nome) : null,
        line(a.adress ?? ""),
        line(cityLine),
        line(a.id_paese_iso ?? ""),
        a.attenzione
          ? line(`${a.attenzione}${a.tel ? " · " + a.tel : ""}`)
          : line(a.tel ?? ""),
      ]);
    };
  },
});
</script>

<style scoped>
.giac-addr {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.giac-addr__loading {
  display: flex;
  align-items: center;
  gap: 8px;
  color: rgba(0, 0, 0, 0.6);
}
.giac-addr__block {
  border: 1px solid rgba(0, 0, 0, 0.12);
  border-radius: 6px;
  padding: 10px 12px;
}
.giac-addr__block--original {
  background: rgba(0, 0, 0, 0.02);
  border-style: dashed;
}
.giac-addr__head {
  display: flex;
  align-items: center;
  gap: 6px;
  font-weight: 600;
  font-size: 0.85rem;
  margin-bottom: 6px;
}
.giac-addr__name {
  font-weight: 600;
}
.giac-addr__line {
  font-size: 0.85rem;
  line-height: 1.35;
}
.giac-addr__empty {
  font-style: italic;
  color: rgba(0, 0, 0, 0.5);
}
.giac-addr__form {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.giac-addr__row {
  display: flex;
  gap: 8px;
}
.giac-addr__note {
  margin: 0;
  font-size: 0.8rem;
  color: rgba(0, 0, 0, 0.6);
}
.giac-addr__error {
  margin: 0;
  color: rgb(var(--v-theme-error));
  font-size: 0.85rem;
}
.giac-addr__actions {
  display: flex;
  justify-content: flex-end;
}
</style>
