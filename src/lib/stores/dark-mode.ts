/**
 * Shared dark mode state management
 * Uses localStorage for persistence and window events for cross-component sync
 */

import { browser } from '$app/environment';

// Internal state (not reactive - components should use their own $state and listen for events)
let darkModeValue = true;

/**
 * Initialize dark mode from localStorage
 * Call this once on component mount
 */
export function initDarkMode(): void {
	if (!browser) return;

	const stored = localStorage.getItem('darkMode');
	if (stored !== null) {
		darkModeValue = stored === 'true';
	}
	// If not stored, keep default (true = dark mode)
}

/**
 * Get the current dark mode value
 */
export function getDarkMode(): boolean {
	return darkModeValue;
}

/**
 * Toggle dark mode and persist to localStorage
 */
export function toggleDarkMode(): void {
	darkModeValue = !darkModeValue;
	if (browser) {
		localStorage.setItem('darkMode', String(darkModeValue));
		// Dispatch event for any components that need to react
		window.dispatchEvent(new CustomEvent('darkModeChange', { detail: darkModeValue }));
	}
}

/**
 * Set dark mode to a specific value
 */
export function setDarkMode(value: boolean): void {
	darkModeValue = value;
	if (browser) {
		localStorage.setItem('darkMode', String(value));
		window.dispatchEvent(new CustomEvent('darkModeChange', { detail: value }));
	}
}


