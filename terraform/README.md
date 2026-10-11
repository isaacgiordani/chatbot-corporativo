# Terraform

Esta configuração cria o bucket privado do site na região N. Virgínia (`us-east-1`), uma distribuição CloudFront chamada `chatbot-corporativo`, um Cognito User Pool, uma API Gateway WebSocket e cinco funções Lambda. Quatro funções atendem às rotas WebSocket; `message-processor` será conectada ao stream DynamoDB em uma etapa posterior. O nome do bucket é montado automaticamente como `<AccountId>-<env>-chatbot-corporativo-s3`, usando os valores de `dev.tfvars`; para o ambiente atual, será `651644924182-dev-chatbot-corporativo-s3`. O provider recusa credenciais de outra conta. O valor `VALCANN | TESTE` é mantido em `dev.tfvars`, mas a tag AWS converte `|` para `-` (`VALCANN - TESTE`) porque esse caractere não é aceito em tags por vários serviços AWS.

Os valores do ambiente de testes ficam em `dev.tfvars`. As credenciais temporárias ficam em `.env`, que é ignorado pelo Git. Na raiz do repositório, crie e preencha o arquivo local:

```bash
cp -n terraform/.env.example terraform/.env
nano terraform/.env
chmod 600 terraform/.env
source terraform/.env
cd terraform
```

No `.env`, preencha `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` e `AWS_SESSION_TOKEN` com credenciais temporárias da role de testes. O arquivo `.env.example` contém apenas campos vazios.

## 1. Bootstrap do bucket de state

O bootstrap fica separado da configuração principal e mantém seu próprio state local para evitar dependência circular. Execute-o na primeira configuração ou quando precisar reconciliar alterações na configuração do bucket:

```bash
./scripts/bootstrap.sh
```

O script usa o `terraform plan` para comparar a configuração com o state e a AWS. Se não houver mudanças, ele encerra sem pedir confirmação nem executar `apply`. Se houver mudanças, mostra o plano e só aplica se você digitar `yes`. Depois da primeira execução, a rotina normal é `./scripts/validate.sh`; não é necessário rodar o bootstrap de novo. O bucket usa versionamento para recuperar versões anteriores do state, além de criptografia padrão, ACLs desativadas, bloqueio público, política que exige TLS e proteção contra destruição acidental. Preserve `state-bootstrap/terraform.tfstate`; ele controla o ciclo de vida do bucket e não deve ser enviado ao Git.

Se o state local do bootstrap for perdido, não aplique às cegas: importe o bucket existente para o state do bootstrap antes de gerenciá-lo novamente.

## 2. Validar e planejar a infraestrutura principal

Depois que o bucket de state existir, rode o script principal. Ele inicializa/migra o state remoto configurado em `dev.backend.hcl`, com lock nativo do Terraform no S3, e planeja o bucket do site:

```bash
./scripts/validate.sh
```

Se houver state local, confirme a migração quando o Terraform perguntar. O state principal ficará em `651644924182-dev-chatbot-corporativo-tfstate`, na chave `chatbot-corporativo/dev/terraform.tfstate`. A configuração requer Terraform 1.10 ou superior.

## Segurança do bucket do site

- Acesso público bloqueado nos quatro controles do S3.
- ACLs desativadas com `BucketOwnerEnforced`.
- Versionamento desativado.
- Criptografia padrão SSE-S3 (`AES256`).
- `force_destroy = false`, para impedir que o Terraform apague objetos ao destruir o bucket.

## 3. Provisionar o bucket do site

O provider aceita apenas a conta `AccountId` configurada. Revise o plano do site antes de provisionar:

```bash
terraform apply -var-file=dev.tfvars
```

Confirme a operação quando o Terraform solicitar. O CloudFront lê o bucket privado por OAC; a política do bucket autoriza somente essa distribuição a ler objetos.

## Distribuição CloudFront

A distribuição padrão `chatbot-corporativo` usa o endpoint REST do bucket S3 privado como origem, sem prefixo de caminho, com `index.html` como documento raiz e sem regras de path adicionais. Não configura domínio próprio, WAF ou certificado personalizado. O domínio padrão `*.cloudfront.net` é fornecido pela AWS; HTTPS usa o certificado padrão do CloudFront e exige TLS 1.2 ou superior. A política de visualização está como `allow-all`, então HTTP também é aceito. O tráfego entre CloudFront e o bucket é assinado pelo OAC com SigV4.

