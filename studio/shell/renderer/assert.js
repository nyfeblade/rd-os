"use strict";

(function attachAssert(Studio) {
  function assertNever(value) {
    throw new Error(`unhandled variant: ${value}`);
  }

  Studio.assertNever = assertNever;
})(globalThis.StudioShell = globalThis.StudioShell || {});
