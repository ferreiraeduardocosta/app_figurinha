import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import type { Sessao } from './api';

const CHAVE = 'craques-da-varzea.sessao';

/**
 * Guarda a sessão no armazenamento seguro do aparelho (Keychain no iOS,
 * Keystore no Android). No navegador (só desenvolvimento) não guarda nada:
 * é preciso entrar de novo a cada recarga.
 */
export async function lerSessao(): Promise<Sessao | null> {
  if (Platform.OS === 'web') return null;
  const valor = await SecureStore.getItemAsync(CHAVE);
  return valor ? (JSON.parse(valor) as Sessao) : null;
}

export async function salvarSessao(sessao: Sessao): Promise<void> {
  if (Platform.OS === 'web') return;
  await SecureStore.setItemAsync(CHAVE, JSON.stringify(sessao));
}

export async function apagarSessao(): Promise<void> {
  if (Platform.OS === 'web') return;
  await SecureStore.deleteItemAsync(CHAVE);
}
