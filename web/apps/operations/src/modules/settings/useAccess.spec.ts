import { describe, expect, it } from 'vitest';
import { buildAccess, hasScope } from '@shared/composables/useAccess';

describe('buildAccess', () => {
  it('sin perfil o sin access es desconocido y vacío (falla cerrado)', () => {
    for (const p of [null, undefined, {}, { access: null as never }]) {
      expect(buildAccess(p)).toEqual({ roles: [], scopes: [], isRoot: false, known: false });
    }
  });

  it('extrae roles, scopes e is_root', () => {
    const a = buildAccess({
      access: {
        roles: [{ name: 'findair_basic' }, { name: 'account_admin', addon: true }],
        scopes: ['shipment:read', 'profile:write'],
        is_root: true,
      },
    });
    expect(a).toEqual({
      roles: ['findair_basic', 'account_admin'],
      scopes: ['shipment:read', 'profile:write'],
      isRoot: true,
      known: true,
    });
  });

  it('descarta entradas mal formadas y exige is_root booleano', () => {
    const a = buildAccess({
      access: { roles: [{ name: 7 as never }, {}, { name: 'x' }], scopes: ['a:b', '', 3 as never], is_root: 'true' as never },
    });
    expect(a.roles).toEqual(['x']);
    expect(a.scopes).toEqual(['a:b']);
    expect(a.isRoot).toBe(false);
    expect(a.known).toBe(true);
  });
});

describe('hasScope', () => {
  const snap = buildAccess({ access: { scopes: ['config:read', 'profile:write'] } });

  it('un scope', () => {
    expect(hasScope(snap, 'config:read')).toBe(true);
    expect(hasScope(snap, 'config:write')).toBe(false);
  });
  it('lista: any por defecto, all si se pide', () => {
    expect(hasScope(snap, ['config:write', 'profile:write'])).toBe(true);
    expect(hasScope(snap, ['config:write', 'profile:write'], 'all')).toBe(false);
    expect(hasScope(snap, ['config:read', 'profile:write'], 'all')).toBe(true);
  });
  it('lista vacía nunca concede', () => {
    expect(hasScope(snap, [])).toBe(false);
  });
  it('sin access conocido nunca concede', () => {
    expect(hasScope(buildAccess(null), 'config:read')).toBe(false);
  });
});
