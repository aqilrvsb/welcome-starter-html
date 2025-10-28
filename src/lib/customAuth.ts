import { supabase } from '@/integrations/supabase/client';
import { createUserTrialSubscription } from './billing';
import { v4 as uuidv4 } from 'uuid';

export interface User {
  id: string;
  username: string;
  email: string;
  is_admin: boolean;
  created_at: string;
}

export interface SignUpData {
  email: string;
  username: string;
  password: string;
}

export interface SignInData {
  email: string;
  password: string;
}

// Simple password hashing using Web Crypto API
const hashPassword = async (password: string): Promise<string> => {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

const verifyPassword = async (password: string, hash: string): Promise<boolean> => {
  const passwordHash = await hashPassword(password);
  return passwordHash === hash;
};

// Session management
const generateSessionToken = (): string => {
  return uuidv4() + '-' + Date.now();
};

const storeUserSession = (user: User, sessionToken: string): void => {
  localStorage.setItem('customAuthUser', JSON.stringify(user));
  localStorage.setItem('customAuthToken', sessionToken);
};

const getUserFromStorage = (): User | null => {
  const stored = localStorage.getItem('customAuthUser');
  return stored ? JSON.parse(stored) : null;
};

// Get session token from local storage
export const getSessionTokenFromStorage = (): string | null => {
  return localStorage.getItem('customAuthToken');
};

// Check and update expired subscriptions (both trial and pro)
const checkAndUpdateExpiredSubscription = async (userId: string): Promise<void> => {
  try {
    const { data: subscription } = await supabase
      .from('user_subscriptions')
      .select('*')
      .eq('user_id', userId)
      .in('status', ['trial', 'active'])
      .maybeSingle();

    if (subscription) {
      const now = new Date();
      let shouldExpire = false;

      // Check trial expiration
      if (subscription.status === 'trial' && subscription.trial_end_date) {
        const trialEndDate = new Date(subscription.trial_end_date);
        if (now > trialEndDate) {
          shouldExpire = true;
        }
      }

      // Check pro subscription expiration
      if (subscription.status === 'active' && subscription.current_period_end) {
        const periodEndDate = new Date(subscription.current_period_end);
        if (now > periodEndDate) {
          shouldExpire = true;
        }
      }

      if (shouldExpire) {
        await supabase
          .from('user_subscriptions')
          .update({ 
            status: 'expired',
            updated_at: now.toISOString()
          })
          .eq('id', subscription.id);
      }
    }
  } catch (error) {
    console.error('Error checking subscription expiration:', error);
  }
};

// Sign up function using Supabase
export const signUp = async (data: SignUpData): Promise<{ user: User | null; error: string | null }> => {
  try {
    // Check if email already exists (email must be unique)
    const { data: existingEmail } = await supabase
      .from('users')
      .select('email')
      .eq('email', data.email)
      .maybeSingle();

    if (existingEmail) {
      return { user: null, error: 'Email already exists' };
    }

    // Hash password
    const passwordHash = await hashPassword(data.password);

    // Create new user in database
    const { data: newUser, error } = await supabase
      .from('users')
      .insert({
        email: data.email,
        username: data.username,
        password_hash: passwordHash,
      })
      .select()
      .single();

    if (error) {
      return { user: null, error: 'Failed to create account' };
    }

    // Return user without password hash
    const user: User = {
      id: newUser.id,
      username: newUser.username,
      email: newUser.email,
      is_admin: newUser.is_admin || false,
      created_at: newUser.created_at,
    };

    // Automatically create trial subscription for new user
    try {
      console.log('Creating trial subscription for new user:', user.id);
      await createUserTrialSubscription(user.id);
      console.log('Trial subscription created successfully for user:', user.id);
    } catch (trialError) {
      console.error('Failed to create trial subscription:', trialError);
      // Don't fail signup if trial creation fails - user can still use the app
    }

    return { user, error: null };
  } catch (error) {
    return { user: null, error: 'Failed to create account' };
  }
};

// Sign in function using Supabase
export const signIn = async (data: SignInData): Promise<{ user: User | null; error: string | null }> => {
  try {
    // Get user from database by email
    const { data: userData, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', data.email)
      .single();

    if (error || !userData) {
      return { user: null, error: 'Invalid email or password' };
    }

    // Verify password
    const isValidPassword = await verifyPassword(data.password, userData.password_hash);
    if (!isValidPassword) {
      return { user: null, error: 'Invalid email or password' };
    }

    // Check and update expired subscriptions before allowing login
    await checkAndUpdateExpiredSubscription(userData.id);

    // Create user object without password hash
    const user: User = {
      id: userData.id,
      username: userData.username,
      email: userData.email,
      is_admin: userData.is_admin || false,
      created_at: userData.created_at,
    };

    // Generate session token
    const sessionToken = generateSessionToken();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days from now

    // Store session in database
    await supabase
      .from('user_sessions')
      .insert({
        user_id: user.id,
        session_token: sessionToken,
        expires_at: expiresAt.toISOString(),
      });

    // Store session locally
    storeUserSession(user, sessionToken);

    return { user, error: null };
  } catch (error) {
    return { user: null, error: 'Login failed' };
  }
};

// Sign out function
export const signOut = async (): Promise<void> => {
  try {
    const sessionToken = getSessionTokenFromStorage();
    
    if (sessionToken) {
      // Remove session from database
      await supabase
        .from('user_sessions')
        .delete()
        .eq('session_token', sessionToken);
    }
    
    // Clear local storage
    localStorage.removeItem('customAuthUser');
    localStorage.removeItem('customAuthToken');
  } catch (error) {
    // Clear local storage even if database operation fails
    localStorage.removeItem('customAuthUser');
    localStorage.removeItem('customAuthToken');
  }
};

// Get current user and validate session
export const getCurrentUser = async (): Promise<User | null> => {
  try {
    const user = getUserFromStorage();
    const sessionToken = getSessionTokenFromStorage();
    
    if (!user || !sessionToken) {
      return null;
    }

    // Validate session in database
    const { data: session } = await supabase
      .from('user_sessions')
      .select('expires_at')
      .eq('session_token', sessionToken)
      .eq('user_id', user.id)
      .maybeSingle();

    if (!session || new Date(session.expires_at) < new Date()) {
      // Session expired or invalid, clear local storage
      await signOut();
      return null;
    }

    // Check and update expired subscriptions whenever user info is fetched
    await checkAndUpdateExpiredSubscription(user.id);

    return user;
  } catch (error) {
    return null;
  }
};

// Change password function using Supabase (no current password verification required)
export const changePassword = async (newPassword: string): Promise<{ error: string | null }> => {
  try {
    const currentUser = getUserFromStorage();
    if (!currentUser) {
      return { error: 'Not authenticated' };
    }

    // Hash new password
    const newPasswordHash = await hashPassword(newPassword);

    // Update password in database
    const { error: updateError } = await supabase
      .from('users')
      .update({
        password_hash: newPasswordHash,
        updated_at: new Date().toISOString()
      })
      .eq('id', currentUser.id);

    if (updateError) {
      return { error: 'Failed to change password' };
    }

    return { error: null };
  } catch (error) {
    return { error: 'Failed to change password' };
  }
};