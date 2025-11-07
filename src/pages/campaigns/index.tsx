import { CampaignsList } from '@/components/campaigns/CampaignsList';
import { motion } from 'framer-motion';
import { Target } from 'lucide-react';

export default function CampaignsPage() {
  return (
    <div className="min-h-screen bg-background">
      <main>
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8 max-w-7xl">
          {/* Header with gradient */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] as any }}
            className="p-8 rounded-2xl gradient-card card-soft mb-6 sm:mb-8"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="p-3 rounded-lg bg-primary/10">
                <Target className="h-6 w-6 text-primary" />
              </div>
              <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-primary via-primary-light to-primary-dark bg-clip-text text-transparent">
                Senarai Kempen
              </h1>
            </div>
            <p className="text-muted-foreground text-base sm:text-lg">
              Pantau dan urus kempen batch call anda
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <CampaignsList />
          </motion.div>
        </div>
      </main>
    </div>
  );
}
