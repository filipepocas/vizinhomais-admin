// src/types.ts

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

export interface Operador {
  id: string;
  lojaId: string;
  nome: string;
  codigo: string;
  ativo: boolean;
}

export interface Movimento {
  id: string;
  tipo: 'ADICIONAR' | 'SUBTRAIR' | 'DESCONTAR';
  valorVenda: number;
  valorCashback: number;
  clienteId: string;
  lojaId: string;
  operadorCod: string;
  documentoRef?: string;
  dataHora: string;
  disponivelEm: string;
  status: 'PENDENTE' | 'DISPONIVEL';
}