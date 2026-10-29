export function detailedTextStats(text: string) {
  let characters = 0,
    nonSpace = 0,
    chinese = 0,
    punctuation = 0,
    words = 0
  for (const character of text) {
    characters++
    if (!/\s/u.test(character)) nonSpace++
    if (/\p{Script=Han}/u.test(character)) chinese++
    if (/\p{P}/u.test(character)) punctuation++
  }
  for (const _ of text.matchAll(
    /\p{Script=Latin}[\p{Script=Latin}\p{M}]*(?:['’-][\p{Script=Latin}\p{M}]+)*/gu,
  )) {
    void _
    words++
  }
  return {
    characters,
    nonSpace,
    chinese,
    words,
    punctuation,
    paragraphs: text.trim()
      ? text
          .trim()
          .replace(/\r\n?/g, '\n')
          .split(/\n\s*\n/).length
      : 0,
    readingMinutes: nonSpace ? Math.max(1, Math.ceil(chinese / 300 + words / 200)) : 0,
  }
}
