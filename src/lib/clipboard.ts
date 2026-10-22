export async function clipboardWithTimeout<T>(action: () => Promise<T>, milliseconds = 1500): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      action(),
      new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('clipboard timed out')), milliseconds) }),
    ])
  } finally { if (timer) clearTimeout(timer) }
}
