export function observePublicInfo<T>(params: Record<string, string>, change: (data: T) => void, error: () => void) {
  const url = new URL('https://tech-2d-auth-email.vercel.app/api/public-info')
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value)
  const controller = new AbortController()
  let timer: ReturnType<typeof setTimeout>
  let stopped = false
  async function poll() {
    try {
      const response = await fetch(url, { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]) })
      if (!response.ok) throw new Error('PUBLIC_INFO_UNAVAILABLE')
      const data = await response.json()
      if (!stopped) change(data)
    } catch { if (!stopped) error() }
    if (!stopped) timer = setTimeout(() => void poll(), 60000)
  }
  void poll()
  return () => { stopped = true; controller.abort(); clearTimeout(timer) }
}
