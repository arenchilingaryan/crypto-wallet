interface MnemonicAnswer {
  index: number;
  word: string;
}

export function confirmMnemonic(
  mnemonic: string,
  answers: MnemonicAnswer[],
): boolean {
  const words = mnemonic.trim().split(/\s+/);

  return answers.every(({ index, word }) => {
    return words[index] === word.trim().toLowerCase();
  });
}
