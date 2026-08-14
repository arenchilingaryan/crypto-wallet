const nodeCrypto = require("node:crypto");

module.exports = {
  getRandomBytesAsync: async (n) => new Uint8Array(nodeCrypto.randomBytes(n)),

  getRandomBytes: (n) => new Uint8Array(nodeCrypto.randomBytes(n)),
};
