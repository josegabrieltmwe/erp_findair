/** Raw `proposals[0]` as the backend sends it (contract §4). */
export function rawProposal(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    type: "confirm_proposal",
    proposal_id: "d07d7e11714abdeaae1760201081f9ff",
    token: "TOKEN-SIGNED-BASE64",
    action: "create_shipment",
    ruta: "ext_shipment",
    risk: "medium",
    reinforced_confirmation: false,
    draft: true,
    target: { kind: "express", id: null, awb: null, reference: null },
    payload: JSON.parse(
      '{"destination":{"name":"Mario Rossi","city":"Milano","country_code":"IT"},"shipment":{"reference":"PRUEBA-1"},"parcels":{"count":2,"weight":"7.50"},"options":{"auto_route":false}}',
    ),
    expires_at: "2026-10-23T07:45:19+00:00",
    expires_in: 300,
    confirm: {
      endpoint: "api_copilot_write_proposal",
      method: "POST",
      body: { op: "confirmar" },
    },
    ...overrides,
  };
}

export function rawCancel(): Record<string, unknown> {
  return rawProposal({
    action: "cancel_cargo",
    ruta: "ext_cargo_shipment_cancel",
    risk: "high",
    reinforced_confirmation: true,
    draft: false,
    target: { kind: "cargo", id: 900, awb: "176-123", reference: "R9" },
    payload: { id: 900 },
  });
}
