import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCustomAuth } from "@/contexts/CustomAuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { X, Plus, Trash2, Copy, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

const variableSchema = z.object({
  name: z.string().min(1, "Nama variable diperlukan"),
  description: z.string().min(1, "Penerangan variable diperlukan"),
});

const promptSchema = z.object({
  prompt_name: z.string().min(1, "Nama prompt diperlukan"),
  first_message: z.string().min(1, "Mesej pertama diperlukan"),
  system_prompt: z.string().min(10, "Skrip sistem diperlukan (minimum 10 karakter)"),
  variables: z.array(variableSchema).optional(),
});

type PromptFormData = z.infer<typeof promptSchema>;
type VariableData = z.infer<typeof variableSchema>;

interface PromptsFormProps {
  prompt?: any;
  onClose?: () => void;
  onSuccess?: () => void;
}

export function PromptsForm({ prompt, onClose, onSuccess }: PromptsFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [variables, setVariables] = useState<VariableData[]>(prompt?.variables || []);
  const [newVariable, setNewVariable] = useState<VariableData>({ name: "", description: "" });
  const { user } = useCustomAuth();
  const queryClient = useQueryClient();

  const form = useForm<PromptFormData>({
    resolver: zodResolver(promptSchema),
    defaultValues: {
      prompt_name: prompt?.prompt_name || "",
      first_message: prompt?.first_message || "",
      system_prompt: prompt?.system_prompt || "",
      variables: prompt?.variables || [],
    },
  });

  const mutation = useMutation({
    mutationFn: async (data: PromptFormData) => {
      if (!user) throw new Error("User not authenticated");

      const promptData = {
        prompt_name: data.prompt_name,
        first_message: data.first_message,
        system_prompt: data.system_prompt,
        variables: variables,
      };

      if (prompt?.id) {
        // Update existing prompt
        const { error } = await supabase
          .from('prompts')
          .update(promptData)
          .eq('id', prompt.id)
          .eq('user_id', user.id);

        if (error) throw error;
      } else {
        // Create new prompt
        const { error } = await supabase
          .from('prompts')
          .insert({
            user_id: user.id,
            ...promptData,
          });

        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(prompt?.id ? "Prompt berjaya dikemaskini!" : "Prompt berjaya dicipta!");
      queryClient.invalidateQueries({ queryKey: ["prompts", user?.id] });
      onSuccess?.();
      onClose?.();
    },
    onError: (error: any) => {
      toast.error("Gagal menyimpan prompt: " + error.message);
    },
  });

  const onSubmit = (data: PromptFormData) => {
    setIsLoading(true);
    mutation.mutate(data);
    setIsLoading(false);
  };

  const addVariable = () => {
    if (newVariable.name && newVariable.description) {
      // Check if variable name already exists
      if (variables.some(v => v.name.toLowerCase() === newVariable.name.toLowerCase())) {
        toast.error("Variable dengan nama ini sudah wujud!");
        return;
      }
      
      setVariables([...variables, newVariable]);
      setNewVariable({ name: "", description: "" });
      toast.success("Variable berjaya ditambah!");
    }
  };

  const removeVariable = (index: number) => {
    setVariables(variables.filter((_, i) => i !== index));
    toast.success("Variable berjaya dipadam!");
  };

  const copyVariableToClipboard = (variableName: string) => {
    const variableFormat = `{{${variableName}}}`;
    navigator.clipboard.writeText(variableFormat);
    toast.success(`Variable ${variableFormat} disalin!`);
  };

  return (
    <Card className="w-full max-w-4xl">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>{prompt?.id ? "Edit Prompt" : "Cipta Prompt Baru"}</CardTitle>
        {onClose && (
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        )}
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="prompt_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nama Prompt</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="Contoh: Skrip Jualan VTEC Promo" 
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Variables Section */}
            <div className="space-y-4">
              <Separator />
              <div>
                <h3 className="text-lg font-semibold mb-2">Variables</h3>
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
                  <Info className="h-4 w-4" />
                  <span>Gunakan variables dalam prompt dengan format: {`{{nama_variable}}`}</span>
                </div>
                
                {/* Add new variable */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <Input
                    placeholder="Nama variable (contoh: customer_name)"
                    value={newVariable.name}
                    onChange={(e) => setNewVariable({...newVariable, name: e.target.value})}
                  />
                  <div className="flex gap-2">
                    <Input
                      placeholder="Penerangan variable"
                      value={newVariable.description}
                      onChange={(e) => setNewVariable({...newVariable, description: e.target.value})}
                    />
                    <Button 
                      type="button" 
                      size="sm" 
                      onClick={addVariable}
                      disabled={!newVariable.name || !newVariable.description}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* Variables list */}
                {variables.length > 0 && (
                  <div className="space-y-2">
                    {variables.map((variable, index) => (
                      <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center gap-3 flex-1">
                          <Badge 
                            variant="secondary" 
                            className="cursor-pointer"
                            onClick={() => copyVariableToClipboard(variable.name)}
                          >
                            {`{{${variable.name}}}`}
                          </Badge>
                          <span className="text-sm text-muted-foreground">{variable.description}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => copyVariableToClipboard(variable.name)}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeVariable(index)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <Separator />
            </div>

            <FormField
              control={form.control}
              name="first_message"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Mesej Pertama</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Contoh: Assalamualaikum, ni {{customer_name}} kan?"
                      className="min-h-[100px]"
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                  {variables.length > 0 && (
                    <div className="text-xs text-muted-foreground mt-1">
                      Available variables: {variables.map(v => `{{${v.name}}}`).join(', ')}
                    </div>
                  )}
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="system_prompt"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Skrip Sistem (System Prompt)</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Masukkan keseluruhan skrip panggilan anda di sini..."
                      className="min-h-[400px] font-mono text-sm"
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                  {variables.length > 0 && (
                    <div className="text-xs text-muted-foreground mt-1">
                      Available variables: {variables.map(v => `{{${v.name}}}`).join(', ')}
                    </div>
                  )}
                </FormItem>
              )}
            />

            <div className="flex gap-4">
              <Button
                type="submit"
                disabled={isLoading || mutation.isPending}
                className="flex-1"
              >
                {isLoading || mutation.isPending ? "Menyimpan..." : "Simpan Prompt"}
              </Button>
              {onClose && (
                <Button type="button" variant="outline" onClick={onClose}>
                  Batal
                </Button>
              )}
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}