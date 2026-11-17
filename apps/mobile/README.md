# App mobile — Liga Aurora

Expo (React Native) + TypeScript. Por enquanto, uma tela inicial que lista os
8 clubes vindos da API (`GET /clubes`).

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
- Num celular físico, use o IP do computador na rede local.

## Verificações

```bash
npm run typecheck
npx expo export --platform android   # gera o bundle, confirma que compila
```

Para adicionar bibliotecas, use `npx expo install <pacote>` (escolhe a versão
compatível com o SDK). Veja também `AGENTS.md`.
