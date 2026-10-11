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

Para gerar o site estático:

```bash
cd site
npm ci
npm audit
npm run build
```

O resultado fica em `site/dist/` e pode ser publicado posteriormente em S3/CloudFront.

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

Não existe template SAM ou outro template de infraestrutura neste repositório. Os comandos de build e teste são exclusivamente locais e não criam recursos na AWS. Consulte `lambdas/README.md` para o contrato, variáveis de ambiente e orientação de autenticação com Cognito.
