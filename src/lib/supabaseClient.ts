import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Supabase nao configurado. Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.',
  )
}

const PAGINATED_TABLES = ['/rest/v1/pending_payments', '/rest/v1/pdv_customers']
const PAGE_SIZE = 1000

const fetchWithPagination: typeof fetch = async (input, init) => {
  const request = new Request(input, init)
  const url = new URL(request.url)
  const method = request.method.toUpperCase()
  const shouldPaginate = method === 'GET' && PAGINATED_TABLES.some((path) => url.pathname.endsWith(path))

  if (!shouldPaginate) {
    return fetch(request)
  }

  const allRows: unknown[] = []
  let offset = 0
  let total: number | null = null
  let firstResponse: Response | null = null

  while (true) {
    const pageRequest = new Request(request)
    pageRequest.headers.set('Range', `${offset}-${offset + PAGE_SIZE - 1}`)
    pageRequest.headers.set('Prefer', 'count=exact')

    const response = await fetch(pageRequest)
    if (!firstResponse) firstResponse = response

    if (!response.ok) {
      return response
    }

    const pageRows = (await response.json()) as unknown
    const rows = Array.isArray(pageRows) ? pageRows : []
    allRows.push(...rows)

    const contentRange = response.headers.get('content-range')
    const match = contentRange?.match(/\/(\d+|\*)$/)
    if (match && match[1] !== '*') {
      total = Number(match[1])
    }

    if (rows.length < PAGE_SIZE || (total !== null && allRows.length >= total)) {
      break
    }

    offset += PAGE_SIZE
  }

  const headers = new Headers(firstResponse?.headers)
  if (total !== null) {
    headers.set('content-range', `0-${Math.max(allRows.length - 1, 0)}/${total}`)
  }
  headers.set('content-type', 'application/json')

  return new Response(JSON.stringify(allRows), {
    status: firstResponse?.status ?? 200,
    statusText: firstResponse?.statusText ?? 'OK',
    headers,
  })
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: {
    fetch: fetchWithPagination,
  },
})
