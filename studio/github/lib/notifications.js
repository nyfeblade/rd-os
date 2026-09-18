"use strict";

const { reject, ok } = require("./errors");

const ENVELOPE_FIELDS = ["provider", "event", "received_at", "at_you", "tray_state", "identity", "payload"];
const IDENTITY_FIELDS = ["actor_kind", "actor_id", "as_user"];
const TRAY_STATES = ["live", "needs_auth", "error", "disconnected"];
const ACTOR_KINDS = ["user", "bot", "app"];

const SUBJECT_TO_EVENT = {
  Issue: "issue_comment",
  PullRequest: "pull_request",
  PullRequestReview: "pull_request_review",
  PullRequestReviewComment: "pull_request_review_comment",
  CheckSuite: "check_suite",
  CheckRun: "check_suite",
  WorkflowRun: "workflow_run",
};

const AT_YOU_REASONS = {
  mention: true,
  assign: true,
  review_requested: true,
  author: true,
  team_mention: true,
  security_alert: true,
  invitation: true,
  ci_activity: true,
};

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function eventOf(subjectType) {
  if (!Object.prototype.hasOwnProperty.call(SUBJECT_TO_EVENT, subjectType)) {
    return null;
  }
  return SUBJECT_TO_EVENT[subjectType];
}

function mapNotification(notification, opts) {
  const options = opts && typeof opts === "object" ? opts : {};
  if (!isObject(notification)) {
    return reject("UNKNOWN_EVENT", "notification is not an object");
  }
  const subject = isObject(notification.subject) ? notification.subject : {};
  const event = eventOf(subject.type);
  if (!event) {
    return reject("UNKNOWN_EVENT", `notification subject.type=${JSON.stringify(subject.type)}`);
  }
  const receivedAt = typeof notification.updated_at === "string" ? notification.updated_at.trim() : "";
  if (!receivedAt) {
    return reject("UNKNOWN_EVENT", "notification.updated_at is required");
  }
  const reason = typeof notification.reason === "string" ? notification.reason : "";
  const repo = isObject(notification.repository) ? notification.repository : {};
  const fullName = typeof repo.full_name === "string" ? repo.full_name : "";
  let trayState = "needs_auth";
  if (TRAY_STATES.includes(options.tray_state)) {
    trayState = options.tray_state;
  } else if (options.has_token === true) {
    trayState = "live";
  }
  const actorKind = ACTOR_KINDS.includes(options.actor_kind) ? options.actor_kind : "user";
  const envelope = {
    provider: "github",
    event,
    received_at: receivedAt,
    at_you: AT_YOU_REASONS[reason] === true,
    tray_state: trayState,
    identity: {
      actor_kind: actorKind,
      actor_id: typeof options.actor_id === "string" ? options.actor_id : "",
      as_user: options.as_user !== false,
    },
    payload: {
      id: notification.id != null ? String(notification.id) : "",
      reason,
      unread: notification.unread === true,
      subject: {
        title: typeof subject.title === "string" ? subject.title : "",
        type: typeof subject.type === "string" ? subject.type : "",
        url: typeof subject.url === "string" ? subject.url : "",
        latest_comment_url: typeof subject.latest_comment_url === "string" ? subject.latest_comment_url : "",
      },
      repository: { full_name: fullName },
    },
  };
  return ok(envelope);
}

function mapNotifications(list, opts) {
  if (!Array.isArray(list)) {
    return reject("UNKNOWN_EVENT", "notifications must be a list");
  }
  const envelopes = [];
  for (const item of list) {
    const mapped = mapNotification(item, opts);
    if (!mapped.ok) {
      return mapped;
    }
    envelopes.push(mapped.data);
  }
  return ok(envelopes);
}

module.exports = {
  ENVELOPE_FIELDS,
  IDENTITY_FIELDS,
  TRAY_STATES,
  ACTOR_KINDS,
  SUBJECT_TO_EVENT,
  AT_YOU_REASONS,
  eventOf,
  mapNotification,
  mapNotifications,
};
