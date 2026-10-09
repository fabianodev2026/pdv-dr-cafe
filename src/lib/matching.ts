// Busca tolerante, usada no app do cliente e no PDV.
//
// O telefone e digitado livremente em varias telas: com mascara no cadastro do
// app, solto no caixa, as vezes com codigo do pais. Comparar string com string
// fazia uma pendencia existente sumir da consulta. Aqui o telefone vira uma
// chave so de digitos e o texto perde acento e caixa, entao a consulta acha o
// registro de qualquer jeito, sem obrigar ninguem a digitar num formato unico.

export function onlyDigits(value: unknown): string {
  return String(value ?? '').replace(/\D/g, '')
}

/** Telefone comparavel: so digitos, sem o codigo do pais. */
export function phoneKey(value: unknown): string {
  const digits = onlyDigits(value)

  if (digits.length >= 12 && digits.startsWith('55')) {
    return digits.slice(2)
  }

  return digits
}

/**
 * Mesmo telefone escrito de formas diferentes.
 * Aceita mascara, espaco, codigo do pais e numero sem DDD, mas exige os 10
 * digitos finais iguais: em dado financeiro, deixar passar o numero de outra
 * pessoa e pior do que nao achar.
 */
export function samePhone(first: unknown, second: unknown): boolean {
  const left = phoneKey(first)
  const right = phoneKey(second)

  if (!left || !right) return false
  if (left === right) return true

  const shorter = left.length <= right.length ? left : right
  const longer = shorter === left ? right : left

  return shorter.length >= 10 && longer.endsWith(shorter)
}

/**
 * Padrao ilike que ignora qualquer separador entre os digitos, para o banco
 * devolver o registro mesmo gravado como "(11) 99999-8888" ou "11999998888".
 * O resultado ainda passa por samePhone, que descarta o que so parece.
 */
export function phoneLikePattern(value: unknown): string | null {
  const digits = phoneKey(value)
  if (digits.length < 8) return null

  return `%${digits.split('').join('%')}%`
}

/** Texto comparavel: sem acento, sem caixa e sem espaco sobrando. */
export function normalizeText(value: unknown): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
}

/**
 * Casa um termo livre com qualquer campo do registro: nome, telefone, cargo,
 * descricao, itens. Se o termo for numerico, compara tambem por digitos, entao
 * procurar "11999998888" acha o telefone gravado com mascara e vice-versa.
 */
export function matchesTerm(term: string, fields: Array<unknown>): boolean {
  const text = normalizeText(term)
  if (!text) return true

  const termDigits = onlyDigits(term)
  const searchByDigits = termDigits.length >= 3

  return fields.some((field) => {
    if (field === null || field === undefined) return false

    if (normalizeText(field).includes(text)) return true

    if (searchByDigits) {
      const fieldDigits = onlyDigits(field)
      if (fieldDigits && fieldDigits.includes(termDigits)) return true
    }

    return false
  })
}

/**
 * Formato padrao do telefone: (DD) 99999-8888.
 * Numero de 11 digitos sai com 5 digitos antes do traco e 4 depois; o de 10
 * digitos mantem 4 e 4. Nunca inventa o nono digito: numero curto demais fica
 * como o usuario digitou, para nao gravar um telefone que nao existe.
 */
export function formatPhone(value: string): string {
  const digits = phoneKey(value).slice(0, 11)

  if (digits.length <= 2) return digits ? `(${digits}` : ''
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`
  if (digits.length <= 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`
  }

  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
}
