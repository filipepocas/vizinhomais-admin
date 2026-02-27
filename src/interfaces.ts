// src/interfaces.ts
export interface PerfilBase {
  id: string;
  nif: string;
  email: string;
  nome: string;
}

export interface Cliente extends PerfilBase {
  numCartao: string;
  telefone?: string;
  dataRegisto: string;
}

export interface Loja extends PerfilBase {
  nomeLoja: string;
  percentualCB: number;
  ativo: boolean;
  nif: string;
}

export interface Movimento {
  id: string;
  tipo: 'ADICIONAR' | 'SUBTRAIR' | 'DESCONTAR';
  valorVenda: number;
  valorCashback: number;
  clienteId: string;
  lojaId: string;
  operadorCod: string;
  dataHora: string;
  disponivelEm: string;
  status: 'PENDENTE' | 'DISPONIVEL';
}