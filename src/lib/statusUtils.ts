/**
 * Utility functions for consistent status handling across the application
 */

export type CallStatus = 'initiated' | 'ringing' | 'in-progress' | 'completed' | 'ended' | 'answered' | 'failed' | 'cancelled' | 'queued';
export type CampaignStatus = 'pending' | 'in_progress' | 'completed' | 'failed';

/**
 * Determines if a call status represents a successful call
 * Only "answered" status counts as successful
 */
export function isCallSuccessful(status: string): boolean {
  return status === 'answered';
}

/**
 * Determines if a call status represents a failed call
 * Any status other than "answered" counts as failed/unanswered (including voicemail)
 */
export function isCallFailed(status: string): boolean {
  return status !== 'answered';
}

/**
 * Determines if a call status represents an active/ongoing call
 */
export function isCallActive(status: string): boolean {
  return status === 'initiated' || status === 'ringing' || status === 'in-progress';
}

/**
 * Calculates success rate with proper null handling
 */
export function calculateSuccessRate(successful: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((successful / total) * 100 * 10) / 10; // Round to 1 decimal
}

/**
 * Calculates average duration with proper null handling
 */
export function calculateAverageDuration(callLogs: Array<{ duration?: number | null }>): number {
  const validDurations = callLogs
    .map(log => log.duration)
    .filter((duration): duration is number => typeof duration === 'number' && duration > 0);
  
  if (validDurations.length === 0) return 0;
  
  return Math.round(validDurations.reduce((sum, duration) => sum + duration, 0) / validDurations.length);
}

/**
 * Formats duration in seconds to a human readable format
 */
export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  
  if (remainingSeconds === 0) return `${minutes}m`;
  return `${minutes}m ${remainingSeconds}s`;
}