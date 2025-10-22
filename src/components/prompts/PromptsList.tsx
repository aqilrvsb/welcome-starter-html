import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCustomAuth } from "@/contexts/CustomAuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Edit2, Trash2, Plus } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import { PromptsForm } from "./PromptsForm";
import Swal from "sweetalert2";
import { SortableTable } from "@/components/ui/sortable-table";

export function PromptsList() {
  const [selectedPrompt, setSelectedPrompt] = useState<any>(null);
  const [showForm, setShowForm] = useState(false);
  const { user } = useCustomAuth();
  const queryClient = useQueryClient();

  const { data: prompts, isLoading } = useQuery({
    queryKey: ["prompts", user?.id],
    queryFn: async () => {
      if (!user) throw new Error("User not authenticated");

      const { data, error } = await supabase
        .from('prompts')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const deleteMutation = useMutation({
    mutationFn: async (promptId: string) => {
      const { error } = await supabase
        .from('prompts')
        .delete()
        .eq('id', promptId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Prompt berjaya dipadam!");
      queryClient.invalidateQueries({ queryKey: ["prompts", user?.id] });
    },
    onError: (error: any) => {
      // Check if error is due to foreign key constraint (prompt being used in campaigns)
      if (error.message && error.message.includes('foreign key constraint')) {
        toast.error("Prompt ini tidak boleh dipadam kerana sedang digunakan dalam kempen yang telah dibuat sebelum ini.");
      } else {
        toast.error("Gagal memadam prompt: " + error.message);
      }
    },
  });

  const handleEdit = (prompt: any) => {
    setSelectedPrompt(prompt);
    setShowForm(true);
  };

  const handleDelete = async (prompt: any) => {
    const result = await Swal.fire({
      title: 'Adakah anda pasti?',
      text: `Memadam prompt "${prompt.prompt_name}"?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Ya, padam!',
      cancelButtonText: 'Batal'
    });

    if (result.isConfirmed) {
      deleteMutation.mutate(prompt.id);
    }
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setSelectedPrompt(null);
  };

  if (showForm) {
    return (
      <PromptsForm
        prompt={selectedPrompt}
        onClose={handleCloseForm}
        onSuccess={handleCloseForm}
      />
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <CardTitle className="text-lg sm:text-xl">Senarai Prompt Skrip</CardTitle>
        <Button onClick={() => setShowForm(true)} className="w-full sm:w-auto">
          <Plus className="h-4 w-4 mr-2" />
          Cipta Prompt Baru
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center py-8">
            <p>Memuat senarai prompt...</p>
          </div>
        ) : !prompts || prompts.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground mb-4 text-sm sm:text-base">
              Tiada prompt dijumpai. Cipta prompt pertama anda untuk memulakan kempen panggilan.
            </p>
            <Button onClick={() => setShowForm(true)} className="w-full sm:w-auto">
              <Plus className="h-4 w-4 mr-2" />
              Cipta Prompt Pertama
            </Button>
          </div>
        ) : (
          <SortableTable
            columns={[
              {
                key: 'prompt_name',
                label: 'Nama Prompt',
                className: 'font-medium'
              },
              {
                key: 'variables',
                label: 'Variables',
                sortable: false,
                render: (variables: any) => (
                  <div className="flex flex-wrap gap-1">
                    {variables && Array.isArray(variables) && variables.length > 0 ? (
                      <>
                        {variables.slice(0, 2).map((variable: any, index: number) => (
                          <Badge key={index} variant="outline" className="text-xs">
                            {`{{${variable.name}}}`}
                          </Badge>
                        ))}
                        {variables.length > 2 && (
                          <Badge variant="secondary" className="text-xs">
                            +{variables.length - 2}
                          </Badge>
                        )}
                      </>
                    ) : (
                      <span className="text-xs text-muted-foreground">Tiada variables</span>
                    )}
                  </div>
                )
              },
              {
                key: 'first_message',
                label: 'Mesej Pertama',
                className: 'max-w-xs',
                render: (value) => (
                  <span className="truncate block">{value}</span>
                )
              },
              {
                key: 'created_at',
                label: 'Tarikh Dicipta',
                render: (value) => (
                  <Badge variant="outline">
                    {new Date(value).toLocaleDateString('ms-MY')}
                  </Badge>
                )
              },
              {
                key: 'actions',
                label: 'Tindakan',
                sortable: false,
                className: 'text-right',
                render: (_, prompt: any) => (
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEdit(prompt)}
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(prompt)}
                      disabled={deleteMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                )
              }
            ]}
            data={prompts}
          />
        )}
      </CardContent>
    </Card>
  );
}