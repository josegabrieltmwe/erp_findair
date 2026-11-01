#!/usr/bin/env node
/**
 * Servidor simulado del contrato ai-admin/1 (docs/06-api/agentes-ia/10-contrato-ai-admin.md en tmwe_json).
 * Solo desarrollo: sirve /bff/v1/<ruta> con las fixtures de
 *   $AI_ADMIN_FIXTURES (por defecto tmwe_json/docs/06-api/agentes-ia/ai-admin-fixtures/<ruta>.<metodo>.json)
 * y, si falta alguna, con las respuestas de ejemplo del propio contrato.
 *
 *   node tests/dev/ai-admin-mock.mjs [puerto]     # 8787 por defecto
 *   AI_ADMIN_MOCK_FAIL=AI_FORBIDDEN node ...      # fuerza el error en todas las rutas
 *
 * Apunta el proxy de Vite (o el navegador) a http://localhost:8787. No toca la API.
 */
import { createServer } from 'node:http';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const port = Number(process.argv[2] ?? 8787);
const dir = process.env.AI_ADMIN_FIXTURES ?? '/var/www/host/tmwe/erp/tmwe_json/docs/06-api/agentes-ia/ai-admin-fixtures';
const fail = process.env.AI_ADMIN_MOCK_FAIL;
const STATUS = { AI_FORBIDDEN: 403, AI_VALIDATION: 422, AI_NOT_FOUND: 404, AI_BUDGET_EXCEEDED: 429, AI_TIMEOUT: 504, AI_UNAVAILABLE: 503 };

const totals = { tokens_in: 1200, tokens_out: 800, voice_seconds: 360, cost_cents: 42, requests: 12, errors: 1 };
const samples = {
  'api_admin_ai_settings.get': { items: [
    { key: 'specialist_enabled', value: '1', scope: 'global' },
    { key: 'copilot_enabled', value: '1', scope: 'global' },
    { key: 'voice_enabled', value: '0', scope: 'partner' },
    { key: 'voice_memory_enabled', value: '0', scope: 'global' },
    { key: 'provider_preference', value: 'anthropic', scope: 'global' },
  ] },
  'api_admin_ai_budgets.get': { items: [
    { id: 1, partner_id: null, feature: 'copilot', period: 'month', max_tokens: 1000000, max_voice_minutes: null, max_cost_cents: 5000 },
  ] },
  'api_admin_ai_usage.get': { totals, series: [
    { key: 'copilot', ...totals, requests: 8 },
    { key: 'voice', ...totals, requests: 4, cost_cents: null },
  ] },
  'api_admin_ai_audit.get': { items: [
    { id: 9, ts: '2026-10-20 10:00:00', partner_id: 1, user_id: 3, actor_client_id: 'erp', feature: 'copilot', event: 'AI_REQUEST', request_id: 'req-1', tool_names: 'list_shipments', status: 'ok', error_code: null },
  ], next_cursor: null },
  'api_admin_copilot_memory.get': { items: [{ id: 4, user_id: 3, created_at: '2026-10-19 09:00:00', size_chars: 640 }], next_cursor: null },
  'api_admin_elevenlabs_health.get': [
    { profile: 'copilot_operator', agent_id_set: true, key_set: true, last_sync_at: '2026-10-18 08:00:00', tools_expected: 12, tools_remote: null, drift: false, last_agent_token_at: '2026-10-20 09:00:00' },
    { profile: 'public_form', agent_id_set: true, key_set: true, last_sync_at: null, tools_expected: 5, tools_remote: null, drift: true, last_agent_token_at: null },
  ],
  // «Mis credenciales de IA»: un partner con clave propia (uses_tmwe_key=false). Para ver el aviso de fallback
  // a TMWE, cambia source a 'global' y uses_tmwe_key a true. Nunca lleva la clave: solo has_key.
  'api_admin_ai_my_credentials.get': {
    items: [{ id: 21, provider: 'anthropic', name: 'Mi clave', model: 'claude-sonnet-5', is_default: 'S', has_key: true, created_at: '2026-10-20 10:00:00', updated_at: '2026-10-21 09:30:00' }],
    effective: { source: 'partner', provider: 'anthropic', uses_tmwe_key: false },
  },
  'api_admin_ai_my_credentials.post': { id: 22, provider: 'openai', name: '', model: '', is_default: 'N', has_key: true },
  'api_admin_ai_my_credentials.put': { id: 21, provider: 'anthropic', name: 'Mi clave', model: 'claude-sonnet-5', is_default: 'S', has_key: true },
  'api_admin_ai_my_credentials.delete': { id: 21, effective: { source: 'global', provider: 'anthropic', uses_tmwe_key: true } },
  'api_admin_ai_settings.put': {}, 'api_admin_ai_budgets.put': {}, 'api_admin_ai_budgets.delete': {},
  'api_admin_copilot_memory.delete': { deleted: 1 },
};

function body(route, method) {
  const name = `${route}.${method.toLowerCase()}`;
  // La API nombra las fixtures con el método en mayúsculas (<ruta>.GET.json).
  const file = [`${route}.${method.toUpperCase()}`, name].map((n) => join(dir, `${n}.json`)).find(existsSync);
  if (file) {
    const j = JSON.parse(readFileSync(file, 'utf8'));
    return j && typeof j === 'object' && 'success' in j ? j : { success: true, data: j };
  }
  return name in samples ? { success: true, data: samples[name] } : null;
}

createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://x');
  const route = url.pathname.replace(/^\/bff\/v1\//, '').replace(/^\//, '');
  const send = (status, json) => {
    res.writeHead(status, { 'content-type': 'application/json', 'X-AI-Admin-Contract': 'ai-admin/1' });
    res.end(JSON.stringify(json));
  };
  if (fail) return send(STATUS[fail] ?? 500, { success: false, error_code: fail, error: `mock ${fail}` });
  const b = body(route, req.method ?? 'GET');
  if (!b) return send(404, { success: false, error_code: 'AI_NOT_FOUND', error: `sin fixture: ${req.method} ${route}` });
  send(200, b);
}).listen(port, () => console.log(`ai-admin mock en http://localhost:${port} (fixtures: ${existsSync(dir) ? dir : 'ejemplos del contrato'})`));
