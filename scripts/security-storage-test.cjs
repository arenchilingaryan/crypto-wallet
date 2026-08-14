const path = require("node:path");
const Module = require("node:module");
require("sucrase/register/ts");

const SRC = path.join(__dirname, "..", "src");
const EXPO_CRYPTO_STUB = path.join(__dirname, "expo-crypto.stub.cjs");

const orig = Module._resolveFilename;
Module._resolveFilename = function (req, ...rest) {
  if (req === "expo-crypto") {
    return EXPO_CRYPTO_STUB;
  }

  const mapped = req.startsWith("@/") ? path.join(SRC, req.slice(2)) : req;
  return orig.call(this, mapped, ...rest);
};

const store = new Map();
global.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};

const { expoSecretStore } = require(
  path.join(SRC, "platform/react-native/secretStore.web.ts"),
);
const { setUnlockMaterial, clearUnlockMaterial } = require(
  path.join(SRC, "platform/react-native/unlockMaterial.ts"),
);
const { clearAllPendingSecrets } = require(
  path.join(SRC, "platform/react-native/pendingSecrets.ts"),
);

const MNEMONIC =
  "congress plastic traffic siren cereal rare lend hood buzz business ask cross";
const ID = "0xabc";

let failed = 0;
function check(label, passed, detail = "") {
  console.log(`${passed ? "ok  " : "FAIL"} ${label}${detail ? ` — ${detail}` : ""}`);
  if (!passed) failed += 1;
}

(async () => {
  clearUnlockMaterial();

  await expoSecretStore.save(ID, { version: 1, mnemonic: MNEMONIC });

  const withoutKey = store.get("wallet.secret." + ID) ?? null;

  check(
    "a secret saved before the vault is open never touches storage in plaintext",
    withoutKey === null,
    withoutKey === null ? "nothing on disk" : `LEAKED: ${withoutKey.slice(0, 40)}`,
  );

  const staged = await expoSecretStore.load(ID);

  check(
    "the staged secret stays usable in memory for the rest of onboarding",
    !!staged && staged.mnemonic === MNEMONIC,
  );

  setUnlockMaterial(new Uint8Array(32).fill(7));

  await expoSecretStore.save(ID, { version: 1, mnemonic: MNEMONIC });

  const sealed = store.get("wallet.secret." + ID) ?? "";

  check(
    "once the vault is open the secret is written as a sealed vault, not plaintext",
    sealed.includes('"version":2') && !sealed.includes("congress"),
    sealed.slice(0, 40),
  );

  check(
    "the mnemonic never appears anywhere in storage in the clear",
    ![...store.values()].some((value) => value.includes("congress")),
  );

  // A staged (memory-only) secret must not outlive a lock.
  clearUnlockMaterial();

  await expoSecretStore.save("0xdef", { version: 1, mnemonic: MNEMONIC });

  // simulate securityApi.lock() clearing the in-memory staging area
  clearAllPendingSecrets();

  const afterLock = await expoSecretStore.load("0xdef");

  check(
    "a staged recovery phrase is wiped from memory when the wallet locks",
    afterLock === null,
    "the in-memory phrase does not survive a lock",
  );

  console.log(
    failed === 0
      ? "\nStorage never holds a plaintext recovery phrase"
      : `\nFAILED checks: ${failed}`,
  );

  if (failed > 0) {
    process.exit(1);
  }
})().catch((e) => {
  console.error("FAILED:", e);
  process.exit(1);
});
