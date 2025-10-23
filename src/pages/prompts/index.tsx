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
            <AlertTitle>Cara Penggunaan Prompt</AlertTitle>
            <AlertDescription className="mt-2 space-y-4">

              <div>
                <p className="font-semibold mb-2">1. Cara Panggil Value dari Contact:</p>
                <div className="bg-muted p-3 rounded text-sm">
                  <p className="mb-2">Gunakan syntax berikut untuk auto-replace dengan data contact:</p>
                  <ul className="list-disc list-inside space-y-1 ml-2">
                    <li><code className="bg-background px-1.5 py-0.5 rounded">{"{{name}}"}</code> - Nama contact</li>
                    <li><code className="bg-background px-1.5 py-0.5 rounded">{"{{phone}}"}</code> - Nombor telefon</li>
                    <li><code className="bg-background px-1.5 py-0.5 rounded">{"{{product}}"}</code> - Nama produk</li>
                    <li><code className="bg-background px-1.5 py-0.5 rounded">{"{{info}}"}</code> - Info tambahan</li>
                  </ul>
                </div>
              </div>

              <div>
                <p className="font-semibold mb-2">2. Cara Save Stage (Dynamic):</p>
                <div className="bg-muted p-3 rounded text-sm">
                  <p className="mb-2">Gunakan format <code className="bg-background px-1.5 py-0.5 rounded">!!Stage [Nama Stage]!!</code></p>
                  <pre className="bg-background p-2 rounded mt-2 overflow-x-auto">
{`!!Stage Welcome Message!!
Purpose: Greet customer
Tanya: "Assalamualaikum {{name}}, saya dari..."

!!Stage Product Offer!!
Purpose: Offer product
Tanya: "Saya ingin tawarkan {{product}}..."`}
                  </pre>
                </div>
              </div>

              <div>
                <p className="font-semibold mb-2">3. Cara Save Details Penting:</p>
                <div className="bg-muted p-3 rounded text-sm">
                  <p className="mb-2">Gunakan format <code className="bg-background px-1.5 py-0.5 rounded">%%[label]%%</code> untuk simpan info:</p>
                  <pre className="bg-background p-2 rounded mt-2">
{`Contoh: "Baik, %%customer_interest%% saya catat."`}
                  </pre>
                </div>
              </div>

              <div>
                <p className="font-semibold mb-2">4. Cara End Call:</p>
                <div className="bg-muted p-3 rounded text-sm">
                  <p>Gunakan keyword <code className="bg-background px-1.5 py-0.5 rounded">end_call</code> dalam prompt untuk tamatkan panggilan:</p>
                  <pre className="bg-background p-2 rounded mt-2">
{`"Terima kasih atas masa anda. Selamat tinggal!" [end_call]`}
                  </pre>
                </div>
              </div>

              <p className="text-sm text-muted-foreground mt-3">
                💡 Sistem akan automatically detect stage, save details, dan track progress panggilan dalam analytics.
              </p>
            </AlertDescription>
          </Alert>

          <PromptsList />
        </div>
      </main>
    </div>
  );
}