/**
 * Shared mission completion state and utilities
 */

import { browser } from '$app/environment';

/**
 * Check if today's mission has been completed
 */
export function isMissionCompletedToday(): boolean {
	if (!browser) return false;

	const lastCompleted = localStorage.getItem('lastCompletedDate');
	const todayStr = new Date().toISOString().split('T')[0];
	return lastCompleted === todayStr;
}

/**
 * Mark today's mission as completed
 */
export function markMissionCompleted(): void {
	if (!browser) return;

	const todayStr = new Date().toISOString().split('T')[0];
	localStorage.setItem('lastCompletedDate', todayStr);
}

/**
 * Get or create an anonymous ID for duplicate prevention
 */
export function getAnonymousId(): string {
	if (!browser) return '';

	let id = localStorage.getItem('kindspread_anon_id');
	if (!id) {
		id = crypto.randomUUID();
		localStorage.setItem('kindspread_anon_id', id);
	}
	return id;
}

