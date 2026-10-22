import type { EnhancedBullet } from '../types';

/**
 * Locate the next pending bullet in the list using review-list ordering.
 * Prefers the next pending bullet after the current one.
 * If none found after, wraps around and checks from the beginning.
 * Excludes currentId (since its status is transitioning away from pending).
 */
export function findNextPendingBulletId(
  bullets: EnhancedBullet[],
  currentId: string
): string | null {
  const isPendingStatus = (s: EnhancedBullet['status']) => s === 'pending' || s === 'review_needed';
  const currentIndex = bullets.findIndex((b) => b.id === currentId);
  if (currentIndex === -1) {
    const firstPending = bullets.find(
      (b) => b.id !== currentId && isPendingStatus(b.status)
    );
    return firstPending ? firstPending.id : null;
  }

  // 1. Check bullets after current bullet
  for (let i = currentIndex + 1; i < bullets.length; i++) {
    if (bullets[i].id !== currentId && isPendingStatus(bullets[i].status)) {
      return bullets[i].id;
    }
  }

  // 2. Wrap around: check bullets before current bullet
  for (let i = 0; i < currentIndex; i++) {
    if (bullets[i].id !== currentId && isPendingStatus(bullets[i].status)) {
      return bullets[i].id;
    }
  }

  return null;
}
