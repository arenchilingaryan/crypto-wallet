/* global __dirname */

const path = require("node:path");
const Module = require("node:module");

require("sucrase/register/ts");

const sourceRoot = path.join(__dirname, "..", "..", "src");
const resolveFilename = Module._resolveFilename;

Module._resolveFilename = function patchedResolve(request, ...rest) {
  const mapped = request.startsWith("@/")
    ? path.join(sourceRoot, request.slice(2))
    : request;

  return resolveFilename.call(this, mapped, ...rest);
};

require("./vault-signing-regressions.ts")
  .main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
