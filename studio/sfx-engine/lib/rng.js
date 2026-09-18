"use strict";

function toSeed(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value >>> 0;
  }
  return null;
}

function mixSeed(seed, salt) {
  let x = (toSeed(seed) === null ? 1 : seed) >>> 0;
  x ^= Math.imul(salt >>> 0, 0x27d4eb2d);
  x = Math.imul(x ^ (x >>> 16), 0x85ebca6b);
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35);
  return (x ^ (x >>> 16)) >>> 0;
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

module.exports = { toSeed, mixSeed, mulberry32 };
