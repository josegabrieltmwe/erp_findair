import { afterEach, describe, expect, it, vi } from 'vitest';
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils';
import { createPinia } from 'pinia';
import { createI18n } from 'vue-i18n';
import { createVuetify } from 'vuetify';
import * as components from 'vuetify/components';
import * as directives from 'vuetify/directives';
import { createRouter, createMemoryHistory } from 'vue-router';
import ContattoPermissionsDialog from './ContattoPermissionsDialog.vue';
import { contattiService, type ApiRoleState } from '../services/contatti.service';
import type { ContattoRow } from '../services/anagrafica.service';

/**
 * C1 (acceso FindAir sin permiso de alta): test de MONTAJE REAL (sufijo
 * `.mount.spec.ts`, ver `environmentMatchGlobs` en apps/operations/vitest.config.ts) —
 * complementa contatti.service.spec.ts (lógica pura de
 * `hasFindairAccessWithoutShipmentCreation`) comprobando que el `v-alert` de
 * aviso REALMENTE aparece/desaparece en el DOM del diálogo, no solo que la
 * función devuelve el booleano correcto.
 *
 * AuthFlagsEditor y ContactApiRolesEditor se stubean: ambos hacen sus propias
 * llamadas a servicio (capabilities / rol API) que no son el objeto bajo
 * prueba aquí y solo añadirían ruido/async innecesario.
 */

const vuetify = createVuetify({ components, directives });
const i18n = createI18n({
  legacy: false,
  locale: 'es',
  messages: {
    es: {
      anagrafiche: {
        findair: {
          cannot_create_shipments_warning:
            'Este contacto tiene acceso Findair pero NO puede crear envíos (auth_19 desactivado): el alta de envíos responderá 403.',
          api_role: 'Rol API',
          manage_in_user: 'Gestionar en la ficha de usuario',
        },
        perm: {
          app_access: 'Acceso por aplicación',
          erp_login_app: 'App ERP',
          b2b_login_app: 'App B2B',
        },
        notifications: 'Notificaciones',
      },
      common: { cancel: 'Cancelar', save: 'Guardar' },
    },
  },
});

const BASE_CONTATTO: ContattoRow = {
  id: 42,
  id_anagrafica: 7,
  nome: 'Test',
  auth_10: 'N', auth_11: 'N', auth_12: 'N', auth_13: 'N', auth_14: 'N',
  auth_15: 'N', auth_16: 'N', auth_17: 'N', auth_18: 'N', auth_19: 'N',
  auth_20: 'N', auth_21: 'N', auth_22: 'N', auth_23: 'N', auth_24: 'N',
  erp_login_app: 'N', b2b_login_app: 'N',
};

let mounted: VueWrapper[] = [];

// Router mínimo, sin ruta `user-detail`: solo para que `useRouter()`/`hasRoute`
// no avisen de "no active router" — el enlace a la ficha de usuario no es lo
// que se prueba aquí (RouterLink va stubeado más abajo).
const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/', component: { template: '<div/>' } }] });

function mountDialog(contatto: ContattoRow = BASE_CONTATTO): VueWrapper {
  const wrapper = mount(ContattoPermissionsDialog, {
    props: { modelValue: false, contatto },
    global: {
      plugins: [vuetify, i18n, createPinia(), router],
      stubs: {
        AuthFlagsEditor: true,
        ContactApiRolesEditor: true,
        RouterLink: true,
      },
    },
    // VDialog hace Teleport de su contenido a document.body: hace falta un
    // nodo real adjunto para que el overlay se monte y se pueda consultar.
    attachTo: document.body,
  });
  mounted.push(wrapper);
  return wrapper;
}

/**
 * El `v-alert` vive dentro de `VDialog`, que hace Teleport de su contenido a
 * `document.body` (no es descendiente del elemento raíz del wrapper): hay que
 * consultarlo ahí, no con `wrapper.find(...)`.
 */
function findAlert(): Element | null {
  return document.body.querySelector('.v-alert');
}

/** Abre el diálogo (false → true) para disparar el `watch` que carga el rol API. */
async function openWith(wrapper: VueWrapper, state: ApiRoleState): Promise<void> {
  vi.spyOn(contattiService, 'getApiRole').mockResolvedValue(state);
  await wrapper.setProps({ modelValue: true });
  await flushPromises();
}

function apiRoleState(overrides: Partial<ApiRoleState>): ApiRoleState {
  return {
    enabled: false,
    level: null,
    role_id: null,
    role_name: null,
    addon_roles: [],
    grantable_roles: [],
    can_create_shipments: true,
    ...overrides,
  };
}

describe('ContattoPermissionsDialog: aviso de veto de alta de envíos (DOM)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    // Limpia también el contenido teleportado a document.body: si no, el del
    // test anterior seguiría ahí y falsearía el siguiente `findAlert()`.
    for (const wrapper of mounted) wrapper.unmount();
    mounted = [];
  });

  it('muestra el v-alert cuando hay acceso FindAir y can_create_shipments es false', async () => {
    const wrapper = mountDialog();
    await openWith(wrapper, apiRoleState({ enabled: true, can_create_shipments: false }));

    const alert = findAlert();
    expect(alert).not.toBeNull();
    expect(alert?.textContent).toContain('NO puede crear envíos');
  });

  it('NO muestra el v-alert cuando hay acceso FindAir y puede crear envíos', async () => {
    const wrapper = mountDialog();
    await openWith(wrapper, apiRoleState({ enabled: true, can_create_shipments: true }));

    expect(findAlert()).toBeNull();
  });

  it('NO muestra el v-alert cuando no hay acceso FindAir habilitado', async () => {
    const wrapper = mountDialog();
    await openWith(wrapper, apiRoleState({ enabled: false, can_create_shipments: false }));

    expect(findAlert()).toBeNull();
  });
});
