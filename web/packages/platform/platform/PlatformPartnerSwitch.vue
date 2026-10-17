<template>
  <!--
    Partner switch (impersonation) — super-admin only. Modern counterpart of
    the legacy <select id="partner_switch">. Renders ONLY when the backend
    returns a partner list (which it does exclusively for the TMWE super-admin
    real anagrafica == 1); for everyone else the list is empty and this
    component renders nothing.

    On pick, POST partner_switch { idp } then hard-reload the page so every
    server-side filter re-applies with the new effective anagrafica — same
    behaviour as the legacy Partner_switch() (window.location reload).
  -->
  <div v-if="partners.length > 0" class="pps">
    <v-icon icon="mdi-account-switch-outline" size="18" class="pps-icon" />
    <v-autocomplete
      :model-value="activeId"
      :items="partners"
      item-title="rag_soc"
      item-value="id"
      :loading="switching"
      :disabled="switching"
      density="compact"
      variant="solo-filled"
      flat
      hide-details
      :menu-props="{ maxHeight: 420 }"
      class="pps-select"
      :aria-label="t('platform.partner_switch.label')"
      @update:model-value="onPick"
    />
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';

interface Partner {
  id: number;
  rag_soc: string;
  id_paese_iso?: string;
}

const { t } = useI18n();

const partners = ref<Partner[]>([]);
// activeId reflects the impersonated partner, or 1 (TMWE) when viewing as self.
const activeId = ref<number>(1);
const switching = ref(false);

const ENDPOINT = '/bff/v1/partner_switch';

onMounted(async () => {
  try {
    const r = await fetch(ENDPOINT, {
      credentials: 'include',
      headers: { Accept: 'application/json' },
    });
    // 403 for non-admins → leave partners empty → component stays hidden.
    if (!r.ok) return;
    const body = await r.json();
    const data = body?.data ?? body;
    const list: Partner[] = Array.isArray(data?.partners) ? data.partners : [];
    partners.value = list.map((p) => ({ ...p, id: Number(p.id) }));
    const active = data?.active_partner_id;
    activeId.value = active ? Number(active) : 1;
  } catch {
    /* keep hidden on any error */
  }
});

// One-way :model-value + explicit handler (project rule for Vuetify remote
// autocompletes): never bind return-object; act on the chosen id.
async function onPick(idp: number | null): Promise<void> {
  if (idp == null || switching.value) return;
  switching.value = true;
  try {
    const r = await fetch(ENDPOINT, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ idp }),
    });
    if (!r.ok) {
      switching.value = false;
      return;
    }
    // Hard reload so all server-side scope filters re-apply (legacy parity).
    window.location.reload();
  } catch {
    switching.value = false;
  }
}
</script>

<style scoped lang="scss">
.pps {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}
.pps-icon {
  color: rgb(var(--v-theme-on-surface-variant));
}
.pps-select {
  width: 220px;
  min-width: 160px;
  font-size: 13px;
}
@media (max-width: 900px) {
  .pps-select { width: 150px; }
}
@media (max-width: 720px) {
  .pps { display: none; }
}
</style>
