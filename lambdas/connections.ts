import type { APIGatewayProxyWebsocketEventV2 } from 'aws-lambda'

type AuthorizerContext = Record<string, unknown> | undefined
type WebSocketRequestContextExtras = {
  authorizer?: AuthorizerContext
  identity?: {
    sourceIp?: string
    userAgent?: string
  }
}

function stringClaim(context: AuthorizerContext, ...names: string[]) {
  for (const name of names) {
    const value = context?.[name]
    if (typeof value === 'string' && value) return value
  }
  return undefined
}

export function connectionItem(event: APIGatewayProxyWebsocketEventV2, ttlHours: number, now = new Date()) {
  const { connectionId, domainName, stage } = event.requestContext
  if (!connectionId || !domainName || !stage) throw new Error('Missing WebSocket connection context.')

  // API Gateway includes these fields in WebSocket events even though the
  // current @types/aws-lambda V2 context does not declare them.
  const requestContext = event.requestContext as typeof event.requestContext & WebSocketRequestContextExtras
  const authorizer = requestContext.authorizer
  const connectedAtEpoch = Math.floor(now.getTime() / 1_000)
  return {
    connectionId,
    domainName,
    stage,
    connectedAt: now.toISOString(),
    connectedAtEpoch,
    expiresAt: connectedAtEpoch + ttlHours * 60 * 60,
    userId: stringClaim(authorizer, 'sub', 'principalId'),
    email: stringClaim(authorizer, 'email'),
    conversationId: event.queryStringParameters?.conversationId,
    sourceIp: requestContext.identity?.sourceIp,
    userAgent: requestContext.identity?.userAgent,
  }
}
