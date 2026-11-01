import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@shared/anagrafiche/services/api.types';

const httpMock = vi.fn();
vi.mock('@shared/anagrafiche/services/http', () => ({ http: (...args: unknown[]) => httpMock(...args) }));

import {
  forwardAirAccountsService,
  forwardAirErrorCode,
  isAccountUsable,
  isAuthorizationCurrent,
  type ForwardAirAccount,
} from '@shared/forward_air_accounts/services/forwardAirAccounts.service';

const account = (over: Partial<ForwardAirAccount> = {}): ForwardAirAccount => ({
  id: 1, partner_id: 10, environment: 'production', account_alias: 'Madrid', customer_id: 'C1', bill_to_account: null,
  description: null, principale: 'N', status: 'active', authorization_status: 'pending', authorization_ref: null,
  authorization_received_at: null, authorization_expires_at: null, last_verified_at: null, has_user: true, has_password: true,
  ...over,
});

describe('forwardAirAccountsService', () => {
  beforeEach(() => httpMock.mockReset());

  it('lista con los filtros como query y sin enviar vacios', async () => {
    httpMock.mockResolvedValue({ success: true, data: [account()] });
    const rows = await forwardAirAccountsService.list({ partner_id: 10, environment: '' });
    expect(httpMock).toHaveBeenCalledWith('/api_admin_forward_air_accounts', { query: { partner_id: '10' } });
    expect(rows).toHaveLength(1);
  });

  it('crea con POST y devuelve la cuenta', async () => {
    httpMock.mockResolvedValue({ success: true, data: account({ id: 9 }) });
    const created = await forwardAirAccountsService.create({ partner_id: 10, account_alias: 'X', api_user: 'u', api_password: 'p' });
    const [, options] = httpMock.mock.calls[0];
    expect(options.method).toBe('POST');
    expect(options.body.api_password).toBe('p');
    expect(created.id).toBe(9);
  });

  it('la accion va en el cuerpo: set_principal, set_authorization y verify', async () => {
    httpMock.mockResolvedValue({ success: true, data: {} });
    await forwardAirAccountsService.setPrincipal(3);
    await forwardAirAccountsService.setAuthorization({ id: 3, authorization_status: 'received', authorization_ref: 'L-1', authorization_received_at: '2026-10-01' });
    await forwardAirAccountsService.verify(3);
    expect(httpMock.mock.calls[0][1]).toEqual({ method: 'PUT', body: { action: 'set_principal', id: 3 } });
    expect(httpMock.mock.calls[1][1].body).toMatchObject({ action: 'set_authorization', id: 3, authorization_ref: 'L-1' });
    expect(httpMock.mock.calls[2][1]).toEqual({ method: 'POST', body: { action: 'verify', id: 3 } });
  });

  it('borra con el id en el cuerpo', async () => {
    httpMock.mockResolvedValue({ success: true });
    await forwardAirAccountsService.remove(4);
    expect(httpMock.mock.calls[0][1]).toEqual({ method: 'DELETE', body: { id: 4 } });
  });

  it('una respuesta sin data o con success=false lanza', async () => {
    httpMock.mockResolvedValue({ success: false, message: 'nope' });
    await expect(forwardAirAccountsService.update({ id: 1 })).rejects.toThrow('nope');
    httpMock.mockResolvedValue({ success: true });
    await expect(forwardAirAccountsService.verify(1)).rejects.toThrow('Verify failed');
  });
});

describe('forwardAirErrorCode', () => {
  it('reconoce solo los codigos FORWARD_AIR_ACCOUNT_*', () => {
    expect(forwardAirErrorCode(new ApiError('x', 409, 'FORWARD_AIR_ACCOUNT_DUPLICATE'))).toBe('FORWARD_AIR_ACCOUNT_DUPLICATE');
    expect(forwardAirErrorCode(new ApiError('x', 400, 'OTHER'))).toBeNull();
    expect(forwardAirErrorCode(new Error('x'))).toBeNull();
  });
});

describe('utilizable', () => {
  it('sandbox siempre; production solo con carta recibida y vigente', () => {
    expect(isAccountUsable(account({ environment: 'sandbox' }), '2026-10-29')).toBe(true);
    expect(isAccountUsable(account(), '2026-10-29')).toBe(false);
    expect(isAccountUsable(account({ authorization_status: 'received' }), '2026-10-29')).toBe(true);
    expect(isAuthorizationCurrent(account({ authorization_status: 'received', authorization_expires_at: '2026-10-28' }), '2026-10-29')).toBe(false);
    expect(isAuthorizationCurrent(account({ authorization_status: 'received', authorization_expires_at: '2026-10-29' }), '2026-10-29')).toBe(true);
  });
});
