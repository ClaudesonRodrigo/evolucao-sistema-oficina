// src/components/AlertaEstoque.tsx
"use client";

import { useState, useEffect } from "react";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Copy, ChevronDown, ChevronUp } from "lucide-react"; 
// Importar Toast
import { toast } from "sonner";

interface ProdutoBaixoEstoque {
  id: string;
  nome: string;
  estoqueAtual: number;
  estoqueMinimo?: number;
  monitorarEstoque?: boolean;
}

export default function AlertaEstoque() {
  const [produtos, setProdutos] = useState<ProdutoBaixoEstoque[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [isMinimized, setIsMinimized] = useState(false);

  useEffect(() => {
    const q = query(
      collection(db, "produtos"),
      where("tipo", "==", "peca"),
      where("estoqueAtual", "<=", 10)
    );

    const unsub = onSnapshot(q, (snapshot) => {
      const lista: ProdutoBaixoEstoque[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        
        if (data.monitorarEstoque === false) {
          return;
        }

        const minimo = data.estoqueMinimo || 3;
        
        if (data.estoqueAtual <= minimo) {
          lista.push({
            id: doc.id,
            nome: data.nome,
            estoqueAtual: data.estoqueAtual,
            estoqueMinimo: minimo,
            monitorarEstoque: data.monitorarEstoque
          });
        }
      });
      setProdutos(lista);
      setLoading(false);
    });

    return () => unsub();
  }, []);

  const copiarListaCompras = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (produtos.length === 0) return;

    let texto = "*LISTA DE COMPRAS URGENTE - OFICINA*\n\n";
    produtos.forEach(p => {
      const falta = (p.estoqueMinimo || 3) * 2 - p.estoqueAtual;
      texto += `- ${p.nome}: Estoque ${p.estoqueAtual} (Comprar +${falta > 0 ? falta : 5})\n`;
    });
    
    navigator.clipboard.writeText(texto);
    // Toast em vez de alert
    toast.success("Lista copiada para a área de transferência!");
  };

  if (loading || produtos.length === 0) {
    return null;
  }

  return (
    <Card className={`mb-6 border-destructive bg-destructive/10 transition-all duration-300 ${isMinimized ? 'h-16 overflow-hidden' : ''}`}>
      <CardHeader 
        className="flex flex-row items-center justify-between pb-2 space-y-0 cursor-pointer select-none"
        onClick={() => setIsMinimized(!isMinimized)}
        title="Clique para minimizar/expandir"
      >
        <div className="flex items-center gap-2">
           <AlertTriangle className="h-5 w-5 text-destructive" />
           <CardTitle className="text-destructive text-lg flex items-center gap-2">
             Reposição Necessária 
             <span className="text-sm font-normal text-destructive/80">
               ({produtos.length} itens)
             </span>
           </CardTitle>
        </div>
        
        <div className="flex items-center gap-2">
          {!isMinimized && (
            <Button variant="outline" size="sm" onClick={copiarListaCompras} className="bg-white border-destructive text-destructive hover:bg-destructive hover:text-white">
              <Copy className="mr-2 h-4 w-4" />
              Copiar
            </Button>
          )}
          
          <Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/20 p-0 h-8 w-8">
            {isMinimized ? <ChevronDown className="h-5 w-5" /> : <ChevronUp className="h-5 w-5" />}
          </Button>
        </div>
      </CardHeader>
      
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 mt-2">
          {produtos.map((produto) => (
            <div key={produto.id} className="flex justify-between items-center bg-white p-2 rounded border border-destructive/20 shadow-sm">
              <span className="font-medium truncate mr-2">{produto.nome}</span>
              <span className="text-xs font-bold px-2 py-1 rounded bg-destructive/20 text-destructive-foreground">
                {produto.estoqueAtual} / {produto.estoqueMinimo || 3}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}