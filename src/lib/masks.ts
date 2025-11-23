// src/lib/masks.ts

// --- MÁSCARAS GERAIS ---

// Telefone: (00) 00000-0000
export const maskPhone = (value: string) => {
  return value
    .replace(/\D/g, "")
    .replace(/^(\d{2})(\d)/g, "($1) $2")
    .replace(/(\d)(\d{4})$/, "$1-$2")
    .slice(0, 15);
};

// CPF: 000.000.000-00 ou CNPJ: 00.000.000/0000-00
export const maskCpfCnpj = (value: string) => {
  const v = value.replace(/\D/g, "");
  
  if (v.length <= 11) {
    // CPF
    return v
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d{1,2})/, "$1-$2")
      .replace(/(-\d{2})\d+?$/, "$1");
  } else {
    // CNPJ
    return v
      .replace(/^(\d{2})(\d)/, "$1.$2")
      .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
      .replace(/\.(\d{3})(\d)/, ".$1/$2")
      .replace(/(\d{4})(\d)/, "$1-$2")
      .replace(/(-\d{2})\d+?$/, "$1")
      .slice(0, 18);
  }
};

// Placa: AAA-1234
export const maskPlate = (value: string) => {
  let v = value.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (v.length > 3) {
    v = v.replace(/^([A-Z]{3})([A-Z0-9])/, "$1-$2");
  }
  return v.slice(0, 8);
};

// --- MÁSCARAS FINANCEIRAS ---

// 1. Para EXIBIÇÃO: Devolve "R$ 1.250,50"
export const formatMoney = (value: number | string) => {
  const numericValue = Number(value);
  if (isNaN(numericValue)) return "R$ 0,00";

  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(numericValue);
};

// 2. Para INPUT (Ajuda a digitar): "100" -> "R$ 1,00"
// ATENÇÃO: Renomeei para bater com o que sua página espera, se necessário
export const maskCurrency = (value: string | number) => {
  const v = String(value).replace(/\D/g, "");
  const numberValue = Number(v) / 100;
  
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(numberValue);
};

// Alias para facilitar (caso esteja usando maskInputCurrency em algum lugar)
export const maskInputCurrency = maskCurrency;

// 3. Para SALVAR (Limpa a string): "R$ 1.250,00" -> 1250.00
// CORREÇÃO: Renomeado de unmaskMoney para unmaskCurrency
export const unmaskCurrency = (value: string | number) => {
  if (typeof value === "number") return value;
  const cleanValue = String(value).replace(/[^\d,]/g, "").replace(",", ".");
  return Number(cleanValue) || 0;
};

// Alias para garantir compatibilidade
export const unmaskMoney = unmaskCurrency;