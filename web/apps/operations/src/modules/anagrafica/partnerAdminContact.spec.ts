import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  accessLinkErrorText,
  buildCreatePayload,
  isPartnerForm,
  isValidEmail,
  validateAdminContact,
} from "@shared/anagrafiche/utils/accessLink";
import { ApiError } from "@shared/anagrafiche/services/api.types";

const httpMock = vi.fn();
vi.mock("@shared/anagrafiche/services/http", () => ({ http: (...a: unknown[]) => httpMock(...a) }));

const baseForm = { rag_soc: "Acme", nome_breve: "", tipo: "C", erp_partner: "N", legale: null };

describe("isValidEmail / validateAdminContact", () => {
  it("valida formato", () => {
    expect(isValidEmail("a@x.com")).toBe(true);
    expect(isValidEmail(" a@x.com ")).toBe(true);
    expect(isValidEmail("a@x")).toBe(false);
    expect(isValidEmail("a b@x.com")).toBe(false);
    expect(isValidEmail("")).toBe(false);
    expect(isValidEmail(null)).toBe(false);
  });
  it("nombre y correo obligatorios, con clave i18n por campo", () => {
    expect(validateAdminContact({ nome: " ", mail: "" })).toEqual({
      "admin_contact.nome": "anagrafiche.admin_contact.errors.nome_required",
      "admin_contact.mail": "anagrafiche.admin_contact.errors.mail_required",
    });
    expect(validateAdminContact({ nome: "Ana", mail: "mal" })).toEqual({
      "admin_contact.mail": "anagrafiche.admin_contact.errors.mail_invalid",
    });
    expect(validateAdminContact({ nome: "Ana", mail: "ana@x.com" })).toEqual({});
  });
});

describe("buildCreatePayload", () => {
  const admin = { nome: " Ana ", mail: " ana@x.com " };
  it("partner de TMWE: erp_partner S y admin_contact recortado", () => {
    const p = buildCreatePayload({ ...baseForm, tipo: "P", erp_partner: "S" }, admin, true);
    expect(isPartnerForm({ tipo: "P", erp_partner: "S" })).toBe(true);
    expect(p.erp_partner).toBe("S");
    expect(p.tipo).toBe("P");
    expect(p.admin_contact).toEqual({ nome: "Ana", mail: "ana@x.com" });
    expect(p).not.toHaveProperty("nome_breve");
    expect(p).not.toHaveProperty("legale");
  });
  it("cliente: no envía admin_contact ni erp_partner", () => {
    const p = buildCreatePayload(baseForm, admin, true);
    expect(p).not.toHaveProperty("admin_contact");
    expect(p).not.toHaveProperty("erp_partner");
    expect(p.rag_soc).toBe("Acme");
  });
  it("tipo P sin erp_partner S no es partner del sistema", () => {
    const p = buildCreatePayload({ ...baseForm, tipo: "P", erp_partner: "N" }, admin, true);
    expect(p).not.toHaveProperty("admin_contact");
    expect(p).not.toHaveProperty("erp_partner");
  });
  it("un usuario no TMWE nunca envía partner", () => {
    const p = buildCreatePayload({ ...baseForm, tipo: "P", erp_partner: "S" }, admin, false);
    expect(p).not.toHaveProperty("admin_contact");
    expect(p).not.toHaveProperty("erp_partner");
  });
});

const i18n = {
  t: (k: string, n?: Record<string, unknown>) => (n ? `${k}|${JSON.stringify(n)}` : k),
  te: (k: string) => k === "errors.api.CONTACT_EMAIL_REQUIRED" || k === "errors.api.ACCESS_LINK_SEND_FAILED",
};
function apiErr(status: number, code: string, details?: unknown): ApiError {
  return new ApiError("srv", status, "X", { success: false, error: { code, message: "srv msg", details } });
}

describe("accessLinkErrorText", () => {
  it("429 indica la espera en segundos o minutos", () => {
    expect(accessLinkErrorText(apiErr(429, "ACCESS_LINK_RATE_LIMITED", { retry_after: 42 }), i18n)).toBe(
      'anagrafiche.access_link.rate_limited_seconds|{"n":42}',
    );
    expect(accessLinkErrorText(apiErr(429, "ACCESS_LINK_RATE_LIMITED", { retry_after: 1200 }), i18n)).toBe(
      'anagrafiche.access_link.rate_limited_minutes|{"n":20}',
    );
    expect(accessLinkErrorText(apiErr(429, "ACCESS_LINK_RATE_LIMITED"), i18n)).toContain('"n":60');
  });
  it("códigos con traducción usan errors.api; sin ella, el mensaje del servidor", () => {
    expect(accessLinkErrorText(apiErr(422, "CONTACT_EMAIL_REQUIRED"), i18n)).toBe("errors.api.CONTACT_EMAIL_REQUIRED");
    expect(accessLinkErrorText(apiErr(502, "ACCESS_LINK_SEND_FAILED"), i18n)).toBe("errors.api.ACCESS_LINK_SEND_FAILED");
    expect(accessLinkErrorText(apiErr(403, "ACCOUNT_ADMIN_REQUIRED"), i18n)).toBe("srv");
  });
  it("404 sin código", () => {
    expect(accessLinkErrorText(new ApiError("nf", 404, undefined, {}), i18n)).toBe("anagrafiche.access_link.not_found");
  });
});

describe("servicios", () => {
  beforeEach(() => httpMock.mockReset());

  it("sendAccessLink hace POST /api_contact_access_link con id_contatto", async () => {
    httpMock.mockResolvedValue({ success: true, data: { id_contatto: 7, access_link_sent: true, sent_to: "a***@x.com" } });
    const { contattiService } = await import("@shared/anagrafiche/services/contatti.service");
    const r = await contattiService.sendAccessLink(7);
    expect(httpMock).toHaveBeenCalledWith("/api_contact_access_link", { method: "POST", body: { id_contatto: 7 } });
    expect(r).toEqual({ id_contatto: 7, access_link_sent: true, sent_to: "a***@x.com" });
  });

  it("create envía admin_contact tal cual y devuelve created_ids y access_link_sent", async () => {
    httpMock.mockResolvedValue({
      success: true,
      data: { id: 9, rag_soc: "P", created_ids: { anagrafica: 9, sedi: [], banche: [], contatti: [31], lettint: [] }, access_link_sent: false },
    });
    const { anagraficaService } = await import("@shared/anagrafiche/services/anagrafica.service");
    const body = { rag_soc: "P", tipo: "P", erp_partner: "S", admin_contact: { nome: "Ana", mail: "ana@x.com" } };
    const r = await anagraficaService.create(body);
    expect(httpMock).toHaveBeenCalledWith("/api_anagrafica_crud", { method: "POST", body });
    expect(r.created_ids?.contatti).toEqual([31]);
    expect(r.access_link_sent).toBe(false);
  });
});
