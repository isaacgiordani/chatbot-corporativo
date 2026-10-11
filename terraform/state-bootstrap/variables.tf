variable "aws_region" {
  description = "Região AWS do bucket de state."
  type        = string
  default     = "us-east-1"
}

variable "env" {
  description = "Ambiente AWS."
  type        = string
}

variable "client" {
  description = "Cliente dono da infraestrutura."
  type        = string
}

variable "AccountId" {
  description = "ID da conta AWS permitida."
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
