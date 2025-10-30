import React, { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Upload, FileText, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import * as XLSX from 'xlsx';

interface ExcelImportProps {
  userId: string;
  onSuccess: (count: number) => void;
}

export function ExcelImport({ userId, onSuccess }: ExcelImportProps) {
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const { toast } = useToast();

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      // Check file type
      const validTypes = [
        'application/vnd.ms-excel', // .xls
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
        'text/csv' // .csv
      ];
      
      if (!validTypes.includes(selectedFile.type) && !selectedFile.name.endsWith('.csv')) {
        toast({
          title: "Error",
          description: "Please select an Excel file (.xlsx, .xls) or CSV file (.csv)",
          variant: "destructive"
        });
        return;
      }

      setFile(selectedFile);
    }
  };

  const formatPhoneNumber = (phoneNumber: string): string => {
    // Convert Malaysian numbers: +60/60 → 0 prefix
    let cleanNumber = phoneNumber.replace(/\D/g, ''); // Remove non-digits

    // Convert +60XXXXXXXXX or 60XXXXXXXXX to 0XXXXXXXXX (Malaysian format)
    if (cleanNumber.startsWith('60') && cleanNumber.length >= 10) {
      cleanNumber = '0' + cleanNumber.substring(2);
    }
    // Ensure number starts with 0 if it doesn't already
    else if (!cleanNumber.startsWith('0') && cleanNumber.length >= 9) {
      cleanNumber = '0' + cleanNumber;
    }

    return cleanNumber;
  };

  const parseCSV = (text: string): Array<{name: string, phone_number: string, product?: string, info?: string}> => {
    const lines = text.split('\n').filter(line => line.trim());
    const contacts = [];

    // Skip header if it exists (check if first line contains 'name' or 'phone')
    const startIndex = lines[0].toLowerCase().includes('name') || lines[0].toLowerCase().includes('phone') ? 1 : 0;

    for (let i = startIndex; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const parts = line.split(',').map(part => part.replace(/"/g, '').trim());

      if (parts.length >= 2 && parts[0] && parts[1]) {
        contacts.push({
          name: parts[0],
          phone_number: formatPhoneNumber(parts[1]),
          product: parts[2] || undefined,
          info: parts[3] || undefined
        });
      }
    }

    return contacts;
  };

  const parseExcel = (buffer: ArrayBuffer): Array<{name: string, phone_number: string, product?: string, info?: string}> => {
    const workbook = XLSX.read(buffer, { type: 'array' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

    const contacts = [];

    // Skip header if it exists (check if first row contains 'name' or 'phone')
    const startIndex = data[0] && (
      (typeof data[0][0] === 'string' && data[0][0].toLowerCase().includes('name')) ||
      (typeof data[0][1] === 'string' && data[0][1].toLowerCase().includes('phone'))
    ) ? 1 : 0;

    for (let i = startIndex; i < data.length; i++) {
      const row = data[i];
      if (row && row.length >= 2 && row[0] && row[1]) {
        const name = String(row[0]).trim();
        const phoneNumber = String(row[1]).trim();
        const product = row[2] ? String(row[2]).trim() : undefined;
        const info = row[3] ? String(row[3]).trim() : undefined;

        if (name && phoneNumber) {
          contacts.push({
            name,
            phone_number: formatPhoneNumber(phoneNumber),
            product,
            info
          });
        }
      }
    }

    return contacts;
  };

  const handleImport = async () => {
    if (!file) {
      toast({
        title: "Error",
        description: "Please select a file first",
        variant: "destructive"
      });
      return;
    }

    setImporting(true);

    try {
      let contacts: Array<{name: string, phone_number: string, product?: string, info?: string}> = [];

      if (file.type === 'text/csv' || file.name.endsWith('.csv')) {
        const text = await file.text();
        contacts = parseCSV(text);
      } else {
        // For Excel files (.xlsx, .xls)
        const buffer = await file.arrayBuffer();
        contacts = parseExcel(buffer);
      }

      if (contacts.length === 0) {
        toast({
          title: "Error",
          description: "No valid contacts found in the file. Make sure the format is: Name, Phone Number, Product (optional), Info (optional)",
          variant: "destructive"
        });
        setImporting(false);
        return;
      }

      // Add user_id to all contacts
      const contactsWithUserId = contacts.map(contact => ({
        ...contact,
        user_id: userId
      }));

      const { data, error } = await supabase
        .from("contacts")
        .insert(contactsWithUserId);

      if (error) {
        console.error("Error importing contacts:", error);
        toast({
          title: "Error",
          description: "Failed to import contacts. Please try again.",
          variant: "destructive"
        });
        setImporting(false);
        return;
      }

      setFile(null);
      // Reset file input
      const fileInput = document.getElementById('file-input') as HTMLInputElement;
      if (fileInput) {
        fileInput.value = '';
      }
      
      onSuccess(contacts.length);
    } catch (error) {
      console.error("Error processing file:", error);
      toast({
        title: "Error",
        description: "Failed to process the file. Please check the format and try again.",
        variant: "destructive"
      });
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-4">
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Upload a CSV or Excel file with contacts. Format: Name, Phone Number, Product (optional), Info (optional) - one contact per line
        </AlertDescription>
      </Alert>

      <div className="space-y-4">
        <div>
          <Input
            id="file-input"
            type="file"
            accept=".csv,.xlsx,.xls"
            onChange={handleFileChange}
          />
        </div>

        {file && (
          <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
            <FileText className="h-4 w-4" />
            <span className="text-sm">{file.name}</span>
            <span className="text-xs text-muted-foreground">
              ({(file.size / 1024).toFixed(1)} KB)
            </span>
          </div>
        )}

        <Button
          onClick={handleImport}
          disabled={!file || importing}
          className="w-full"
        >
          <Upload className="h-4 w-4 mr-2" />
          {importing ? "Importing..." : "Import Contacts"}
        </Button>
      </div>

      <div className="text-sm text-muted-foreground">
        <p><strong>CSV Format Example (Malaysian numbers will auto-get +60 prefix):</strong></p>
        <code className="block bg-muted p-2 rounded mt-1">
          Name, Phone Number, Product, Info<br />
          John Doe, 0123456789, Product A, Additional info about John<br />
          Jane Smith, 1137527311, Product B, Notes for Jane<br />
          Ahmad Ali, +601234567890, Product C, Important customer
        </code>
        <p className="mt-2 text-xs">
          Note: Malaysian numbers will automatically be formatted with +60 prefix if not already present. Product and Info are optional.
        </p>
      </div>
    </div>
  );
}