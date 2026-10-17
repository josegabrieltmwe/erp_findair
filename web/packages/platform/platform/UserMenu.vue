<template>
  <!--
    User menu — avatar + dropdown with profile name, language, theme
    pointer, and logout. Reads /get_my_profile once on mount (cached).
  -->
  <div class="um" :class="{ 'um--open': open }">
    <button
      type="button"
      class="um-trigger"
      :title="profile?.name ?? t('platform.user_menu.account')"
      @click="toggle"
      @blur="onBlur"
    >
      <div class="um-avatar">
        <v-icon v-if="!profile" icon="mdi-account" size="18" />
        <span v-else>{{ initials }}</span>
      </div>
      <v-icon icon="mdi-chevron-down" size="14" class="um-caret" />
    </button>

    <div v-if="open" class="um-panel" @mousedown.prevent>
      <header class="um-head">
        <div class="um-avatar um-avatar--lg">
          <span v-if="profile">{{ initials }}</span>
          <v-icon v-else icon="mdi-account" size="22" />
        </div>
        <div class="um-head-body">
          <div class="um-name">{{ profile?.name ?? t('platform.user_menu.account') }}</div>
          <div class="um-sub">{{ profile?.email ?? '—' }}</div>
          <div v-if="profile?.company" class="um-sub">{{ profile.company }}</div>
        </div>
      </header>

      <div class="um-section">
        <a class="um-link" :href="profileHref">
          <v-icon icon="mdi-account-cog-outline" size="16" />
          <span>{{ t('platform.user_menu.profile') }}</span>
        </a>
        <a class="um-link" href="#" @click.prevent="onLogout">
          <v-icon icon="mdi-logout" size="16" />
          <span>{{ t('common.logout') }}</span>
        </a>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useProfile } from '../composables/useProfile';
import { bffLogout } from '@tmwe/shared-frontend/http';

const { t } = useI18n();
const { profile: rawProfile, ensureProfile } = useProfile();

interface Profile {
  name?: string;
  email?: string;
  company?: string;
}

const open = ref(false);
const profile = ref<Profile | null>(null);

const profileHref = '/erp/profilo.php';
async function onLogout(): Promise<void> {
  await bffLogout();
}

const initials = computed<string>(() => {
  const name = profile.value?.name ?? '';
  if (!name) return '?';
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('') || '?';
});

function toggle(): void {
  open.value = !open.value;
}
function onBlur(): void {
  // Delay so clicks inside the panel still register.
  window.setTimeout(() => { open.value = false; }, 140);
}

async function loadProfile(): Promise<void> {
  // QW5: reusa el fetch compartido de `get_my_profile` (useProfile) en vez
  // de uno propio — ver comentario en PlatformTopBar.vue.
  await ensureProfile();
  const body = rawProfile.value;
  if (!body) return;
  profile.value = {
    name: body.name ?? body.nome ?? body.username,
    email: body.email ?? body.mail,
    company: body.cliente ?? body.company,
  };
}

function onKey(ev: KeyboardEvent): void {
  if (ev.key === 'Escape' && open.value) {
    open.value = false;
  }
}

onMounted(() => {
  void loadProfile();
  window.addEventListener('keydown', onKey);
});
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey);
});
</script>

<style scoped lang="scss">
.um {
  position: relative;
}
.um-trigger {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: transparent;
  border: 0;
  padding: 2px 4px;
  border-radius: 8px;
  cursor: pointer;
  color: rgb(var(--v-theme-on-surface));
  transition: background .12s;
}
.um-trigger:hover {
  background: rgb(var(--v-theme-surface-variant));
}
.um-avatar {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  background: rgb(var(--v-theme-primary));
  color: rgb(var(--v-theme-on-primary));
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  flex-shrink: 0;
}
.um-avatar--lg {
  width: 42px;
  height: 42px;
  font-size: 14px;
}
.um-caret {
  color: rgb(var(--v-theme-on-surface-variant));
}
.um-panel {
  position: absolute;
  right: 0;
  top: calc(100% + 6px);
  background: rgb(var(--v-theme-surface));
  border: 1px solid rgba(var(--v-border-color, 0, 0, 0), 0.08);
  border-radius: 10px;
  box-shadow: 0 10px 28px -6px rgba(0,0,0,.18);
  min-width: 240px;
  z-index: 200;
  overflow: hidden;
}
.um-head {
  display: flex;
  gap: 10px;
  padding: 14px;
  border-bottom: 1px solid rgba(var(--v-border-color, 0, 0, 0), 0.06);
}
.um-head-body {
  min-width: 0;
}
.um-name {
  font-weight: 700;
  font-size: 13.5px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.um-sub {
  font-size: 11.5px;
  color: rgb(var(--v-theme-on-surface-variant));
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.um-section {
  padding: 8px 6px;
  border-bottom: 1px solid rgba(var(--v-border-color, 0, 0, 0), 0.06);
}
.um-section:last-child {
  border-bottom: 0;
}
.um-section-title {
  font-size: 10.5px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: rgb(var(--v-theme-on-surface-variant));
  padding: 6px 8px 4px;
}
.um-link {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  text-decoration: none;
  color: rgb(var(--v-theme-on-surface));
  font-size: 13px;
  border-radius: 6px;
  margin: 2px;
  transition: background .12s;
}
.um-link:hover {
  background: rgb(var(--v-theme-surface-variant));
}
</style>
