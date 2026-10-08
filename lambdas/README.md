# Lambdas WebSocket do AutoAtende

As funções estão organizadas como cinco unidades distintas:

| Diretório | Rota esperada | Responsabilidade |
| --- | --- | --- |
| `authorizer/` | Authorizer de `$connect` | Valida o access token do Cognito |
| `connect/` | `$connect` | Grava a conexão no DynamoDB |
| `disconnect/` | `$disconnect` | Remove a conexão do DynamoDB |
| `message-persist/` | `sendMessage` e `$default` | Valida e persiste a mensagem |
| `message-processor/` | DynamoDB Stream | Processa o item salvo e responde pelo WebSocket |

O processador ainda não chama o Bedrock. Por enquanto, consome registros `INSERT` do stream e devolve uma confirmação contendo o texto persistido.

## Variáveis de ambiente

Use `.env.example` como referência ao configurar cada Lambda na infraestrutura futuramente.

| Variável | Obrigatória | Uso |
| --- | --- | --- |
| `CONNECTIONS_TABLE` | Sim | Nome parametrizado da tabela DynamoDB |
| `MESSAGES_TABLE` | Message persist | Nome parametrizado da tabela de mensagens |
| `CONNECTIONS_TTL_HOURS` | Não | Retenção do registro da conexão; padrão de 24 horas |
| `FIXED_RESPONSE` | Não | Resposta temporária do processador |
| `WEBSOCKET_CALLBACK_ENDPOINT` | Não | Endpoint HTTPS de callback para domínio customizado |
| `COGNITO_USER_POOL_ID` | Authorizer | ID do Cognito User Pool |
| `COGNITO_USER_POOL_CLIENT_ID` | Authorizer | ID do App Client público |
| `AUTH_TOKEN_QUERY_PARAM` | Não | Nome do parâmetro de token para navegadores; padrão `token` |

O nome da tabela não está fixado no código. Por exemplo:

```text
CONNECTIONS_TABLE=autoatende-dev-websocket-connections
MESSAGES_TABLE=autoatende-dev-messages
```

A tabela futura deve utilizar `connectionId` como chave primária e habilitar TTL no atributo `expiresAt`. O evento `$disconnect` é entregue em regime de melhor esforço pelo API Gateway; por isso o TTL serve como limpeza de segurança para conexões antigas.

## Build e testes

Requisitos: Node.js 22+ e npm.

```bash
cd lambdas
npm install
npm run validate
```

Esse comando verifica os tipos, executa os testes e gera cinco bundles independentes:

```text
dist/authorizer/index.js
dist/connect/index.js
dist/disconnect/index.js
dist/message-persist/index.js
dist/message-processor/index.js
```

Todas as dependências usadas em execução são empacotadas em cada bundle. Não há template SAM e nenhum desses comandos acessa ou modifica a conta AWS.

Para compilar apenas uma função:

```bash
npm run build:authorizer
npm run build:connect
npm run build:disconnect
npm run build:message-persist
npm run build:message-processor
```

## Contrato da mensagem

O frontend envia:

```json
{
  "action": "sendMessage",
  "conversationId": "uuid-da-conversa",
  "message": "Quero encontrar um SUV"
}
```

O `message-persist` salva o item e o stream aciona o `message-processor`, que responde pela conexão registrada no item:

```json
{
  "type": "assistant.message",
  "content": "Sua mensagem foi recebida e o código será alterado depois. Texto salvo: \"Quero encontrar um SUV\"",
  "conversationId": "uuid-da-conversa",
  "requestId": "id-da-requisicao",
  "savedMessage": {
    "messageId": "uuid-da-mensagem",
    "content": "Quero encontrar um SUV",
    "status": "RECEIVED"
  }
}
```

Para o endpoint padrão `execute-api`, a Lambda monta o callback como `https://{domainName}/{stage}`. Se um domínio customizado remover o stage da URL, configure `WEBSOCKET_CALLBACK_ENDPOINT`.

## Cognito na API WebSocket

A Lambda `authorizer` implementa um authorizer do tipo `REQUEST` para a rota `$connect`:

1. O frontend autentica com Amplify e Cognito.
2. `fetchAuthSession()` entrega um access token atual.
3. O frontend abre o WebSocket enviando o token no parâmetro de query configurado por `VITE_WEBSOCKET_TOKEN_QUERY_PARAM`.
4. O authorizer aceita `Authorization: Bearer <token>` ou o parâmetro de query e valida assinatura, emissor, expiração, `token_use=access` e App Client.
5. Em caso válido, devolve `Allow`, `principalId` e um contexto contendo pelo menos `sub`.
6. A Lambda `connect` já está preparada para persistir esse `sub` como `userId`.

O authorizer deve ser anexado somente ao `$connect`. A conexão autorizada é reutilizada nas mensagens seguintes; o JWT não precisa ser enviado em cada frame. Como a expiração posterior do token não encerra automaticamente uma conexão aberta, defina no futuro uma duração máxima da conexão ou uma estratégia de reautenticação.

O `WebSocket` nativo do navegador não permite definir livremente o header `Authorization`. Portanto, no API Gateway, escolha apenas uma origem de identidade:

- para a SPA: **Query string**, chave `token`;
- para Postman, wscat ou outro backend: **Header**, chave `Authorization`.

Não configure as duas origens simultaneamente: o API Gateway exigiria que ambas estivessem presentes antes de invocar a Lambda. Como o token passa pela URL na SPA, use sempre `wss://`, evite registrar query strings e nunca coloque client secret no frontend.

### Publicação manual da authorizer

```bash
cd lambdas
npm run build:authorizer
cd dist/authorizer
zip ../authorizer.zip index.js index.js.map
```

