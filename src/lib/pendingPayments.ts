import { phoneLikePattern, samePhone } from './matching'
import { supabase } from './supabaseClient'

// Busca do saldo devedor de um telefone.
//
// Caminho preferido: a funcao get_pending_by_phone, que normaliza o telefone
// dentro do banco e devolve so as linhas daquele numero
// (supabase/sql/pending-payments-phone-lookup.sql).
//
// Se a funcao ainda nao foi aplicada no Supabase, cai para a consulta por
// padrao de texto. Nos dois casos o resultado passa por samePhone, que e o
// filtro que garante nao exibir a divida de outra pessoa.

const MISSING_FUNCTION_CODES = ['42883', 'PGRST202']

function isMissingFunction(error: { code?: string; message?: string } | null) {
  if (!error) return false
  if (error.code && MISSING_FUNCTION_CODES.includes(error.code)) return true

  const message = (error.message ?? '').toLowerCase()
  return message.includes('could not find the function') || message.includes('does not exist')
}

export type PendingLookupSource = 'rpc' | 'fallback'

export interface PendingLookupResult<T> {
  data: T[] | null
  error: unknown
  source: PendingLookupSource
}

export async function fetchPendingByPhone<T extends { phone?: string | null }>(
  phone: string,
): Promise<PendingLookupResult<T>> {
  const rpcResult = await supabase.rpc('get_pending_by_phone', { p_phone: phone })

  if (!rpcResult.error) {
    const rows = (rpcResult.data ?? []) as T[]
    return {
      data: rows.filter((row) => samePhone(row.phone, phone)),
      error: null,
      source: 'rpc',
    }
  }

  if (!isMissingFunction(rpcResult.error)) {
    return { data: null, error: rpcResult.error, source: 'rpc' }
  }

  const likePattern = phoneLikePattern(phone)
  const query = supabase.from('pending_payments').select('*').eq('status', 'pendente')
  const { data, error } = await (likePattern
    ? query.ilike('phone', likePattern)
    : query.eq('phone', phone))

  if (error) {
    return { data: null, error, source: 'fallback' }
  }

  const rows = (data ?? []) as T[]
  return {
    data: rows.filter((row) => samePhone(row.phone, phone)),
    error: null,
    source: 'fallback',
  }
}
