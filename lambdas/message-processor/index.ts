import { GoneException, PostToConnectionCommand } from '@aws-sdk/client-apigatewaymanagementapi'
import type { AttributeValue } from '@aws-sdk/client-dynamodb'
import { DeleteCommand } from '@aws-sdk/lib-dynamodb'
import { unmarshall } from '@aws-sdk/util-dynamodb'
import type { DynamoDBBatchResponse, DynamoDBRecord, DynamoDBStreamEvent, Handler } from 'aws-lambda'
import { createManagementClient, dynamo } from '../aws.js'
import { config } from '../config.js'
import { parseStoredMessage, receivedMessagePayload } from '../messages.js'
import { managementEndpoint } from '../websocket.js'

async function processRecord(record: DynamoDBRecord) {
  if (record.eventName !== 'INSERT' || !record.dynamodb?.NewImage) return

  const image = unmarshall(record.dynamodb.NewImage as Record<string, AttributeValue>)
  const message = parseStoredMessage(image)
  if (!message) {
    console.warn('DynamoDB stream record ignored because required message fields are missing', {
      eventId: record.eventID,
    })
    return
  }

  const management = createManagementClient(
    managementEndpoint(message.domainName, message.stage, config.callbackEndpoint),
  )

  try {
    await management.send(new PostToConnectionCommand({
      ConnectionId: message.connectionId,
      Data: Buffer.from(JSON.stringify(receivedMessagePayload(message, config.fixedResponse))),
    }))
    console.info('Persisted message acknowledgement sent', {
      messageId: message.messageId,
      conversationId: message.conversationId,
      connectionId: message.connectionId,
    })
  } catch (error) {
    if (error instanceof GoneException || (error as { name?: string })?.name === 'GoneException') {
      await dynamo.send(new DeleteCommand({
        TableName: config.connectionsTable,
        Key: { connectionId: message.connectionId },
      }))
      console.info('Stale WebSocket connection removed while processing stream record', {
        connectionId: message.connectionId,
        messageId: message.messageId,
      })
      return
    }
    throw error
  }
}

export const handler: Handler<DynamoDBStreamEvent, DynamoDBBatchResponse> = async (event) => {
  const batchItemFailures: DynamoDBBatchResponse['batchItemFailures'] = []

  for (const record of event.Records) {
    try {
      await processRecord(record)
    } catch (error) {
      console.error('Failed to process DynamoDB stream record', {
        eventId: record.eventID,
        sequenceNumber: record.dynamodb?.SequenceNumber,
        error,
      })
      if (record.dynamodb?.SequenceNumber) {
        batchItemFailures.push({ itemIdentifier: record.dynamodb.SequenceNumber })
      }
    }
  }

  return { batchItemFailures }
}
