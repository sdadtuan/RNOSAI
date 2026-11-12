/** Giới hạn tệp Solutions: tối đa 5 file, tổng dung lượng dưới 15MB. */
export const SOLUTION_FILE_MAX_COUNT = 5;
export const SOLUTION_FILE_MAX_TOTAL_BYTES = 15 * 1024 * 1024;

export function solutionFileTotalBytes(sizes: number[]): number {
  return sizes.reduce((sum, size) => sum + Math.max(0, size), 0);
}

export function solutionFileAddError(currentTotalBytes: number, incomingBytes: number, currentCount: number): string | null {
  if (currentCount >= SOLUTION_FILE_MAX_COUNT) return 'Tối đa 5 file';
  if (currentTotalBytes + incomingBytes > SOLUTION_FILE_MAX_TOTAL_BYTES) {
    return 'Tổng dung lượng tệp vượt quá 15MB';
  }
  return null;
}