Crie a Lambda com Node.js 22.x, handler `index.handler`, faça upload de `dist/authorizer.zip` e configure `COGNITO_USER_POOL_ID`, `COGNITO_USER_POOL_CLIENT_ID` e, opcionalmente, `AUTH_TOKEN_QUERY_PARAM`. A role precisa apenas das permissões básicas de logs; a validação usa as chaves públicas do User Pool.

No authorizer da WebSocket API, selecione essa Lambda e, para o site atual, configure **Query string → token**. Depois selecione a rota `$connect`, associe o authorizer e faça deploy do stage. A alteração só será testada em uma nova conexão WebSocket.

## Fluxo de persistência e processamento

```text
React WebSocket
  -> rota sendMessage
  -> message-persist
  -> tabela de mensagens
  -> DynamoDB Stream
  -> message-processor
  -> API Gateway Management API
  -> React WebSocket
```

A tabela de mensagens deve ter:

- partition key `conversationId` do tipo String;
- sort key `messageKey` do tipo String;
- DynamoDB Stream habilitado com a visualização **New image**.

O `messageKey` combina data ISO e UUID, permitindo ordenar as mensagens de uma conversa cronologicamente. Cada item também guarda `messageId`, `content`, `role`, `status`, `connectionId`, `domainName`, `stage`, `userId` e datas de criação.

O processador implementa resposta parcial de lote (`ReportBatchItemFailures`). O consumo do DynamoDB Stream é pelo menos uma vez, então uma futura versão de produção ainda deverá considerar idempotência para evitar respostas duplicadas em cenários de retry.

## Configuração manual no console da AWS

### 1. Criar a tabela de mensagens

No DynamoDB, escolha **Create table**:

- Table name: por exemplo `autoatende-dev-messages`;
- Partition key: `conversationId`, tipo String;
- Sort key: `messageKey`, tipo String;
- Table settings: `On-demand` é suficiente para o início.

Depois abra **Exports and streams → DynamoDB stream details → Turn on** e escolha **New image**.

### 2. Configurar a message-persist

Compile e compacte:

```bash
cd lambdas
npm run build:message-persist
cd dist/message-persist
zip ../message-persist.zip index.js index.js.map
```

Na Lambda use Node.js 22.x, handler `index.handler` e as variáveis `CONNECTIONS_TABLE`, `MESSAGES_TABLE` e, se necessário, `WEBSOCKET_CALLBACK_ENDPOINT`.

Na role conceda:

- `dynamodb:GetItem` na tabela de conexões;
- `dynamodb:PutItem` na tabela de mensagens;
- `dynamodb:DeleteItem` na tabela de conexões;
- `execute-api:ManageConnections` na API WebSocket.

No API Gateway, altere as integrações das rotas `sendMessage` e `$default` para `message-persist` e faça deploy do stage.

### 3. Configurar a message-processor

Compile e compacte:

```bash
cd lambdas
npm run build:message-processor
cd dist/message-processor
zip ../message-processor.zip index.js index.js.map
```

Na processadora configure `CONNECTIONS_TABLE`, `FIXED_RESPONSE` e, se necessário, `WEBSOCKET_CALLBACK_ENDPOINT`. Remova qualquer integração direta dela com as rotas `sendMessage` e `$default`.

Na role, anexe `AWSLambdaDynamoDBExecutionRole` para leitura do stream e acrescente permissões para `execute-api:ManageConnections` e `dynamodb:DeleteItem` na tabela de conexões.

Na página da Lambda processadora, escolha **Add trigger → DynamoDB**:

- DynamoDB table: `autoatende-dev-messages`;
- Batch size: `10`;
- Batch window: `0`;
- Starting position: `Trim horizon` se a tabela for nova e vazia; caso use `Latest`, não grave mensagens até o trigger aparecer como habilitado;
- Split batch on error: habilitado;
- Retry attempts: `3`;
- Maximum age of record: `3600` segundos;
- Report batch item failures: habilitado;
- Filter criteria, se disponível: `{ "eventName": ["INSERT"] }`;
- Trigger status: habilitado.

O suporte a falhas parciais só funciona quando `ReportBatchItemFailures` também está habilitado no event source mapping.

## Recuperação do registro da conexão

O DynamoDB funciona como registro das conexões ativas, mas apagar um item da tabela não encerra o WebSocket correspondente no API Gateway. Se o `message-persist` receber uma mensagem de uma conexão ainda aberta cujo item não existe mais, ele usa `DeleteConnection` para encerrar aquela conexão. O frontend recebe `onclose`, reconecta automaticamente e a rota `$connect` grava um novo `connectionId`, preservando o `conversationId` enquanto a tela atual continuar aberta.

A mensagem que disparou a recuperação não é reenviada automaticamente; o usuário deve enviá-la novamente depois que o indicador mostrar que a conexão foi restabelecida.

## Permissões futuras mínimas

- `connect`: `dynamodb:PutItem` na tabela de conexões;
- `disconnect`: `dynamodb:DeleteItem` na tabela;
- `message-persist`: `dynamodb:GetItem`, `dynamodb:PutItem`, `dynamodb:DeleteItem` e `execute-api:ManageConnections` nos recursos necessários;
- `message-processor`: leitura do DynamoDB Stream, `dynamodb:DeleteItem` na tabela de conexões e `execute-api:ManageConnections` restrito à API e ao stage;
- `authorizer`: logs no CloudWatch; nenhuma permissão de leitura no Cognito é necessária para verificar o JWT.

Quando o Bedrock for integrado, adicione somente as permissões necessárias ao modelo escolhido.
