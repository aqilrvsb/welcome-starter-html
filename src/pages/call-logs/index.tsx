import { Link } from 'react-router-dom';
import { ArrowLeft, Phone } from 'lucide-react';
import { CallLogsTable } from '@/components/call-logs/CallLogsTable';
import { motion } from 'framer-motion';

export default function CallLogsPage() {
  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8 max-w-7xl">
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.4 }}
        className="mb-4 sm:mb-6"
      >
        <Link
          to="/dashboard"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-primary transition-smooth px-3 py-2 rounded-lg hover:bg-primary/5"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Kembali ke Dashboard
        </Link>
      </motion.div>

      {/* Header with gradient */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] as any }}
        className="p-8 rounded-2xl gradient-card card-soft mb-6 sm:mb-8"
      >
        <div className="flex items-center gap-3 mb-3">
          <div className="p-3 rounded-lg bg-primary/10">
            <Phone className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-primary via-primary-light to-primary-dark bg-clip-text text-transparent">
            Call Logs
          </h1>
        </div>
        <p className="text-muted-foreground text-base sm:text-lg">
          Lihat semua rekod panggilan dari voice agent
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
      >
        <CallLogsTable />
      </motion.div>
    </div>
  );
}
