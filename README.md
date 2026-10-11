# Valcann Chat

Repositório do chatbot corporativo para atendimento de uma loja de veículos. O código está separado em dois projetos independentes:

```text
site/                         # SPA React + TypeScript
lambdas/                      # Lambdas WebSocket em TypeScript
  authorizer/                 # valida o access token do Cognito
  connect/                    # registra a conexão no DynamoDB
  disconnect/                 # remove a conexão
  message-persist/            # persiste a mensagem recebida
  message-processor/          # consome o DynamoDB Stream e responde
```

## Site

O frontend inclui cadastro, confirmação de conta, login e recuperação de senha pelo Amazon Cognito, além da interface de chat e do adaptador WebSocket.

```bash
cd site
cp .env.example .env
npm ci
npm run dev
```

`npm run dev` inicia o servidor local do Vite para desenvolvimento e visualização na máquina; ele não publica arquivos na AWS. O frontend lê a configuração Cognito de `site/.env`. Após criar o User Pool, preencha `VITE_COGNITO_USER_POOL_ID` e `VITE_COGNITO_USER_POOL_CLIENT_ID` com os outputs do Terraform. Reinicie `npm run dev` para aplicar mudanças no `.env` durante o desenvolvimento.

Para gerar o site estático:

```bash
cd site
npm ci
npm audit
npm run build
```

O resultado fica em `site/dist/`. As variáveis de `site/.env`, incluindo os IDs do Cognito, são incorporadas ao build; gere um novo build depois de alterar o `.env`.

Para publicar alterações, configure as credenciais AWS, gere o build e sincronize com o bucket S3 do ambiente `dev`:

```bash
cd site
npm run build
./scripts/sync-s3.sh 651644924182 dev
```

O script monta o bucket como `<AccountId>-<env>-chatbot-corporativo-s3`, envia os arquivos de `site/dist/` sem apagar objetos existentes e solicita a invalidação `/*` no CloudFront. Ele busca o ID pelo output `cloudfront_distribution_id` do Terraform; também é possível definir `AWS_CLOUDFRONT_DISTRIBUTION_ID`. As credenciais AWS precisam permitir upload no S3 e criar invalidações. A invalidação é assíncrona e pode levar alguns minutos. O comando manual abaixo serve para solicitar outra invalidação, se necessário:

```bash
cd ../terraform
aws cloudfront create-invalidation \
  --distribution-id "$(terraform output -raw cloudfront_distribution_id)" \
  --paths "/*"
```

O bucket é privado; o sync não habilita acesso público. O site é servido pela distribuição CloudFront com Origin Access Control. Não é necessário executar `npm run dev` para publicar.

### Resolver avisos de dependências

Se `npm audit` apontar vulnerabilidades, consulte o relatório e tente primeiro a correção automática compatível com as versões declaradas:

```bash
cd site
npm audit
npm audit fix
npm ci
npm audit
npm run build
```

Confirme que a auditoria termina com `found 0 vulnerabilities` e que o build passa. Evite `npm audit fix --force` sem revisar as mudanças, pois ele pode instalar versões incompatíveis.

Se o `npm ci` avisar que um script de instalação foi bloqueado por não estar em `allowScripts`, aprove apenas o pacote citado no aviso e somente se ele for uma dependência esperada do projeto. Para o `esbuild` usado pelo Vite:

```bash
cd site
npm install-scripts approve esbuild
npm ci
npm run build
```

Essa aprovação fica registrada em `site/package.json`. Se o npm informar que `tsc` não foi encontrado, confirme que está em `site/` e rode `npm ci`. Se um script aprovado falhar com `EPERM` ao executar um binário, tente os mesmos comandos fora de um ambiente que bloqueie a execução de subprocessos; não é necessário usar `sudo`.

## Lambdas

As cinco Lambdas são pacotes de execução distintos, mas compartilham configuração e dependências de desenvolvimento no diretório `lambdas/`.

```bash
cd lambdas
npm install
npm run validate
```

O build gera:

```text
lambdas/dist/connect/index.js
lambdas/dist/disconnect/index.js
lambdas/dist/message-persist/index.js
lambdas/dist/message-processor/index.js
lambdas/dist/authorizer/index.js
```

Não existe template SAM neste repositório. O empacotamento das Lambdas é local; a implantação das funções e da API WebSocket é definida em `terraform/`. Consulte `lambdas/README.md` para o contrato, variáveis de ambiente e empacotamento, e `terraform/README.md` para o deploy da infraestrutura.
