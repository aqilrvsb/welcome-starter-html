import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Loader2, Eye, Lightbulb } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { format, parseISO } from 'date-fns';

interface FeatureRequest {
  id: string;
  user_id: string;
  title: string;
  description: string;
  category: string;
  status: string;
  priority: string;
  votes: number;
  admin_notes: string | null;
  created_at: string;
  updated_at: string;
  users: {
    username: string;
    email: string;
  };
}

const statusColors: Record<string, string> = {
  submitted: 'bg-blue-100 text-blue-800',
  under_review: 'bg-yellow-100 text-yellow-800',
  planned: 'bg-purple-100 text-purple-800',
  in_progress: 'bg-orange-100 text-orange-800',
  completed: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
};

const categoryColors: Record<string, string> = {
  general: 'bg-gray-100 text-gray-800',
  ui: 'bg-blue-100 text-blue-800',
  feature: 'bg-green-100 text-green-800',
  integration: 'bg-purple-100 text-purple-800',
  performance: 'bg-orange-100 text-orange-800',
  bug: 'bg-red-100 text-red-800',
};

export default function AdminFeatureRequests() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState<FeatureRequest[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<FeatureRequest | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [processing, setProcessing] = useState(false);

  // Form state
  const [status, setStatus] = useState('submitted');
  const [priority, setPriority] = useState('medium');
  const [adminNotes, setAdminNotes] = useState('');

  useEffect(() => {
    loadFeatureRequests();
  }, []);

  const loadFeatureRequests = async () => {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('feature_requests')
        .select(`
          *,
          users!inner (
            username,
            email
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setRequests(data as any);
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

  const handleViewRequest = (request: FeatureRequest) => {
    setSelectedRequest(request);
    setStatus(request.status);
    setPriority(request.priority);
    setAdminNotes(request.admin_notes || '');
    setDialogOpen(true);
  };

  const handleUpdate = async () => {
    if (!selectedRequest) return;

    try {
      setProcessing(true);

      const { error } = await supabase
        .from('feature_requests')
        .update({
          status,
          priority,
          admin_notes: adminNotes.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', selectedRequest.id);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Feature request updated successfully',
      });

      setDialogOpen(false);
      await loadFeatureRequests();
    } catch (error: any) {
      console.error('Error updating feature request:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to update feature request',
        variant: 'destructive',
      });
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Feature Requests</h1>
        <p className="text-muted-foreground mt-2">
          Manage and prioritize feature requests from clients
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5" />
            All Feature Requests ({requests.length})
          </CardTitle>
          <CardDescription>Review and update the status of client feature requests</CardDescription>
        </CardHeader>
        <CardContent>
          {requests.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No feature requests yet
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requests.map((request) => (
                  <TableRow key={request.id}>
                    <TableCell className="font-medium max-w-xs truncate">
                      {request.title}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={categoryColors[request.category]}>
                        {request.category}
                      </Badge>
                    </TableCell>
                    <TableCell>{request.users.username}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={statusColors[request.status]}>
                        {request.status.replace('_', ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          request.priority === 'critical'
                            ? 'bg-red-100 text-red-800'
                            : request.priority === 'high'
                            ? 'bg-orange-100 text-orange-800'
                            : request.priority === 'medium'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-gray-100 text-gray-800'
                        }
                      >
                        {request.priority}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {format(parseISO(request.created_at), 'MMM dd, yyyy')}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleViewRequest(request)}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* View/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Feature Request Details</DialogTitle>
            <DialogDescription>
              Review and update the feature request status
            </DialogDescription>
          </DialogHeader>

          {selectedRequest && (
            <div className="space-y-6">
              {/* Client Info */}
              <div className="p-4 bg-muted rounded-lg">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">Client:</span> {selectedRequest.users.username}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Email:</span> {selectedRequest.users.email}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Submitted:</span>{' '}
                    {format(parseISO(selectedRequest.created_at), 'MMM dd, yyyy HH:mm')}
                  </div>
                  <div>
                    <Badge variant="outline" className={categoryColors[selectedRequest.category]}>
                      {selectedRequest.category}
                    </Badge>
                  </div>
                </div>
              </div>

              {/* Request Content */}
              <div className="space-y-2">
                <h3 className="font-semibold text-lg">{selectedRequest.title}</h3>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {selectedRequest.description}
                </p>
              </div>

              {/* Admin Form */}
              <div className="space-y-4 pt-4 border-t">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Select value={status} onValueChange={setStatus}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="submitted">Submitted</SelectItem>
                        <SelectItem value="under_review">Under Review</SelectItem>
                        <SelectItem value="planned">Planned</SelectItem>
                        <SelectItem value="in_progress">In Progress</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                        <SelectItem value="rejected">Rejected</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Priority</Label>
                    <Select value={priority} onValueChange={setPriority}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="critical">Critical</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Admin Notes (visible to client)</Label>
                  <Textarea
                    value={adminNotes}
                    onChange={(e) => setAdminNotes(e.target.value)}
                    placeholder="Add notes that will be visible to the client..."
                    rows={4}
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 justify-end">
                <Button
                  variant="outline"
                  onClick={() => setDialogOpen(false)}
                  disabled={processing}
                >
                  Cancel
                </Button>
                <Button onClick={handleUpdate} disabled={processing}>
                  {processing ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    'Update Request'
                  )}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
