// A second repair must not overwrite what the first one parked. Each
// unreadable value gets its own slot, so "the old record is kept" stays true
// however many times this happens.
const MAX_QUARANTINE_SLOTS = 50;

export class QuarantineFullError extends Error {
  constructor(base: string) {
    super(
      `There is no free place left to keep another unreadable copy of ${base}. Use "Forget the copies kept here" below, then repair again.`,
    );

    this.name = "QuarantineFullError";
  }
}

export async function freeQuarantineKey(
  base: string,
  read: (key: string) => Promise<string | null>,
): Promise<string> {
  for (let index = 0; index <= MAX_QUARANTINE_SLOTS; index += 1) {
    const key = index === 0 ? base : `${base}.${index}`;

    if ((await read(key)) === null) {
      return key;
    }
  }

  // Every slot is taken. Silently reusing the last one would quietly delete a
  // copy the screen promises is kept — refuse instead and say why.
  throw new QuarantineFullError(base);
}
