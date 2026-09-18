import { describe, expect, it } from "vitest";
import { RULES_PLAIN, formatAge, waitingOnWho, whyPlain } from "./copy";

describe("copy", () => {
  it("keeps five HARD LAW sentences", () => {
    expect(RULES_PLAIN).toHaveLength(5);
  });

  it("uses tabular age units from the greyscale SoT", () => {
    expect(formatAge(12)).toBe("12s");
    expect(formatAge(720)).toBe("12m");
    expect(formatAge(3720)).toBe("1h 02m");
  });

  it("labels waiting-on without accent words", () => {
    expect(waitingOnWho("human")).toBe("Human");
    expect(waitingOnWho("proof")).toBe("Proof");
    expect(waitingOnWho("agent")).toBe("Agent");
  });

  it("maps dump why fields to the Waiting graphic", () => {
    expect(whyPlain("accepted plan waiting on human merge gate", "Exp-2 wedge")).toBe(
      "Plan ready — merge gate on Exp-2 wedge",
    );
    expect(whyPlain("packet present; Eng Proof owns verdict")).toBe("Checking claims…");
    expect(whyPlain("open packet needs fan-out / claim instrument")).toBe("Running probes…");
  });
});
