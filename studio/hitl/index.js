"use strict";

const { REJECT_CODES } = require("./lib/codes");
const {
  DECISIONS,
  FORBIDDEN_DECISION_ACTORS,
  GATE_KINDS,
  GATE_STATUSES,
  HIGH_RISK_KINDS,
  HUMAN_ACTOR,
  isHighRiskKind,
  needYouOf,
  riskOf,
} = require("./lib/kinds");
const { createHitlKernel } = require("./lib/kernel");

module.exports = {
  createHitlKernel,
  DECISIONS,
  FORBIDDEN_DECISION_ACTORS,
  GATE_KINDS,
  GATE_STATUSES,
  HIGH_RISK_KINDS,
  HUMAN_ACTOR,
  REJECT_CODES,
  isHighRiskKind,
  needYouOf,
  riskOf,
};
