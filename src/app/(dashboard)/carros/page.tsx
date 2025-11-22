// src/app/(dashboard)/carros/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { 
  collection, addDoc, onSnapshot, query, where, Query, deleteDoc, doc
} from "firebase/firestore"; 
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { maskPlate } from "@/lib/masks";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Cliente { id: string; nome: string; }
interface Carro { id: string; modelo: string; placa: string; ano?: string; cor?: string; clienteId: string; nomeCliente?: string; ownerId: string; }

const formSchema = z.object({
  clienteId: z.string().min(1, "Selecione um cliente."),
  modelo: z.string().min(2, "Informe o modelo."),
  placa: z.string().min(7, "A placa deve ter pelo menos 7 caracteres."),
  ano: z.string().optional(),
  cor: z.string().optional(),
});

export default function CarrosPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [carros, setCarros] = useState<Carro[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const { userData, loading: authLoading } = useAuth();
  const router = useRouter();

  if (authLoading) return <div className="flex h-screen w-full items-center justify-center">Carregando...</div>;
  if (!userData) { router.push('/login'); return null; }

  useEffect(() => {
    if (userData) {
      const isAdmin = userData.role === 'admin';
      
      // Clientes
      let qClientes = isAdmin ? query(collection(db, "clientes")) : query(collection(db, "clientes"), where("ownerId", "==", userData.id));
      const unsubClientes = onSnapshot(qClientes, (snapshot) => setClientes(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Cliente))));

      // Carros
      let qCarros = isAdmin ? query(collection(db, "carros")) : query(collection(db, "carros"), where("ownerId", "==", userData.id));
      const unsubCarros = onSnapshot(qCarros, (snapshot) => {
        setCarros(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Carro)));
      });

      return () => { unsubClientes(); unsubCarros(); };
    }
  }, [userData]);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { clienteId: "", modelo: "", placa: "", ano: "", cor: "" },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    try {
      const clienteSelecionado = clientes.find(c => c.id === values.clienteId);
      await addDoc(collection(db, "carros"), {
        ...values,
        placa: values.placa.toUpperCase(),
        nomeCliente: clienteSelecionado?.nome || "Desconhecido",
        ownerId: userData?.id
      });
      toast.success("Veículo cadastrado!");
      form.reset();
      setIsModalOpen(false);
    } catch (error) {
      toast.error("Erro ao cadastrar.");
    }
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-4xl font-bold">Veículos</h1>
        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogTrigger asChild><Button>Cadastrar Veículo</Button></DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader><DialogTitle>Novo Veículo</DialogTitle><DialogDescription>Cadastre o veículo e vincule a um cliente.</DialogDescription></DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField control={form.control} name="clienteId" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Dono (Cliente)</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger></FormControl>
                      <SelectContent>
                        {clientes.map((cliente) => <SelectItem key={cliente.id} value={cliente.id}>{cliente.nome}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="modelo" render={({ field }) => ( <FormItem><FormLabel>Modelo</FormLabel><FormControl><Input placeholder="Ex: Fiat Uno" {...field} /></FormControl><FormMessage /></FormItem> )} />
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="placa" render={({ field }) => ( 
                    <FormItem>
                      <FormLabel>Placa</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="ABC-1234" 
                          {...field} 
                          onChange={(e) => field.onChange(maskPlate(e.target.value))}
                          maxLength={8}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem> 
                  )} />
                  <FormField control={form.control} name="ano" render={({ field }) => ( <FormItem><FormLabel>Ano</FormLabel><FormControl><Input placeholder="2010" {...field} /></FormControl><FormMessage /></FormItem> )} />
                </div>
                <FormField control={form.control} name="cor" render={({ field }) => ( <FormItem><FormLabel>Cor</FormLabel><FormControl><Input placeholder="Ex: Prata" {...field} /></FormControl><FormMessage /></FormItem> )} />
                <DialogFooter><Button type="submit">Salvar Veículo</Button></DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Modelo</TableHead>
              <TableHead>Placa</TableHead>
              <TableHead>Cor</TableHead>
              <TableHead>Dono</TableHead>
              <TableHead>Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {carros.map((carro) => (
              <TableRow key={carro.id}>
                <TableCell>{carro.modelo}</TableCell>
                <TableCell>{carro.placa}</TableCell>
                <TableCell>{carro.cor || "-"}</TableCell>
                <TableCell>{carro.nomeCliente}</TableCell>
                <TableCell>
                   <Button variant="destructive" size="sm" 
                      onClick={async () => {
                        if (confirm("Excluir este veículo?")) {
                           await deleteDoc(doc(db, "carros", carro.id));
                           toast.success("Veículo excluído.");
                        }
                      }}
                    >
                      Excluir
                    </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}