// src/app/(dashboard)/caixa/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { db } from "@/lib/firebase";
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  updateDoc,
  Timestamp,
  addDoc,
  Query, 
} from "firebase/firestore";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { format } from "date-fns"; // Para formatar a data

// Componentes Shadcn
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Card, CardContent } from "@/components/ui/card";

// --- Interfaces ---
interface Produto {
  id: string; 
  nome: string;
  codigoSku?: string;
  precoCusto: number;
  precoVenda: number;
  estoqueAtual: number;
  tipo: "peca" | "servico";
}
interface ItemOS {
  id: string;
  nome: string;
  qtde: number;
  precoUnitario: number;
  custoUnitario?: number;
}
interface OrdemDeServico {
  id: string;
  numeroOS: number;
  dataAbertura: Timestamp;
  nomeCliente: string;
  veiculoPlaca: string;
  veiculoModelo: string;
  servicosDescricao?: string;
  status: "aberta" | "finalizada";
  itens: ItemOS[];
  valorTotal: number;
  custoTotal: number;
  ownerId: string;
  formaPagamento?: string; // Campo já existe
}

// Schema do formulário de pagamento
const paymentSchema = z.object({
  formaPagamento: z.string().min(1, { message: "Selecione uma forma de pagamento." }),
});

export default function CaixaPage() {
  const [ordensAbertas, setOrdensAbertas] = useState<OrdemDeServico[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [osSelecionada, setOsSelecionada] = useState<OrdemDeServico | null>(null);
  
  const { userData, loading: authLoading } = useAuth();
  const router = useRouter();

  // Guardião de Rota
  if (authLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        Carregando permissões...
      </div>
    );
  }
  if (!userData) {
    router.push('/login');
    return (
       <div className="flex h-screen w-full items-center justify-center">
         Redirecionando...
       </div>
    );
  }

  // Busca as OSs
  useEffect(() => {
    if (userData) {
      const isAdmin = userData.role === 'admin';
      const osRef = collection(db, "ordensDeServico");
      
      let q: Query;
      
      // Filtro base: Status "aberta"
      const statusFilter = where("status", "==", "aberta");

      if (isAdmin) {
        // Admin vê todas as OS abertas
        q = query(osRef, statusFilter);
      } else {
        // Operador vê SÓ AS DELE que estão abertas
        q = query(osRef, statusFilter, where("ownerId", "==", userData.id));
      }
      
      const unsub = onSnapshot(q, (querySnapshot) => {
        const listaOS: OrdemDeServico[] = [];
        querySnapshot.forEach((doc) => {
          listaOS.push({ id: doc.id, ...doc.data() } as OrdemDeServico);
        });
        setOrdensAbertas(listaOS); 
      });

      return () => unsub();
    }
  }, [userData]);

  const form = useForm<z.infer<typeof paymentSchema>>({
    resolver: zodResolver(paymentSchema),
    defaultValues: {
      formaPagamento: "",
    },
  });

  // Função para abrir o modal de Detalhes
  const handleVerDetalhes = (os: OrdemDeServico) => {
    setOsSelecionada(os);
    setIsModalOpen(true);
  };

  // Função para abrir o modal de Pagamento
  const handleAbrirPagamento = (os: OrdemDeServico) => {
    setOsSelecionada(os);
    setIsModalOpen(false); // Fecha o modal de detalhes
    setIsPaymentModalOpen(true); // Abre o modal de pagamento
    form.reset();
  };

  // Função para REGISTRAR o pagamento
  async function handleRegistrarPagamento(values: z.infer<typeof paymentSchema>) {
    if (!osSelecionada || !userData) {
      alert("Erro: OS não selecionada ou usuário não autenticado.");
      return;
    }

    try {
      // 1. Atualiza a Ordem de Serviço
      const osDocRef = doc(db, "ordensDeServico", osSelecionada.id);
      await updateDoc(osDocRef, {
        status: "finalizada",
        formaPagamento: values.formaPagamento,
        dataFechamento: Timestamp.now(),
      });

      // 2. Cria a Movimentação Financeira (Entrada no Caixa)
      await addDoc(collection(db, "movimentacoes"), {
        data: Timestamp.now(),
        tipo: "entrada",
        descricao: `Venda OS Nº ${osSelecionada.numeroOS}`,
        valor: osSelecionada.valorTotal,
        custo: osSelecionada.custoTotal,
        formaPagamento: values.formaPagamento,
        ownerId: userData.id, // ID de quem finalizou a venda
        referenciaId: osSelecionada.id, // ID da OS
      });

      console.log("Venda finalizada com sucesso!");
      setIsPaymentModalOpen(false);
      setOsSelecionada(null);

    } catch (error) {
      console.error("Erro ao registrar pagamento: ", error);
      alert("Erro ao registrar pagamento. Verifique o console.");
    }
  }

  return (
    <div>
      <h1 className="text-4xl font-bold mb-6">Frente de Caixa</h1>
      
      {ordensAbertas.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-lg">Nenhuma Ordem de Serviço aberta no momento.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nº OS</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Placa</TableHead>
                <TableHead>Valor (R$)</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ordensAbertas.map((os) => (
                <TableRow key={os.id}>
                  <TableCell className="font-medium">{os.numeroOS}</TableCell>
                  <TableCell>
                    {format(new Date(os.dataAbertura.seconds * 1000), 'dd/MM/yyyy')}
                  </TableCell>
                  <TableCell>{os.nomeCliente}</TableCell>
                  <TableCell>{os.veiculoPlaca}</TableCell>
                  <TableCell>R$ {os.valorTotal.toFixed(2)}</TableCell>
                  <TableCell>
                    <Button variant="outline" size="sm" onClick={() => handleVerDetalhes(os)} className="mr-2">
                      Ver Detalhes
                    </Button>
                    <Button size="sm" onClick={() => handleAbrirPagamento(os)}>
                      Registrar Pagamento
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* --- MODAL DE DETALHES (ATUALIZADO) --- */}
      {osSelecionada && (
        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogContent className="sm:max-w-[600px]">
            {/* --- ATUALIZAÇÃO 1: Nome da Empresa Adicionado --- */}
            <DialogHeader>
              <DialogTitle className="text-2xl">Detalhes da OS: {osSelecionada.numeroOS}</DialogTitle>
              <DialogDescription className="text-lg font-semibold">
                Rodrigo Skaps
              </DialogDescription>
            </DialogHeader>

            <div className="grid grid-cols-2 gap-4 py-4">
              {/* Coluna 1: Cliente e Veículo */}
              <div className="space-y-2">
                <h4 className="font-semibold">Cliente</h4>
                <p>{osSelecionada.nomeCliente}</p>
                
                <h4 className="font-semibold mt-4">Veículo</h4>
                <p>{osSelecionada.veiculoModelo} - {osSelecionada.veiculoPlaca}</p>
              </div>

              {/* Coluna 2: Datas e Status */}
              <div className="space-y-2">
                <h4 className="font-semibold">Data de Abertura</h4>
                <p>{format(new Date(osSelecionada.dataAbertura.seconds * 1000), 'dd/MM/yyyy HH:mm')}</p>
                
                <h4 className="font-semibold mt-4">Status</h4>
                <p className="capitalize font-bold">{osSelecionada.status}</p>
                
                {/* --- ATUALIZAÇÃO 2: Forma de Pagamento (Se finalizada) --- */}
                {osSelecionada.status === 'finalizada' && osSelecionada.formaPagamento && (
                  <>
                    <h4 className="font-semibold mt-4">Forma de Pagamento</h4>
                    <p className="font-bold">{osSelecionada.formaPagamento}</p>
                  </>
                )}
              </div>
            </div>

            {/* Itens da OS */}
            <h4 className="font-semibold mb-2">Itens e Serviços</h4>
            <div className="rounded-md border max-h-48 overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead>Qtde</TableHead>
                    <TableHead>Vl. Unit.</TableHead>
                    <TableHead>Vl. Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {osSelecionada.itens.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>{item.nome}</TableCell>
                      <TableCell>{item.qtde}</TableCell>
                      <TableCell>R$ {item.precoUnitario.toFixed(2)}</TableCell>
                      <TableCell>R$ {(item.qtde * item.precoUnitario).toFixed(2)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            
            <div className="text-right mt-4">
              <h3 className="text-2xl font-bold">
                Valor Total: R$ {osSelecionada.valorTotal.toFixed(2)}
              </h3>
            </div>

            <DialogFooter className="mt-6">
              <Button variant="outline" onClick={() => setIsModalOpen(false)}>Fechar</Button>
              {osSelecionada.status === 'aberta' && (
                <Button onClick={() => handleAbrirPagamento(osSelecionada)}>
                  Ir para Pagamento
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
      
      {/* --- MODAL DE PAGAMENTO (Sem alterações) --- */}
      {osSelecionada && (
        <Dialog open={isPaymentModalOpen} onOpenChange={setIsPaymentModalOpen}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Registrar Pagamento (OS: {osSelecionada.numeroOS})</DialogTitle>
              <DialogDescription>
                Valor Total: R$ {osSelecionada.valorTotal.toFixed(2)}
              </DialogDescription>
            </DialogHeader>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleRegistrarPagamento)} className="space-y-6 pt-4">
                <FormField
                  control={form.control}
                  name="formaPagamento"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Forma de Pagamento</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione..." />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="Dinheiro">Dinheiro</SelectItem>
                          <SelectItem value="Pix">Pix</SelectItem>
                          <SelectItem value="Cartão de Débito">Cartão de Débito</SelectItem>
                          <SelectItem value="Cartão de Crédito">Cartão de Crédito</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <DialogFooter>
                  <Button 
                    type="submit" 
                    disabled={form.formState.isSubmitting} 
                    className="w-full"
                    size="lg"
                  >
                    {form.formState.isSubmitting ? "Finalizando..." : "Finalizar Venda"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      )}

    </div>
  );
}