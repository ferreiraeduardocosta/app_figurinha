# App mobile — Craques da Várzea

Expo (React Native) + TypeScript.

Telas: entrar/criar conta, início (pacote grátis do dia, progresso e garantia
mínima), abertura de pacote animada, álbum por clube (com detalhe da figurinha
e balcão de repetidas), probabilidades do pacote e trocas (amigos, mercado de
repetidas, propostas e contrapropostas).

A sessão fica no armazenamento seguro do aparelho (`expo-secure-store`). No
navegador ela não é guardada: é preciso entrar de novo a cada recarga.

Os avatares são provisórios (silhuetas geradas a partir do código da
figurinha) até chegar a arte final.

Este app tem o próprio `node_modules` e `package-lock.json` (fica fora dos
workspaces da raiz, para evitar problemas de hoisting do React Native).

## Rodar

```bash
cd apps/mobile
cp .env.example .env   # ajuste EXPO_PUBLIC_API_URL
npm install
npx expo start         # abra no Expo Go ou num emulador
```

- No emulador Android, a API do seu computador fica em `http://10.0.2.2:3000`.
- No navegador (`npx expo start --web`), rode a API com
  `CORS_ORIGENS=http://localhost:8081`.
- Num celular físico, use o IP do computador na rede local.

## Verificações

```bash
npm run typecheck
npx expo export --platform android   # gera o bundle, confirma que compila
```

Para adicionar bibliotecas, use `npx expo install <pacote>` (escolhe a versão
compatível com o SDK). Veja também `AGENTS.md`.

## Dica para desenvolvimento

Se o `expo start` não perceber arquivos alterados (aconteceu em ambientes sem
watcher de arquivos), reinicie com `npx expo start --clear`.

## Gerar o app instalável

Ícone, tela de abertura, identificador (`com.craquesdavarzea.app`) e perfis de build
(`eas.json`: `preview` gera APK de teste, `production` gera o pacote das lojas)
já estão configurados. Passo a passo em [docs/PUBLICACAO.md](../../docs/PUBLICACAO.md).
