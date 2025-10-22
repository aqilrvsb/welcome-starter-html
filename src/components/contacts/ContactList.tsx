import React, { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Trash2, Search, Users, Edit2, Check, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";
import { SortableTable } from "@/components/ui/sortable-table";

// Validation schema for editing contacts
const editContactSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100, "Name must be less than 100 characters"),
  phone_number: z.string().trim().min(1, "Phone number is required").max(20, "Phone number must be less than 20 characters"),
  product: z.string().trim().max(100, "Product must be less than 100 characters").optional(),
});

interface Contact {
  id: string;
  name: string;
  phone_number: string;
  product?: string | null;
  created_at: string;
}

interface ContactStats {
  total_calls: number;
  answered_calls: number;
  unanswered_calls: number;
}

interface ContactListProps {
  userId: string;
  selectedContacts: string[];
  onSelectionChange: (selected: string[]) => void;
  refreshTrigger: number;
}

export function ContactList({ userId, selectedContacts, onSelectionChange, refreshTrigger }: ContactListProps) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [filteredContacts, setFilteredContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [productFilter, setProductFilter] = useState("");
  const [callStatusFilter, setCallStatusFilter] = useState<string>("all");
  const [editingContact, setEditingContact] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState({ name: "", phone_number: "", product: "" });
  const [editErrors, setEditErrors] = useState<{ name?: string; phone_number?: string; product?: string }>({});
  const [contactStats, setContactStats] = useState<Map<string, ContactStats>>(new Map());
  const [contactToDelete, setContactToDelete] = useState<string | null>(null);
  const [contactToEdit, setContactToEdit] = useState<Contact | null>(null);
  const { toast } = useToast();

  const fetchContacts = async () => {
    try {
      const { data, error } = await supabase
        .from("contacts")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching contacts:", error);
        toast({
          title: "Error",
          description: "Failed to load contacts. Please try again.",
          variant: "destructive"
        });
        return;
      }

      setContacts(data || []);
      
      // Fetch call statistics for each contact
      if (data && data.length > 0) {
        const contactIds = data.map(c => c.id);
        const { data: callLogs } = await supabase
          .from("call_logs")
          .select("contact_id, status")
          .eq("user_id", userId)
          .in("contact_id", contactIds);

        // Calculate stats for each contact
        const statsMap = new Map<string, ContactStats>();
        contactIds.forEach(contactId => {
          const contactCalls = callLogs?.filter(log => log.contact_id === contactId) || [];
          const totalCalls = contactCalls.length;
          const answeredCalls = contactCalls.filter(log => log.status === 'answered').length;
          const unansweredCalls = totalCalls - answeredCalls;
          
          statsMap.set(contactId, {
            total_calls: totalCalls,
            answered_calls: answeredCalls,
            unanswered_calls: unansweredCalls
          });
        });
        
        setContactStats(statsMap);
      }
    } catch (error) {
      console.error("Error fetching contacts:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchContacts();
  }, [userId, refreshTrigger]);

  useEffect(() => {
    const filtered = contacts.filter(
      contact => {
        const matchesSearch = contact.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          contact.phone_number.includes(searchTerm);
        const matchesProduct = !productFilter || 
          (contact.product && contact.product.toLowerCase().includes(productFilter.toLowerCase()));
        
        // Filter by call status
        let matchesCallStatus = true;
        if (callStatusFilter !== "all") {
          const stats = contactStats.get(contact.id);
          if (callStatusFilter === "answered") {
            matchesCallStatus = stats ? stats.answered_calls > 0 : false;
          } else if (callStatusFilter === "never_answered") {
            matchesCallStatus = !stats || stats.answered_calls === 0;
          }
        }
        
        return matchesSearch && matchesProduct && matchesCallStatus;
      }
    );
    setFilteredContacts(filtered);
  }, [contacts, searchTerm, productFilter, callStatusFilter, contactStats]);

  const handleSelectAll = () => {
    if (selectedContacts.length === filteredContacts.length && selectedContacts.length > 0) {
      onSelectionChange([]);
    } else {
      // Limit to maximum 10 contacts
      const contactsToSelect = filteredContacts.slice(0, 10).map(contact => contact.id);
      onSelectionChange(contactsToSelect);
      
      if (filteredContacts.length > 10) {
        toast({
          title: "Selection limit reached",
          description: "You can only select up to 10 contacts for batch calls (concurrent call limit).",
          variant: "default",
        });
      }
    }
  };

  const handleSelectContact = (contactId: string) => {
    if (selectedContacts.includes(contactId)) {
      onSelectionChange(selectedContacts.filter(id => id !== contactId));
    } else {
      // Check if limit reached
      if (selectedContacts.length >= 10) {
        toast({
          title: "Selection limit reached",
          description: "You can only select up to 10 contacts for batch calls (concurrent call limit).",
          variant: "default",
        });
        return;
      }
      onSelectionChange([...selectedContacts, contactId]);
    }
  };

  const confirmDelete = async () => {
    if (!contactToDelete) return;
    
    try {
      const { error } = await supabase
        .from("contacts")
        .delete()
        .eq("id", contactToDelete)
        .eq("user_id", userId);

      if (error) {
        toast({
          title: "Error",
          description: "Failed to delete contact. Please try again.",
          variant: "destructive"
        });
        return;
      }

      setContacts(contacts.filter(contact => contact.id !== contactToDelete));
      onSelectionChange(selectedContacts.filter(id => id !== contactToDelete));
      
      toast({
        title: "Success",
        description: "Contact deleted successfully!"
      });
    } catch (error) {
      console.error("Error deleting contact:", error);
    } finally {
      setContactToDelete(null);
    }
  };

  const confirmEdit = () => {
    if (!contactToEdit) return;
    setEditingContact(contactToEdit.id);
    setEditFormData({ name: contactToEdit.name, phone_number: contactToEdit.phone_number, product: contactToEdit.product || "" });
    setEditErrors({});
    setContactToEdit(null);
  };

  const cancelEditing = () => {
    setEditingContact(null);
    setEditFormData({ name: "", phone_number: "", product: "" });
    setEditErrors({});
  };

  const saveEdit = async (contactId: string) => {
    try {
      // Validate the form data
      const validationResult = editContactSchema.safeParse(editFormData);
      
      if (!validationResult.success) {
        const errors: { name?: string; phone_number?: string } = {};
        validationResult.error.errors.forEach(error => {
          if (error.path[0]) {
            errors[error.path[0] as keyof typeof errors] = error.message;
          }
        });
        setEditErrors(errors);
        return;
      }

      const { error } = await supabase
        .from("contacts")
        .update({
          name: validationResult.data.name,
          phone_number: validationResult.data.phone_number,
          product: validationResult.data.product || null,
        })
        .eq("id", contactId)
        .eq("user_id", userId);

      if (error) {
        toast({
          title: "Error",
          description: "Failed to update contact. Please try again.",
          variant: "destructive"
        });
        return;
      }

      // Update local state
      setContacts(contacts.map(contact => 
        contact.id === contactId 
          ? { ...contact, name: validationResult.data.name, phone_number: validationResult.data.phone_number, product: validationResult.data.product || null }
          : contact
      ));
      
      setEditingContact(null);
      setEditFormData({ name: "", phone_number: "", product: "" });
      setEditErrors({});
      
      toast({
        title: "Success",
        description: "Contact updated successfully!"
      });
    } catch (error) {
      console.error("Error updating contact:", error);
    }
  };

  if (loading) {
    return <div className="text-center py-4">Loading contacts...</div>;
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Contacts ({contacts.length})
            </CardTitle>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search contacts..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Input
                placeholder="Filter by product..."
                value={productFilter}
                onChange={(e) => setProductFilter(e.target.value)}
                className="w-48"
              />
              <Select value={callStatusFilter} onValueChange={setCallStatusFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filter by call status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Contacts</SelectItem>
                  <SelectItem value="answered">Dah Angkat</SelectItem>
                  <SelectItem value="never_answered">Tak Pernah Angkat</SelectItem>
                </SelectContent>
              </Select>
              {filteredContacts.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSelectAll}
                >
                  {selectedContacts.length === filteredContacts.length ? "Unselect All" : "Select All"}
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredContacts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {searchTerm ? "No contacts found matching your search." : "No contacts yet. Add some contacts to get started."}
            </div>
          ) : (
            <SortableTable
              columns={[
                {
                  key: 'select',
                  label: '',
                  sortable: false,
                  className: 'w-12',
                  render: (_, contact: Contact) => (
                    <Checkbox
                      checked={selectedContacts.includes(contact.id)}
                      onCheckedChange={() => handleSelectContact(contact.id)}
                    />
                  )
                },
                {
                  key: 'name',
                  label: 'Name',
                  render: (value, contact: Contact) => (
                    editingContact === contact.id ? (
                      <div className="flex-1 space-y-2">
                        <div>
                          <Input
                            value={editFormData.name}
                            onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                            placeholder="Contact name"
                            className={editErrors.name ? "border-destructive" : ""}
                          />
                          {editErrors.name && (
                            <p className="text-xs text-destructive mt-1">{editErrors.name}</p>
                          )}
                        </div>
                        <div>
                          <Input
                            value={editFormData.phone_number}
                            onChange={(e) => setEditFormData({ ...editFormData, phone_number: e.target.value })}
                            placeholder="Phone number"
                            className={editErrors.phone_number ? "border-destructive" : ""}
                          />
                          {editErrors.phone_number && (
                            <p className="text-xs text-destructive mt-1">{editErrors.phone_number}</p>
                          )}
                        </div>
                        <div>
                          <Input
                            value={editFormData.product}
                            onChange={(e) => setEditFormData({ ...editFormData, product: e.target.value })}
                            placeholder="Product (optional)"
                            className={editErrors.product ? "border-destructive" : ""}
                          />
                          {editErrors.product && (
                            <p className="text-xs text-destructive mt-1">{editErrors.product}</p>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div>
                        <div className="font-medium">{value}</div>
                        <div className="text-sm text-muted-foreground">
                          {contact.phone_number}
                        </div>
                        {contact.product && (
                          <div className="text-xs text-muted-foreground mt-1">
                            Product: {contact.product}
                          </div>
                        )}
                      </div>
                    )
                  )
                },
                {
                  key: 'stats',
                  label: 'Call Stats',
                  sortable: false,
                  render: (_, contact: Contact) => (
                    editingContact !== contact.id && contactStats.has(contact.id) ? (
                      <div className="flex items-center gap-3 text-xs">
                        <div className="flex items-center gap-1">
                          <span className="text-muted-foreground">Total:</span>
                          <span className="font-medium">{contactStats.get(contact.id)?.total_calls || 0}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-green-600">Angkat:</span>
                          <span className="font-medium text-green-600">{contactStats.get(contact.id)?.answered_calls || 0}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-destructive">Tak Angkat:</span>
                          <span className="font-medium text-destructive">{contactStats.get(contact.id)?.unanswered_calls || 0}</span>
                        </div>
                      </div>
                    ) : null
                  )
                },
                {
                  key: 'created_at',
                  label: 'Created',
                  render: (value) => new Date(value).toLocaleDateString('ms-MY')
                },
                {
                  key: 'actions',
                  label: 'Actions',
                  sortable: false,
                  className: 'text-right',
                  render: (_, contact: Contact) => (
                    <div className="flex justify-end gap-2">
                      {editingContact === contact.id ? (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => saveEdit(contact.id)}
                            className="text-green-600 hover:text-green-700"
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={cancelEditing}
                            className="text-gray-600 hover:text-gray-700"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setContactToEdit(contact)}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setContactToDelete(contact.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </>
                      )}
                    </div>
                  )
                }
              ]}
              data={filteredContacts}
            />
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!contactToDelete} onOpenChange={(open) => !open && setContactToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Adakah anda pasti?</AlertDialogTitle>
            <AlertDialogDescription>
              Tindakan ini tidak boleh dibatalkan. Contact ini akan dipadam secara kekal dari sistem anda.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Padam</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit Confirmation Dialog */}
      <AlertDialog open={!!contactToEdit} onOpenChange={(open) => !open && setContactToEdit(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Edit Contact</AlertDialogTitle>
            <AlertDialogDescription>
              Adakah anda pasti mahu mengedit contact {contactToEdit?.name}?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={confirmEdit}>Edit</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}