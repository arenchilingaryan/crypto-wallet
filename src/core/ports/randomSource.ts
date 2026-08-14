export interface RandomSource {
  getBytes(length: number): Promise<Uint8Array>;
}
