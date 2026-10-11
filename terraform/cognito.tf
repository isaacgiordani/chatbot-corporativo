resource "aws_cognito_user_pool" "site" {
  name = "chatbot-corporativo"

  username_configuration {
    case_sensitive = false
  }

  admin_create_user_config {
    allow_admin_create_user_only = false
  }

  auto_verified_attributes = ["email"]

  schema {
    name                     = "email"
    attribute_data_type      = "String"
    developer_only_attribute = false
    mutable                  = true
    required                 = true

    string_attribute_constraints {
      min_length = 0
      max_length = 2048
    }
  }

  schema {
    name                     = "name"
    attribute_data_type      = "String"
    developer_only_attribute = false
    mutable                  = true
    required                 = true

    string_attribute_constraints {
      min_length = 0
      max_length = 2048
    }
  }

  tags = {
    Name = "chatbot-corporativo"
  }
}

resource "aws_cognito_user_pool_client" "site_spa" {
  name         = "chatbot-corporativo"
  user_pool_id = aws_cognito_user_pool.site.id

  generate_secret                      = false
  enable_token_revocation              = true
  prevent_user_existence_errors        = "ENABLED"
  explicit_auth_flows                  = ["ALLOW_USER_SRP_AUTH", "ALLOW_USER_PASSWORD_AUTH", "ALLOW_REFRESH_TOKEN_AUTH"]
  allowed_oauth_flows_user_pool_client = true
  allowed_oauth_flows                  = ["code"]
  allowed_oauth_scopes                 = ["email", "openid", "profile"]
  supported_identity_providers         = ["COGNITO"]

  callback_urls = ["http://localhost:5173/"]
  logout_urls   = ["http://localhost:5173/"]
}
