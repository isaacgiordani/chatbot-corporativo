import assert from 'node:assert/strict'
import test from 'node:test'
import { allowPolicy, extractAccessToken } from './index.js'

test('extracts a Bearer token from the Authorization header case-insensitively', () => {
  assert.equal(extractAccessToken({
    headers: { Authorization: 'Bearer header-token' },
    queryStringParameters: null,
  }), 'header-token')
})

test('falls back to the configured query string token', () => {
  assert.equal(extractAccessToken({
    headers: null,
    queryStringParameters: { access_token: 'query-token' },
  }, 'access_token'), 'query-token')
})

test('builds an allow policy with Cognito identity context', () => {
  const result = allowPolicy('arn:aws:execute-api:us-east-1:123456789012:api/dev/$connect', {
    sub: 'user-1',
    username: 'customer',
    client_id: 'client-1',
    scope: 'openid',
    'cognito:groups': ['customers'],
  })

  assert.equal(result.principalId, 'user-1')
  assert.equal(result.policyDocument.Statement[0]?.Effect, 'Allow')
  assert.deepEqual(result.context, {
    sub: 'user-1',
    username: 'customer',
    clientId: 'client-1',
    scope: 'openid',
    groups: 'customers',
  })
})
