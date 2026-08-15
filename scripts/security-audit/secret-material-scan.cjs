/* global __dirname */

const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
const { entropyToMnemonic, validateMnemonic } = require("@scure/bip39");
const { wordlist } = require("@scure/bip39/wordlists/english.js");

const repositoryRoot = path.join(__dirname, "..", "..");
const sourceExtensions = new Set([
  ".cjs",
  ".js",
  ".jsx",
  ".mjs",
  ".ts",
  ".tsx",
]);

// A recovery phrase does not have to sit in a string literal to be exposed. A
// fixture JSON, a note in a Markdown file, or a checked-in config leaks it just
// as completely, so every tracked text file is scanned — source files through
// the AST, everything else as plain text.
const BINARY_EXTENSIONS = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".ico",
  ".ttf",
  ".otf",
  ".woff",
  ".woff2",
  ".pdf",
  ".zip",
  ".jar",
  ".keystore",
  ".p12",
  ".mp4",
  ".mov",
]);

const mnemonicLengths = new Set([12, 15, 18, 21, 24]);
const maxMnemonicLength = 24;

function trackedFiles() {
  return execFileSync("git", ["ls-files", "-z"], {
    cwd: repositoryRoot,
    encoding: "utf8",
  })
    .split("\0")
    .filter(Boolean)
    .filter((file) => !BINARY_EXTENSIONS.has(path.extname(file).toLowerCase()));
}

function isSourceFile(relativePath) {
  return sourceExtensions.has(path.extname(relativePath).toLowerCase());
}

function lineOf(source, position) {
  return source.getLineAndCharacterOfPosition(position).line + 1;
}

function mnemonicInLiteral(value) {
  const words = value.trim().toLowerCase().split(/\s+/u);

  return (
    mnemonicLengths.has(words.length) &&
    words.every((word) => /^[a-z]+$/u.test(word)) &&
    validateMnemonic(words.join(" "), wordlist)
  );
}

function scanText(relativePath, text) {
  const source = ts.createSourceFile(
    relativePath,
    text,
    ts.ScriptTarget.Latest,
    true,
    relativePath.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const hits = [];

  function visit(node) {
    if (
      (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) &&
      mnemonicInLiteral(node.text)
    ) {
      hits.push({ file: relativePath, line: lineOf(source, node.getStart(source)) });
    }

    ts.forEachChild(node, visit);
  }

  visit(source);

  return hits;
}

// Words that belong to a phrase are adjacent, separated only by spaces. Runs
// are cut at anything else, so unrelated words on either side of punctuation
// cannot be stitched into a false positive.
function scanPlainText(relativePath, text) {
  const hits = [];
  const lines = text.split(/\r?\n/u);

  lines.forEach((line, index) => {
    const lower = line.toLowerCase();

    for (const run of lower.split(/[^a-z ]+/u)) {
      const words = run.split(" ").filter(Boolean);

      if (words.length < 12) {
        continue;
      }

      for (let start = 0; start < words.length; start += 1) {
        for (let length = 12; length <= maxMnemonicLength; length += 1) {
          if (!mnemonicLengths.has(length) || start + length > words.length) {
            continue;
          }

          const candidate = words.slice(start, start + length).join(" ");

          if (validateMnemonic(candidate, wordlist)) {
            hits.push({ file: relativePath, line: index + 1 });

            return;
          }
        }
      }
    }
  });

  return hits;
}

function scanFile(relativePath) {
  const absolutePath = path.join(repositoryRoot, relativePath);

  let text;

  try {
    text = fs.readFileSync(absolutePath, "utf8");
  } catch {
    // A tracked path that cannot be read is not evidence of safety, but it is
    // also not a literal. Report it so it is never silently skipped.
    console.error(`UNREADABLE ${relativePath}`);

    return [];
  }

  return isSourceFile(relativePath)
    ? scanText(relativePath, text)
    : scanPlainText(relativePath, text);
}

if (process.argv.includes("--self-test")) {
  const ephemeralFixture = entropyToMnemonic(
    Uint8Array.from({ length: 16 }, (_, index) => 255 - index),
    wordlist,
  );
  const hits = scanText(
    "ephemeral-fixture.ts",
    `const credential = ${JSON.stringify(ephemeralFixture)};`,
  );

  assert.equal(
    hits.length,
    1,
    "the scanner did not detect an in-memory BIP-39 literal fixture",
  );

  const plainHits = scanPlainText(
    "ephemeral-fixture.md",
    `notes\nrecovery: ${ephemeralFixture}\nend`,
  );

  assert.equal(
    plainHits.length,
    1,
    "the scanner did not detect a BIP-39 phrase outside a source file",
  );

  assert.equal(
    scanPlainText("ephemeral-fixture.md", "abandon. ".repeat(24)).length,
    0,
    "punctuation-separated words were stitched into a false positive",
  );

  console.log("ok   mnemonic-literal detector self-test");
}

// Scanning the working tree answers "is there a phrase in my editor right
// now?". It says nothing about what is committed, and a phrase removed from
// the working tree but still present in a commit is still published to
// everyone who can clone the repository. Every blob reachable from any ref is
// scanned, and the two answers are reported separately.
function historyHits() {
  let objects;

  try {
    objects = execFileSync("git", ["rev-list", "--objects", "--all"], {
      cwd: repositoryRoot,
      encoding: "utf8",
      maxBuffer: 256 * 1024 * 1024,
    });
  } catch {
    return { scanned: false, hits: [] };
  }

  const named = objects
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const space = line.indexOf(" ");

      return space === -1
        ? null
        : { sha: line.slice(0, space), name: line.slice(space + 1) };
    })
    .filter(
      (entry) =>
        entry !== null &&
        !BINARY_EXTENSIONS.has(path.extname(entry.name).toLowerCase()),
    );

  // `rev-list --objects` also lists trees; only blobs have content to read.
  let types;

  try {
    types = execFileSync(
      "git",
      ["cat-file", "--batch-check=%(objecttype) %(objectname)"],
      {
        cwd: repositoryRoot,
        encoding: "utf8",
        input: `${named.map((entry) => entry.sha).join("\n")}\n`,
        maxBuffer: 256 * 1024 * 1024,
      },
    );
  } catch {
    return { scanned: false, hits: [] };
  }

  const blobShas = new Set(
    types
      .split("\n")
      .filter((line) => line.startsWith("blob "))
      .map((line) => line.slice(5).trim()),
  );

  const blobs = named.filter((entry) => blobShas.has(entry.sha));

  const found = [];

  for (const blob of blobs) {
    let text;

    try {
      text = execFileSync("git", ["cat-file", "blob", blob.sha], {
        cwd: repositoryRoot,
        encoding: "utf8",
        maxBuffer: 64 * 1024 * 1024,
      });
    } catch {
      continue;
    }

    const scanned = isSourceFile(blob.name)
      ? scanText(blob.name, text)
      : scanPlainText(blob.name, text);

    for (const hit of scanned) {
      found.push({ file: `${blob.sha.slice(0, 12)}:${blob.name}`, line: hit.line });
    }
  }

  return { scanned: true, hits: found };
}

