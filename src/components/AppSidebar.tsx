import { Link, useLocation } from 'react-router-dom';
import {
  BarChart3,
  Phone,
  Bot,
  Settings,
  Home,
  LogOut,
  Crown,
  Clock,
  XCircle,
  Users,
  Wallet,
  Lightbulb,
  UserCheck
} from 'lucide-react';
import { useCustomAuth } from '@/contexts/CustomAuthContext';
import { useState, useEffect } from 'react';
import { getUserSubscription } from '@/lib/billing';
import { Badge } from '@/components/ui/badge';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  useSidebar,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

const navigationItems = [
  { title: 'Dashboard', url: '/dashboard', icon: Home },
  { title: 'Pro Application', url: '/pro-application', icon: UserCheck },
  { title: 'Credits Top-Up', url: '/credits-topup', icon: Wallet },
  { title: 'Contacts', url: '/contacts', icon: Users },
  { title: 'Campaigns', url: '/campaigns', icon: BarChart3 },
  { title: 'Call Logs', url: '/call-logs', icon: Phone },
  { title: 'Prompts', url: '/prompts', icon: Bot },
  { title: 'Roadmap', url: '/roadmap', icon: Lightbulb },
  { title: 'Settings', url: '/settings', icon: Settings },
];

export function AppSidebar() {
  const location = useLocation();
  const { user, signOut } = useCustomAuth();
  const { state } = useSidebar();
  const isCollapsed = state === 'collapsed';
  const [subscriptionStatus, setSubscriptionStatus] = useState<'trial' | 'pro' | 'expired' | null>(null);

  const isActive = (path: string) => location.pathname === path;

  useEffect(() => {
    const checkSubscription = async () => {
      if (!user) return;
      
      try {
        // Check local subscription only (Billplz-based)
        const localSubscription = await getUserSubscription(user.id);
        
        if (localSubscription?.status === 'active') {
          setSubscriptionStatus('pro');
        } else if (localSubscription?.status === 'trial') {
          setSubscriptionStatus('trial');
        } else if (localSubscription && (localSubscription.status === 'expired' || localSubscription.status === 'cancelled')) {
          setSubscriptionStatus('expired');
        } else {
          setSubscriptionStatus(null);
        }
      } catch (error) {
        console.error('Error checking subscription:', error);
      }
    };

    checkSubscription();
  }, [user]);

  const getSubscriptionBadge = () => {
    if (subscriptionStatus === 'pro') {
      return (
        <Badge variant="default" className="ml-2 bg-yellow-500 text-white">
          <Crown className="w-3 h-3 mr-1" />
          Pro
        </Badge>
      );
    }
    if (subscriptionStatus === 'trial') {
      return (
        <Badge variant="secondary" className="ml-2">
          <Clock className="w-3 h-3 mr-1" />
          Trial
        </Badge>
      );
    }
    if (subscriptionStatus === 'expired') {
      return (
        <Badge variant="destructive" className="ml-2">
          <XCircle className="w-3 h-3 mr-1" />
          Expired
        </Badge>
      );
    }
    return null;
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b">
        <div className="flex items-center gap-2 px-4 py-2">
          {!isCollapsed && (
            <div className="flex items-center justify-between w-full">
              <h2 className="text-lg font-semibold text-primary">VoiceAI</h2>
              {getSubscriptionBadge()}
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navigationItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)}>
                    <Link to={item.url}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t">
        <SidebarMenu>
          <SidebarMenuItem>
            <div className="flex items-center gap-2 p-2">
              <Avatar className="h-8 w-8">
                <AvatarImage src="" alt={user?.username} />
                <AvatarFallback>
                  {user?.username?.charAt(0)?.toUpperCase() || 'U'}
                </AvatarFallback>
              </Avatar>
              {!isCollapsed && (
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{user?.username}</p>
                </div>
              )}
            </div>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <Button
              variant="ghost"
              size="sm"
              onClick={signOut}
              className="w-full justify-start"
            >
              <LogOut className="h-4 w-4" />
              {!isCollapsed && <span>Logout</span>}
            </Button>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}