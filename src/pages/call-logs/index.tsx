import { Link } from 'react-router-dom';
import { ArrowLeft, Phone } from 'lucide-react';
import { CallLogsTable } from '@/components/call-logs/CallLogsTable';

export default function CallLogsPage() {
  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8 max-w-7xl">
      <div className="mb-4 sm:mb-6">
        <Link 
          to="/dashboard" 
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Kembali ke Dashboard
        </Link>
      </div>
      
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground flex items-center">
          <Phone className="mr-2 sm:mr-3 h-6 w-6 sm:h-8 sm:w-8" />
          Call Logs
        </h1>
        <p className="text-muted-foreground mt-2 text-sm sm:text-base">
          Lihat semua rekod panggilan dari voice agent
        </p>
      </div>

      <CallLogsTable />
    </div>
  );
}