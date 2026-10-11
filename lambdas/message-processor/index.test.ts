import assert from 'node:assert/strict'
import test from 'node:test'
import { receivedMessagePayload } from '../messages.js'
import { managementEndpoint, parseChatRequest } from '../websocket.js'

test('builds the execute-api management endpoint with the stage', () => {
  assert.equal(
    managementEndpoint('abc.execute-api.us-east-1.amazonaws.com', 'prod'),
    'https://abc.execute-api.us-east-1.amazonaws.com/prod',
  )
})

test('uses an explicit callback endpoint for custom domains', () => {
  assert.equal(managementEndpoint('ignored', 'ignored', 'https://ws.example.com/'), 'https://ws.example.com')
})

test('parses the frontend WebSocket contract', () => {
  assert.deepEqual(parseChatRequest(JSON.stringify({
    action: 'sendMessage',
    conversationId: 'conversation-1',
    message: '  Como faço para alterar meus dados?  ',
  })), {
    action: 'sendMessage',
    conversationId: 'conversation-1',
    message: 'Como faço para alterar meus dados?',
  })
})

test('rejects messages without content', () => {
  assert.throws(() => parseChatRequest('{"action":"sendMessage"}'), /message é obrigatório/)
})

test('creates a generic acknowledgement and returns the persisted message separately', () => {
  const payload = receivedMessagePayload({
    conversationId: 'conversation-1',
    messageKey: '2026-10-08T15:00:00.000Z#message-1',
    messageId: 'message-1',
    role: 'user',
    content: 'Preciso de ajuda com uma dúvida',
    status: 'RECEIVED',
    createdAt: '2026-10-08T15:00:00.000Z',
    createdAtEpoch: 1791471600,
    connectionId: 'connection-1',
    domainName: 'example.com',
    stage: 'dev',
  }, 'Obrigado pela mensagem! Como posso ajudar?')

  assert.equal(
    payload.content,
    'Obrigado pela mensagem! Como posso ajudar?',
  )
  assert.equal(payload.savedMessage.content, 'Preciso de ajuda com uma dúvida')
})
