export interface Loja {
  id: string;
  nomeLoja: string;
  email: string;
  nif: string;
  morada: string;
  codigoPostal: string;
  cidade: string;
  telefone: string;
  atividade: string; // talho, café, restaurante, etc. [cite: 53]
  percentualCB: number; // Define o % de cashback [cite: 55]
  ativo: boolean; // Para o Admin poder desativar [cite: 42]
}

export interface Cliente {
  id: string;
  nome: string;
  email: string;
  nif: string; // Único, não editável [cite: 20, 22]
  codigoPostal: string;
  telefone: string;
  numCartao: string; // 10 dígitos [cite: 17]
  ativo: boolean;
}

export interface Operador {
  id: string;
  nome: string;
  codigo: string; // 5 dígitos para validar operações [cite: 72]
  lojaId: string;
}

export interface Movimento {
  id: string;
  tipo: 'ADICIONAR' | 'SUBTRAIR' | 'DESCONTO'; // [cite: 62]
  valorVenda: number;
  valorCashback: number;
  clienteId: string; // ID ou Email do Cliente
  lojaId: string;
  nomeLoja: string;
  dataHora: string; // Registada automaticamente [cite: 9, 70]
  docOrigem?: string; // Fatura/Nota de Crédito/etc [cite: 70]
  operadorNome?: string; // Quem fez o movimento [cite: 72]
}