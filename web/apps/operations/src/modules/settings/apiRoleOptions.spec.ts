import { describe, expect, it } from 'vitest';
import { apiRoleOptions } from '@shared/anagrafiche/services/apiRoleOptions';
import type { ApiRoleRef, ApiRoleState } from '@shared/anagrafiche/services/contatti.service';

const ref = (id: number, name: string, addon: boolean): ApiRoleRef => ({ id, name, display_name: name, addon });
const state = (over: Partial<ApiRoleState>): ApiRoleState => ({
  enabled: true, level: null, role_id: 1, role_name: 'findair_basic', addon_roles: [], grantable_roles: [], ...over,
});

describe('apiRoleOptions', () => {
  it('sin estado no se puede editar nada', () => {
    expect(apiRoleOptions(null)).toEqual({ held: [], addable: [], baseChoices: [], canEdit: false });
  });

  it('no ofrece roles que ya tiene y separa base de aditivos', () => {
    const o = apiRoleOptions(state({
      addon_roles: [ref(9, 'accounting_viewer', true)],
      grantable_roles: [ref(1, 'findair_basic', false), ref(9, 'accounting_viewer', true), ref(10, 'account_admin', true)],
    }));
    expect(o.addable.map((r) => r.name)).toEqual(['account_admin']);
    expect(o.baseChoices.map((r) => r.name)).toEqual(['findair_basic']);
    expect(o.canEdit).toBe(true);
  });

  it('un rol que tiene pero no puede conceder no es retirable', () => {
    const o = apiRoleOptions(state({
      addon_roles: [ref(20, 'dispatcher', true), ref(9, 'accounting_viewer', true)],
      grantable_roles: [ref(9, 'accounting_viewer', true)],
    }));
    expect(o.held.map((r) => [r.name, r.removable])).toEqual([['dispatcher', false], ['accounting_viewer', true]]);
  });

  it('sin roles concedibles es solo lectura aunque el contacto tenga aditivos', () => {
    const o = apiRoleOptions(state({ addon_roles: [ref(20, 'dispatcher', true)], grantable_roles: [] }));
    expect(o.canEdit).toBe(false);
    expect(o.held[0].removable).toBe(false);
  });
});
