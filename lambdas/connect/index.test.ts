import assert from 'node:assert/strict'
import test from 'node:test'
import type { APIGatewayProxyWebsocketEventV2 } from 'aws-lambda'
import { connectionItem } from '../connections.js'

test('creates a connection record with authorizer identity and TTL', () => {
  const now = new Date('2026-10-01T12:00:00.000Z')
  const event = {
    queryStringParameters: { conversationId: 'conversation-1' },
    requestContext: {
      connectionId: 'connection-1',
      domainName: 'abc.execute-api.us-east-1.amazonaws.com',
      stage: 'dev',
      authorizer: { sub: 'user-1', email: 'customer@example.com' },
      identity: { sourceIp: '203.0.113.10', userAgent: 'test-agent' },
    },
  } as unknown as APIGatewayProxyWebsocketEventV2

  assert.deepEqual(connectionItem(event, 2, now), {
    connectionId: 'connection-1',
    domainName: 'abc.execute-api.us-east-1.amazonaws.com',
    stage: 'dev',
    connectedAt: '2026-10-01T12:00:00.000Z',
    connectedAtEpoch: 1790856000,
    expiresAt: 1790863200,
    userId: 'user-1',
    email: 'customer@example.com',
    conversationId: 'conversation-1',
    sourceIp: '203.0.113.10',
    userAgent: 'test-agent',
  })
})
