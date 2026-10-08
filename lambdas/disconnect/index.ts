import { DeleteCommand } from '@aws-sdk/lib-dynamodb'
import type { APIGatewayProxyWebsocketHandlerV2 } from 'aws-lambda'
import { dynamo } from '../aws.js'
import { config } from '../config.js'
import { response } from '../http.js'

export const handler: APIGatewayProxyWebsocketHandlerV2 = async (event) => {
  const connectionId = event.requestContext.connectionId
  if (!connectionId) return response(400, { message: 'Connection ID ausente.' })

  try {
    await dynamo.send(new DeleteCommand({
      TableName: config.connectionsTable,
      Key: { connectionId },
    }))

    console.info('WebSocket connection removed', { connectionId })
    return response(200)
  } catch (error) {
    // $disconnect is best effort. Returning an error is useful for observability,
    // while DynamoDB TTL remains the fallback cleanup mechanism.
    console.error('Failed to remove WebSocket connection', { connectionId, error })
    return response(500, { message: 'Não foi possível remover a conexão.' })
  }
}
