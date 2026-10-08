import { PutCommand } from '@aws-sdk/lib-dynamodb'
import type { APIGatewayProxyWebsocketHandlerV2 } from 'aws-lambda'
import { dynamo } from '../aws.js'
import { config } from '../config.js'
import { connectionItem } from '../connections.js'
import { response } from '../http.js'

export const handler: APIGatewayProxyWebsocketHandlerV2 = async (event) => {
  try {
    const item = connectionItem(event, config.connectionsTtlHours)
    await dynamo.send(new PutCommand({
      TableName: config.connectionsTable,
      Item: item,
      ConditionExpression: 'attribute_not_exists(connectionId)',
    }))

    console.info('WebSocket connection stored', { connectionId: item.connectionId, userId: item.userId })
    return response(200)
  } catch (error) {
    console.error('Failed to store WebSocket connection', { error })
    return response(500, { message: 'Não foi possível registrar a conexão.' })
  }
}
