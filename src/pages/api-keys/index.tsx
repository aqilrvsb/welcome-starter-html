import { ApiKeysForm } from '@/components/api-keys/ApiKeysForm';

export default function ApiKeysPage() {
  return (
    <div className="min-h-screen bg-background">
      <main>
        <div className="container mx-auto px-4 py-8 max-w-2xl">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-foreground">API Keys Settings</h1>
            <p className="text-muted-foreground mt-2">
              Konfigurasikan kunci API untuk menggunakan perkhidmatan AI dan telefon
            </p>
          </div>

          <ApiKeysForm />
        </div>
      </main>
    </div>
  );
}