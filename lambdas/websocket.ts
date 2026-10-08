export interface ChatRequest {
  action?: string
  conversationId?: string
  message: string
}

export class ValidationError extends Error {
  override name = 'ValidationError'
}

export function parseChatRequest(rawBody: string | null | undefined): ChatRequest {
  if (!rawBody) throw new ValidationError('O corpo da mensagem é obrigatório.')

  let parsed: unknown
  try {
    parsed = JSON.parse(rawBody)
  } catch {
    throw new ValidationError('A mensagem deve ser um JSON válido.')
  }

  if (!parsed || typeof parsed !== 'object') throw new ValidationError('A mensagem deve ser um objeto JSON.')
  const record = parsed as Record<string, unknown>
  const message = typeof record.message === 'string' ? record.message.trim() : ''
  if (!message) throw new ValidationError('O campo message é obrigatório.')
  if (message.length > 4_000) throw new ValidationError('O campo message deve ter no máximo 4.000 caracteres.')

  return {
    action: typeof record.action === 'string' ? record.action : undefined,
    conversationId: typeof record.conversationId === 'string' ? record.conversationId : undefined,
    message,
  }
}

export function managementEndpoint(domainName: string, stage: string, override = '') {
  if (override) return override.replace(/\/$/, '')
  if (!domainName || !stage) throw new Error('domainName and stage are required to build the callback endpoint.')
  return `https://${domainName}/${stage}`
}
