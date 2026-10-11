output "site_bucket_name" {
  description = "Nome do bucket privado do site."
  value       = aws_s3_bucket.site.id
}

output "site_bucket_arn" {
  description = "ARN do bucket privado do site."
  value       = aws_s3_bucket.site.arn
}

output "cloudfront_distribution_id" {
  description = "ID da distribuição CloudFront do site."
  value       = aws_cloudfront_distribution.site.id
}

output "cloudfront_distribution_domain_name" {
  description = "Domínio padrão da distribuição CloudFront."
  value       = aws_cloudfront_distribution.site.domain_name
}

output "cognito_user_pool_id" {
  description = "ID do Cognito User Pool do site."
  value       = aws_cognito_user_pool.site.id
}

output "cognito_user_pool_arn" {
  description = "ARN do Cognito User Pool do site."
  value       = aws_cognito_user_pool.site.arn
}

output "cognito_user_pool_client_id" {
  description = "ID público do App Client Cognito usado pela SPA."
  value       = aws_cognito_user_pool_client.site_spa.id
}

output "websocket_api_id" {
  description = "ID da API WebSocket do chatbot."
  value       = aws_apigatewayv2_api.websocket.id
}

output "websocket_api_url" {
  description = "URL WSS da API WebSocket no stage configurado."
  value       = "${aws_apigatewayv2_api.websocket.api_endpoint}/${aws_apigatewayv2_stage.websocket.name}"
}

output "websocket_lambda_function_names" {
  description = "Nomes das funções Lambda do chatbot."
  value       = { for name, function in aws_lambda_function.websocket : name => function.function_name }
}
