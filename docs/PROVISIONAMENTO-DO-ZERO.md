# Provisionamento do ambiente do zero

Este guia provisiona do zero o ambiente `dev` para o cliente configurado em `terraform/dev.tfvars`. O valor atual da variável `client` é `Assistente`. Ele cria o bucket de state, o site privado com CloudFront, o Cognito, a API WebSocket, cinco Lambdas e as tabelas DynamoDB. A resposta do chat ainda é fixa; a integração com Bedrock não está incluída.

## 1. Pré-requisitos

Tenha disponíveis no computador:

- AWS CLI configurada para credenciais temporárias da conta de testes `651644924182`;
- Terraform 1.10 ou superior;
- Node.js 22 ou superior e npm;
- `zip` para gerar os pacotes das Lambdas;
- acesso à conta AWS e permissões para criar os recursos do projeto.

Na raiz do repositório, confirme que está no projeto e prepare as credenciais:

```bash
cd ~/Documentos/Git/chatbot-corporativo
cp -n terraform/.env.example terraform/.env
nano terraform/.env
chmod 600 terraform/.env
source terraform/.env
aws sts get-caller-identity
```

Preencha `terraform/.env` com credenciais temporárias, sem compartilhar ou enviar o arquivo ao Git. Confirme que `Account` no resultado de `aws sts get-caller-identity` é `651644924182`. Se a sessão expirar durante o processo, obtenha novas credenciais e repita `source terraform/.env`.

As variáveis de infraestrutura do ambiente de testes estão em `terraform/dev.tfvars`. Revise-as antes de começar. O backend e os nomes de recursos atuais também estão configurados para essa conta e ambiente.

O valor atual de `client` é `Assistente`; ele determina parte dos nomes das Lambdas e das tabelas DynamoDB. Alterar `client` pode levar o Terraform a substituir as tabelas e apagar mensagens/conexões. Antes de aplicar uma mudança desse tipo em ambiente existente, revise o plano e faça backup dos dados.

## 2. Criar o bucket remoto do state (bootstrap)

O bootstrap usa state local para criar o bucket S3 que guardará o state principal. Rode-o uma vez por ambiente. O script inicializa, formata, valida e planeja o bootstrap; se houver alterações, mostra o plano e pede que você digite `yes` antes de aplicar.

```bash
cd terraform
./scripts/bootstrap.sh
```

Guarde com segurança `terraform/state-bootstrap/terraform.tfstate`: ele gerencia o bucket de state e não pode ser perdido nem enviado ao Git. O state remoto principal e o bucket que o contém são separados dos recursos gerenciados pelo Terraform principal. Um `terraform destroy` na pasta `terraform/` não os remove. Em instalações seguintes, não rode o bootstrap de novo sem necessidade; use o script de validação principal.

## 3. Empacotar as Lambdas

Antes do Terraform planejar as funções, gere seus bundles e ZIPs:

```bash
cd ../lambdas
npm ci
npm run package
```

Os arquivos `dist/*.zip` são os pacotes de deploy usados pelo Terraform. Rode `npm run package` novamente sempre que alterar o código das Lambdas.

## 4. Inicializar, validar e revisar o plano Terraform

Volte à pasta Terraform e execute o script:

```bash
cd ../terraform
./scripts/validate.sh
```

O script inicializa o backend S3 definido em `dev.backend.hcl`, verifica a formatação, valida a configuração e exibe o plano do ambiente `dev`. Na primeira execução, se houver state local para migrar, leia o prompt e confirme a migração. Revise cuidadosamente o plano e confirme que a conta é a esperada antes de aplicar.

O script `validate.sh` não aplica alterações. Para criar ou atualizar a infraestrutura depois de revisar o plano:

```bash
terraform apply -var-file=dev.tfvars
```

Digite `yes` somente depois de conferir as ações. Na primeira aplicação, o Terraform cria os recursos do site, CloudFront, Cognito, API WebSocket, Lambdas, DynamoDB e suas integrações. A distribuição CloudFront pode levar alguns minutos até ficar disponível.

## 5. Copiar os outputs para a configuração local do site

Na pasta `terraform`, consulte os outputs necessários:

```bash
terraform output -raw cloudfront_distribution_domain_name
terraform output -raw cognito_user_pool_id
terraform output -raw cognito_user_pool_client_id
terraform output -raw websocket_api_url
```

Prepare `site/.env` a partir do exemplo:

```bash
cd ../site
cp -n .env.example .env
nano .env
```

Preencha no `site/.env`:

| Variável | Valor |
| --- | --- |
| `VITE_CLIENT_NAME` | `Assistente` |
| `VITE_AWS_REGION` | `us-east-1` |
| `VITE_COGNITO_USER_POOL_ID` | Output `cognito_user_pool_id` |
| `VITE_COGNITO_USER_POOL_CLIENT_ID` | Output `cognito_user_pool_client_id` |
| `VITE_WEBSOCKET_URL` | Output `websocket_api_url` |
| `VITE_WEBSOCKET_ACTION` | `sendMessage` |
| `VITE_WEBSOCKET_TOKEN_QUERY_PARAM` | `token` |
| `VITE_ENABLE_DEMO_MODE` | `false` |

Não coloque credenciais AWS ou client secret do Cognito no frontend. Os valores `VITE_*` são incorporados aos arquivos públicos do site durante o build.

## 6. Criar uma conta de teste no Cognito

