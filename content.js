(function () {
	if (window.hasVimNavigation) {
		return; //prevent multiple injections
	}
	window.hasVimNavigation = true;

	//state management
	const state = {
		navigationEnabled: false,
		searchModeActive: false,
		lastFocusedElement: null,
		focusableElements: [],
		searchResults: [],
		currentSearchIndex: -1,
		searchBox: null,
		currentHighlightedElement: null,
		scrollState: {
			interval: null,
			currentSpeed: 100, //base speed
			acceleration: 1.2, //speed multiplier per interval
			maxSpeed: 800, //maximum scroll speed
			isScrolling: false,
		},
	};

	//cache DOM selectors for better performance
	const SELECTORS = {
		focusable:
			"a[href], button, input:not([type='hidden']), textarea, select, [contenteditable='true'], [tabindex]:not([tabindex='-1'])",
		excluded:
			"header, footer, nav, [role='banner'], [role='contentinfo'], [role='navigation']",
	};

	//optimize DOM querying with memoization
	const memoize = (fn, ttl = 1000) => {
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
	};

	//performance optimization - throttle expensive functions
	const throttle = (fn, delay) => {
		let lastCall = 0;
		return function (...args) {
			const now = Date.now();
			if (now - lastCall >= delay) {
				lastCall = now;
				return fn.apply(this, args);
			}
		};
	};

	//debounce function to limit how often a function is called
	const debounce = (func, wait) => {
		let timeout;
		return function (...args) {
			clearTimeout(timeout);
			timeout = setTimeout(() => func.apply(this, args), wait);
		};
	};

	//check if element is in allowed content (not in header, footer, etc.)
	const isElementInAllowedContent = (element) => {
		return !element.closest(SELECTORS.excluded);
	};

	//more efficient visibility check with batched DOM reads
	const isActuallyVisible = (() => {
		//cache computed styles to avoid repeated calculations
		const styleCache = new WeakMap();

		return (element) => {
			if (!element) return false;

			//get cached rect or compute new one
			const rect = element.getBoundingClientRect();

			//early bailout for zero dimensions
			if (rect.width === 0 || rect.height === 0) {
				return false;
			}

			//check all parent elements
			let parent = element.parentElement;
			while (parent && parent !== document.body) {
				//use cached style or compute new one
				let parentStyle = styleCache.get(parent);
				if (!parentStyle) {
					parentStyle = getComputedStyle(parent);
					styleCache.set(parent, parentStyle);
				}

				//quick check for definite hidden states
				if (
					parentStyle.display === "none" ||
					parentStyle.visibility === "hidden" ||
					parseFloat(parentStyle.opacity) === 0
				) {
					return false;
				}

				//check overflow state
				if (parentStyle.overflow === "hidden") {
					const parentRect = parent.getBoundingClientRect();
					//check if element is within visible area of parent
					if (
						!(
							rect.bottom > parentRect.top &&
							rect.top < parentRect.bottom &&
							rect.right > parentRect.left &&
							rect.left < parentRect.right
						)
					) {
						return false;
					}
				}

				//check for collapsed elements and ARIA states
				if (
					(parent.clientHeight > 0 &&
						parent.clientHeight < 10 &&
						rect.height > parent.clientHeight) ||
					parent.getAttribute("aria-expanded") === "false" ||
					parent.getAttribute("aria-hidden") === "true" ||
					parent.hasAttribute("hidden")
				) {
					return false;
				}

				parent = parent.parentElement;
			}

			//check if element is behind others (only for elements in viewport)
			const centerX = rect.left + rect.width / 2;
			const centerY = rect.top + rect.height / 2;

			if (
				centerX >= 0 &&
				centerX <= window.innerWidth &&
				centerY >= 0 &&
				centerY <= window.innerHeight
			) {
				const topElement = document.elementFromPoint(centerX, centerY);

				if (
					topElement &&
					!element.contains(topElement) &&
					!topElement.contains(element)
				) {
					//use cached style or compute new one
					let topElStyle = styleCache.get(topElement);
					if (!topElStyle) {
						topElStyle = getComputedStyle(topElement);
						styleCache.set(topElement, topElStyle);
					}

					if (parseFloat(topElStyle.opacity) > 0.1) {
						return false;
					}
				}
			}

			return true;
		};
	})();

	//efficiently get all focusable elements with batched DOM operations
	const getAllFocusableElements = memoize(() => {
		const allElements = Array.from(
			document.querySelectorAll(SELECTORS.focusable),
		);
		const visibleElements = [];

		//batch DOM reads before filtering
		const elemData = allElements.map((el) => ({
			element: el,
			rect: el.getBoundingClientRect(),
			style: getComputedStyle(el),
		}));

		//now filter with minimal DOM reads
		return elemData
			.filter(
				({ element, rect, style }) =>
					isElementInAllowedContent(element) &&
					rect.width > 0 &&
					rect.height > 0 &&
					style.visibility !== "hidden" &&
					style.display !== "none" &&
					parseFloat(style.opacity) > 0 &&
					isActuallyVisible(element),
			)
			.map((data) => data.element);
	}, 300); //cache valid for 300ms to avoid frequent recalculation

	//get only elements in viewport
	const getVisibleFocusableElements = memoize(() => {
		//reuse already computed focusable elements
		const elements = getAllFocusableElements();
		const viewportHeight = window.innerHeight;
		const viewportWidth = window.innerWidth;

		//batch DOM reads by computing all rects at once
		const withRects = elements.map((el) => ({
			element: el,
			rect: el.getBoundingClientRect(),
		}));

		//filter based on viewport visibility
		return withRects
			.filter(
				({ rect }) =>
					rect.bottom >= 0 &&
					rect.right >= 0 &&
					rect.top <= viewportHeight &&
					rect.left <= viewportWidth,
			)
			.map((data) => data.element);
	}, 300); //cache valid for 300ms

	//efficiently handle element focus with minimal reflows
	const focusElement = (element) => {
		if (!element) return;

		//use requestAnimationFrame to batch visual changes
		requestAnimationFrame(() => {
			//remove highlight from previously focused element
			if (state.lastFocusedElement) {
				state.lastFocusedElement.classList.remove("highlight-focus");
			}

			//add highlight to newly focused element
			element.classList.add("highlight-focus");

			//set focus without scrolling
			element.focus({ preventScroll: true });

			//update reference
			state.lastFocusedElement = element;

			//ensure element is visible
			ensureElementIsVisible(element);
		});
	};

	//get element's position relative to viewport
	const getElementViewframePosition = (element) => {
		if (!element || !element.getBoundingClientRect) return 2;

		const rect = element.getBoundingClientRect();
		const viewframeHeight = window.innerHeight;

		//check vertical position
		const topInView = rect.top <= viewframeHeight;
		const bottomInView = rect.bottom >= 0;

		if (topInView && bottomInView) return 0; //in view
		if (rect.bottom < 0) return -1; //above viewport
		if (rect.top > viewframeHeight) return 1; //below viewport

		return 2; //other case
	};

	//ensure element is visible in the viewport
	const ensureElementIsVisible = throttle((element) => {
		const rect = element.getBoundingClientRect();

		if (
			rect.top < 0 ||
			rect.left < 0 ||
			rect.bottom > window.innerHeight ||
			rect.right > window.innerWidth
		) {
			element.scrollIntoView({
				block: "nearest",
				behavior: "smooth",
			});
		}
	}, 50); //throttle to improve performance

	//highlight element without focusing
	const highlightElement = (element, isSearchResult = false) => {
		if (!element) return;

		requestAnimationFrame(() => {
			if (isSearchResult) {
				element.classList.add("search-result");
			} else {
				//remove highlight from previous element
				if (state.currentHighlightedElement) {
					state.currentHighlightedElement.classList.remove("highlight-focus");
				}

				//add highlight to new element
				element.classList.add("highlight-focus");
				state.currentHighlightedElement = element;
			}
		});
	};

	//clear all highlights
	const clearHighlights = () => {
		requestAnimationFrame(() => {
			if (state.currentHighlightedElement) {
				state.currentHighlightedElement.classList.remove("highlight-focus");
				state.currentHighlightedElement = null;
			}

			//use more efficient querySelectorAll approach
			document.querySelectorAll(".search-result").forEach((element) => {
				element.classList.remove("search-result");
			});
		});
	};

	//navigation logic
	const handleHorizontalNavigation = (direction) => {
		//get fresh list of visible elements
		state.focusableElements = getVisibleFocusableElements();
		if (state.focusableElements.length === 0) {
			state.lastFocusedElement = null;
			return;
		}

		const startIndex = Math.max(
			state.focusableElements.indexOf(state.lastFocusedElement),
			0,
		);
		const relativePos = getElementViewframePosition(state.lastFocusedElement);
		let nextVisibleIndex = -1;

		//determine which element to focus next
		if (direction === "l" || relativePos === -1) {
			for (let i = startIndex + 1; i < state.focusableElements.length; i++) {
				if (getElementViewframePosition(state.focusableElements[i]) === 0) {
					nextVisibleIndex = i;
					break;
				}
			}
		} else if (direction === "h" || relativePos === 1) {
			for (let i = startIndex - 1; i >= 0; i--) {
				if (getElementViewframePosition(state.focusableElements[i]) === 0) {
					nextVisibleIndex = i;
					break;
				}
			}
		}

		//default to first/last if needed
		if (nextVisibleIndex === -1 && state.focusableElements.length > 0) {
			nextVisibleIndex =
				direction === "l" ? 0 : state.focusableElements.length - 1;
		}

		//focus the element
		const elementToFocus = state.focusableElements[nextVisibleIndex];
		if (elementToFocus) {
			focusElement(elementToFocus);
		}
	};

	//search functionality
	const createSearchBox = () => {
		if (!state.searchBox) {
			//create elements once and reuse
			state.searchBox = document.createElement("div");
			state.searchBox.id = "byebyemouse-search";
			state.searchBox.style.cssText = `
        position: fixed;
        top: 10px;
        left: 50%;
        transform: translateX(-50%);
        z-index: 999999;
        background-color: #333;
        color: #fff;
        padding: 10px;
        border-radius: 5px;
        box-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
        display: flex;
        align-items: center;
        font-family: system-ui, -apple-system, sans-serif;
      `;

			const searchLabel = document.createElement("span");
			searchLabel.textContent = "Search: ";
			searchLabel.style.marginRight = "5px";

			const searchInput = document.createElement("input");
			searchInput.type = "text";
			searchInput.id = "byebyemouse-search-input";
			searchInput.style.cssText = `
        padding: 5px;
        border: none;
        border-radius: 3px;
        outline: none;
        width: 300px;
        font-size: 14px;
      `;

			const searchInfo = document.createElement("span");
			searchInfo.id = "byebyemouse-search-info";
			searchInfo.style.marginLeft = "10px";
			searchInfo.style.fontSize = "12px";
			searchInfo.style.opacity = "0.8";

			//build DOM structure
			state.searchBox.appendChild(searchLabel);
			state.searchBox.appendChild(searchInput);
			state.searchBox.appendChild(searchInfo);

			//event listeners
			searchInput.addEventListener("keydown", (event) => {
				if (event.key === "Enter" && state.searchModeActive) {
					if (state.currentHighlightedElement) {
						focusElement(state.currentHighlightedElement);
					}
					hideSearchBox();
					event.preventDefault();
					event.stopPropagation();
				} else if (event.key === "Escape") {
					exitSearchMode();
					event.preventDefault();
					event.stopPropagation();
				}
			});

			//debounced search
			searchInput.addEventListener(
				"input",
				debounce(() => {
					performSearch(searchInput.value);
				}, 300),
			);
		}

		//only inject styles once
		if (!document.getElementById("byebyemouse-styles")) {
			const style = document.createElement("style");
			style.id = "byebyemouse-styles";
			style.textContent = `
        .search-result {
          outline: 2px dashed #4d90fe !important;
          background-color: rgba(77, 144, 254, 0.1) !important;
        }
        .highlight-focus {
          outline: 2px solid #4d90fe !important;
          box-shadow: 0 0 5px rgba(77, 144, 254, 0.8) !important;
          background-color: rgba(77, 144, 254, 0.2) !important;
          transition: all 0.2s ease-in-out !important;
        }
      `;
			document.head.appendChild(style);
		}

		document.body.appendChild(state.searchBox);
		document.getElementById("byebyemouse-search-input").focus();
	};

	//hide search box
	const hideSearchBox = () => {
		if (state.searchBox && state.searchBox.parentNode) {
			state.searchBox.parentNode.removeChild(state.searchBox);
			state.searchModeActive = false;
		}
	};

	//exit search mode
	const exitSearchMode = () => {
		hideSearchBox();
		state.searchModeActive = false;
		clearHighlights();
		if (state.lastFocusedElement) {
			focusElement(state.lastFocusedElement);
		}
	};

	//perform search with optimized matching
	const performSearch = (searchText) => {
		clearHighlights();

		if (!searchText || searchText.trim() === "") {
			state.searchResults = [];
			updateSearchInfo();
			return;
		}

		const searchLower = searchText.toLowerCase();

		//cache all focusable elements for search
		state.focusableElements = getAllFocusableElements();

		//use efficient filtering with fewer DOM operations
		state.searchResults = state.focusableElements.filter((element) => {
			//check text content
			if (element.textContent.toLowerCase().includes(searchLower)) {
				return true;
			}

			//collect all attributes to check in one pass
			const attributes = {
				ariaLabel: element.getAttribute("aria-label"),
				title: element.getAttribute("title"),
				placeholder: element.getAttribute("placeholder"),
				value: element.value,
			};

			//check attributes
			for (const [_, value] of Object.entries(attributes)) {
				if (value && value.toLowerCase().includes(searchLower)) {
					return true;
				}
			}

			//check alt text for images more efficiently
			if (element.querySelectorAll) {
				const imgs = element.querySelectorAll("img[alt]");
				for (const img of imgs) {
					const alt = img.getAttribute("alt");
					if (alt && alt.toLowerCase().includes(searchLower)) {
						return true;
					}
				}
			}

			return false;
		});

		//batch DOM operations for highlighting
		requestAnimationFrame(() => {
			//highlight all matches
			state.searchResults.forEach((element) => {
				highlightElement(element, true);
			});

			//find which results are in viewport
			const visibleResults = state.searchResults.filter((element) => {
				const rect = element.getBoundingClientRect();
				return (
					rect.top >= 0 &&
					rect.left >= 0 &&
					rect.bottom <= window.innerHeight &&
					rect.right <= window.innerWidth
				);
			});

			//set index to first visible result or first result
			if (visibleResults.length > 0) {
				state.currentSearchIndex = state.searchResults.indexOf(
					visibleResults[0],
				);
			} else {
				state.currentSearchIndex = state.searchResults.length > 0 ? 0 : -1;
			}

			updateSearchInfo();

			//highlight current result
			if (state.currentSearchIndex >= 0) {
				highlightElement(state.searchResults[state.currentSearchIndex], false);
			}
		});
	};

	//update search info text
	const updateSearchInfo = () => {
		const infoElement = document.getElementById("byebyemouse-search-info");
		if (infoElement) {
			infoElement.textContent =
				state.searchResults.length > 0
					? `${state.currentSearchIndex + 1}/${
							state.searchResults.length
					  } matches`
					: "No matches";
		}
	};

	//navigate between search results
	const navigateSearchResults = (direction) => {
		if (state.searchResults.length === 0) {
			return;
		}

		if (direction === "next") {
			state.currentSearchIndex =
				(state.currentSearchIndex + 1) % state.searchResults.length;
		} else {
			state.currentSearchIndex =
				(state.currentSearchIndex - 1 + state.searchResults.length) %
				state.searchResults.length;
		}

		const element = state.searchResults[state.currentSearchIndex];

		//if in search mode, highlight; otherwise focus
		if (state.searchModeActive) {
			highlightElement(element, false);
			ensureElementIsVisible(element);
		} else {
			focusElement(element);
		}

		updateSearchInfo();
	};

	//find active element in viewport
	const findActiveElementInViewport = () => {
		const activeElement = document.activeElement;

		if (
			activeElement &&
			activeElement !== document.body &&
			activeElement !== document
		) {
			const rect = activeElement.getBoundingClientRect();
			const isInViewport =
				rect.top >= 0 &&
				rect.left >= 0 &&
				rect.bottom <= window.innerHeight &&
				rect.right <= window.innerWidth;

			if (isInViewport && isActuallyVisible(activeElement)) {
				return activeElement;
			}
		}

		return null;
	};

	//handle scrolling more efficiently
	const handleScroll = throttle((direction) => {
		const { scrollState } = state;

		if (!scrollState.isScrolling) {
			scrollState.isScrolling = true;
			scrollState.currentSpeed = 100; //reset speed on new scroll
		}

		//use requestAnimationFrame for smoother scrolling
		requestAnimationFrame(() => {
			scrollState.currentSpeed = Math.min(
				scrollState.currentSpeed * scrollState.acceleration,
				scrollState.maxSpeed,
			);

			window.scrollBy({
				top: direction * scrollState.currentSpeed,
				behavior: "smooth",
			});
		});
	}, 16); //~60fps

	//update navigation state
	const update = (enable) => {
		state.navigationEnabled = enable;

		if (!state.navigationEnabled) {
			//clean up when disabled
			if (state.lastFocusedElement) {
				state.lastFocusedElement.classList.remove("highlight-focus");
				state.lastFocusedElement = null;
			}
			hideSearchBox();
			clearHighlights();
			state.searchResults = [];
			state.currentSearchIndex = -1;
			console.log("Bye Bye Mouse disabled.");
		} else {
			//check if there's already an active element in the viewport
			const activeElement = findActiveElementInViewport();

			if (activeElement) {
				focusElement(activeElement);
			} else {
				handleHorizontalNavigation("l");
			}

			console.log("Bye Bye Mouse enabled (scroll/focus).");
		}
	};

	//clean up resources when navigation is no longer needed
	const cleanup = () => {
		//clear any remaining intervals
		if (state.scrollState.interval) {
			clearInterval(state.scrollState.interval);
			state.scrollState.interval = null;
		}

		//remove search box if it exists
		hideSearchBox();

		//clear highlights
		clearHighlights();
	};

	//key down event handler - consolidated to reduce event listeners
	const handleKeyDown = (event) => {
		if (!state.navigationEnabled) {
			return;
		}

		//skip if in search box (except for Enter/Escape which are handled separately)
		if (state.searchModeActive && !["Enter", "Escape"].includes(event.key)) {
			return;
		}

		//handle horizontal navigation keys (h, l)
		if (!state.searchModeActive && ["h", "l"].includes(event.key)) {
			handleHorizontalNavigation(event.key);
			event.preventDefault();
			event.stopPropagation();
			return;
		}

		//handle vertical scrolling keys (j, k)
		if (!state.searchModeActive && ["j", "k"].includes(event.key)) {
			event.preventDefault();
			event.stopPropagation();

			const direction = event.key === "j" ? 1 : -1;
			handleScroll(direction);

			if (!state.scrollState.interval) {
				state.scrollState.interval = setInterval(() => {
					handleScroll(direction);
				}, 200);
			}
			return;
		}

		switch (event.key) {
			case "f": //enter search mode
				if (!state.searchModeActive) {
					state.searchModeActive = true;
					if (state.lastFocusedElement) {
						state.lastFocusedElement.classList.remove("highlight-focus");
					}
					createSearchBox();
					event.preventDefault();
					event.stopPropagation();
				}
				break;

			case "n": //next search result
				if (state.searchResults.length > 0) {
					navigateSearchResults("next");
					event.preventDefault();
					event.stopPropagation();
				}
				break;

			case "N": //previous search result
				if (state.searchResults.length > 0) {
					navigateSearchResults("prev");
					event.preventDefault();
					event.stopPropagation();
				}
				break;

			case "Escape": //exit navigation
				state.searchResults = [];
				state.currentSearchIndex = -1;
				clearHighlights();
				browser.runtime.sendMessage({
					action: "updateBackgroundState",
					state: false,
				});
				event.preventDefault();
				event.stopPropagation();
				break;
		}
	};

	//handle key up event - mostly for scrolling
	const handleKeyUp = (event) => {
		if (["j", "k"].includes(event.key)) {
			if (state.scrollState.interval) {
				clearInterval(state.scrollState.interval);
				state.scrollState.interval = null;
				state.scrollState.currentSpeed = 100;
				state.scrollState.isScrolling = false;
			}
		}
	};

	//handle toggle navigation
	const handleToggle = (event) => {
		if (event.ctrlKey && event.key === " ") {
			browser.runtime.sendMessage({
				action: "updateBackgroundState",
				state: !state.navigationEnabled,
			});
			event.preventDefault();
			event.stopPropagation();
		}
	};

	//consolidated event listeners
	document.addEventListener("keydown", handleKeyDown);
	document.addEventListener("keyup", handleKeyUp);
	document.addEventListener("keydown", handleToggle);

	//message listener
	browser.runtime.onMessage.addListener((request) => {
		if (request.action === "updateContentState") {
			update(request.state);
		}
	});

	//initial state request
	browser.runtime.sendMessage({
		action: "updateBackgroundState",
		state: !state.navigationEnabled,
	});

	//clean up on page unload
	window.addEventListener("unload", cleanup);
})();
