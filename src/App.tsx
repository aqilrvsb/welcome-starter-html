import * as React from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { CustomAuthProvider } from "@/contexts/CustomAuthContext";
import { OnboardingProvider } from "@/contexts/OnboardingContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { CustomProtectedRoute } from "@/components/layout/CustomProtectedRoute";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { AdminSidebar } from "@/components/AdminSidebar";
import Index from "./pages/Index";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Dashboard from "./pages/Dashboard";

import CallLogsPage from '@/pages/call-logs';
import FailedCallsPage from '@/pages/failed-calls';
import PromptsPage from './pages/prompts';
import CampaignsPage from './pages/campaigns';
import CampaignBatchPage from './pages/campaign-batch';
import ContactsPage from './pages/contacts';
import InvoicesPage from './pages/invoices';
import Settings from "./pages/Settings";
import Whatsapp from "./pages/Whatsapp";
import CreditsTopup from "./pages/CreditsTopup";
import NotFound from "./pages/NotFound";
import ThankYou from "./pages/ThankYou";
import TwilioTutorial from "./pages/TwilioTutorial";

// Admin pages
import AdminLogin from "./pages/admin/AdminLogin";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminUsers from "./pages/admin/AdminUsers";
import AdminCallLogs from "./pages/admin/AdminCallLogs";
import AdminContacts from "./pages/admin/AdminContacts";
import AdminCampaigns from "./pages/admin/AdminCampaigns";

// Create QueryClient outside component to avoid recreation
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 3,
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
  },
});

// Layout wrapper for protected routes
function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const isPublicRoute = ['/', '/login', '/signup', '/admin/login'].includes(location.pathname);
  const isAdminRoute = location.pathname.startsWith('/admin');

  if (isPublicRoute) {
    return <>{children}</>;
  }

  // Admin routes use AdminSidebar
  if (isAdminRoute) {
    return (
      <SidebarProvider>
        <div className="min-h-screen flex w-full">
          <AdminSidebar />
          <main className="flex-1 flex flex-col relative">
            <header className="sticky top-0 z-50 h-12 flex items-center border-b px-4 bg-background">
              <SidebarTrigger />
            </header>
            <div className="flex-1">
              {children}
            </div>
          </main>
        </div>
      </SidebarProvider>
    );
  }

  // Regular user routes use AppSidebar
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <main className="flex-1 flex flex-col relative">
          <header className="sticky top-0 z-50 h-12 flex items-center border-b px-4 bg-background">
            <SidebarTrigger />
          </header>
          <div className="flex-1">
            {children}
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <BrowserRouter>
          <CustomAuthProvider>
            <OnboardingProvider>
              <TooltipProvider>
                <ProtectedLayout>
                  <div className="min-h-screen bg-background">
                    <Routes>
                      <Route path="/" element={<Index />} />
                      <Route path="/login" element={<Login />} />
                      <Route path="/signup" element={<Signup />} />
                      <Route 
                        path="/dashboard" 
                        element={
                          <CustomProtectedRoute>
                            <Dashboard />
                          </CustomProtectedRoute>
                        } 
                      />
                      <Route 
                        path="/call-logs" 
                        element={
                          <CustomProtectedRoute>
                            <CallLogsPage />
                          </CustomProtectedRoute>
                        } 
                      />
                      <Route 
                        path="/failed-calls" 
                        element={
                          <CustomProtectedRoute>
                            <FailedCallsPage />
                          </CustomProtectedRoute>
                        } 
                      />
                      <Route 
                        path="/prompts" 
                        element={
                          <CustomProtectedRoute>
                            <PromptsPage />
                          </CustomProtectedRoute>
                        } 
                      />
                      <Route 
                        path="/campaigns" 
                        element={
                          <CustomProtectedRoute>
                            <CampaignsPage />
                          </CustomProtectedRoute>
                        } 
                      />
                      <Route 
                        path="/campaign-batch" 
                        element={
                          <CustomProtectedRoute>
                            <CampaignBatchPage />
                          </CustomProtectedRoute>
                        } 
                      />
                      <Route 
                        path="/contacts" 
                        element={
                          <CustomProtectedRoute>
                            <ContactsPage />
                          </CustomProtectedRoute>
                        } 
                      />
                      <Route 
                        path="/invoices" 
                        element={
                          <CustomProtectedRoute>
                            <InvoicesPage />
                          </CustomProtectedRoute>
                        } 
                      />
                      <Route 
                        path="/settings" 
                        element={
                          <CustomProtectedRoute>
                            <Settings />
                          </CustomProtectedRoute>
                        } 
                      />
                      <Route
                        path="/whatsapp"
                        element={
                          <CustomProtectedRoute>
                            <Whatsapp />
                          </CustomProtectedRoute>
                        }
                      />
                      <Route
                        path="/credits-topup"
                        element={
                          <CustomProtectedRoute>
                            <CreditsTopup />
                          </CustomProtectedRoute>
                        }
                      />
                      <Route path="/thank-you" element={<ThankYou />} />
                      <Route
                        path="/twilio-tutorial"
                        element={
                          <CustomProtectedRoute>
                            <TwilioTutorial />
                          </CustomProtectedRoute>
                        }
                      />

                      {/* Admin Routes */}
                      <Route path="/admin/login" element={<AdminLogin />} />
                      <Route
                        path="/admin/dashboard"
                        element={
                          <CustomProtectedRoute>
                            <AdminDashboard />
                          </CustomProtectedRoute>
                        }
                      />
                      <Route
                        path="/admin/users"
                        element={
                          <CustomProtectedRoute>
                            <AdminUsers />
                          </CustomProtectedRoute>
                        }
                      />
                      <Route
                        path="/admin/call-logs"
                        element={
                          <CustomProtectedRoute>
                            <AdminCallLogs />
                          </CustomProtectedRoute>
                        }
                      />
                      <Route
                        path="/admin/contacts"
                        element={
                          <CustomProtectedRoute>
                            <AdminContacts />
                          </CustomProtectedRoute>
                        }
                      />
                      <Route
                        path="/admin/campaigns"
                        element={
                          <CustomProtectedRoute>
                            <AdminCampaigns />
                          </CustomProtectedRoute>
                        }
                      />

                      <Route path="*" element={<NotFound />} />
                    </Routes>
                  </div>
                </ProtectedLayout>
                <Toaster />
                <Sonner />
              </TooltipProvider>
            </OnboardingProvider>
          </CustomAuthProvider>
        </BrowserRouter>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
