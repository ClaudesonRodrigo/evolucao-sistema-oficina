// src/app/(dashboard)/fornecedores/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { db } from "@/lib/firebase";
import { 
  collection, addDoc, onSnapshot, query, where, Query, doc, updateDoc, deleteDoc 
} from "firebase/firestore"; 
import { Edit, Trash2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { maskPhone, maskCpfCnpj } from "@/lib/masks";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

interface Fornecedor {
  id: string; 
  nome: string;
  telefone?: string;
  cnpj?: string;
  vendedor?: string; 
  ownerId?: string;
}

const formSchema = z.object({
  nome: z.string().min(3, { message: "O nome deve ter pelo menos 3 caracteres." }),
  telefone: z.string().optional(),
  cnpj: z.string().optional(),
  vendedor: z.string().optional(),
});

export default function FornecedoresPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [fornecedorParaEditar, setFornecedorParaEditar] = useState<Fornecedor | null>(null);
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);

  const { userData, loading: authLoading } = useAuth();
  const router = useRouter();

  if (authLoading) return <div className="flex h-screen w-full items-center justify-center">Carregando...</div>;
  if (!userData) { router.push('/login'); return null; }
  
  useEffect(() => {
    if (userData) {
      const isAdmin = userData.role === 'admin';
      const fornecedoresRef = collection(db, "fornecedores");
      let q: Query;
      if (isAdmin) {
        q = query(fornecedoresRef);
      } else {
        q = query(fornecedoresRef, where("ownerId", "==", userData.id));
      }
      const unsub = onSnapshot(q, (querySnapshot) => {
        const listaDeFornecedores: Fornecedor[] = [];
        querySnapshot.forEach((doc) => {
          listaDeFornecedores.push({ id: doc.id, ...doc.data() } as Fornecedor);
        });
        setFornecedores(listaDeFornecedores); 
      });
      return () => unsub();
    }
  }, [userData]);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { nome: "", telefone: "", cnpj: "", vendedor: "" },
  });

  const editForm = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { nome: "", telefone: "", cnpj: "", vendedor: "" },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    try {
      const docParaSalvar = { ...values, ownerId: userData?.id };
      await addDoc(collection(db, "fornecedores"), docParaSalvar);
      toast.success("Fornecedor cadastrado!");
      form.reset();
      setIsModalOpen(false);
    } catch (error) {
      console.error(error);
      toast.error("Erro ao salvar.");
    }
  }

  const handleEditarFornecedor = (fornecedor: Fornecedor) => {
    setFornecedorParaEditar(fornecedor);
    editForm.reset({
      nome: fornecedor.nome,
      telefone: fornecedor.telefone || "",
      cnpj: fornecedor.cnpj || "",
      vendedor: fornecedor.vendedor || "",
    });
    setIsEditModalOpen(true);
  };

  async function onEditSubmit(values: z.infer<typeof formSchema>) {
    if (!fornecedorParaEditar) return;
    try {
      const docRef = doc(db, "fornecedores", fornecedorParaEditar.id);
      await updateDoc(docRef, {
        nome: values.nome,
        telefone: values.telefone,
        cnpj: values.cnpj,
        vendedor: values.vendedor,
      });
      toast.success("Fornecedor atualizado!");
      setIsEditModalOpen(false);
      setFornecedorParaEditar(null);
    } catch (error) {
      toast.error("Erro ao atualizar.");
    }
  }

  const handleDeleteFornecedor = async (fornecedor: Fornecedor) => {
    if (confirm(`Excluir "${fornecedor.nome}"?`)) {
      try {
        await deleteDoc(doc(db, "fornecedores", fornecedor.id));
        toast.success("Fornecedor excluído.");
      } catch (error) {
        toast.error("Erro ao excluir.");
      }
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-4xl font-bold">Fornecedores</h1>
        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogTrigger asChild><Button>Adicionar Novo Fornecedor</Button></DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader><DialogTitle>Adicionar Novo Fornecedor</DialogTitle></DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField control={form.control} name="nome" render={({ field }) => ( <FormItem><FormLabel>Empresa</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                <FormField control={form.control} name="vendedor" render={({ field }) => ( <FormItem><FormLabel>Vendedor</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
                <FormField control={form.control} name="telefone" render={({ field }) => ( 
                  <FormItem>
                    <FormLabel>Telefone</FormLabel>
                    <FormControl>
                      <Input {...field} onChange={(e) => field.onChange(maskPhone(e.target.value))} maxLength={15} />
                    </FormControl>
                    <FormMessage />
                  </FormItem> 
                )} />
                <FormField control={form.control} name="cnpj" render={({ field }) => ( 
                  <FormItem>
                    <FormLabel>CNPJ</FormLabel>
                    <FormControl>
                      <Input {...field} onChange={(e) => field.onChange(maskCpfCnpj(e.target.value))} maxLength={18} />
                    </FormControl>
                    <FormMessage />
                  </FormItem> 
                )} />
                <DialogFooter><Button type="submit">Salvar</Button></DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Empresa</TableHead>
              <TableHead>Vendedor</TableHead>
              <TableHead>Telefone</TableHead>
              <TableHead>CNPJ</TableHead>
              <TableHead>Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {fornecedores.map((fornecedor) => (
              <TableRow key={fornecedor.id}>
                <TableCell>{fornecedor.nome}</TableCell>
                <TableCell>{fornecedor.vendedor}</TableCell>
                <TableCell>{fornecedor.telefone}</TableCell>
                <TableCell>{fornecedor.cnpj}</TableCell>
                <TableCell className="flex gap-2">
                  <Button variant="ghost" size="icon-sm" onClick={() => handleEditarFornecedor(fornecedor)}><Edit className="h-4 w-4" /></Button>
                  <Button variant="destructive" size="icon-sm" onClick={() => handleDeleteFornecedor(fornecedor)}><Trash2 className="h-4 w-4" /></Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader><DialogTitle>Editar Fornecedor</DialogTitle></DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4">
              {/* Campos de edição idênticos aos de criação */}
              <FormField control={editForm.control} name="nome" render={({ field }) => ( <FormItem><FormLabel>Empresa</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
              <FormField control={editForm.control} name="vendedor" render={({ field }) => ( <FormItem><FormLabel>Vendedor</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem> )} />
              <FormField control={editForm.control} name="telefone" render={({ field }) => ( <FormItem><FormLabel>Telefone</FormLabel><FormControl><Input {...field} onChange={(e) => field.onChange(maskPhone(e.target.value))} maxLength={15} /></FormControl><FormMessage /></FormItem> )} />
              <FormField control={editForm.control} name="cnpj" render={({ field }) => ( <FormItem><FormLabel>CNPJ</FormLabel><FormControl><Input {...field} onChange={(e) => field.onChange(maskCpfCnpj(e.target.value))} maxLength={18} /></FormControl><FormMessage /></FormItem> )} />
              <DialogFooter><Button type="submit">Salvar Alterações</Button></DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}