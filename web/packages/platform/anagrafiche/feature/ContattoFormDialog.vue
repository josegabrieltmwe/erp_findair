<template>
  <v-dialog :model-value="modelValue" max-width="640" persistent @update:model-value="onClose">
    <v-card>
      <v-card-title>{{ isEdit ? t('common.edit') : t('common.add') }} — {{ t('anagrafiche.tabs.contatti') }}</v-card-title>

      <!-- Paso credenciales "shown once" tras crear un contacto nuevo. -->
      <v-card-text v-if="createdCredentials">
        <v-alert type="success" variant="tonal" density="compact" class="mb-3">
          {{ t('anagrafiche.contatto_created') }}
        </v-alert>
        <CredentialsRevealCard
          :loginn="createdCredentials.loginn"
          :password="createdCredentials.password"
        />
      </v-card-text>

      <!-- Formulario. -->
      <v-card-text v-else>
        <v-row dense>
          <v-col cols="12" md="6">
            <v-text-field v-model="form.nome" :label="t('anagrafiche.fields.nome')" density="compact" variant="outlined" />
          </v-col>
          <v-col cols="12" md="6">
            <v-text-field v-model="form.mail"
          v-field-help="'mail'" :label="t('anagrafiche.fields.mail')" density="compact" variant="outlined" />
          </v-col>
          <v-col cols="12" sm="6" md="4">
            <v-text-field v-model="form.ruolo"
          v-field-help="'ruolo'" :label="t('anagrafiche.fields.ruolo')" density="compact" variant="outlined" />
          </v-col>

          <!-- Clasificación: sede asignada + tipo de contacto -->
          <v-col cols="12" sm="6" md="4">
            <v-select
              v-model="form.id_sede_interna"
          v-field-help="'id_sede_interna'"
              :items="sediItems"
              :loading="loadingOptions"
              :label="t('anagrafiche.contatto.id_sede_interna')"
              item-title="label"
              item-value="value"
              clearable
              density="compact"
              variant="outlined"
            />
          </v-col>
          <v-col cols="12" sm="6" md="4">
            <v-select
              v-model="form.id_contatto_tipo"
          v-field-help="'id_contatto_tipo'"
              :items="tipoItems"
              :loading="loadingOptions"
              :label="t('anagrafiche.contatto.id_contatto_tipo')"
              item-title="label"
              item-value="value"
              clearable
              density="compact"
              variant="outlined"
            />
          </v-col>

          <!-- Fase E2: datos de contacto completos -->
          <v-col cols="12" sm="6" md="4">
            <v-text-field v-model="form.tel" :label="t('anagrafiche.fields.tel')" density="compact" variant="outlined" />
          </v-col>
          <v-col cols="12" sm="6" md="4">
            <v-text-field v-model="form.tel2" :label="t('anagrafiche.contatto.tel2')" density="compact" variant="outlined" />
          </v-col>
          <v-col cols="12" sm="6" md="4">
            <v-text-field v-model="form.cell"
          v-field-help="'cell'" :label="t('anagrafiche.contatto.cell')" density="compact" variant="outlined" />
          </v-col>
          <v-col cols="12" sm="6" md="4">
            <v-text-field v-model="form.sigl"
          v-field-help="'sigl'" :label="t('anagrafiche.contatto.sigl')" maxlength="10" density="compact" variant="outlined" />
          </v-col>
          <v-col cols="12" sm="6" md="4">
            <v-text-field v-model="form.fax"
          v-field-help="'fax'" :label="t('anagrafiche.fields.fax')" density="compact" variant="outlined" />
          </v-col>

          <!-- Idiomas: web / traducción / teléfono -->
          <v-col cols="12" md="4">
            <v-select
              v-model="form.lingua_web"
          v-field-help="'lingua_web'"
              :items="languageItems"
              :loading="loadingOptions"
              :label="t('anagrafiche.contatto.lingua_web')"
              item-title="label"
              item-value="value"
              clearable
              density="compact"
              variant="outlined"
            />
          </v-col>
          <v-col cols="12" md="4">
            <v-select
              v-model="form.lingua_trad"
          v-field-help="'lingua_trad'"
              :items="languageItems"
              :loading="loadingOptions"
              :label="t('anagrafiche.contatto.lingua_trad')"
              item-title="label"
              item-value="value"
              clearable
              density="compact"
              variant="outlined"
            />
          </v-col>
          <v-col cols="12" md="4">
            <v-select
              v-model="form.lingua_tel"
          v-field-help="'lingua_tel'"
              :items="languageItems"
              :loading="loadingOptions"
              :label="t('anagrafiche.contatto.lingua_tel')"
              item-title="label"
              item-value="value"
              clearable
              density="compact"
              variant="outlined"
            />
          </v-col>
          <v-col cols="12">
            <v-textarea v-model="form.note"
          v-field-help="'note'" :label="t('anagrafiche.fields.note')" rows="2" auto-grow density="compact" variant="outlined" />
          </v-col>
        </v-row>
      </v-card-text>

      <v-card-actions>
        <v-spacer />
        <template v-if="createdCredentials">
          <v-btn color="primary" @click="onClose">{{ t('common.close') }}</v-btn>
        </template>
        <template v-else>
          <v-btn variant="text" @click="onClose">{{ t('common.cancel') }}</v-btn>
          <v-btn color="primary" :loading="saving" @click="onSave">{{ t('common.save') }}</v-btn>
        </template>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import type { ContattoRow } from '../services/anagrafica.service';
