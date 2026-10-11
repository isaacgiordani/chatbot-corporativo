output "state_bucket_name" {
  description = "Nome do bucket privado que armazenará os states Terraform."
  value       = aws_s3_bucket.terraform_state.id
}

output "state_bucket_arn" {
  description = "ARN do bucket de state."
  value       = aws_s3_bucket.terraform_state.arn
}
