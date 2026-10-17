<template>
  <div class="storico-messaggi">
    <!-- Filtros -->
    <div class="storico-filters">
      <select v-model="filters.metodo" class="sm-select" @change="reload">
        <option value="">Tutti i canali</option>
        <option value="M">Email</option>
        <option value="S">SMS</option>
        <option value="F">Fax</option>
        <option value="C">Carta</option>
      </select>
      <select v-model="filters.esito" class="sm-select" @change="reload">
        <option value="">Tutti gli esiti</option>
        <option value="WRK">In corso</option>
        <option value="OK">Inviato</option>
        <option value="KO">Errore</option>
      </select>
      <input
        v-model="filters.tipo"
        class="sm-input"
        placeholder="Tipo (FATT, CRM…)"
        @keyup.enter="reload"
      />
      <button class="sm-btn" :disabled="loading" @click="reload">Cerca</button>
    </div>

    <p v-if="error" class="sm-error">{{ error }}</p>

    <table class="sm-table">
      <thead>
        <tr>
          <th>Data</th>
          <th>Tipo</th>
          <th>Canale</th>
          <th>Destinatario</th>
          <th>Oggetto</th>
          <th>Esito</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        <tr v-if="loading">
          <td colspan="7" class="sm-muted">Caricamento…</td>
        </tr>
        <tr v-else-if="rows.length === 0">
          <td colspan="7" class="sm-muted">Nessun messaggio.</td>
        </tr>
        <tr v-for="row in rows" v-else :key="row.id">
          <td>{{ formatDate(row.insert_datetime) }}</td>
          <td>{{ row.tipo }}</td>
          <td>{{ channelLabel(row.metodo) }}</td>
          <td class="sm-ellipsis" :title="row.dest_msg">{{ row.dest_msg }}</td>
          <td class="sm-ellipsis" :title="row.descriz">{{ row.descriz }}</td>
          <td>
            <span class="sm-chip" :class="esitoClass(row.esito)">{{ esitoLabel(row.esito) }}</span>
          </td>
          <td>
            <button
              class="sm-btn sm-btn--sm"
              :disabled="resendingId === row.id"
              title="Reinvia il messaggio"
              @click="resend(row)"
            >
              {{ resendingId === row.id ? '…' : 'Reinvia' }}
            </button>
          </td>
        </tr>
      </tbody>
    </table>

    <div class="storico-pager">
      <span class="sm-muted">{{ total }} messaggi</span>
      <button class="sm-btn sm-btn--sm" :disabled="page <= 1 || loading" @click="goPage(page - 1)">‹</button>
      <span>{{ page }}</span>
      <button class="sm-btn sm-btn--sm" :disabled="page * limit >= total || loading" @click="goPage(page + 1)">›</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import {
  docsstoryService,
  CHANNEL_LABEL,
  ESITO_LABEL,
  type DocsstoryRecord,
  type DocsstoryMetodo,
  type DocsstoryEsito,
} from '../services/docsstory.service';

/**
 * Storico messaggi inviati — outbound message history (docsstory).
 * Self-contained: only depends on docsstoryService, so any host app can
 * drop it into a page or dialog without extra wiring.
 */
const props = defineProps<{
  /** Optional: scope the list to one anagrafica (operator view = leave unset). */
  idAnagr?: number;
}>();

const rows = ref<DocsstoryRecord[]>([]);
const total = ref(0);
const page = ref(1);
const limit = 50;
const loading = ref(false);
const error = ref<string | null>(null);
const resendingId = ref<number | null>(null);

const filters = reactive<{ metodo: '' | DocsstoryMetodo; esito: '' | DocsstoryEsito; tipo: string }>({
  metodo: '',
  esito: '',
  tipo: '',
});

function channelLabel(m: DocsstoryMetodo): string {
  return CHANNEL_LABEL[m] ?? m;
}
function esitoLabel(e: DocsstoryEsito): string {
  return ESITO_LABEL[e] ?? e;
}
function esitoClass(e: DocsstoryEsito): string {
  return { WRK: 'sm-chip--wrk', OK: 'sm-chip--ok', KO: 'sm-chip--ko' }[e] ?? '';
}
function formatDate(dt: string): string {
  return dt ? dt.replace('T', ' ').slice(0, 16) : '';
}

async function load() {
  loading.value = true;
  error.value = null;
  try {
    const res = await docsstoryService.list({
      id_anagr: props.idAnagr,
      metodo: filters.metodo || undefined,
      esito: filters.esito || undefined,
      tipo: filters.tipo || undefined,
      page: page.value,
      limit,
    });
    rows.value = res.data ?? [];
    total.value = res.total ?? 0;
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
    rows.value = [];
  } finally {
    loading.value = false;
  }
}
function reload() {
  page.value = 1;
  load();
}
function goPage(p: number) {
  page.value = p;
  load();
}

async function resend(row: DocsstoryRecord) {
  resendingId.value = row.id;
  try {
    await docsstoryService.resend(row.id);
    // The resend clones the record; refresh so the new row + esito show up.
    await load();
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
  } finally {
    resendingId.value = null;
  }
}

onMounted(load);
</script>

<style scoped>
.storico-messaggi {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.storico-filters {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  align-items: center;
}
.sm-select,
.sm-input {
  padding: 6px 8px;
  border: 1px solid rgba(var(--v-theme-on-surface, 0, 0, 0), 0.24);
  border-radius: 6px;
  background: rgb(var(--v-theme-surface, 255, 255, 255));
  color: inherit;
  font-size: 0.875rem;
}
.sm-btn {
  padding: 6px 14px;
  border: none;
  border-radius: 6px;
  background: rgb(var(--v-theme-primary, 21, 101, 176));
  color: #fff;
  cursor: pointer;
  font-size: 0.875rem;
}
.sm-btn:disabled {
  opacity: 0.5;
  cursor: default;
}
.sm-btn--sm {
  padding: 3px 10px;
  font-size: 0.8rem;
}
.sm-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.875rem;
}
.sm-table th,
.sm-table td {
  text-align: left;
  padding: 8px 10px;
  border-bottom: 1px solid rgba(var(--v-theme-on-surface, 0, 0, 0), 0.12);
}
.sm-table th {
  font-weight: 600;
  white-space: nowrap;
}
.sm-ellipsis {
  max-width: 220px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.sm-muted {
  color: rgba(var(--v-theme-on-surface, 0, 0, 0), 0.6);
}
.sm-error {
  color: rgb(var(--v-theme-error, 178, 59, 59));
  margin: 0;
}
.sm-chip {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 0.75rem;
  font-weight: 600;
}
.sm-chip--wrk {
  background: rgba(183, 121, 23, 0.16);
  color: #a76a17;
}
.sm-chip--ok {
  background: rgba(47, 122, 79, 0.16);
  color: #2f7a4f;
}
.sm-chip--ko {
  background: rgba(178, 59, 59, 0.16);
  color: #b23b3b;
}
.storico-pager {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
}
</style>
