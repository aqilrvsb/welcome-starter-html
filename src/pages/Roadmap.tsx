import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Loader2, Plus, Lightbulb, CheckCircle2, Clock, XCircle, Eye, ThumbsUp } from 'lucide-react';
import { useCustomAuth } from '@/contexts/CustomAuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { format, parseISO } from 'date-fns';
import { motion } from 'framer-motion';

interface FeatureRequest {
  id: string;
  title: string;
  description: string;
  category: string;
  status: string;
  priority: string;
  votes: number;
  admin_notes: string | null;
  created_at: string;
  updated_at: string;
}

const statusConfig = {
  submitted: { label: 'Submitted', icon: Clock, color: 'bg-blue-500', textColor: 'text-blue-600' },
  under_review: { label: 'Under Review', icon: Eye, color: 'bg-yellow-500', textColor: 'text-yellow-600' },
  planned: { label: 'Planned', icon: Lightbulb, color: 'bg-purple-500', textColor: 'text-purple-600' },
  in_progress: { label: 'In Progress', icon: Clock, color: 'bg-orange-500', textColor: 'text-orange-600' },
  completed: { label: 'Completed', icon: CheckCircle2, color: 'bg-green-500', textColor: 'text-green-600' },
  rejected: { label: 'Rejected', icon: XCircle, color: 'bg-red-500', textColor: 'text-red-600' },
};

const categoryConfig = {
  general: { label: 'General', color: 'bg-gray-100 text-gray-800' },
  ui: { label: 'UI/UX', color: 'bg-blue-100 text-blue-800' },
  feature: { label: 'New Feature', color: 'bg-green-100 text-green-800' },
  integration: { label: 'Integration', color: 'bg-purple-100 text-purple-800' },
  performance: { label: 'Performance', color: 'bg-orange-100 text-orange-800' },
  bug: { label: 'Bug Fix', color: 'bg-red-100 text-red-800' },
};

export default function Roadmap() {
  const { user } = useCustomAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [requests, setRequests] = useState<FeatureRequest[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('feature');

  useEffect(() => {
    if (user) {
      loadFeatureRequests();
    }
  }, [user]);

  const loadFeatureRequests = async () => {
    if (!user) return;

    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('feature_requests')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setRequests(data || []);
    } catch (error: any) {
      console.error('Error loading feature requests:', error);
      toast({
        title: 'Error',
        description: 'Failed to load feature requests',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) return;

    if (!title.trim() || !description.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Please fill in all required fields',
        variant: 'destructive',
      });
      return;
    }

    try {
      setSubmitting(true);

      const { error } = await supabase.from('feature_requests').insert({
        user_id: user.id,
        title: title.trim(),
        description: description.trim(),
        category,
        status: 'submitted',
      });

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Your feature request has been submitted!',
      });

      // Reset form
      setTitle('');
      setDescription('');
      setCategory('feature');
      setIsDialogOpen(false);

      // Reload requests
      await loadFeatureRequests();
    } catch (error: any) {
      console.error('Error submitting feature request:', error);
      toast({
        title: 'Error',
        description: 'Failed to submit feature request',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto py-8">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-8 h-8 animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="p-8 rounded-2xl gradient-card card-soft"
      >
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-primary via-primary-light to-primary-dark bg-clip-text text-transparent mb-3">
              Feature Roadmap
            </h1>
            <p className="text-muted-foreground text-lg">
              Request new features and track their progress
            </p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button size="lg" className="gap-2">
                <Plus className="h-5 w-5" />
                Request Feature
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Submit Feature Request</DialogTitle>
                <DialogDescription>
                  Tell us what feature or improvement you'd like to see in the platform
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Title *</Label>
                  <Input
                    id="title"
                    placeholder="Brief title for your feature request"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="category">Category</Label>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger id="category">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(categoryConfig).map(([key, config]) => (
                        <SelectItem key={key} value={key}>
                          {config.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description *</Label>
                  <Textarea
                    id="description"
                    placeholder="Describe your feature request in detail..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={6}
                    required
                  />
                </div>

                <div className="flex gap-2 justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsDialogOpen(false)}
                    disabled={submitting}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={submitting}>
                    {submitting ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Submitting...
                      </>
                    ) : (
                      <>
                        <Plus className="w-4 h-4 mr-2" />
                        Submit Request
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </motion.div>

      {/* Feature Requests List */}
      <div className="grid gap-4">
        {requests.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Lightbulb className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">
                No feature requests yet. Click "Request Feature" to submit your first idea!
              </p>
            </CardContent>
          </Card>
        ) : (
          requests.map((request, index) => {
            const statusInfo = statusConfig[request.status as keyof typeof statusConfig];
            const categoryInfo = categoryConfig[request.category as keyof typeof categoryConfig];
            const StatusIcon = statusInfo.icon;

            return (
              <motion.div
                key={request.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: index * 0.05 }}
              >
                <Card className="card-soft hover:shadow-lg transition-all">
                  <CardHeader>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge className={categoryInfo.color}>{categoryInfo.label}</Badge>
                          <Badge
                            variant="outline"
                            className={`${statusInfo.textColor} border-current`}
                          >
                            <StatusIcon className="h-3 w-3 mr-1" />
                            {statusInfo.label}
                          </Badge>
                        </div>
                        <CardTitle className="text-xl">{request.title}</CardTitle>
                        <CardDescription className="mt-2">{request.description}</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {request.admin_notes && (
                        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                          <p className="text-sm font-medium text-blue-900 mb-1">Admin Response:</p>
                          <p className="text-sm text-blue-700">{request.admin_notes}</p>
                        </div>
                      )}
                      <div className="flex items-center justify-between text-sm text-muted-foreground">
                        <span>Submitted {format(parseISO(request.created_at), 'MMM dd, yyyy')}</span>
                        {request.updated_at !== request.created_at && (
                          <span>Updated {format(parseISO(request.updated_at), 'MMM dd, yyyy')}</span>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })
        )}
      </div>
    </div>
  );
}
