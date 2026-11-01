export const PROFILES = ["staff", "partner", "sinacc"] as const;
export type Profile = (typeof PROFILES)[number];

export function credentials(p: Profile): { user: string; pass: string } | null {
  const user = process.env[`E2E_${p.toUpperCase()}_USER`];
  const pass = process.env[`E2E_${p.toUpperCase()}_PASS`];
  return user && pass ? { user, pass } : null;
}

/** Capacidades que debe devolver /bff/auth/session por perfil (docs/plan-pruebas-ui.md §2). */
export const EXPECTED_CAPABILITIES: Record<Profile, string[]> = {
  staff: ["tmwe", "clients"],
  partner: ["clients", "my_org"],
  sinacc: [],
};
