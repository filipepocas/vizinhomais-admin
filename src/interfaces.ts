export interface Loja {
  id: string;
  nome: string;
  nomeLoja: string;
  email: string;
  nif: string;
  percentualCB: number;
  ativo: boolean;
}

export interface Cliente {
  id: string;
  nome: string;
  email: string;
  nif: string;
  telefone: string;
}

export interface Movimento {
  id: string;
  tipo: 'ADICIONAR' | 'SUBTRAIR';
  valorVenda: number;
  valorCashback: number;
  clienteId: string;
  lojaId: string;
  nomeLoja: string;
  dataHora: string;
}