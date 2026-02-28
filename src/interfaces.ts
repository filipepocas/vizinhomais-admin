export interface Loja {
  id: string;
  nomeLoja: string;
  email: string;
  nif: string;
  morada: string;
  codigoPostal: string;
  cidade: string;
  telefone: string;
  atividade: string;
  percentualCB: number;
  ativo: boolean;
}

export interface Cliente {
  id: string;
  nome: string;
  email: string;
  nif: string;
  codigoPostal: string;
  telefone: string;
  numCartao: string;
  ativo: boolean;
}

export interface Operador {
  id: string;
  nome: string;
  codigo: string; // 5 dígitos para validar operações
  lojaId: string;
}

export interface Movimento {
  id: string;
  tipo: 'ADICIONAR' | 'SUBTRAIR' | 'DESCONTO';
  valorVenda: number;
  valorCashback: number;
  clienteId: string;
  lojaId: string;
  nomeLoja: string;
  dataHora: string;
  docOrigem?: string;
  operadorNome?: string;
}