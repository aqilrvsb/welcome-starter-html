import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, Phone, Clock, Pause } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  status: string;
  type?: 'call' | 'campaign';
  size?: 'sm' | 'default';
  showIcon?: boolean;
}

export function StatusBadge({ status, type = 'campaign', size = 'default', showIcon = true }: StatusBadgeProps) {
  const getCallStatusConfig = (status: string) => {
    switch (status.toLowerCase()) {
      case 'completed':
      case 'ended':
        return {
          variant: 'default' as const,
          className: 'bg-success hover:bg-success/80 text-success-foreground',
          icon: CheckCircle,
          label: 'Selesai'
        };
      case 'failed':
      case 'cancelled':
        return {
          variant: 'destructive' as const,
          className: '',
          icon: XCircle,
          label: 'Gagal'
        };
      case 'in-progress':
      case 'ringing':
        return {
          variant: 'default' as const,
          className: 'bg-primary hover:bg-primary/80 text-primary-foreground',
          icon: Phone,
          label: 'Aktif'
        };
      case 'initiated':
        return {
          variant: 'secondary' as const,
          className: '',
          icon: Clock,
          label: 'Menunggu'
        };
      default:
        return {
          variant: 'outline' as const,
          className: '',
          icon: Pause,
          label: status
        };
    }
  };

  const getCampaignStatusConfig = (status: string) => {
    switch (status.toLowerCase()) {
      case 'completed':
        return {
          variant: 'default' as const,
          className: 'bg-success hover:bg-success/80 text-success-foreground',
          icon: CheckCircle,
          label: 'Selesai'
        };
      case 'in_progress':
        return {
          variant: 'default' as const,
          className: 'bg-primary hover:bg-primary/80 text-primary-foreground',
          icon: Phone,
          label: 'Sedang Berjalan'
        };
      case 'failed':
        return {
          variant: 'destructive' as const,
          className: '',
          icon: XCircle,
          label: 'Gagal'
        };
      case 'pending':
        return {
          variant: 'secondary' as const,
          className: '',
          icon: Clock,
          label: 'Menunggu'
        };
      default:
        return {
          variant: 'outline' as const,
          className: '',
          icon: Pause,
          label: status
        };
    }
  };

  const config = type === 'call' ? getCallStatusConfig(status) : getCampaignStatusConfig(status);
  const Icon = config.icon;
  const iconSize = size === 'sm' ? 'h-3 w-3' : 'h-4 w-4';

  return (
    <Badge 
      variant={config.variant}
      className={cn(
        config.className,
        showIcon && "flex items-center gap-1",
        size === 'sm' && "text-xs"
      )}
    >
      {showIcon && <Icon className={iconSize} />}
      {config.label}
    </Badge>
  );
}