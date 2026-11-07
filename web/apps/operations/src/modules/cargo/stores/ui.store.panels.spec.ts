import { beforeEach, describe, expect, it } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { useUiStore } from "./ui.store";

/** Documentos y auditoría son modales; solo el chat sigue siendo un panel lateral. */
describe("cargo ui.store: documentos y auditoría como modales", () => {
  beforeEach(() => setActivePinia(createPinia()));

  it("openDoc y openAudit usan la pila de modales (un solo modal a la vez)", () => {
    const ui = useUiStore();
    ui.openDoc();
    expect(ui.activeModal).toBe("documents");
    expect(ui.docOpen).toBe(true);
    expect(ui.auditOpen).toBe(false);
    ui.openAudit();
    expect(ui.activeModal).toBe("audit");
    expect(ui.docOpen).toBe(false);
    expect(ui.auditOpen).toBe(true);
  });

  it("closeModal los cierra", () => {
    const ui = useUiStore();
    ui.openDoc();
    ui.closeModal();
    expect(ui.docOpen).toBe(false);
    expect(ui.activeModal).toBeNull();
  });

  it("abrir el chat cierra los modales de documentos y auditoría, pero no otros modales", () => {
    const ui = useUiStore();
    ui.openAudit();
    ui.openChat();
    expect(ui.chatOpen).toBe(true);
    expect(ui.activeModal).toBeNull();
    ui.openModal("costi");
    ui.openChat();
    expect(ui.activeModal).toBe("costi");
  });

  it("abrir documentos o auditoría cierra el chat", () => {
    const ui = useUiStore();
    ui.openChat();
    ui.openDoc();
    expect(ui.chatOpen).toBe(false);
    ui.openChat();
    ui.openAudit();
    expect(ui.chatOpen).toBe(false);
  });

  it("closeAllDrawers cierra chat, documentos y auditoría sin tocar otros modales", () => {
    const ui = useUiStore();
    ui.openDoc();
    ui.closeAllDrawers();
    expect(ui.activeModal).toBeNull();
    ui.openModal("costi");
    ui.closeAllDrawers();
    expect(ui.activeModal).toBe("costi");
  });
});
