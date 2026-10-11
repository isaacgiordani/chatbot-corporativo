locals {
  lambda_base_name       = "${var.client}-${var.env}-chatbot-corporativo"
  connections_table_name = "${var.client}-${var.env}-websocket-connections"
  messages_table_name    = "${var.client}-${var.env}-websocket-messages"

  lambda_functions = {
    authorizer = {
      timeout = 10
      environment = {
        COGNITO_USER_POOL_ID        = aws_cognito_user_pool.site.id
        COGNITO_USER_POOL_CLIENT_ID = aws_cognito_user_pool_client.site_spa.id
        AUTH_TOKEN_QUERY_PARAM      = "token"
      }
    }
    connect = {
      timeout = 10
      environment = {
        CONNECTIONS_TABLE     = local.connections_table_name
        CONNECTIONS_TTL_HOURS = "24"
      }
    }
    disconnect = {
      timeout = 10
      environment = {
        CONNECTIONS_TABLE = local.connections_table_name
      }
    }
    message-persist = {
      timeout = 15
      environment = {
        CONNECTIONS_TABLE = local.connections_table_name
        MESSAGES_TABLE    = local.messages_table_name
      }
    }
    message-processor = {
      timeout = 30
      environment = {
        CONNECTIONS_TABLE = local.connections_table_name
        FIXED_RESPONSE    = "Sua mensagem foi recebida e o código será alterado depois."
      }
    }
  }

  api_gateway_lambda_functions = toset(["connect", "disconnect", "message-persist"])
}

data "aws_iam_policy_document" "lambda_assume_role" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "lambda" {
  for_each = local.lambda_functions

  name               = "${local.lambda_base_name}-${each.key}-role"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume_role.json
}

resource "aws_iam_role_policy_attachment" "lambda_basic_execution" {
  for_each = local.lambda_functions

  role       = aws_iam_role.lambda[each.key].name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_cloudwatch_log_group" "lambda" {
  for_each = local.lambda_functions

  name              = "/aws/lambda/${local.lambda_base_name}-${each.key}"
  retention_in_days = 14
}

resource "aws_lambda_function" "websocket" {
  for_each = local.lambda_functions

  function_name = "${local.lambda_base_name}-${each.key}"
  description   = "${each.key} do chatbot-corporativo."
  role          = aws_iam_role.lambda[each.key].arn
  runtime       = "nodejs22.x"
  handler       = "index.handler"
  filename      = "${path.module}/../lambdas/dist/${each.key}.zip"
  source_code_hash = filebase64sha256(
    "${path.module}/../lambdas/dist/${each.key}.zip"
  )
  timeout = each.value.timeout

  environment {
    variables = each.value.environment
  }

  depends_on = [
    aws_iam_role_policy_attachment.lambda_basic_execution,
    aws_cloudwatch_log_group.lambda,
  ]
}

resource "aws_iam_role_policy" "connect_dynamodb" {
  name = "${local.lambda_base_name}-connect-dynamodb"
  role = aws_iam_role.lambda["connect"].id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["dynamodb:PutItem"]
      Resource = "arn:aws:dynamodb:${var.aws_region}:${var.AccountId}:table/${local.connections_table_name}"
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
      Resource = "arn:aws:dynamodb:${var.aws_region}:${var.AccountId}:table/${local.connections_table_name}"
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
        Resource = "arn:aws:dynamodb:${var.aws_region}:${var.AccountId}:table/${local.connections_table_name}"
      },
      {
        Effect   = "Allow"
        Action   = ["dynamodb:PutItem"]
        Resource = "arn:aws:dynamodb:${var.aws_region}:${var.AccountId}:table/${local.messages_table_name}"
      }
    ]
  })
}

resource "aws_iam_role_policy" "message_persist_manage_connections" {
  name = "${local.lambda_base_name}-message-persist-manage-connections"
  role = aws_iam_role.lambda["message-persist"].id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["execute-api:ManageConnections"]
      Resource = "${aws_apigatewayv2_api.websocket.execution_arn}/${aws_apigatewayv2_stage.websocket.name}/POST/@connections/*"
    }]
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
      Resource = "arn:aws:dynamodb:${var.aws_region}:${var.AccountId}:table/${local.connections_table_name}"
    }]
  })
}

resource "aws_iam_role_policy" "message_processor_manage_connections" {
  name = "${local.lambda_base_name}-message-processor-manage-connections"
  role = aws_iam_role.lambda["message-processor"].id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["execute-api:ManageConnections"]
      Resource = "${aws_apigatewayv2_api.websocket.execution_arn}/${aws_apigatewayv2_stage.websocket.name}/POST/@connections/*"
    }]
  })
}

resource "aws_apigatewayv2_api" "websocket" {
  name                       = "chatbot-corporativo"
  protocol_type              = "WEBSOCKET"
  route_selection_expression = "$request.body.action"
  ip_address_type            = "ipv4"
}

resource "aws_apigatewayv2_authorizer" "websocket" {
  api_id           = aws_apigatewayv2_api.websocket.id
  name             = "chatbot-corporativo-cognito-authorizer"
  authorizer_type  = "REQUEST"
  authorizer_uri   = aws_lambda_function.websocket["authorizer"].invoke_arn
  identity_sources = ["route.request.querystring.token"]
}

resource "aws_lambda_permission" "websocket_authorizer" {
  statement_id  = "AllowWebSocketApiInvokeAuthorizer"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.websocket["authorizer"].function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.websocket.execution_arn}/authorizers/${aws_apigatewayv2_authorizer.websocket.id}"
}

locals {
  websocket_route_integrations = {
    "$connect"    = "connect"
    "$disconnect" = "disconnect"
    "sendMessage" = "message-persist"
    "$default"    = "message-persist"
  }
}

resource "aws_apigatewayv2_integration" "websocket" {
  for_each = local.websocket_route_integrations

  api_id                 = aws_apigatewayv2_api.websocket.id
  integration_type       = "AWS_PROXY"
  integration_method     = "POST"
  integration_uri        = aws_lambda_function.websocket[each.value].invoke_arn
  payload_format_version = "1.0"
}

resource "aws_apigatewayv2_route" "websocket" {
  for_each = local.websocket_route_integrations

  api_id    = aws_apigatewayv2_api.websocket.id
  route_key = each.key
  target    = "integrations/${aws_apigatewayv2_integration.websocket[each.key].id}"

  authorization_type = each.key == "$connect" ? "CUSTOM" : "NONE"
  authorizer_id      = each.key == "$connect" ? aws_apigatewayv2_authorizer.websocket.id : null
}

resource "aws_lambda_permission" "websocket_routes" {
  for_each = local.api_gateway_lambda_functions

  statement_id  = "AllowWebSocketApiInvoke${replace(title(each.key), "-", "")}"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.websocket[each.key].function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.websocket.execution_arn}/${var.env}/*"
}

resource "aws_apigatewayv2_stage" "websocket" {
  api_id      = aws_apigatewayv2_api.websocket.id
  name        = var.env
  auto_deploy = true

  depends_on = [aws_apigatewayv2_route.websocket]
}
