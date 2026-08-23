export function lazyWithTimeout<T>(loader: () => Promise<T>, milliseconds: number, message: string) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), milliseconds);
  });
  return Promise.race([loader(), timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}
