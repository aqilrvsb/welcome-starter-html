import { useState, useEffect } from 'react';
import { useCustomAuth } from '@/contexts/CustomAuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Plus, Trash2, Save, Edit2, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import Swal from 'sweetalert2';

interface Template {
  id?: string;
  message_type: string;
  message_text: string;
  image_urls: string[];
}

interface DbTemplate {
  created_at: string;
  id: string;
  image_urls: any; // Json type from database
  message_text: string;
  message_type: string;
  updated_at: string;
  user_id: string;
}

export default function TemplateForm() {
  const { user } = useCustomAuth();
  const { toast } = useToast();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(false);
  const [isCreatingNew, setIsCreatingNew] = useState(true);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [messageType, setMessageType] = useState('');
  const [messageText, setMessageText] = useState('');
  const [imageUrls, setImageUrls] = useState<string[]>(['']);

  useEffect(() => {
    if (user?.id) {
      loadTemplates();
    }
  }, [user]);

  const handleSelectTemplate = (template: Template) => {
    setSelectedTemplate(template);
    setIsCreatingNew(false);
    setMessageType(template.message_type);
    setMessageText(template.message_text);
    setImageUrls(template.image_urls.length > 0 ? template.image_urls : ['']);
  };

  const handleCreateNew = () => {
    setIsCreatingNew(true);
    setSelectedTemplate(null);
    setMessageType('');
    setMessageText('');
    setImageUrls(['']);
  };

  const loadTemplates = async () => {
    try {
      const { data, error } = await supabase
        .from('whatsapp_templates')
        .select('*')
        .eq('user_id', user!.id);

      if (error) throw error;
      
      // Transform database data to Template format
      const transformedData: Template[] = (data || []).map((item: DbTemplate) => ({
        id: item.id,
        message_type: item.message_type,
        message_text: item.message_text,
        image_urls: Array.isArray(item.image_urls) ? item.image_urls : []
      }));
      
      setTemplates(transformedData);
    } catch (error) {
      console.error('Error loading templates:', error);
    }
  };

  const handleAddImageUrl = () => {
    setImageUrls([...imageUrls, '']);
  };

  const handleRemoveImageUrl = (index: number) => {
    const newUrls = imageUrls.filter((_, i) => i !== index);
    setImageUrls(newUrls.length > 0 ? newUrls : ['']);
  };

  const handleImageUrlChange = (index: number, value: string) => {
    const newUrls = [...imageUrls];
    newUrls[index] = value;
    setImageUrls(newUrls);
  };

  const handleSave = async () => {
    if (!user?.id) return;
    
    if (!messageType.trim()) {
      toast({
        title: 'Error',
        description: 'Message type cannot be empty',
        variant: 'destructive'
      });
      return;
    }

    if (!messageText.trim()) {
      toast({
        title: 'Error',
        description: 'Message text cannot be empty',
        variant: 'destructive'
      });
      return;
    }

    setLoading(true);
    try {
      const filteredUrls = imageUrls.filter(url => url.trim() !== '');

      const { error } = await supabase
        .from('whatsapp_templates')
        .upsert({
          user_id: user.id,
          message_type: messageType.toLowerCase().replace(/\s+/g, '_'),
          message_text: messageText,
          image_urls: filteredUrls
        }, {
          onConflict: 'user_id,message_type'
        });

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Template saved successfully'
      });

      await loadTemplates();
      handleCreateNew();
    } catch (error: any) {
      console.error('Error saving template:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to save template',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (templateId: string) => {
    const result = await Swal.fire({
      title: 'Are you sure?',
      text: 'You want to delete this template?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Yes, delete it!',
      cancelButtonText: 'Cancel'
    });

    if (!result.isConfirmed) return;

    try {
      const { error } = await supabase
        .from('whatsapp_templates')
        .delete()
        .eq('id', templateId);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Template deleted successfully'
      });

      await loadTemplates();
      handleCreateNew();
    } catch (error: any) {
      console.error('Error deleting template:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete template',
        variant: 'destructive'
      });
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Templates List */}
      <Card className="lg:col-span-1">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Your Templates</CardTitle>
            <Button size="sm" onClick={handleCreateNew}>
              <Plus className="h-4 w-4 mr-1" />
              New
            </Button>
          </div>
          <CardDescription>
            Click to edit existing templates
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {templates.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No templates yet. Create your first one!
            </p>
          ) : (
            templates.map((template) => (
              <div
                key={template.id}
                className={`p-3 rounded-lg border cursor-pointer hover:bg-accent transition-colors ${
                  selectedTemplate?.id === template.id ? 'bg-accent border-primary' : ''
                }`}
                onClick={() => handleSelectTemplate(template)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="font-medium text-sm">{template.message_type}</p>
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                      {template.message_text}
                    </p>
                    {template.image_urls.length > 0 && (
                      <p className="text-xs text-muted-foreground mt-1">
                        📷 {template.image_urls.length} image(s)
                      </p>
                    )}
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (template.id) handleDelete(template.id);
                    }}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Template Editor */}
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>
            {isCreatingNew ? 'Create New Template' : 'Edit Template'}
          </CardTitle>
          <CardDescription>
            Configure custom messages and images to send to customers
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Use the message type name in your AI prompt to send this template.
              Example: <code className="bg-muted px-1 py-0.5 rounded">messageType: "your_message_type_name"</code>
            </AlertDescription>
          </Alert>

          <Alert className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
            <AlertCircle className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <AlertDescription className="text-blue-900 dark:text-blue-100">
              <strong className="block mb-2">💡 Cara Guna Variables dari Prompt:</strong>
              <ol className="text-sm space-y-1 ml-4 list-decimal">
                <li>Pergi ke <strong>Prompts</strong> page dan define variables (contoh: <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">customer_address</code>)</li>
                <li>Dalam template ini, guna format: <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">{'{'} customer_address {'}'}</code> </li>
                <li>AI akan auto collect data dan replace variables bila hantar WhatsApp</li>
              </ol>
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <Label>Message Type Name *</Label>
            <Input
              value={messageType}
              onChange={(e) => setMessageType(e.target.value)}
              placeholder="e.g., product_info, promo_raya, order_confirmation"
              disabled={!isCreatingNew}
            />
            <p className="text-xs text-muted-foreground">
              Use lowercase with underscores. This will be used in your AI prompt.
            </p>
          </div>

          <div className="space-y-2">
            <Label>Message Text *</Label>
            <Textarea
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              placeholder="Enter your message here..."
              rows={8}
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Use *text* for bold, _text_ for italic. Guna variables dalam format {'{'} nama_variable {'}'} atau {'{{'} nama_variable {'}}'}
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Image URLs (optional)</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddImageUrl}
              >
                <Plus className="h-4 w-4 mr-1" />
                Add Image
              </Button>
            </div>
            {imageUrls.map((url, index) => (
              <div key={index} className="flex gap-2">
                <Input
                  value={url}
                  onChange={(e) => handleImageUrlChange(index, e.target.value)}
                  placeholder="https://example.com/image.jpg"
                />
                {imageUrls.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRemoveImageUrl(index)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>

          <Button onClick={handleSave} disabled={loading} className="w-full">
            <Save className="mr-2 h-4 w-4" />
            {loading ? 'Saving...' : isCreatingNew ? 'Create Template' : 'Update Template'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
