/**
 * Kindness missions organized by category
 *
 * IMPORTANT: The single source of truth for missions is missions.json
 * Edit that file to add, remove, or modify missions.
 */

import missionsData from './missions.json';

export const missions: string[] = missionsData;

/**
 * Get a mission for a specific day (deterministic based on day of year)
 */
export function getMissionForDay(date: Date = new Date()): { mission: string; index: number } {
	const dayOfYear = Math.floor(
		(date.getTime() - new Date(date.getFullYear(), 0, 0).getTime()) / (1000 * 60 * 60 * 24)
	);
	const index = dayOfYear % missions.length;
	return { mission: missions[index], index };
}

/**
 * Get a random mission different from the current one
 */
export function getRandomMission(currentIndex: number): { mission: string; index: number } {
	let newIndex: number;
	do {
		newIndex = Math.floor(Math.random() * missions.length);
	} while (newIndex === currentIndex && missions.length > 1);

	return { mission: missions[newIndex], index: newIndex };
}
