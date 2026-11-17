import { api, Loja, Oferta } from './api';

export type ResultadoCompra = { status: 'concluida'; pacotes: number } | { status: 'cancelada' };

/**
 * Camada de pagamento. As telas só chamam `comprar` e não sabem quem processa.
 *
 * Hoje: modo de teste do servidor (LOJA_TESTE=1), sem pagamento real.
 *
 * Produção (a fazer, precisa de build nativo, não roda no Expo Go):
 *   1. `npx expo install react-native-purchases` e configurar o plugin.
 *   2. `Purchases.configure({ apiKey })` com a chave pública do RevenueCat
 *      (uma para iOS, outra para Android) e `Purchases.logIn(usuarioId)`:
 *      o servidor identifica quem comprou pelo id do usuário.
 *   3. `Purchases.getProducts([...ids das ofertas])` para mostrar o preço da loja
 *      (que pode diferir do preço de referência) e `Purchases.purchaseStoreProduct`.
 *   4. O crédito vem do servidor (webhook do RevenueCat); o app espera o perfil
 *      mostrar os pacotes novos. O app NUNCA credita nada sozinho.
 */
export async function comprar(token: string, loja: Loja, oferta: Oferta): Promise<ResultadoCompra> {
  if (!loja.modoTeste) {
    throw new Error('Compras com pagamento ainda não estão disponíveis nesta versão do app.');
  }
  const r = await api.compraTeste(token, oferta.id);
  return { status: 'concluida', pacotes: r.compra.pacotes };
}

/** Preço para mostrar. Em produção virá da loja (Apple/Google), já na moeda do jogador. */
export function precoExibido(oferta: Oferta): string {
  return (oferta.precoReferenciaCentavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
