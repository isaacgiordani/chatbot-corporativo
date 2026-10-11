locals {
  connections_table_name = "${var.client}-${var.env}-websocket-connections"
  messages_table_name    = "${var.client}-${var.env}-websocket-messages"
}

resource "aws_dynamodb_table" "connections" {
  name         = local.connections_table_name
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "connectionId"

  attribute {
    name = "connectionId"
    type = "S"
  }

  ttl {
    enabled        = true
    attribute_name = "expiresAt"
  }

  server_side_encryption {
    enabled = true
  }
}

resource "aws_dynamodb_table" "messages" {
  name         = local.messages_table_name
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "messageId"

  attribute {
    name = "messageId"
    type = "S"
  }

  stream_enabled   = true
  stream_view_type = "NEW_IMAGE"

  server_side_encryption {
    enabled = true
  }
}

resource "aws_iam_role_policy" "connect_dynamodb" {
  name = "${local.lambda_base_name}-connect-dynamodb"
  role = aws_iam_role.lambda["connect"].id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["dynamodb:PutItem"]
      Resource = aws_dynamodb_table.connections.arn
    }]
  })
}

resource "aws_iam_role_policy" "disconnect_dynamodb" {
  name = "${local.lambda_base_name}-disconnect-dynamodb"
  role = aws_iam_role.lambda["disconnect"].id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["dynamodb:DeleteItem"]
      Resource = aws_dynamodb_table.connections.arn
    }]
  })
}

resource "aws_iam_role_policy" "message_persist_dynamodb" {
  name = "${local.lambda_base_name}-message-persist-dynamodb"
  role = aws_iam_role.lambda["message-persist"].id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["dynamodb:GetItem", "dynamodb:DeleteItem"]
        Resource = aws_dynamodb_table.connections.arn
      },
      {
        Effect   = "Allow"
        Action   = ["dynamodb:PutItem"]
        Resource = aws_dynamodb_table.messages.arn
      }
    ]
  })
}

resource "aws_iam_role_policy" "message_processor_dynamodb" {
  name = "${local.lambda_base_name}-message-processor-dynamodb"
  role = aws_iam_role.lambda["message-processor"].id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["dynamodb:DeleteItem"]
      Resource = aws_dynamodb_table.connections.arn
    }]
  })
}

resource "aws_iam_role_policy" "message_processor_stream" {
  name = "${local.lambda_base_name}-message-processor-stream"
  role = aws_iam_role.lambda["message-processor"].id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "dynamodb:DescribeStream",
          "dynamodb:GetRecords",
          "dynamodb:GetShardIterator",
          "dynamodb:ListStreams"
        ]
        Resource = "${aws_dynamodb_table.messages.arn}/stream/*"
      }
    ]
  })
}

resource "aws_lambda_event_source_mapping" "message_processor" {
  event_source_arn               = aws_dynamodb_table.messages.stream_arn
  function_name                  = aws_lambda_function.websocket["message-processor"].arn
  starting_position              = "LATEST"
  batch_size                     = 10
  maximum_record_age_in_seconds  = 3600
  maximum_retry_attempts         = 3
  bisect_batch_on_function_error = true
  function_response_types        = ["ReportBatchItemFailures"]
  enabled                        = true

  depends_on = [aws_iam_role_policy.message_processor_stream]
}
