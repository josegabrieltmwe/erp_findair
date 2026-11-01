import { describe, expect, it } from 'vitest';
import { bulkRolesToastKind, rolesNotGranted } from '@shared/users/services/userRoleResults';

describe('rolesNotGranted', () => {
  it('devuelve los roles pedidos que el servidor omitió', () => {
    expect(rolesNotGranted(['root', 'admin'], ['admin'])).toEqual(['root']);
  });
  it('vacío si se concedieron todos (sin distinguir mayúsculas)', () => {
    expect(rolesNotGranted(['Admin'], ['admin'])).toEqual([]);
  });
  it('si el servidor no devuelve roles_assigned, todos quedan sin conceder', () => {
    expect(rolesNotGranted(['a', 'b'], undefined)).toEqual(['a', 'b']);
  });
  it('sin roles pedidos no hay nada que avisar', () => {
    expect(rolesNotGranted([], ['x'])).toEqual([]);
  });
});

describe('bulkRolesToastKind', () => {
  it('error si no se procesó ninguno', () => {
    expect(bulkRolesToastKind({ processed: 0, skipped: 3 })).toBe('error');
    expect(bulkRolesToastKind({ processed: 0 })).toBe('error');
  });
  it('warning si hubo omitidos', () => {
    expect(bulkRolesToastKind({ processed: 2, skipped: 1 })).toBe('warning');
  });
  it('success si todo se procesó', () => {
    expect(bulkRolesToastKind({ processed: 2, skipped: 0 })).toBe('success');
    expect(bulkRolesToastKind({ processed: 2 })).toBe('success');
  });
});
