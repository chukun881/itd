import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merge Tailwind CSS class names with conflict resolution.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/**
 * Format a file size in bytes to a human-readable string.
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/**
 * Format a polygon count to a human-readable string.
 */
export function formatPolyCount(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K`;
  return String(count);
}

/**
 * Validate that a file is an accepted image type.
 */
export const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10 MB

export function isValidImageType(mimeType: string): boolean {
  return (ACCEPTED_IMAGE_TYPES as readonly string[]).includes(mimeType);
}

/**
 * Sleep utility for retry loops.
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
