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
