import { PromptsList } from '@/components/prompts/PromptsList';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Info } from 'lucide-react';

export default function PromptsPage() {
  return (
    <div className="min-h-screen bg-background">
      <main>
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8 max-w-7xl">
          <div className="mb-6 sm:mb-8">
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Pengurusan Skrip Prompt</h1>
            <p className="text-muted-foreground mt-2 text-sm sm:text-base">
              Cipta dan urus templat skrip untuk kempen panggilan AI anda
            </p>
          </div>

          <Alert className="mb-6">
            <Info className="h-4 w-4" />
            <AlertTitle>Panduan Setup Stage dalam Prompt</AlertTitle>
            <AlertDescription className="mt-2 space-y-2">
              <p>
                Untuk menjejak progress perbualan AI anda, gunakan penanda <code className="bg-muted px-1.5 py-0.5 rounded text-sm">!!Stage [Nama Stage]!!</code> dalam System Prompt anda.
              </p>
              <div className="mt-3">
                <p className="font-semibold mb-2">Contoh penggunaan:</p>
                <pre className="bg-muted p-3 rounded text-sm overflow-x-auto">
{`1. !!Stage Pembukaan!!
Purpose: Salam dan kenalan
Tanya: "Assalamualaikum, saya AI Assistant..."

2. !!Stage Pengesahan Keperluan!!
Purpose: Confirm customer needs
Tanya: "Adakah anda berminat dengan..."

3. !!Stage Penutupan!!
Purpose: Close conversation
Action: Tutup panggilan dengan mesra`}
                </pre>
              </div>
              <p className="text-sm text-muted-foreground mt-3">
                💡 Sistem akan automatically detect stage mana yang dicapai oleh AI dalam setiap panggilan dan paparkan dalam analytics.
              </p>
            </AlertDescription>
          </Alert>

          <PromptsList />
        </div>
      </main>
    </div>
  );
}