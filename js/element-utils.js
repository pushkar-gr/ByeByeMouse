import DomUtils from "./dom-utils.js";

//utilities for element operations and visibility
const ElementUtils = {
	//efficiently check element visibility
	isActuallyVisible: (() => {
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
	})(),

	isElementInAllowedContent: (element) => {
		return !element.closest(DomUtils.SELECTORS.excluded);
	},

	getElementViewframePosition: (element) => {
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
	},

	ensureElementIsVisible: function (element) {
		return DomUtils.throttle((element) => {
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
		}, 50)(element);
	},

	//efficiently get all focusable elements
	getAllFocusableElements: DomUtils.memoize(() => {
		const allElements = Array.from(
			document.querySelectorAll(DomUtils.SELECTORS.focusable),
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
					ElementUtils.isElementInAllowedContent(element) &&
					rect.width > 0 &&
					rect.height > 0 &&
					style.visibility !== "hidden" &&
					style.display !== "none" &&
					parseFloat(style.opacity) > 0 &&
					ElementUtils.isActuallyVisible(element),
			)
			.map((data) => data.element);
	}, 300),

	//get only elements in viewport
	getVisibleFocusableElements: DomUtils.memoize(() => {
		//reuse already computed focusable elements
		const elements = ElementUtils.getAllFocusableElements();
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
	}, 300),

	//check if element is a text input
	isTextInput: (element) => {
		if (!element) return false;
		return element.matches(DomUtils.SELECTORS.textInput);
	},

	//find active element in viewport
	findActiveElementInViewport: () => {
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

			if (isInViewport && ElementUtils.isActuallyVisible(activeElement)) {
				return activeElement;
			}
		}

		return null;
	},
};

export default ElementUtils;
