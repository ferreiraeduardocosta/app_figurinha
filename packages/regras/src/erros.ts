export type CodigoErroRegra =
  | 'CONFIG_INVALIDA'
  | 'CATALOGO_INVALIDO'
  | 'FIGURINHA_INEXISTENTE'
  | 'JA_POSSUI'
  | 'REPETIDAS_INSUFICIENTES'
  | 'TROCA_INVALIDA'
  | 'SEM_REPETIDA';

/** Erro de regra do jogo: algo que o jogador ou a configuração não pode fazer. */
export class ErroRegra extends Error {
  constructor(
    public readonly codigo: CodigoErroRegra,
    mensagem: string,
  ) {
    super(mensagem);
    this.name = 'ErroRegra';
  }
}
