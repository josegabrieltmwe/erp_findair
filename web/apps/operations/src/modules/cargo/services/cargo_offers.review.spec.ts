import { describe, expect, it } from "vitest";
import { offerHasReply, offerNeedsReview } from "./cargo_offers.service";

describe("respuestas de aerolínea por revisar", () => {
  it("sin fecha de respuesta no hay respuesta", () => {
    expect(offerHasReply({ data_risp: null })).toBe(false);
    expect(offerHasReply({ data_risp: "0000-00-00 00:00:00" })).toBe(false);
    expect(offerHasReply({ data_risp: "2026-11-06 10:00:00" })).toBe(true);
  });

  it("solo cuenta la respondida y sin controlar", () => {
    expect(offerNeedsReview({ data_risp: "2026-11-06 10:00:00", controllata: "N" })).toBe(true);
    expect(offerNeedsReview({ data_risp: "2026-11-06 10:00:00", controllata: "S" })).toBe(false);
    expect(offerNeedsReview({ data_risp: "0000-00-00 00:00:00", controllata: "N" })).toBe(false);
  });
});
