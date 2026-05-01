/**
 * Kindness missions organized by category
 *
 * IMPORTANT: The single source of truth for missions is missions.json (English)
 * and missions-sv.json (Swedish).
 * Edit those files to add, remove, or modify missions.
 */

import missionsData from './missions.json';
import missionsSvData from './missions-sv.json';
import { getLocale } from '$lib/i18n';
import type { Locale } from '$lib/i18n';

export const missions: string[] = missionsData;
export const missionsSv: string[] = missionsSvData;

function getMissionsForLocale(locale?: Locale): string[] {
	const l = locale ?? getLocale();
	return l === 'sv' ? missionsSv : missions;
}

/**
 * Simple deterministic hash for a given date.
 * Uses the epoch day number combined with a mixing function to produce
 * a well-distributed index, avoiding the predictable sequential cycling
 * of a plain modulo approach.
 */
function hashDate(date: Date): number {
	// Epoch day number — unique per calendar day, incorporates year naturally
	const epochDay = Math.floor(date.getTime() / (1000 * 60 * 60 * 24));

	// Mix bits (simple integer hash based on splitmix32)
	let h = (epochDay + 0x9e3779b9) | 0;
	h ^= h >>> 16;
	h = Math.imul(h, 0x45d9f3b);
	h ^= h >>> 16;
	return Math.abs(h);
}

/**
 * Get a mission for a specific day.
 * Deterministic — the same date always returns the same mission — but
 * the sequence feels shuffled and won't repeat in a recognisable pattern
 * until the hash collides (effectively years).
 */
export function getMissionForDay(
	date: Date = new Date(),
	locale?: Locale
): { mission: string; index: number } {
	const list = getMissionsForLocale(locale);
	const index = hashDate(date) % list.length;
	return { mission: list[index], index };
}

/**
 * Get a random mission different from the current one
 */
export function getRandomMission(
	currentIndex: number,
	locale?: Locale
): { mission: string; index: number } {
	const list = getMissionsForLocale(locale);
	let newIndex: number;
	do {
		newIndex = Math.floor(Math.random() * list.length);
	} while (newIndex === currentIndex && list.length > 1);

	return { mission: list[newIndex], index: newIndex };
}
