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

function collectCoreModules(directory) {
  const fs = require("node:fs");

  return fs
    .readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => {
      const full = path.join(directory, entry.name);

      if (entry.isDirectory()) {
        return collectCoreModules(full);
      }

      return entry.isFile() && entry.name.endsWith(".ts") ? [full] : [];
    });
}

const coreModules = collectCoreModules(path.join(SRC, "core"));

const failedModules = [];

for (const file of coreModules) {
  try {
    require(file);
  } catch (error) {
    failedModules.push(`${path.relative(SRC, file)}: ${error.message}`);
  }
}

console.log(
  failedModules.length === 0
    ? `ok   all ${coreModules.length} core modules loaded in Node`
    : `FAIL core modules failed to load:\n  ${failedModules.join("\n  ")}`,
);

if (failedModules.length > 0) {
  process.exit(1);
}

require("./core-in-node.ts")
  .main()
  .catch((error) => {
    console.error(error);

    process.exit(1);
  });
