/* global __dirname */

const path = require("node:path");
const Module = require("node:module");

require("sucrase/register/ts");

const SRC = path.join(__dirname, "..", "src");
const resolveFilename = Module._resolveFilename;

Module._resolveFilename = function patchedResolve(request, ...rest) {
  const mapped = request.startsWith("@/")
    ? path.join(SRC, request.slice(2))
    : request;

  return resolveFilename.call(this, mapped, ...rest);
};

async function main() {
  await require("./token-intelligence-in-node.ts").main();
  await require("./token-intelligence-provider-in-node.ts").main();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
