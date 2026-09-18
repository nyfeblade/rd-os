"use strict";

const { ok, reject, isNonEmptyString } = require("./result");
const { OUTCOME_SOURCES, OUTCOME_STATUSES, OUTCOME_SCHEMA } = require("./codes");
const { eventId } = require("./ids");
const { appendEvent, loadEvents } = require("./store");

function ingestOutcome(home, thread, input, nowIso) {
  const source = input && input.source;
  if (OUTCOME_SOURCES.indexOf(source) < 0) {
    return reject("UNKNOWN_OUTCOME_SOURCE", `source must be one of ${OUTCOME_SOURCES.join(", ")}`);
  }
  const status = input && input.status;
  if (OUTCOME_STATUSES.indexOf(status) < 0) {
    return reject("UNKNOWN_OUTCOME_STATUS", `status must be one of ${OUTCOME_STATUSES.join(", ")}`);
  }
  const event = {
    schema: OUTCOME_SCHEMA,
    id: eventId(),
    kind: "outcome",
    source,
    status,
    ref: isNonEmptyString(input.ref) ? input.ref.trim() : null,
    summary: isNonEmptyString(input.summary) ? input.summary.trim() : `${source} ${status}`,
    created_at: nowIso(),
    thread_id: thread.id,
    fingerprint: isNonEmptyString(input.fingerprint) ? input.fingerprint.trim() : null,
  };
  const saved = appendEvent(home, thread.id, event);
  if (!saved.ok) {
    return saved;
  }
  return ok(event);
}

function listOutcomes(home, threadId) {
  const loaded = loadEvents(home, threadId);
  if (!loaded.ok) {
    return loaded;
  }
  return ok(loaded.data.filter((row) => row && (row.kind === "outcome" || row.kind === "handoff")));
}

function fingerprintOf(pr, checks) {
  const prPart = pr ? `${pr.number}:${pr.updated_at || ""}:${pr.state}` : "none";
  const ciPart = checks ? `${checks.conclusion}:${(checks.failing || []).join(",")}` : "none";
  return `${prPart}|${ciPart}`;
}

async function pollOutcomes(home, thread, snapshot, nowIso) {
  const listed = listOutcomes(home, thread.id);
  if (!listed.ok) {
    return listed;
  }
  const fingerprint = fingerprintOf(snapshot.open_pr, snapshot.checks);
  const already = listed.data.some((row) => row.kind === "outcome" && row.fingerprint === fingerprint);
  const ingested = [];
  if (!already && (snapshot.open_pr || snapshot.checks)) {
    const status = snapshot.checks && snapshot.checks.conclusion === "failure" ? "failure" : snapshot.open_pr ? "running" : "unknown";
    const source = snapshot.checks ? "ci" : "pr";
    const summary = snapshot.checks && snapshot.checks.failing && snapshot.checks.failing.length
      ? `CI ${snapshot.checks.conclusion}: ${snapshot.checks.failing.join(", ")}`
      : snapshot.open_pr
        ? `PR #${snapshot.open_pr.number} ${snapshot.open_pr.title}`
        : "poll";
    const event = ingestOutcome(
      home,
      thread,
      {
        source,
        status,
        ref: snapshot.open_pr ? String(snapshot.open_pr.number) : snapshot.head,
        summary,
        fingerprint,
      },
      nowIso
    );
    if (event.ok) {
      ingested.push(event.data);
    }
  }
  const next = listOutcomes(home, thread.id);
  if (!next.ok) {
    return next;
  }
  return ok({
    schema: OUTCOME_SCHEMA,
    polled: true,
    mode: snapshot.open_pr || snapshot.checks ? "live" : "stub",
    fingerprint,
    ingested,
    events: next.data,
  });
}

module.exports = {
  ingestOutcome,
  listOutcomes,
  pollOutcomes,
  fingerprintOf,
};