Gere e publique o site primeiro (próxima etapa), depois abra o domínio CloudFront obtido no output. Use o fluxo de cadastro para criar uma conta com username, e-mail e nome. O User Pool exige confirmação do e-mail; siga as instruções recebidas antes de fazer login. O App Client é público e não usa client secret.

## 7. Gerar e publicar o frontend

Execute o bloco a partir da raiz do repositório. `npm ci` e `npm run build` rodam dentro de `site/`; depois o terminal volta à raiz para chamar o script de sync, que também solicita a invalidação do cache CloudFront:

```bash
cd ~/Documentos/Git/chatbot-corporativo
cd site
npm ci
npm run build
cd ..
./site/scripts/sync-s3.sh 651644924182 dev
```

A invalidação é assíncrona. Aguarde alguns minutos e abra o domínio CloudFront, sem acrescentar caminho. `index.html` é o documento raiz da distribuição.

## 8. Verificar o ambiente

1. Abra o domínio retornado por `cloudfront_distribution_domain_name`.
2. Cadastre e confirme um usuário no Cognito, então faça login.
3. Confirme que o chat exibe **Conectado**.
4. Envie uma mensagem e confirme que aparece uma resposta contendo o texto enviado.

A resposta atual é uma confirmação fixa. Esse teste valida a autenticação no `$connect`, as rotas WebSocket, a persistência no DynamoDB, o acionamento do stream e o retorno da Lambda processadora pelo API Gateway. Não significa que o Bedrock esteja integrado.

## Reaplicar mudanças depois da instalação inicial

Para alterações nas Lambdas, gere os ZIPs antes de planejar. Para mudanças Terraform, repita a validação e revise o plano. Aplique somente após conferir as ações:

```bash
cd lambdas
npm ci
npm run package
cd ../terraform
./scripts/validate.sh
terraform apply -var-file=dev.tfvars
```

Se as alterações forem apenas no frontend, não é necessário reaplicar o Terraform: atualize `site/.env` se necessário, gere o build e sincronize os arquivos:

```bash
cd ~/Documentos/Git/chatbot-corporativo
cd site
npm run build
cd ..
./site/scripts/sync-s3.sh 651644924182 dev
```

## Destruir e recriar o ambiente

O script de destruição remove os recursos do ambiente principal, inclusive o bucket do site, mas preserva o bucket remoto do state e o state separado do bootstrap. Ele valida a conta AWS e o workspace, exibe um plano `destroy`, exige a confirmação literal `destroy dev 651644924182` e então esvazia o bucket do site antes de aplicar o plano:

```bash
cd ~/Documentos/Git/chatbot-corporativo/terraform
./scripts/destroy.sh
```

Revise o plano com atenção: isso apaga também usuários do Cognito, dados do DynamoDB, funções Lambda e distribuição CloudFront. O script para sem apagar os recursos se detectar versionamento ativo/suspenso no bucket, pois `aws s3 rm` não remove versões antigas. O bucket do site é removido; seu nome é global no S3, então não há garantia de que continuará disponível se outra conta o registrar antes da recriação.

Para recriar, siga este guia desde a etapa 3 e pule o bootstrap se o bucket de state e o arquivo `terraform/state-bootstrap/terraform.tfstate` continuam presentes. Depois, gere os ZIPs das Lambdas, rode `./scripts/validate.sh`, revise o plano, aplique e atualize `site/.env` com os outputs novos. O Cognito e a API são recriados e seus IDs/URL podem mudar; por isso é necessário gerar e publicar o frontend novamente.

Se estiver em uma máquina nova ou tiver perdido o state local do bootstrap, não rode `./scripts/bootstrap.sh` imediatamente: o bucket remoto já existe, mas o Terraform local não sabe disso. Recupere o gerenciamento importando o bucket existente:

```bash
cd terraform/state-bootstrap
terraform init
terraform import -var-file=../dev.tfvars \
  aws_s3_bucket.terraform_state \
  651644924182-dev-chatbot-corporativo-tfstate
cd ..
./scripts/bootstrap.sh
```

Revise o plano do bootstrap após a importação. O bucket de state contém o state da infraestrutura e tem `prevent_destroy`; não o apague como parte do reset do ambiente.

## Problemas comuns

- **`npm error enoent` ao executar npm:** entre na pasta do projeto (`site/` ou `lambdas/`) antes do comando.
- **`tsc: not found` ou dependências ausentes:** na pasta correta, rode `npm ci` e repita o build.
- **Credenciais inválidas ou conta incorreta:** atualize as credenciais temporárias em `terraform/.env`, execute `source terraform/.env` e confira `aws sts get-caller-identity`.
- **Bucket de state já existe, mas o bootstrap tenta criá-lo:** preserve o state local `terraform/state-bootstrap/terraform.tfstate`. Se ele foi perdido, pare e importe o bucket existente no state do bootstrap antes de aplicar; não tente recriá-lo.
- **Terraform informa que o bucket de state não existe:** rode `./scripts/bootstrap.sh` em `terraform/` antes de `./scripts/validate.sh`.
- **O site mostra configuração antiga:** confirme `site/.env`, rode `npm run build` dentro de `site/`, volte à raiz do repositório e execute `./site/scripts/sync-s3.sh 651644924182 dev`; aguarde a invalidação CloudFront.
- **A mensagem não recebe resposta:** verifique o status **Conectado**, confirme `VITE_WEBSOCKET_URL`, `VITE_COGNITO_USER_POOL_ID` e `VITE_COGNITO_USER_POOL_CLIENT_ID`, refaça build/sync após alterações e confira logs das Lambdas no CloudWatch.
