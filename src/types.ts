// src/types.ts

export interface PerfilBase {
  id: string;      // UID gerado pelo Firebase
  nif: string;     // Identificador Único (Regra de Ouro)
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
  percentualCB: number; // Ex: 10 para 10% de Cashback
  ativo: boolean;
  nif: string; 
}

export interface Operador {
  id: string;
  lojaId: string;
  nome: string;
  codigo: string; // O código de 5 dígitos para validar operações
  ativo: boolean;
}

export interface Movimento {
  id: string;
  tipo: 'ADICIONAR' | 'SUBTRAIR' | 'DESCONTAR';
  valorVenda: number;      
  valorCashback: number;   
  clienteId: string;
  lojaId: string;
  operadorCod: string;     // Registo de quem fez a operação
  documentoRef?: string;   // Fatura ou Nota de Crédito
  dataHora: string;        // Registo automático no momento da queixa
  disponivelEm: string;    // DataHora + 48 horas (Lógica do Checklist)
  status: 'PENDENTE' | 'DISPONIVEL';
}