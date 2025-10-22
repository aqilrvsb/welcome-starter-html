import React, { useState } from "react";
import { useCustomAuth } from "@/contexts/CustomAuthContext";
import { ContactForm } from "@/components/contacts/ContactForm";
import { ContactList } from "@/components/contacts/ContactList";
import { ExcelImport } from "@/components/contacts/ExcelImport";
import { ContactBatchCallModal } from "@/components/contacts/ContactBatchCallModal";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Phone } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const ContactsPage = () => {
  const { user } = useCustomAuth();
  const { toast } = useToast();
  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);
  const [isBatchCallModalOpen, setIsBatchCallModalOpen] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  if (!user) {
    return <div>Please log in to access contacts.</div>;
  }

  const handleContactAdded = () => {
    setRefreshTrigger(prev => prev + 1);
    toast({
      title: "Success",
      description: "Contact added successfully!"
    });
  };

  const handleContactsImported = (count: number) => {
    setRefreshTrigger(prev => prev + 1);
    toast({
      title: "Success",
      description: `${count} contacts imported successfully!`
    });
  };

  const handleBatchCall = () => {
    if (selectedContacts.length === 0) {
      toast({
        title: "Error",
        description: "Please select at least one contact to call."
      });
      return;
    }
    setIsBatchCallModalOpen(true);
  };

  const handleBatchCallSuccess = () => {
    setSelectedContacts([]);
    setIsBatchCallModalOpen(false);
    toast({
      title: "Success",
      description: "Batch call campaign created successfully!"
    });
  };

  return (
    <div className="container mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Contacts</h1>
          <p className="text-muted-foreground">
            Manage your contact list and create batch call campaigns
          </p>
        </div>
        <div className="flex gap-2">
          {selectedContacts.length > 0 && (
            <Button onClick={handleBatchCall} className="gap-2">
              <Phone className="h-4 w-4" />
              Batch Call ({selectedContacts.length})
            </Button>
          )}
        </div>
      </div>

      <Tabs defaultValue="list" className="space-y-6">
        <TabsList>
          <TabsTrigger value="list">Contact List</TabsTrigger>
          <TabsTrigger value="add">Add Contact</TabsTrigger>
          <TabsTrigger value="import">Import Excel</TabsTrigger>
        </TabsList>

        <TabsContent value="list" className="space-y-4">
          <ContactList 
            userId={user.id}
            selectedContacts={selectedContacts}
            onSelectionChange={setSelectedContacts}
            refreshTrigger={refreshTrigger}
          />
        </TabsContent>

        <TabsContent value="add">
          <Card>
            <CardHeader>
              <CardTitle>Add New Contact</CardTitle>
            </CardHeader>
            <CardContent>
              <ContactForm 
                userId={user.id}
                onSuccess={handleContactAdded}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="import">
          <Card>
            <CardHeader>
              <CardTitle>Import Contacts from Excel</CardTitle>
            </CardHeader>
            <CardContent>
              <ExcelImport 
                userId={user.id}
                onSuccess={handleContactsImported}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <ContactBatchCallModal
        open={isBatchCallModalOpen}
        onClose={() => setIsBatchCallModalOpen(false)}
        selectedContacts={selectedContacts}
        userId={user.id}
        onSuccess={handleBatchCallSuccess}
      />
    </div>
  );
};

export default ContactsPage;