<script setup lang="ts">
/**
 * Autocompletes de la cabecera de la pratica (paridad crm_form.php):
 *   - Cliente (anagrafiche): búsqueda remota por texto.
 *   - Contacto (contatti): dependiente del cliente elegido; al elegir uno,
 *     propone rellenar nome/email/tel (paridad ContattoDet legacy, sin el
 *     confirm() bloqueante — aquí se rellena si los campos están vacíos).
 *
 * Patrón Vuetify autocomplete remoto: :model-value one-way + evento onPick
 * (NO v-model bidireccional con búsqueda remota → evita bucles de fetch).
 */
import { ref, watch } from "vue";
import { useI18n } from "vue-i18n";

import { anagraficaService } from "@shared/anagrafiche/services/anagrafica.service";
import type { AnagraficaLite } from "@shared/anagrafiche/services/anagrafica.service";
import { contattiService } from "@shared/anagrafiche/services/contatti.service";
import type { ContattoLite } from "@shared/anagrafiche/services/contatti.service";

const props = defineProps<{
  idAnagrafica: number | null;
  idContatto: number | null;
  /** Muestra el cliente como texto (no editable). Su razón social se pasa en
   *  `clienteLabel`. El contacto sigue siendo editable. */
  clienteReadonly?: boolean;
  clienteLabel?: string | null;
}>();

const emit = defineEmits<{
  "pick-anagrafica": [{ id: number; label: string }];
  "pick-contatto": [{ id: number; nome: string; email: string; tel: string }];
}>();

const { t } = useI18n();

// ─── Cliente (anagrafiche) — búsqueda remota ───────────────────
const anagItems = ref<AnagraficaLite[]>([]);
const anagLoading = ref(false);
const anagSearch = ref("");

// Sembrar la opción del cliente ya guardado (resolviendo su rag_soc) para que
// el autocomplete muestre el nombre y no un id pelado.
watch(
  () => props.idAnagrafica,
  async (id) => {
    if (!id || anagItems.value.some((a) => a.id === id)) return;
    const anag = await anagraficaService.getById(id);
    if (anag && !anagItems.value.some((a) => a.id === anag.id)) {
      anagItems.value = [anag, ...anagItems.value];
    }
  },
  { immediate: true },
);

let anagTimer: ReturnType<typeof setTimeout> | null = null;
watch(anagSearch, (q) => {
  if (anagTimer) clearTimeout(anagTimer);
  const query = (q ?? "").trim();
  if (query.length < 2) return;
  anagTimer = setTimeout(async () => {
    anagLoading.value = true;
    try {
      anagItems.value = await anagraficaService.search(query, 25);
    } finally {
      anagLoading.value = false;
    }
  }, 300);
});

function onPickAnagrafica(id: number | null): void {
  if (!id) return;
  const chosen = anagItems.value.find((a) => a.id === id);
  emit("pick-anagrafica", { id, label: chosen?.rag_soc ?? "" });
  // Al cambiar de cliente, recargar sus contactos.
  void loadContatti(id);
}

// ─── Contacto (contatti) — dependiente del cliente ─────────────
const contItems = ref<ContattoLite[]>([]);
const contLoading = ref(false);

async function loadContatti(anagId: number | null): Promise<void> {
  contItems.value = [];
  if (!anagId || anagId <= 0) return;
  contLoading.value = true;
  try {
    contItems.value = await contattiService.listByPartner(anagId);
  } finally {
    contLoading.value = false;
  }
}

function contattoLabel(c: ContattoLite): string {
  const login = c.loginn ? ` — ${c.loginn}` : "";
  return `${c.nome ?? ""}${login}`.trim() || `#${c.id}`;
}

function onPickContatto(id: number | null): void {
  if (!id) return;
  const c = contItems.value.find((x) => x.id === id);
  if (!c) return;
  emit("pick-contatto", {
    id,
    nome: String(c.nome ?? ""),
    email: String(c.mail ?? ""),
    tel: String((c as Record<string, unknown>).tel ?? ""),
  });
}

// Cargar contactos del cliente ya guardado al montar / cuando cambie desde fuera.
watch(
  () => props.idAnagrafica,
  (id) => {
    if (id && !contItems.value.length) void loadContatti(id);
  },
  { immediate: true },
);
</script>

<template>
  <div class="d-flex flex-wrap ga-3">
    <!-- Cliente: en modo readonly se muestra como texto (el cliente de una
         pratica no se reasigna desde la ficha). Editable = autocomplete. -->
    <v-text-field
      v-if="clienteReadonly"
      :model-value="clienteLabel || (idAnagrafica ? `#${idAnagrafica}` : '—')"
      :label="t('crm.field.cliente')"
      density="compact"
      variant="outlined"
      hide-details
      readonly
      prepend-inner-icon="mdi-domain"
      style="min-width: 280px; flex: 1"
    />
    <v-autocomplete
      v-else
      :model-value="idAnagrafica"
      :items="anagItems"
      item-title="rag_soc"
      item-value="id"
      :label="t('crm.field.cliente')"
      :loading="anagLoading"
      :no-data-text="t('crm.lookup.type_to_search')"
      density="compact"
      variant="outlined"
      hide-details
      clearable
      style="min-width: 280px; flex: 1"
      @update:search="anagSearch = $event"
      @update:model-value="onPickAnagrafica"
    />
    <v-autocomplete
      :model-value="idContatto"
      :items="contItems"
      :item-title="contattoLabel"
      item-value="id"
      :label="t('crm.field.contatto')"
      :loading="contLoading"
      :disabled="!idAnagrafica"
      :no-data-text="t('crm.lookup.no_contacts')"
      density="compact"
      variant="outlined"
      hide-details
      clearable
      style="min-width: 240px; flex: 1"
      @update:model-value="onPickContatto"
    />
  </div>
</template>
