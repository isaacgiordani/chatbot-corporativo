terraform {
  required_version = ">= 1.10.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
  }
}

provider "aws" {
  region              = var.aws_region
  allowed_account_ids = [var.AccountId]

  default_tags {
    tags = {
      Project     = "chatbot-corporativo"
      ManagedBy   = "Terraform"
      Environment = var.env
      Client      = var.client
      AccountName = replace(var.account_name, "|", "-")
      Purpose     = "terraform-state"
    }
  }
}
