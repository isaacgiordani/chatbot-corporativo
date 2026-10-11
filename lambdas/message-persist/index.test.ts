import assert from 'node:assert/strict'
import test from 'node:test'
import { createMessageItem } from '../messages.js'

test('creates a chronologically sortable message item for DynamoDB', () => {
  const item = createMessageItem({
    request: {
      action: 'sendMessage',
      conversationId: 'conversation-1',
      message: 'Como faço para alterar meus dados?',
    },
    connection: { conversationId: 'conversation-1', userId: 'user-1' },
    connectionId: 'connection-1',
    domainName: 'abc.execute-api.us-east-1.amazonaws.com',
    stage: 'dev',
    requestId: 'request-1',
    now: new Date('2026-10-08T15:00:00.000Z'),
    messageId: 'message-1',
  })

  assert.deepEqual(item, {
    conversationId: 'conversation-1',
    messageKey: '2026-10-08T15:00:00.000Z#message-1',
    messageId: 'message-1',
    role: 'user',
    content: 'Como faço para alterar meus dados?',
    status: 'RECEIVED',
    createdAt: '2026-10-08T15:00:00.000Z',
    createdAtEpoch: 1791471600,
    connectionId: 'connection-1',
    domainName: 'abc.execute-api.us-east-1.amazonaws.com',
    stage: 'dev',
    requestId: 'request-1',
    userId: 'user-1',
  })
})

test('rejects a conversation id that differs from the registered connection', () => {
  assert.throws(() => createMessageItem({
    request: { conversationId: 'conversation-2', message: 'Olá' },
    connection: { conversationId: 'conversation-1' },
    connectionId: 'connection-1',
    domainName: 'example.com',
    stage: 'dev',
  }), /não corresponde/)
})
