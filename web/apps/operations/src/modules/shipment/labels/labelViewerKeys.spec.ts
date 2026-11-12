import { describe, expect, it } from "vitest";
import { labelViewerAction } from "./labelViewerKeys";

describe("labelViewerAction", () => {
  it("navega y hace zoom", () => {
    expect(labelViewerAction({ key: "ArrowLeft" })).toBe("prev");
    expect(labelViewerAction({ key: "ArrowRight" })).toBe("next");
    expect(labelViewerAction({ key: "Home" })).toBe("first");
    expect(labelViewerAction({ key: "End" })).toBe("last");
    expect(labelViewerAction({ key: "+" })).toBe("zoomIn");
    expect(labelViewerAction({ key: "-" })).toBe("zoomOut");
    expect(labelViewerAction({ key: "0" })).toBe("zoomFit");
  });
  it("no pisa los atajos del navegador ni escribir en un campo", () => {
    expect(labelViewerAction({ key: "ArrowLeft", ctrlKey: true })).toBeNull();
    expect(labelViewerAction({ key: "-", metaKey: true })).toBeNull();
    expect(labelViewerAction({ key: "0", targetTag: "INPUT" })).toBeNull();
    expect(labelViewerAction({ key: "a" })).toBeNull();
  });
});
