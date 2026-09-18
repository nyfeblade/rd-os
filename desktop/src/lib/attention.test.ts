import { describe, expect, it } from "vitest";
import emptyDump from "../../fixtures/attention.dump.empty.json";
import flightDump from "../../fixtures/attention.dump.flight.json";
import humanDump from "../../fixtures/attention.dump.json";
import {
  firstHuman,
  isIdleP0,
  parseAttentionDump,
  waitingCaption,
  waitingFoot,
  waitingItems,
  whatLabel,
} from "./attention";
import { formatAge, waitingOnWho } from "./copy";

describe("parseAttentionDump", () => {
  it("accepts the human fixture and keeps HARD LAW beside P0", () => {
    const parsed = parseAttentionDump(humanDump);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      return;
    }
    expect(parsed.dump.p0?.waiting_on).toBe("human");
    expect(parsed.dump.hard_law).toContain("attention-beside-law");
  });

  it("rejects a payload that is not a dump", () => {
    const parsed = parseAttentionDump({ hello: "no" });
    expect(parsed.ok).toBe(false);
  });
});

describe("waiting table from dump", () => {
  it("maps the human fixture to what / waiting on / age", () => {
    const parsed = parseAttentionDump(humanDump);
    if (!parsed.ok) {
      throw new Error(parsed.reason);
    }
    const items = waitingItems(parsed.dump);
    expect(waitingCaption(items)).toBe("Open items · sorted by urgency");
    expect(whatLabel(items[0]!)).toBe("Plan ready — merge gate on Exp-2 wedge");
    expect(waitingOnWho(items[0]!.waiting_on)).toBe("Human");
    expect(formatAge(items[0]!.age_s)).toBe("12m");
    expect(firstHuman(items)?.id).toBe("exp-2-wedge");
    expect(items.filter((item) => item.waiting_on === "human")).toHaveLength(1);
    expect(waitingFoot(parsed.dump)).toContain("Open gates: merge · Exp-2");
    expect(waitingFoot(parsed.dump)).toContain("Last similar run: 2 CA hours");
  });

  it("treats idle dump as empty Waiting", () => {
    const parsed = parseAttentionDump(emptyDump);
    if (!parsed.ok) {
      throw new Error(parsed.reason);
    }
    expect(isIdleP0(parsed.dump.p0)).toBe(true);
    expect(waitingItems(parsed.dump)).toEqual([]);
  });

  it("does not put Approve targets on in-flight rows", () => {
    const parsed = parseAttentionDump(flightDump);
    if (!parsed.ok) {
      throw new Error(parsed.reason);
    }
    const items = waitingItems(parsed.dump);
    expect(waitingCaption(items)).toBe("Open items · no human gate");
    expect(firstHuman(items)).toBeNull();
    expect(items.every((item) => item.waiting_on !== "human")).toBe(true);
  });
});
