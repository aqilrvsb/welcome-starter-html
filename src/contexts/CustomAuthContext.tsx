import * as React from 'react';
import { User, getCurrentUser, signOut as customSignOut } from '@/lib/customAuth';
import { createUserTrialSubscription } from '@/lib/billing';

interface CustomAuthContextType {
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const CustomAuthContext = React.createContext<CustomAuthContextType | undefined>(undefined);

export function CustomAuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<User | null>(null);
  const [loading, setLoading] = React.useState(true);

  const refreshUser = async () => {
    try {
      const currentUser = await getCurrentUser();
      setUser(currentUser);
      
      // If user exists but doesn't have a subscription, create trial
      if (currentUser) {
        try {
          await createUserTrialSubscription(currentUser.id);
        } catch (error) {
          // Ignore error if subscription already exists
          console.log('Trial subscription check:', error);
        }
      }
    } catch (error) {
      console.error('Error fetching user:', error);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    refreshUser();
  }, []);

  const signOut = async () => {
    await customSignOut();
    setUser(null);
  };

  const value = {
    user,
    loading,
    signOut,
    refreshUser,
  };

  return (
    <CustomAuthContext.Provider value={value}>
      {children}
    </CustomAuthContext.Provider>
  );
}

export function useCustomAuth() {
  const context = React.useContext(CustomAuthContext);
  if (context === undefined) {
    throw new Error('useCustomAuth must be used within a CustomAuthProvider');
  }
  return context;
}