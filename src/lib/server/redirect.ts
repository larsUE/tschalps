/** Only allow same-site relative redirect targets (prevents open redirects). */
export function safeRedirectTarget(target: string | null | undefined, fallback = '/') {
	if (!target || !target.startsWith('/') || target.startsWith('//') || target.startsWith('/\\')) {
		return fallback;
	}
	return target;
}
