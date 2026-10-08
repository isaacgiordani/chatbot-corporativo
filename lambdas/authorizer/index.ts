import type {
  APIGatewayAuthorizerResult,
  APIGatewayRequestAuthorizerEvent,
  APIGatewayRequestAuthorizerHandler,
} from 'aws-lambda'
import { CognitoJwtVerifier } from 'aws-jwt-verify'
import { config } from '../config.js'

interface VerifiedAccessToken {
  sub: string
  username?: string
  client_id?: string
  scope?: string
  'cognito:groups'?: string[]
}

let verifier: ReturnType<typeof CognitoJwtVerifier.create> | undefined

function getVerifier() {
  verifier ??= CognitoJwtVerifier.create({
    userPoolId: config.cognitoUserPoolId,
    tokenUse: 'access',
    clientId: config.cognitoUserPoolClientId,
  })
  return verifier
}

function headerValue(headers: APIGatewayRequestAuthorizerEvent['headers'], expectedName: string) {
  const entry = Object.entries(headers ?? {}).find(([name]) => name.toLowerCase() === expectedName.toLowerCase())
  return entry?.[1]?.trim()
}

export function extractAccessToken(
  event: Pick<APIGatewayRequestAuthorizerEvent, 'headers' | 'queryStringParameters'>,
  queryParamName = 'token',
) {
  const authorization = headerValue(event.headers, 'authorization')
  const bearer = authorization?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim()
  if (bearer) return bearer

  const queryToken = event.queryStringParameters?.[queryParamName]?.trim()
  return queryToken || undefined
}

export function allowPolicy(
  resource: string,
  payload: VerifiedAccessToken,
): APIGatewayAuthorizerResult {
  return {
    principalId: payload.sub,
    policyDocument: {
      Version: '2012-10-17',
      Statement: [{
        Action: 'execute-api:Invoke',
        Effect: 'Allow',
        Resource: resource,
      }],
    },
    context: {
      sub: payload.sub,
      username: payload.username ?? '',
      clientId: payload.client_id ?? '',
      scope: payload.scope ?? '',
      groups: payload['cognito:groups']?.join(',') ?? '',
    },
  }
}

export const handler: APIGatewayRequestAuthorizerHandler = async (event) => {
  try {
    const token = extractAccessToken(event, config.authorizerQueryParam)
    if (!token) throw new Error('Access token ausente.')

    const payload = await getVerifier().verify(token) as VerifiedAccessToken
    console.info('WebSocket connection authorized', { sub: payload.sub })
    return allowPolicy(event.methodArn, payload)
  } catch (error) {
    console.warn('WebSocket authorization rejected', {
      errorName: error instanceof Error ? error.name : 'UnknownError',
      message: error instanceof Error ? error.message : 'Unknown authorization error',
    })
    throw new Error('Unauthorized')
  }
}
