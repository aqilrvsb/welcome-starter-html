import React, { useState } from "react";
import { useCustomAuth } from "@/contexts/CustomAuthContext";
import { ContactForm } from "@/components/contacts/ContactForm";
import { ContactList } from "@/components/contacts/ContactList";
import { ExcelImport } from "@/components/contacts/ExcelImport";
import { ContactBatchCallModal } from "@/components/contacts/ContactBatchCallModal";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Phone, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";

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
      {/* Header with gradient */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] as any }}
        className="p-8 rounded-2xl gradient-card card-soft mb-6"
      >
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-3">
              <div className="p-3 rounded-lg bg-primary/10">
                <Users className="h-6 w-6 text-primary" />
              </div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-primary via-primary-light to-primary-dark bg-clip-text text-transparent">
                Contacts
              </h1>
            </div>
            <p className="text-muted-foreground text-lg">
              Manage your contact list and create batch call campaigns
            </p>
          </div>
          <div className="flex gap-2">
            {selectedContacts.length > 0 && (
              <motion.div
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <Button
                  onClick={handleBatchCall}
                  className="gap-2 bg-gradient-to-r from-primary to-primary-dark hover:from-primary-dark hover:to-primary transition-all duration-300 shadow-lg hover:shadow-xl"
                >
                  <Phone className="h-4 w-4" />
                  Batch Call ({selectedContacts.length})
                </Button>
              </motion.div>
            )}
          </div>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
      >
        <Tabs defaultValue="list" className="space-y-6">
        <TabsList className="bg-muted/50 border border-primary/20">
          <TabsTrigger
            value="list"
            className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all duration-300"
          >
            Contact List
          </TabsTrigger>
          <TabsTrigger
            value="add"
            className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all duration-300"
          >
            Add Contact
          </TabsTrigger>
          <TabsTrigger
            value="import"
            className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all duration-300"
          >
            Import Excel
          </TabsTrigger>
        </TabsList>

        <TabsContent value="list" className="space-y-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4 }}
          >
            <ContactList
              userId={user.id}
              selectedContacts={selectedContacts}
              onSelectionChange={setSelectedContacts}
              refreshTrigger={refreshTrigger}
            />
          </motion.div>
        </TabsContent>

        <TabsContent value="add">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <Card className="card-medium border-primary/20">
              <CardHeader>
                <CardTitle className="text-2xl text-primary">Add New Contact</CardTitle>
              </CardHeader>
              <CardContent>
                <ContactForm
                  userId={user.id}
                  onSuccess={handleContactAdded}
                />
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>

        <TabsContent value="import">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <Card className="card-medium border-primary/20">
              <CardHeader>
                <CardTitle className="text-2xl text-primary">Import Contacts from Excel</CardTitle>
              </CardHeader>
              <CardContent>
                <ExcelImport
                  userId={user.id}
                  onSuccess={handleContactsImported}
                />
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>
      </Tabs>
      </motion.div>

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