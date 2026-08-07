import * as Crypto from "expo-crypto";

import type { RandomSource } from "../../core/wallet/ports/randomSource";

export const expoRandomSource: RandomSource = {
  async getBytes(length) {
    return Crypto.getRandomBytesAsync(length);
  },
};
