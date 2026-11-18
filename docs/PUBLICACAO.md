# Publicação: servidor e app

Ordem recomendada: **1) publicar o servidor**, **2) gerar o APK de teste**,
**3) instalar no Android e testar**. Depois, as lojas (ver [LOJA.md](LOJA.md)).

---

## 1. Servidor (API + banco)

A API roda num container Docker ([`Dockerfile`](../Dockerfile)). Ao subir, ela:

1. aplica as migrações do banco;
2. carrega as 136 figurinhas **se o banco estiver vazio** (primeiro deploy;
   depois disso nunca sobrescreve edições feitas no painel);
3. sobe a API (porta 3000) com o painel em `/admin`.

### Variáveis de ambiente

| Variável | Obrigatória | O que é |
|---|---|---|
| `DATABASE_URL` | sim | Conexão PostgreSQL 16 (`postgresql://usuario:senha@host:5432/banco?schema=public`) |
| `PORT` | não | Porta (padrão 3000; muitas hospedagens definem sozinhas) |
| `TRUST_PROXY` | sim, em hospedagem | Número de proxies na frente da API, normalmente `1`. Sem isso o limite de tentativas de login trata todos os jogadores como um só |
| `LIGA_SEMENTE` | recomendada | Texto secreto: impede prever os placares da liga lendo o código |
| `REVENUECAT_WEBHOOK_TOKEN` | quando ligar pagamentos | Ver [LOJA.md](LOJA.md) |
| `NODE_ENV` | já vem `production` na imagem | Desliga o modo de teste da loja |

**Nunca** defina `LOJA_TESTE=1` em produção (a imagem já o ignora com
`NODE_ENV=production`).

### Opção A — hospedagem gerenciada (mais simples)

Serviços como Render, Railway ou Fly.io constroem o `Dockerfile` direto do
GitHub e oferecem PostgreSQL gerenciado com backup e HTTPS automático:

1. Criar um banco PostgreSQL 16 no serviço e copiar a URL de conexão.
2. Criar um serviço web a partir deste repositório, usando o `Dockerfile` da raiz.
3. Definir as variáveis da tabela acima (`TRUST_PROXY=1`).
4. Aguardar o deploy e abrir `https://<seu-endereço>/saude` (deve responder
   `{"status":"ok"}`).

> Planos gratuitos costumam "dormir" quando ficam sem acesso; a primeira
> requisição depois disso demora alguns segundos.

### Opção B — servidor próprio (VPS)

Com Docker instalado no servidor:

```bash
git clone https://github.com/ferreiraeduardocosta/app_figurinha && cd app_figurinha
```

```bash
cat > .env.producao <<'FIM'
POSTGRES_USER=liga
POSTGRES_PASSWORD=troque-por-uma-senha-forte
POSTGRES_DB=liga_aurora
TRUST_PROXY=1
LIGA_SEMENTE=troque-por-um-texto-secreto
FIM
```

```bash
docker compose -f docker-compose.prod.yml --env-file .env.producao up -d --build
```

Coloque um proxy com HTTPS na frente (Caddy ou Nginx com Let's Encrypt): o app
Android em modo de produção **só aceita servidores HTTPS**. Faça backup diário
do volume do PostgreSQL.

### Primeiro administrador

Crie uma conta pelo app ou pela API e promova-a dentro do container:

```bash
docker compose -f docker-compose.prod.yml exec api npm run admin:promover -- seu-email@exemplo.com
```

(Em hospedagem gerenciada, use o "shell"/"console" do serviço e rode
`npm run admin:promover -- seu-email@exemplo.com` na pasta `/app/apps/api`.)

### Se o Docker Hub limitar downloads

A imagem base vem do Docker Hub. Se o build falhar com erro 429, use um espelho:

```bash
docker build --build-arg NODE_IMAGE=mirror.gcr.io/library/node:22-bookworm -t liga-aurora-api .
```

---

## 2. APK de teste (Android)

Configuração pronta em `apps/mobile`: ícone e tela de abertura próprios,
identificador `com.ligaaurora.app` e o perfil `preview` do
[`eas.json`](../apps/mobile/eas.json), que gera um **APK** instalável direto no
celular.

> O identificador `com.ligaaurora.app` não pode mudar depois do primeiro envio
> à Google Play/App Store. Se quiser outro (por exemplo, com um domínio seu),
> troque em `apps/mobile/app.json` antes.

Passos (no seu computador, com Node 22):

1. Criar uma conta gratuita em [expo.dev](https://expo.dev).
2. Na pasta `apps/mobile`:

   ```bash
   npm install
   ```

   ```bash
   npx eas-cli@latest login
   ```

   ```bash
   npx eas-cli@latest init
   ```

   O `init` cria o projeto na sua conta Expo e grava o id dele no `app.json`
   (faça commit dessa mudança).
3. Dizer ao app onde está o servidor (troque pelo seu endereço HTTPS):

   ```bash
   npx eas-cli@latest env:create --environment preview --name EXPO_PUBLIC_API_URL --value https://seu-servidor.exemplo.com --visibility plaintext
   ```

4. Gerar o APK (o build roda na nuvem do Expo, leva de 10 a 20 minutos):

   ```bash
   npx eas-cli@latest build --platform android --profile preview
   ```

   Ao final aparece um link e um QR code para baixar o APK.

## 3. Instalar e testar no Android

1. Abra o link (ou leia o QR code) no celular e baixe o APK.
2. Permita "instalar apps de fontes desconhecidas" quando o Android pedir.
3. Abra o **Liga Aurora**, crie uma conta e teste: pacote do dia, álbum,
   trocas (com uma segunda conta), loja (sem pagamento real), liga e ranking.

O que ainda não funciona nesse APK: pagamentos reais (ver [LOJA.md](LOJA.md)) e
notificações push.

## 4. Produção (lojas)

```bash
npx eas-cli@latest env:create --environment production --name EXPO_PUBLIC_API_URL --value https://seu-servidor.exemplo.com --visibility plaintext
```

```bash
npx eas-cli@latest build --platform all --profile production
```

O perfil `production` gera o pacote das lojas (AAB no Android) e numera as
versões automaticamente. iOS exige conta Apple Developer. Antes de publicar, veja
o checklist em [LOJA.md](LOJA.md#antes-de-publicar).