Após aplicar o Terraform, consulte o endereço e o ID da distribuição:

```bash
terraform output -raw cloudfront_distribution_domain_name
terraform output -raw cloudfront_distribution_id
```

## Cognito para a SPA

O User Pool e o App Client têm o nome `chatbot-corporativo`. O pool permite cadastro público, usa `username` como identificador (o frontend preenche esse username com o e-mail informado), e exige os atributos `email` e `name`. O e-mail é verificado automaticamente. O App Client é público, sem client secret, e usa o fluxo OAuth de código com `http://localhost:5173/` como callback e URL de logout.

Depois de aplicar, obtenha os valores para configurar `site/.env`:

```bash
terraform output -raw cognito_user_pool_id
terraform output -raw cognito_user_pool_client_id
cd ../site
nano .env
cd ../terraform
```

Copie os valores para `VITE_COGNITO_USER_POOL_ID` e `VITE_COGNITO_USER_POOL_CLIENT_ID` em `site/.env`; a região está configurada como `us-east-1`. O arquivo `site/.env.example` mantém esses IDs vazios para não apontar para um pool diferente. Para desenvolvimento local, `npm run dev` inicia o Vite e não publica na AWS; reinicie-o depois de alterar o `.env`.

## API Gateway WebSocket e Lambdas

A API WebSocket `chatbot-corporativo` usa IPv4, stage `dev` e a expressão de seleção `$request.body.action` (a sintaxe do API Gateway inclui o `$`). As rotas `$connect`, `$disconnect`, `sendMessage` e `$default` são integradas às Lambdas. O authorizer Cognito protege `$connect` recebendo o token pela query string `token`. As cinco funções usam runtime Node.js 22.x e roles IAM separadas; o Terraform cria log groups com retenção de 14 dias.

Antes do plano/aplicação, gere os bundles e ZIPs locais:

```bash
cd ../lambdas
npm ci
npm run package
cd ../terraform
./scripts/validate.sh
```

O `npm run package` transpila e empacota cada função em `lambdas/dist/<função>.zip`; o comando `zip` precisa estar instalado no sistema. Cada ZIP contém `index.js` na raiz; o bundle inclui as dependências em runtime. Depois de revisar o plano, aplique:

```bash
terraform apply -var-file=dev.tfvars
```

O Terraform implanta as cinco funções. `authorizer`, `connect`, `disconnect` e `message-persist` são conectadas à API; `message-processor` fica criada para receber o trigger DynamoDB Stream em uma etapa posterior. Como as tabelas ainda não foram provisionadas, as rotas que acessam DynamoDB não estarão operacionais até essa etapa.

Obtenha a URL WebSocket e configure `VITE_WEBSOCKET_URL` em `site/.env`:

```bash
terraform output -raw websocket_api_url
cd ../site
nano .env
```

Após salvar a URL, gere novamente o frontend e publique-o pelo fluxo acima para incorporar o endpoint no build.

## Publicar o frontend

Para publicar alterações, configure as credenciais AWS no terminal e gere o build com os valores atuais de `site/.env`:

```bash
cd ../site
npm run build
./scripts/sync-s3.sh 651644924182 dev
```

O script envia `site/dist/` para `651644924182-dev-chatbot-corporativo-s3`, não gera o build nem apaga arquivos do bucket, e solicita automaticamente a invalidação `/*` do CloudFront. Ele obtém a distribuição pelo output Terraform `cloudfront_distribution_id`; alternativamente, defina `AWS_CLOUDFRONT_DISTRIBUTION_ID`. As credenciais AWS precisam permitir escrita no bucket e criação de invalidações. A invalidação é assíncrona e pode levar alguns minutos. O comando manual abaixo serve para solicitar outra invalidação, se necessário:

```bash
cd ../terraform
aws cloudfront create-invalidation \
  --distribution-id "$(terraform output -raw cloudfront_distribution_id)" \
  --paths "/*"
```

Como alternativa, `npm run deploy:s3` gera o build e publica usando a variável `AWS_S3_BUCKET`; esse fluxo aplica regras de cache e pode invalidar o CloudFront se `AWS_CLOUDFRONT_DISTRIBUTION_ID` estiver definida. O bucket continua privado e acessível pelo CloudFront via OAC. Não é necessário executar `npm run dev` para publicar.
