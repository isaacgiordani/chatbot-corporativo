# AutoAtende Chat

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

O material da aula permanece preservado em `site/material-aula-cognito/` e não participa do build da aplicação.

## Site

O frontend inclui cadastro, confirmação de conta, login e recuperação de senha pelo Amazon Cognito, além da interface de chat e do adaptador WebSocket.

```bash
cd site
cp .env.example .env
npm install
npm run dev
```

Para gerar o site estático:

```bash
cd site
npm run build
```

O resultado fica em `site/dist/` e pode ser publicado posteriormente em S3/CloudFront.

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

Não existe template SAM ou outro template de infraestrutura neste repositório. Os comandos de build e teste são exclusivamente locais e não criam recursos na AWS. Consulte `lambdas/README.md` para o contrato, variáveis de ambiente e orientação de autenticação com Cognito.
