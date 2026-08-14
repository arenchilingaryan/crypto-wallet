import * as Crypto from "expo-crypto";

import type { RandomSource } from "../../core/ports/randomSource";

export const expoRandomSource: RandomSource = {
  async getBytes(length) {
    return Crypto.getRandomBytesAsync(length);
  },
};
