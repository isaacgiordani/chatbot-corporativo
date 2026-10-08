import { randomUUID } from 'node:crypto'
import type { ChatRequest } from './websocket.js'
import { ValidationError } from './websocket.js'

export interface StoredMessage {
  conversationId: string
  messageKey: string
  messageId: string
  role: 'user'
  content: string
  status: 'RECEIVED'
  createdAt: string
  createdAtEpoch: number
  connectionId: string
  domainName: string
  stage: string
  requestId?: string
  userId?: string
}

interface CreateMessageInput {
  request: ChatRequest
  connection: Record<string, unknown>
  connectionId: string
  domainName: string
  stage: string
  requestId?: string
  now?: Date
  messageId?: string
}

function optionalString(value: unknown) {
  return typeof value === 'string' && value ? value : undefined
}

export function createMessageItem({
  request,
  connection,
  connectionId,
  domainName,
  stage,
  requestId,
  now = new Date(),
  messageId = randomUUID(),
}: CreateMessageInput): StoredMessage {
  const registeredConversationId = optionalString(connection.conversationId)
  if (registeredConversationId && request.conversationId && registeredConversationId !== request.conversationId) {
    throw new ValidationError('O conversationId não corresponde à conexão atual.')
  }

  const conversationId = registeredConversationId || request.conversationId
  if (!conversationId) throw new ValidationError('O conversationId é obrigatório.')

  const createdAt = now.toISOString()
  return {
    conversationId,
    messageKey: `${createdAt}#${messageId}`,
    messageId,
    role: 'user',
    content: request.message,
    status: 'RECEIVED',
    createdAt,
    createdAtEpoch: Math.floor(now.getTime() / 1_000),
    connectionId,
    domainName,
    stage,
    requestId,
    userId: optionalString(connection.userId),
  }
}

export function parseStoredMessage(value: Record<string, unknown>): StoredMessage | null {
  const required = ['conversationId', 'messageKey', 'messageId', 'content', 'createdAt', 'connectionId', 'domainName', 'stage'] as const
  if (required.some((key) => typeof value[key] !== 'string' || !value[key])) return null

  return value as unknown as StoredMessage
}

export function receivedMessagePayload(message: StoredMessage, acknowledgement: string) {
  return {
    type: 'assistant.message',
    content: `${acknowledgement} Texto salvo: "${message.content}"`,
    conversationId: message.conversationId,
    requestId: message.requestId || message.messageId,
    savedMessage: {
      messageId: message.messageId,
      conversationId: message.conversationId,
      role: message.role,
      content: message.content,
      status: message.status,
      createdAt: message.createdAt,
    },
  }
}