// A finding in history cannot be fixed by editing a file: the key is out, and
// only rotating it changes anything. A gate whose expected state is red gets
// ignored, so a rotation that actually happened can be recorded here — with
// who rotated it and when — and the finding then reports as accepted instead
// of failing. Nothing in this repository writes that file; a human does.
const ACKNOWLEDGEMENT_PATH = ".security-audit/rotated-secrets.json";

function acknowledgements() {
  try {
    const parsed = JSON.parse(
      fs.readFileSync(path.join(repositoryRoot, ACKNOWLEDGEMENT_PATH), "utf8"),
    );

    if (!Array.isArray(parsed)) {
      return new Map();
    }

    // An entry has to actually name a blob, a date and a person. A ledger that
    // accepts empty strings is a checkbox, not a record.
    return new Map(
      parsed
        .filter(
          (entry) =>
            entry &&
            typeof entry.blob === "string" &&
            /^[0-9a-f]{7,40}$/u.test(entry.blob) &&
            typeof entry.rotatedOn === "string" &&
            /^\d{4}-\d{2}-\d{2}$/u.test(entry.rotatedOn) &&
            typeof entry.rotatedBy === "string" &&
            entry.rotatedBy.trim().length > 0,
        )
        .map((entry) => [entry.blob, entry]),
    );
  } catch {
    return new Map();
  }
}

const hits = trackedFiles().flatMap(scanFile);
const history = historyHits();
const rotated = acknowledgements();

// A person copying a sha out of `git rev-list` gets the full 40 characters;
// the finding prints a 12-character prefix. Either has to match, or the ledger
// would silently never apply.
function rotationFor(hit) {
  const sha = hit.file.split(":")[0];

  for (const [blob, record] of rotated) {
    if (blob.startsWith(sha) || sha.startsWith(blob)) {
      return record;
    }
  }

  return null;
}

const unacknowledged = history.hits.filter((hit) => rotationFor(hit) === null);

let environmentFileIgnored = true;

try {
  execFileSync("git", ["check-ignore", "--quiet", ".env"], {
    cwd: repositoryRoot,
    stdio: "ignore",
  });
} catch {
  environmentFileIgnored = false;
}

if (hits.length > 0) {
  for (const hit of hits) {
    console.error(`BIP39_LITERAL working-tree ${hit.file}:${hit.line}`);
  }

  console.error(
    `FAIL ${hits.length} mnemonic literal(s) in the working tree`,
  );
} else {
  console.log("ok   no BIP-39 mnemonic literals in the working tree");
}

if (!history.scanned) {
  console.error(
    "UNKNOWN git history could not be read; nothing is claimed about committed content",
  );
} else if (history.hits.length > 0) {
  for (const hit of history.hits) {
    const record = rotationFor(hit);

    if (record) {
      console.log(
        `ack  history ${hit.file}:${hit.line} — key rotated ${record.rotatedOn} by ${record.rotatedBy}`,
      );
    } else {
      console.error(`BIP39_LITERAL history ${hit.file}:${hit.line}`);
    }
  }

  if (unacknowledged.length > 0) {
    console.error(
      `FAIL ${unacknowledged.length} mnemonic literal(s) reachable from Git history with no recorded rotation. Removing the line does not revoke the key: the wallet must be abandoned or rotated, every existing clone treated as holding it, and the rotation recorded in ${ACKNOWLEDGEMENT_PATH}.`,
    );
  } else {
    console.log(
      "ok   every mnemonic literal in Git history has a recorded rotation",
    );
  }
} else {
  console.log("ok   no BIP-39 mnemonic literals reachable from Git history");
}

if (!environmentFileIgnored) {
  console.error("ENV_NOT_IGNORED .env");
} else {
  console.log("ok   local .env is ignored by Git");
}

if (
  hits.length > 0 ||
  !history.scanned ||
  unacknowledged.length > 0 ||
  !environmentFileIgnored
) {
  process.exitCode = 1;
}
