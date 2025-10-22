import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

const contactSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100, "Name must be less than 100 characters"),
  phoneNumber: z.string().trim().min(1, "Phone number is required").max(20, "Phone number must be less than 20 characters")
    .transform((val) => {
      // Auto-add +60 if not present and it's a Malaysian number
      if (val && !val.startsWith('+')) {
        // Remove any leading zeros and non-digits for processing
        const cleanNumber = val.replace(/\D/g, '');
        
        // If it starts with 60, assume it's already formatted without +
        if (cleanNumber.startsWith('60')) {
          return '+' + cleanNumber;
        }
        // If it's a Malaysian mobile number (starts with 1, 01, etc.)
        else if (cleanNumber.startsWith('1') || cleanNumber.startsWith('01') || 
                 cleanNumber.length >= 9 && cleanNumber.length <= 11) {
          // Remove leading zero if present
          const numberWithoutZero = cleanNumber.startsWith('0') ? cleanNumber.slice(1) : cleanNumber;
          return '+60' + numberWithoutZero;
        }
      }
      return val;
    }),
  product: z.string().trim().max(100, "Product must be less than 100 characters").optional(),
});

type ContactFormData = z.infer<typeof contactSchema>;

interface ContactFormProps {
  userId: string;
  onSuccess: () => void;
}

export function ContactForm({ userId, onSuccess }: ContactFormProps) {
  const { toast } = useToast();

  const form = useForm<ContactFormData>({
    resolver: zodResolver(contactSchema),
    defaultValues: {
      name: "",
      phoneNumber: "",
      product: "",
    },
  });

  const onSubmit = async (data: ContactFormData) => {
    try {
      console.log('Submitting contact data:', { 
        user_id: userId, 
        name: data.name, 
        phone_number: data.phoneNumber 
      });

      const { data: result, error } = await supabase
        .from("contacts")
        .insert({
          user_id: userId,
          name: data.name,
          phone_number: data.phoneNumber,
          product: data.product || null,
        })
        .select()
        .single();

      if (error) {
        console.error("Supabase error:", error);
        toast({
          title: "Error",
          description: `Failed to add contact: ${error.message}`,
          variant: "destructive"
        });
        return;
      }

      console.log('Contact added successfully:', result);
      form.reset();
      onSuccess();
    } catch (error) {
      console.error("Unexpected error adding contact:", error);
      toast({
        title: "Error",
        description: "An unexpected error occurred. Please check console and try again.",
        variant: "destructive"
      });
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input placeholder="Enter contact name" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <FormField
          control={form.control}
          name="phoneNumber"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Phone Number</FormLabel>
              <FormControl>
                <Input 
                  placeholder="Enter phone number (e.g., 0123456789)" 
                  {...field} 
                />
              </FormControl>
              <div className="text-xs text-muted-foreground">
                Malaysian numbers will automatically get +60 prefix
              </div>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="product"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Product (Optional)</FormLabel>
              <FormControl>
                <Input placeholder="Enter product name" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? "Adding..." : "Add Contact"}
        </Button>
      </form>
    </Form>
  );
}