import { Shield, Users, LayoutDashboard, Phone, MessageSquare, Target, CreditCard, LogOut, DollarSign, BarChart3, FileText, UserCheck, Lightbulb, Settings, Receipt, Wallet } from "lucide-react"
import { Link, useLocation, useNavigate } from "react-router-dom"
import { useCustomAuth } from "@/contexts/CustomAuthContext"
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar"

const adminMenuItems = [
  {
    title: "Dashboard",
    url: "/admin/dashboard",
    icon: LayoutDashboard,
  },
  {
    title: "Waiting List",
    url: "/admin/waiting-list",
    icon: UserCheck,
  },
  {
    title: "Users",
    url: "/admin/users",
    icon: Users,
  },
  {
    title: "Feature Requests",
    url: "/admin/feature-requests",
    icon: Lightbulb,
  },
  {
    title: "Transactions",
    url: "/admin/transactions",
    icon: Receipt,
  },
  {
    title: "Manual Credits",
    url: "/admin/manual-credits",
    icon: Wallet,
  },
  {
    title: "Revenue",
    url: "/admin/revenue",
    icon: DollarSign,
  },
  {
    title: "Analytics",
    url: "/admin/analytics",
    icon: BarChart3,
  },
  {
    title: "Call Logs",
    url: "/admin/call-logs",
    icon: Phone,
  },
  {
    title: "Contacts",
    url: "/admin/contacts",
    icon: MessageSquare,
  },
  {
    title: "Campaigns",
    url: "/admin/campaigns",
    icon: Target,
  },
  {
    title: "Reports",
    url: "/admin/reports",
    icon: FileText,
  },
  {
    title: "System Settings",
    url: "/admin/settings",
    icon: Settings,
  },
]

export function AdminSidebar() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, signOut } = useCustomAuth()

  const handleLogout = async () => {
    await signOut()
    navigate('/admin/login')
  }

  return (
    <Sidebar>
      <SidebarHeader>
        <div className="flex items-center gap-2 px-4 py-3">
          <Shield className="h-6 w-6 text-red-600" />
          <div>
            <h2 className="text-lg font-bold">Admin Panel</h2>
            <p className="text-xs text-muted-foreground">SifuCall</p>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Administration</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {adminMenuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={location.pathname === item.url}>
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
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <div className="px-4 py-2 border-t">
              <p className="text-sm font-medium">Admin</p>
              <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
            </div>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={handleLogout}>
              <LogOut className="h-4 w-4" />
              <span>Logout</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
