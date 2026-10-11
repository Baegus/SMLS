export const DEBUG = process.env.DEBUG === "true";

export function debug(...values) {
	if (DEBUG) console.debug("[SMLS]", ...values);
}

export function warn(...values) {
	console.warn("[SMLS]", ...values);
}
