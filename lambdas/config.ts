function required(name: string) {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`Missing required environment variable: ${name}`)
  return value
}

function positiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value || '', 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

export const config = {
  get connectionsTable() { return required('CONNECTIONS_TABLE') },
  get messagesTable() { return required('MESSAGES_TABLE') },
  get cognitoUserPoolId() { return required('COGNITO_USER_POOL_ID') },
  get cognitoUserPoolClientId() { return required('COGNITO_USER_POOL_CLIENT_ID') },
  connectionsTtlHours: positiveInteger(process.env.CONNECTIONS_TTL_HOURS, 24),
  fixedResponse: process.env.FIXED_RESPONSE?.trim() || 'Obrigado pela mensagem! Como posso ajudar?',
  callbackEndpoint: process.env.WEBSOCKET_CALLBACK_ENDPOINT?.trim() || '',
  authorizerQueryParam: process.env.AUTH_TOKEN_QUERY_PARAM?.trim() || 'token',
}
