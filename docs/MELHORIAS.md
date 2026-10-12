# Melhorias sugeridas

Este documento reúne os pontos identificados na revisão do código em 11/10/2026. Ele registra propostas; não implica que as mudanças já foram implementadas.

## Prioridade alta

### Evitar que o chat fique bloqueado quando uma resposta não chega

**Arquivos:** `site/src/App.tsx`, `site/src/hooks/useChatSocket.ts`

Ao enviar uma mensagem, a interface ativa o indicador de que o assistente está digitando e só o desativa ao receber uma resposta. Se a conexão cair ou o processamento falhar, o indicador pode permanecer ativo e impedir novos envios.

**Sugestão:** associar o estado de espera a uma mensagem/requisição, definir um timeout e liberar a interface quando houver desconexão ou erro. Exibir uma ação clara para tentar novamente quando aplicável.

### Definir recuperação e consulta do histórico de conversas

**Arquivos:** `terraform/dynamodb.tf`, `lambdas/`, `site/src/App.tsx`

As mensagens são persistidas, mas a tabela usa `messageId` como chave e não possui índice por conversa. Não há atualmente um fluxo para consultar mensagens anteriores; a interface mantém as mensagens apenas em memória.

**Sugestão:** se histórico for requisito, definir um modelo de consulta por `conversationId` (por exemplo, chave composta ou índice secundário), restringir a leitura às conversas do usuário autenticado e implementar a API e a recuperação na interface. Definir também a política de retenção das mensagens.

## Prioridade média

### Unificar os fluxos de publicação do site

**Arquivos:** `site/scripts/deploy-s3.sh`, `site/scripts/sync-s3.sh`

O fluxo `deploy-s3.sh` define cache imutável de um ano para todos os arquivos e usa `--delete`; `sync-s3.sh` não remove objetos e invalida todo o cache CloudFront. Os comportamentos diferentes podem causar cache de arquivos sem nome versionado ou remoção de objetos inesperados.

**Sugestão:** escolher um fluxo oficial, aplicar cache longo apenas a assets com hash no nome, manter `index.html` com cache curto e documentar quando objetos antigos devem ser removidos. Confirmar também qual script é chamado pelo comando `deploy:s3`.

### Redirecionar HTTP para HTTPS no CloudFront

**Arquivo:** `terraform/cloudfront.tf`

A distribuição atualmente aceita HTTP com `viewer_protocol_policy = "allow-all"`.

**Sugestão:** configurar redirecionamento de HTTP para HTTPS para que os visitantes usem a conexão segura em todos os acessos.

### Adicionar controles contra abuso no cadastro público

**Arquivo:** `terraform/cognito.tf`

O User Pool permite cadastro público. Para um serviço exposto a clientes, isso pode gerar cadastros automatizados e aumento de tráfego ou custos.

**Sugestão:** avaliar controles proporcionais ao público esperado, como limites e monitoramento de tentativas, proteção contra bots e um processo de cadastro compatível com as regras do produto.

### Reduzir detalhes registrados em falhas de autenticação

**Arquivo:** `lambdas/authorizer/index.ts`

O authorizer registra a mensagem da exceção ao rejeitar um token. O token é enviado na query string porque o WebSocket nativo do navegador não permite configurar livremente o header `Authorization`.

**Sugestão:** registrar o tipo da falha e um identificador de requisição, sem detalhes que possam expor conteúdo do token. Revisar também a configuração de logs de acesso do API Gateway para evitar registrar query strings.

## Prioridade para evolução do processamento

### Tornar o processamento do stream idempotente

**Arquivos:** `lambdas/message-processor/index.ts`, `terraform/dynamodb.tf`

O DynamoDB Stream pode entregar um mesmo registro mais de uma vez. Uma repetição pode enviar uma resposta duplicada ao usuário.

**Sugestão:** registrar o processamento por `messageId` e verificar esse estado antes de enviar novamente. Definir como lidar com falhas entre o envio da resposta e o registro de conclusão.

## Observações

- A resposta atual do chatbot é fixa; a integração com Bedrock continua fora do escopo implementado.
- As sugestões acima não foram aplicadas nem validadas por testes nesta etapa.
