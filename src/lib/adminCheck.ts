import { User } from './customAuth';

// Check if user is admin
export const isAdmin = (user: User | null): boolean => {
  if (!user) return false;
  return user.email === 'admin@gmail.com';
};

// Admin email constant
export const ADMIN_EMAIL = 'admin@gmail.com';
export const ADMIN_PASSWORD = 'admin@gmail.com';
