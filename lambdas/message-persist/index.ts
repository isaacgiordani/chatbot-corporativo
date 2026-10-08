import { DeleteConnectionCommand, GoneException } from '@aws-sdk/client-apigatewaymanagementapi'
import { DeleteCommand, GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb'
import type { APIGatewayProxyWebsocketHandlerV2 } from 'aws-lambda'
import { createManagementClient, dynamo } from '../aws.js'
import { config } from '../config.js'
import { response } from '../http.js'
import { createMessageItem } from '../messages.js'
import { managementEndpoint, parseChatRequest, ValidationError } from '../websocket.js'

export const handler: APIGatewayProxyWebsocketHandlerV2 = async (event) => {
  const { connectionId, domainName, stage, requestId } = event.requestContext
  if (!connectionId || !domainName || !stage) return response(400, { message: 'Contexto WebSocket incompleto.' })

  try {
    const request = parseChatRequest(event.body)
    const connection = await dynamo.send(new GetCommand({
      TableName: config.connectionsTable,
      Key: { connectionId },
      ConsistentRead: true,
    }))

    if (!connection.Item) {
      const management = createManagementClient(managementEndpoint(domainName, stage, config.callbackEndpoint))
      await management.send(new DeleteConnectionCommand({ ConnectionId: connectionId }))
      console.info('Unregistered WebSocket connection closed for re-registration', { connectionId })
      return response(401, { message: 'Conexão sem registro; reconexão solicitada.' })
    }

    const item = createMessageItem({
      request,
      connection: connection.Item,
      connectionId,
      domainName,
      stage,
      requestId,
    })

    await dynamo.send(new PutCommand({
      TableName: config.messagesTable,
      Item: item,
      ConditionExpression: 'attribute_not_exists(conversationId) AND attribute_not_exists(messageKey)',
    }))

    console.info('WebSocket message persisted', {
      connectionId,
      conversationId: item.conversationId,
      messageId: item.messageId,
    })
    return response(202, { messageId: item.messageId, status: item.status })
  } catch (error) {
    if (error instanceof GoneException || (error as { name?: string })?.name === 'GoneException') {
      await dynamo.send(new DeleteCommand({
        TableName: config.connectionsTable,
        Key: { connectionId },
      }))
      console.info('Stale WebSocket connection removed', { connectionId })
      return response(410, { message: 'A conexão não está mais ativa.' })
    }

    if (error instanceof ValidationError) return response(400, { message: error.message })

    console.error('Failed to persist WebSocket message', { connectionId, requestId, error })
    return response(500, { message: 'Não foi possível salvar a mensagem.' })
  }
}
