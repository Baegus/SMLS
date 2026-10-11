export function debounce(func, getWait) {
	let timeout;
	return function executedFunction(...args) {
		const later = () => {
			clearTimeout(timeout);
			func(...args);
		};
		clearTimeout(timeout);
		const wait = typeof getWait === "function" ? getWait() : getWait;
		timeout = setTimeout(later, wait);
	};
}
