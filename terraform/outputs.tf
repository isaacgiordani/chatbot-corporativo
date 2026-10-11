output "site_bucket_name" {
  description = "Nome do bucket privado do site."
  value       = aws_s3_bucket.site.id
}

output "site_bucket_arn" {
  description = "ARN do bucket privado do site."
  value       = aws_s3_bucket.site.arn
}
