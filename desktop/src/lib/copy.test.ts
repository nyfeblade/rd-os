import { describe, expect, it } from "vitest";
import {
  RULES_PLAIN,
  experimentPlain,
  formatAge,
  gateFootEntry,
  waitingOnWho,
  whyPlain,
  baselinePlain,
} from "./copy";

describe("copy", () => {
  it("keeps the five designer Rules sentences", () => {
    expect(RULES_PLAIN).toEqual([
      "Plan in CA hours and proof minutes — not weeks — unless a human gate is listed.",
      "Run at least two cheap probes before accepting a plan, unless a real constraint says one is enough.",
      "Don’t accept scores or vibes as proof — require fetch/run evidence.",
      "Remember finished CA-hour baselines for the next plan.",
      "Keep what’s waiting next to these rules — don’t bury them.",
    ]);
  });

  it("uses Xm / Xh Ym / Xd ages", () => {
    expect(formatAge(12)).toBe("0m");
    expect(formatAge(720)).toBe("12m");
    expect(formatAge(3720)).toBe("1h 02m");
    expect(formatAge(86400)).toBe("1d");
  });

  it("labels waiting-on without accent words", () => {
    expect(waitingOnWho("human")).toBe("Human");
    expect(waitingOnWho("proof")).toBe("Proof");
    expect(waitingOnWho("agent")).toBe("Agent");
  });

  it("uses p0.why as the What line", () => {
    expect(whyPlain("Plan ready — merge gate on Exp-2 wedge")).toBe(
      "Plan ready — merge gate on Exp-2 wedge",
    );
  });

  it("humanizes gates and envelope nulls", () => {
    expect(experimentPlain("exp-2-wedge")).toBe("Exp-2");
    expect(gateFootEntry("exp-2-wedge:merge")).toBe("merge · Exp-2");
    expect(baselinePlain({ baseline_ca_hours: null })).toBe("No similar run yet");
  });
});
