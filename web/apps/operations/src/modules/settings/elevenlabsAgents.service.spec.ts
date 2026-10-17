import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@shared/anagrafiche/services/api.types';

const httpMock = vi.fn();
vi.mock('@shared/anagrafiche/services/http', () => ({ http: (...args: unknown[]) => httpMock(...args) }));

import {
  AgentApiError,
  agentReviewService,
  canRequestReview,
  partnerAgentsService,
  severityColor,
  statusColor,
  toAgentError,
} from '@shared/elevenlabs_agents/services/elevenlabsAgents.service';

describe('partnerAgentsService', () => {
  beforeEach(() => {
    httpMock.mockReset();
  });

  it('crea enviando op=create y SIN id de partner', async () => {
    httpMock.mockResolvedValue({ success: true, data: { id: 5 } });
    await partnerAgentsService.create({ profile: 'public_form', agent_id: 'agent_abc', api_key: 'k' });
    const [url, options] = httpMock.mock.calls[0];
    expect(url).toBe('/api_partner_elevenlabs_agents');
    expect(options.method).toBe('POST');
    expect(options.body).toEqual({ op: 'create', profile: 'public_form', agent_id: 'agent_abc', api_key: 'k' });
    expect(JSON.stringify(options.body)).not.toContain('id_anagrafica');
  });

  it('valida, pide revision y edita con el id en el cuerpo', async () => {
    httpMock.mockResolvedValue({ success: true, data: {} });
    await partnerAgentsService.validate(7);
    await partnerAgentsService.requestReview(7);
    await partnerAgentsService.update(7, { description: 'x' });
    expect(httpMock.mock.calls[0][1].body).toEqual({ op: 'validate', id: 7 });
    expect(httpMock.mock.calls[1][1].body).toEqual({ op: 'request_review', id: 7 });
    expect(httpMock.mock.calls[2][1]).toEqual({ method: 'PUT', body: { id: 7, description: 'x' } });
  });

  it('borra por query y consulta por id', async () => {
    httpMock.mockResolvedValue({ success: true, data: {} });
    await partnerAgentsService.remove(9);
    await partnerAgentsService.get(9);
    expect(httpMock.mock.calls[0][1]).toEqual({ method: 'DELETE', query: { id: '9' } });
    expect(httpMock.mock.calls[1][1]).toEqual({ query: { id: '9' } });
  });

  it('un success=false se convierte en AgentApiError con el codigo del servidor', async () => {
    httpMock.mockResolvedValue({ success: false, error: 'profile_already_has_agent' });
    await expect(partnerAgentsService.list()).rejects.toMatchObject({ name: 'AgentApiError', code: 'profile_already_has_agent' });
  });

  it('un 422 con informe de auditoria conserva el informe', async () => {
    const report = { agent_name: 'A', blocking: 2, summary: {}, findings: [{ rule: 'P-21', severity: 'critical', area: 'seguridad', message: 'x', blocking: true }], version_id: 'v1', can_be_approved: false };
    httpMock.mockRejectedValue(new ApiError('audit_has_blockers', 422, undefined, { success: false, error: 'audit_has_blockers', details: report }));
    const err = await partnerAgentsService.requestReview(1).catch((e) => e);
    expect(err).toBeInstanceOf(AgentApiError);
    expect(err.code).toBe('audit_has_blockers');
    expect(err.status).toBe(422);
    expect(err.report?.findings[0].rule).toBe('P-21');
  });

  it('un 400 de validacion conserva los campos', async () => {
    httpMock.mockRejectedValue(new ApiError('invalid_input', 400, undefined, { success: false, error: 'invalid_input', details: { agent_id: 'invalid format' } }));
    const err = await partnerAgentsService.create({}).catch((e) => e);
    expect(err.code).toBe('invalid_input');
    expect(err.fields).toEqual({ agent_id: 'invalid format' });
    expect(err.report).toBeNull();
  });

  it('un fallo de red se normaliza', () => {
    const err = toAgentError(new Error('Failed to fetch'));
    expect(err.code).toBe('network_error');
    expect(err.status).toBe(0);
  });
});

describe('agentReviewService', () => {
  beforeEach(() => {
    httpMock.mockReset();
  });

  it('lista por estado', async () => {
    httpMock.mockResolvedValue({ success: true, data: { status: 'pending_review', agents: [{ id: 1 }] } });
    expect(await agentReviewService.list('pending_review')).toEqual([{ id: 1 }]);
    expect(httpMock.mock.calls[0]).toEqual(['/api_admin_elevenlabs_review', { query: { status: 'pending_review' } }]);
  });

  it('cada accion envia su op y las notas, sin aportar nunca una verificacion', async () => {
    httpMock.mockResolvedValue({ success: true, data: {} });
    await agentReviewService.inspect(3);
    await agentReviewService.approve(3, 'ok');
    await agentReviewService.reject(3, 'no');
    await agentReviewService.suspend(3, 'x');
    await agentReviewService.reactivate(3);
    const bodies = httpMock.mock.calls.map((c) => c[1].body);
    expect(bodies).toEqual([
      { op: 'inspect', id: 3 },
      { op: 'approve', id: 3, notes: 'ok' },
      { op: 'reject', id: 3, notes: 'no' },
      { op: 'suspend', id: 3, notes: 'x' },
      { op: 'reactivate', id: 3, notes: '' },
    ]);
    for (const b of bodies) {
      expect(Object.keys(b)).not.toContain('config_hash');
      expect(Object.keys(b)).not.toContain('verification');
    }
  });
});

describe('helpers de presentacion', () => {
  it('color por estado', () => {
    expect(statusColor('approved')).toBe('success');
    expect(statusColor('pending_review')).toBe('info');
    expect(statusColor('rejected')).toBe('error');
    expect(statusColor('suspended')).toBe('error');
    expect(statusColor('draft')).toBe('default');
    expect(statusColor(null)).toBe('default');
  });

  it('color por gravedad', () => {
    expect(severityColor('critical')).toBe('error');
    expect(severityColor('medium')).toBe('warning');
    expect(severityColor('info')).toBe('default');
  });

  it('solo se puede pedir revision desde borrador, rechazado o suspendido', () => {
    expect(['draft', 'rejected', 'suspended'].every(canRequestReview)).toBe(true);
    expect(['pending_review', 'approved', null, undefined].some(canRequestReview)).toBe(false);
  });
});
