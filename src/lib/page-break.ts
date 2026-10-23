/** Return a cut between two nearly white scanlines, nearest the bottom of the band. */
export function findWhitespaceCut(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
): number | null {
  let blankRows = 0
  for (let y = height - 1; y >= 0; y--) {
    let blank = true
    for (let x = 0; x < width; x++) {
      const offset = (y * width + x) * 4
      if (
        pixels[offset + 3] > 5 &&
        (pixels[offset] < 250 || pixels[offset + 1] < 250 || pixels[offset + 2] < 250)
      ) {
        blank = false
        break
      }
    }
    blankRows = blank ? blankRows + 1 : 0
    if (blankRows >= 2) return y + 1
  }
  return null
}
