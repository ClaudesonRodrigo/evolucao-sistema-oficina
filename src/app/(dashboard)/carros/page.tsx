// src/app/(dashboard)/carros/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { 
  collection, addDoc, onSnapshot, query, where, Query, 
  deleteDoc, doc, updateDoc 
} from "firebase/firestore"; 
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { maskPlate } from "@/lib/masks";
import { Edit, Trash2 } from "lucide-react";

// Componentes Shadcn
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

// Interfaces
interface Cliente {
  id: string;
  nome: string;
}

interface Carro {
  id: string; 
  modelo: string;
  placa: string;
  ano?: string;
  cor?: string;
  clienteId: string;
  nomeCliente?: string; 
  ownerId: string;
}

// Schema de Validação (Reaproveitado para Criar e Editar)
const formSchema = z.object({
  clienteId: z.string().min(1, "Selecione um cliente."),
  modelo: z.string().min(2, "Informe o modelo."),
  placa: z.string().min(7, "A placa deve ter pelo menos 7 caracteres."),
  ano: z.string().optional(),
  cor: z.string().optional(),
});

export default function CarrosPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [carroParaEditar, setCarroParaEditar] = useState<Carro | null>(null);
  
  const [carros, setCarros] = useState<Carro[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);

  const { userData, loading: authLoading } = useAuth();
  const router = useRouter();

  if (authLoading) {
    return <div className="flex h-screen w-full items-center justify-center">Carregando...</div>;
  }
  if (!userData) { 
    router.push('/login');
    return null;
  }

  // Buscar Dados
  useEffect(() => {
    if (userData) {
      const isAdmin = userData.role === 'admin';
      
      // 1. Clientes (para o select)
      let qClientes = isAdmin 
        ? query(collection(db, "clientes")) 
        : query(collection(db, "clientes"), where("ownerId", "==", userData.id));
      
      const unsubClientes = onSnapshot(qClientes, (snapshot) => {
        setClientes(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Cliente)));
      });

      // 2. Carros (para a tabela)
      let qCarros = isAdmin 
        ? query(collection(db, "carros")) 
        : query(collection(db, "carros"), where("ownerId", "==", userData.id));

      const unsubCarros = onSnapshot(qCarros, (snapshot) => {
        const listaCarros: Carro[] = [];
        snapshot.forEach((doc) => {
          listaCarros.push({ id: doc.id, ...doc.data() } as Carro);
        });
        setCarros(listaCarros);
      });

      return () => {
        unsubClientes();
        unsubCarros();
      };
    }
  }, [userData]);

  // --- Formulários ---
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { clienteId: "", modelo: "", placa: "", ano: "", cor: "" },
  });

  const editForm = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { clienteId: "", modelo: "", placa: "", ano: "", cor: "" },
  });

  // --- CRIAR Carro ---
  async function onSubmit(values: z.infer<typeof formSchema>) {
    try {
      const clienteSelecionado = clientes.find(c => c.id === values.clienteId);
      
      await addDoc(collection(db, "carros"), {
        ...values,
        placa: values.placa.toUpperCase(),
        nomeCliente: clienteSelecionado?.nome || "Desconhecido",
        ownerId: userData?.id
      });

      toast.success("Veículo cadastrado com sucesso!");
      form.reset();
      setIsModalOpen(false);

    } catch (error) {
      console.error(error);
      toast.error("Erro ao cadastrar veículo.");
    }
  }

  // --- EDITAR Carro ---
  const handleEditarCarro = (carro: Carro) => {
    setCarroParaEditar(carro);
    editForm.reset({
      clienteId: carro.clienteId,
      modelo: carro.modelo,
      placa: carro.placa,
      ano: carro.ano || "",
      cor: carro.cor || "",
    });
    setIsEditModalOpen(true);
  };

  async function onEditSubmit(values: z.infer<typeof formSchema>) {
    if (!carroParaEditar) return;

    try {
      const clienteSelecionado = clientes.find(c => c.id === values.clienteId);
      const docRef = doc(db, "carros", carroParaEditar.id);
      
      await updateDoc(docRef, {
        ...values,
        placa: values.placa.toUpperCase(),
        nomeCliente: clienteSelecionado?.nome || "Desconhecido",
      });

      toast.success("Veículo atualizado!");
      setIsEditModalOpen(false);
      setCarroParaEditar(null);

    } catch (error) {
      console.error(error);
      toast.error("Erro ao atualizar veículo.");
    }
  }

  // --- EXCLUIR Carro ---
  const handleDeleteCarro = async (carro: Carro) => {
    try {
      await deleteDoc(doc(db, "carros", carro.id));
      toast.success("Veículo excluído com sucesso.");
    } catch (error) {
      console.error("Erro ao excluir:", error);
      toast.error("Erro ao excluir veículo.");
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-4xl font-bold">Veículos</h1>
        
        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogTrigger asChild>
            <Button>Cadastrar Veículo</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Novo Veículo</DialogTitle>
              <DialogDescription>
                Cadastre o veículo e vincule a um cliente.
              </DialogDescription>
            </DialogHeader>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                
                <FormField
                  control={form.control}
                  name="clienteId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Dono (Cliente)</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione o cliente..." />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {clientes.map((cliente) => (
                            <SelectItem key={cliente.id} value={cliente.id}>
                              {cliente.nome}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="modelo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Modelo</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: Fiat Uno" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="placa"
                    render={({ field }) => (
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
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="ano"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Ano</FormLabel>
                        <FormControl>
                          <Input placeholder="2010" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="cor"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cor</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: Prata" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <DialogFooter>
                  <Button type="submit" disabled={form.formState.isSubmitting}>
                    {form.formState.isSubmitting ? "Salvando..." : "Salvar Veículo"}
                  </Button>
                </DialogFooter>
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
              <TableHead>Cliente (Dono)</TableHead>
              <TableHead>Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {carros.map((carro) => (
              <TableRow key={carro.id}>
                <TableCell className="font-medium">{carro.modelo}</TableCell>
                <TableCell>{carro.placa}</TableCell>
                <TableCell>{carro.cor || "-"}</TableCell>
                <TableCell>{carro.nomeCliente}</TableCell>
                <TableCell className="flex gap-2">
                   
                   {/* Botão Editar */}
                   <Button variant="ghost" size="icon-sm" onClick={() => handleEditarCarro(carro)} title="Editar">
                      <Edit className="h-4 w-4" />
                   </Button>

                   {/* Botão Excluir (com AlertDialog) */}
                   <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" size="icon-sm" title="Excluir">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Tem certeza?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Isso excluirá permanentemente o veículo <span className="font-bold">{carro.modelo} ({carro.placa})</span>.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction 
                          onClick={() => handleDeleteCarro(carro)}
                          className="bg-red-600 hover:bg-red-700"
                        >
                          Sim, excluir
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>

                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* --- MODAL DE EDIÇÃO --- */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Editar Veículo</DialogTitle>
          </DialogHeader>

          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4">
              
              <FormField
                control={editForm.control}
                name="clienteId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Dono (Cliente)</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o cliente..." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {clientes.map((cliente) => (
                          <SelectItem key={cliente.id} value={cliente.id}>
                            {cliente.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={editForm.control}
                name="modelo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Modelo</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={editForm.control}
                  name="placa"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Placa</FormLabel>
                      <FormControl>
                        <Input 
                          {...field} 
                          onChange={(e) => field.onChange(maskPlate(e.target.value))}
                          maxLength={8}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={editForm.control}
                  name="ano"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Ano</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={editForm.control}
                name="cor"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cor</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button type="submit" disabled={editForm.formState.isSubmitting}>
                  {editForm.formState.isSubmitting ? "Salvando..." : "Salvar Alterações"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

    </div>
  );
}