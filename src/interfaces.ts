// src/interfaces.ts

export type PerfilBase = {
  id: string;
  nif: string;
  email: string;
  nome: string;
};

export type Cliente = PerfilBase & {
  numCartao: string;
  telefone?: string;
  dataRegisto: string;
};

export type Loja = PerfilBase & {
  nomeLoja: string;
  percentualCB: number;
  ativo: boolean;
};

export type Movimento = {
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
};