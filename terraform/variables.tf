variable "aws_region" {
  description = "Região AWS onde o bucket será criado."
  type        = string
  default     = "us-east-1"
}

variable "env" {
  description = "Nome do ambiente."
  type        = string
}

variable "client" {
  description = "Cliente dono da infraestrutura."
  type        = string
}

variable "AccountId" {
  description = "ID da conta AWS autorizada para este ambiente."
  type        = string

  validation {
    condition     = can(regex("^[0-9]{12}$", var.AccountId))
    error_message = "AccountId deve conter exatamente 12 dígitos."
  }
}

variable "account_name" {
  description = "Nome amigável da conta AWS, usado nas tags."
  type        = string
}