import { contattiService, type RevealedCredentials } from '../services/contatti.service';
import { sediInterneService } from '../services/sediInterne.service';
import { contactOptionsService } from '../services/contactOptions.service';
import { useToast } from '../composables/useToast';
import CredentialsRevealCard from '../components/CredentialsRevealCard.vue';

const props = defineProps<{ modelValue: boolean; idAnagrafica: number; contatto: ContattoRow | null }>();
const emit = defineEmits<{ 'update:modelValue': [value: boolean]; saved: [] }>();
const { t } = useI18n();
const toast = useToast();

const saving = ref(false);
const form = ref<Partial<ContattoRow>>({});
const createdCredentials = ref<RevealedCredentials | null>(null);
const isEdit = computed(() => !!props.contatto?.id);

// Opciones de los selects (sedi, tipo contacto, idiomas).
const sediItems = ref<{ title: string; label: string; value: number }[]>([]);
const tipoItems = ref<{ title: string; label: string; value: number }[]>([]);
const languageItems = ref<{ title: string; label: string; value: string }[]>([]);
const loadingOptions = ref(false);
let optionsLoaded = false;

async function loadOptions(): Promise<void> {
  if (optionsLoaded) return;
  loadingOptions.value = true;
  try {
    const [sedi, tipi, langs] = await Promise.all([
      sediInterneService.listByPartner(props.idAnagrafica),
      contactOptionsService.contactTypes(),
      contactOptionsService.languages(),
    ]);
    sediItems.value = sedi.map((s) => {
      const label = String(s.label ?? s.citta ?? s.id);
      return { title: label, label, value: Number(s.id) };
    });
    tipoItems.value = tipi.map((tp) => ({ title: tp.label, label: tp.label, value: tp.id }));
    languageItems.value = langs.map((l) => {
      const label = `${l.code} — ${l.native ?? l.name ?? ''}`.trim();
      return { title: label, label, value: l.code };
    });
    optionsLoaded = true;
  } finally {
    loadingOptions.value = false;
  }
}

watch(() => props.modelValue, (v) => {
  if (v) {
    form.value = props.contatto ? { ...props.contatto } : {};
    createdCredentials.value = null;
    void loadOptions();
  }
});

function onClose(): void {
  emit('update:modelValue', false);
}

async function onSave(): Promise<void> {
  saving.value = true;
  try {
    if (isEdit.value && form.value.id) {
      await contattiService.update(form.value.id, form.value);
      toast.success(t('anagrafiche.updated'));
      emit('saved');
      onClose();
    } else {
      const result = await contattiService.create(props.idAnagrafica, form.value);
      emit('saved'); // refrescar la lista detrás del paso de credenciales
      // Si el backend devolvió credenciales, mostrarlas una vez antes de cerrar.
      if (result.credentials?.password) {
        createdCredentials.value = result.credentials;
      } else {
        toast.success(t('anagrafiche.updated'));
        onClose();
      }
    }
  } catch (e) {
    toast.error(e instanceof Error ? e.message : (t('common.error') as string));
  } finally {
    saving.value = false;
  }
}
</script>
