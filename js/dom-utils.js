//utility functions for DOM operations
const DomUtils = {
	//memoization for better performance
	memoize: (fn, ttl = 1000) => {
		let cache = {};
		let lastClear = Date.now();

		return function (...args) {
			//clear cache if TTL expired to avoid stale data
			if (Date.now() - lastClear > ttl) {
				cache = {};
				lastClear = Date.now();
			}

			const key = JSON.stringify(args);
			if (cache[key] === undefined) {
				cache[key] = fn.apply(this, args);
			}
			return cache[key];
		};
	},

	//throttle expensive functions
	throttle: (fn, delay) => {
		let lastCall = 0;
		return function (...args) {
			const now = Date.now();
			if (now - lastCall >= delay) {
				lastCall = now;
				return fn.apply(this, args);
			}
		};
	},

	//debounce function
	debounce: (func, wait) => {
		let timeout;
		return function (...args) {
			clearTimeout(timeout);
			timeout = setTimeout(() => func.apply(this, args), wait);
		};
	},

	//cache DOM selectors for better performance
	SELECTORS: {
		focusable:
			"a[href], button, input:not([type='hidden']), textarea, select, [contenteditable='true'], [tabindex]:not([tabindex='-1'])",
		excluded:
			"header, footer, nav, [role='banner'], [role='contentinfo'], [role='navigation']",
		textInput:
			"input[type='text'], input[type='search'], input[type='email'], input[type='password'], input[type='number'], textarea, [contenteditable='true']",
	},
};

export default DomUtils;
