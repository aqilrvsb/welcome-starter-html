import { Button } from "@/components/ui/button";
import { 
  Bot, 
  Menu, 
  X, 
  User, 
  LogOut, 
  Settings, 
  BarChart3, 
  Phone, 
  Zap,
  FileText,
  Home,
  Users
} from "lucide-react";
import { useState } from "react";
import { useCustomAuth } from "@/contexts/CustomAuthContext";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Link, useLocation } from "react-router-dom";

// Define main navigation items
const mainNavItems = [
  { to: '/dashboard', label: 'Dashboard', icon: Home },
  { to: '/campaigns', label: 'Campaigns', icon: BarChart3 },
  { to: '/prompts', label: 'Prompts', icon: FileText },
  { to: '/contacts', label: 'Contacts', icon: Users },
  { to: '/call-logs', label: 'Call Logs', icon: Phone },
];

export function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { user, signOut } = useCustomAuth();
  const location = useLocation();

  const handleSignOut = async () => {
    await signOut();
  };

  const isActivePath = (path: string) => location.pathname === path;

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <div className="flex items-center space-x-2">
            <div className="hero-gradient p-2 rounded-lg">
              <Bot className="h-6 w-6 text-white" />
            </div>
            <span className="text-xl font-bold text-foreground">SifuCall</span>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-1">
            {user ? (
              // Authenticated user navigation
              <>
                {mainNavItems.map((item) => (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={`px-3 py-2 rounded-md text-sm font-medium transition-smooth ${
                      isActivePath(item.to)
                        ? 'bg-primary/10 text-primary border border-primary/20'
                        : 'text-muted-foreground hover:text-primary hover:bg-primary/5'
                    }`}
                  >
                    {item.label}
                  </Link>
                ))}
              </>
            ) : (
              // Public navigation for non-authenticated users
              <>
                <a href="#features" className="px-3 py-2 text-sm font-medium hover:text-primary transition-smooth">
                  Features
                </a>
                <a href="#pricing" className="px-3 py-2 text-sm font-medium hover:text-primary transition-smooth">
                  Pricing
                </a>
                <a href="#contact" className="px-3 py-2 text-sm font-medium hover:text-primary transition-smooth">
                  Contact
                </a>
              </>
            )}
          </nav>

          {/* Desktop CTA Buttons */}
          <div className="hidden md:flex items-center space-x-4">
            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="relative h-8 w-8 rounded-full">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="bg-primary text-primary-foreground">
                        {user.username?.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56" align="end">
                  <div className="flex items-center justify-start gap-2 p-2">
                    <div className="flex flex-col space-y-1 leading-none">
                      <p className="font-medium">{user.username}</p>
                    </div>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link to="/dashboard">
                      <Home className="mr-2 h-4 w-4" />
                      Dashboard
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/settings">
                      <Settings className="mr-2 h-4 w-4" />
                      Settings
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleSignOut}>
                    <LogOut className="mr-2 h-4 w-4" />
                    Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <>
                <Button variant="ghost" size="sm" asChild>
                  <Link to="/login">Log In</Link>
                </Button>
                <Button variant="hero" size="sm" asChild>
                  <Link to="/signup">Get Started</Link>
                </Button>
              </>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden p-2"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            aria-label="Toggle menu"
          >
            {isMenuOpen ? (
              <X className="h-6 w-6" />
            ) : (
              <Menu className="h-6 w-6" />
            )}
          </button>
        </div>

        {/* Mobile Navigation */}
        {isMenuOpen && (
          <div className="md:hidden py-4 border-t bg-background/95 backdrop-blur">
            <nav className="flex flex-col space-y-2">
              {user ? (
                // Authenticated mobile navigation
                <>
                  {mainNavItems.map((item) => {
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.to}
                        to={item.to}
                        className={`flex items-center space-x-3 px-3 py-3 rounded-md text-sm font-medium transition-smooth ${
                          isActivePath(item.to)
                            ? 'bg-primary/10 text-primary border border-primary/20'
                            : 'text-muted-foreground hover:text-primary hover:bg-primary/5'
                        }`}
                        onClick={() => setIsMenuOpen(false)}
                      >
                        <Icon className="h-4 w-4" />
                        <span>{item.label}</span>
                      </Link>
                    );
                  })}
                  <div className="pt-4 border-t border-border space-y-2">
                    <Link
                      to="/settings"
                      className="flex items-center space-x-3 px-3 py-3 rounded-md text-sm font-medium text-muted-foreground hover:text-primary hover:bg-primary/5 transition-smooth"
                      onClick={() => setIsMenuOpen(false)}
                    >
                      <Settings className="h-4 w-4" />
                      <span>Settings</span>
                    </Link>
                    <button
                      onClick={() => {
                        handleSignOut();
                        setIsMenuOpen(false);
                      }}
                      className="flex items-center space-x-3 px-3 py-3 rounded-md text-sm font-medium text-destructive hover:bg-destructive/10 transition-smooth w-full"
                    >
                      <LogOut className="h-4 w-4" />
                      <span>Sign Out</span>
                    </button>
                   </div>
                 </>
                ) : (
                  // Public mobile navigation
                  <>
                   <a href="#features" className="px-3 py-3 text-sm font-medium hover:text-primary transition-smooth">
                     Features
                   </a>
                   <a href="#pricing" className="px-3 py-3 text-sm font-medium hover:text-primary transition-smooth">
                     Pricing
                   </a>
                   <a href="#contact" className="px-3 py-3 text-sm font-medium hover:text-primary transition-smooth">
                     Contact
                   </a>
                   <div className="flex flex-col space-y-2 pt-4 border-t border-border">
                     <Button variant="ghost" size="sm" asChild>
                       <Link to="/login" onClick={() => setIsMenuOpen(false)}>Log In</Link>
                     </Button>
                     <Button variant="hero" size="sm" asChild>
                       <Link to="/signup" onClick={() => setIsMenuOpen(false)}>Get Started</Link>
                     </Button>
                   </div>
                 </>
               )}
            </nav>
          </div>
        )}
      </div>
    </header>
  );
}