"use strict";

/**
 * Recipes: reusable rail packs. A recipe names a base mode and tightens it.
 * It can raise a floor or add reserved words; it can never drop a rail or loosen a requirement.
 * Pure functions: the caller loads the base mode and the recipe.
 */

const { RAILS } = require("./rails");

const FLAGS = ["require_measured_evidence", "require_kill_line", "require_retained"];

function composeMode(base, recipe) {
  const name = recipe && recipe.recipe;
  if (!name) throw new Error("recipe has no name");
  if (!base || base.mode !== recipe.base) {
    throw new Error(`recipe ${name} is built on ${JSON.stringify(recipe.base)}, got base mode ${base && base.mode}`);
  }

  const rails = Array.isArray(recipe.rails) ? recipe.rails : RAILS;
  for (const rail of RAILS) {
    if (!rails.includes(rail)) throw new Error(`recipe ${name} drops rail ${rail}; all three are mandatory`);
  }
  for (const rail of rails) {
    if (!RAILS.includes(rail)) throw new Error(`recipe ${name} names unknown rail "${rail}"`);
  }

  const t = recipe.tighten || {};
  const known = new Set(["min_evidence", "evidence_kinds", "verdict_words", ...FLAGS]);
  for (const key of Object.keys(t)) {
    if (!known.has(key)) throw new Error(`recipe ${name} tightens unknown field ${key}`);
  }

  const mode = { ...base, rails: [...RAILS], recipe: name };

  if (t.min_evidence !== undefined) {
    const floor = Number.isInteger(base.min_evidence) ? base.min_evidence : 1;
    if (!Number.isInteger(t.min_evidence) || t.min_evidence < floor) {
      throw new Error(`recipe ${name} lowers min_evidence below ${floor}`);
    }
    mode.min_evidence = t.min_evidence;
  }

  if (t.evidence_kinds !== undefined) {
    const allowed = base.evidence_kinds || [];
    const extra = (t.evidence_kinds || []).filter((kind) => !allowed.includes(kind));
    if (extra.length || !t.evidence_kinds.length) {
      throw new Error(`recipe ${name} may only narrow evidence_kinds within ${allowed.join("|")}`);
    }
    mode.evidence_kinds = [...t.evidence_kinds];
  }

  if (t.verdict_words !== undefined) {
    mode.verdict_words = [...new Set([...(base.verdict_words || []), ...t.verdict_words])];
  }

  for (const flag of FLAGS) {
    if (t[flag] === undefined) continue;
    if (t[flag] !== true) throw new Error(`recipe ${name} may only set ${flag} to true`);
    mode[flag] = true;
  }

  return mode;
}

module.exports = { composeMode };
