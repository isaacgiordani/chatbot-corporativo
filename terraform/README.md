# Terraform

Esta configuração cria o bucket privado do site na região N. Virgínia (`us-east-1`). O nome é montado automaticamente como `<AccountId>-<env>-chatbot-corporativo-s3`, usando os valores de `dev.tfvars`; para o ambiente atual, será `651644924182-dev-chatbot-corporativo-s3`. O provider recusa credenciais de outra conta. O valor `VALCANN | TESTE` é mantido em `dev.tfvars`, mas a tag AWS converte `|` para `-` (`VALCANN - TESTE`) porque esse caractere não é aceito em tags por vários serviços AWS.

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

Confirme a operação quando o Terraform solicitar. A configuração não cria CloudFront nem habilita hospedagem pública de site estático; o bucket permanece privado.

## Publicar o frontend

Depois de configurar separadamente o acesso privado, por exemplo com CloudFront e Origin Access Control, use o output do Terraform como bucket de destino:

```bash
export AWS_S3_BUCKET="$(terraform output -raw site_bucket_name)"
cd ../site
npm ci
npm run deploy:s3
```

O script `deploy:s3` gera o build e sincroniza `site/dist/` com o bucket. O bucket privado não serve conteúdo diretamente ao navegador; configure CloudFront com Origin Access Control antes de esperar que o site fique acessível aos usuários.
