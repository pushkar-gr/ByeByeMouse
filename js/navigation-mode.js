import ElementUtils from "./element-utils.js";
import DomUtils from "./dom-utils.js";

//handles navigation mode functionality
const NavigationMode = {
	stateManager: null,
	focusableElements: [],
	scrollState: {
		interval: null,
		currentSpeed: 100, //base speed
		acceleration: 1.2, //speed multiplier per interval
		maxSpeed: 800, //maximum scroll speed
		isScrolling: false,
	},

	initialize(stateManager) {
		this.stateManager = stateManager;
	},

	enter() {
		//check if there's already an active element in the viewport
		const activeElement = ElementUtils.findActiveElementInViewport();

		if (activeElement) {
			this.focusElement(activeElement);
		} else if (
			ElementUtils.isActuallyVisible(this.stateManager.focusedElement)
		) {
			this.focusElement(this.stateManager.focusedElement);
		} else {
			this.handleHorizontalNavigation("l");
		}
	},

	exit() {
		//stop any scrolling
		if (this.scrollState.interval) {
			clearInterval(this.scrollState.interval);
			this.scrollState.interval = null;
			this.scrollState.isScrolling = false;
		}

		this.clearHighlights();
	},

	cleanup() {
		this.exit();
	},

	clearHighlights() {
		requestAnimationFrame(() => {
			//clear search result highlighting
			document.querySelectorAll(".search-result").forEach((element) => {
				element.classList.remove("search-result");
			});

			//clear current highlighted element
			document.querySelectorAll(".highlight-focus").forEach((element) => {
				element.classList.remove("highlight-focus");
			});
		});
	},

	handleKeyDown(event) {
		if (event.key === "Escape") {
			this.stateManager.setState(this.stateManager.STATES.DISABLED);
			event.preventDefault();
			event.stopPropagation();
			return;
		}

		if (event.key === "f") {
			this.stateManager.setState(this.stateManager.STATES.FIND);
			event.preventDefault();
			event.stopPropagation();
			return;
		}

		//handle horizontal navigation keys (h, l)
		if (["h", "l"].includes(event.key)) {
			this.handleHorizontalNavigation(event.key);
			event.preventDefault();
			event.stopPropagation();
			return;
		}

		//handle vertical scrolling keys (j, k)
		if (["j", "k"].includes(event.key)) {
			event.preventDefault();
			event.stopPropagation();

			const direction = event.key === "j" ? 1 : -1;
			this.handleScroll(direction);

			if (!this.scrollState.interval) {
				this.scrollState.interval = setInterval(() => {
					this.handleScroll(direction);
				}, 200);
			}
			return;
		}

		//handle search result navigation (n, N)
		if (["n", "N"].includes(event.key)) {
			if (
				this.stateManager.searchResults &&
				this.stateManager.searchResults.length > 0
			) {
				const direction = event.key === "n" ? "next" : "prev";
				this.navigateSearchResults(direction);
				event.preventDefault();
				event.stopPropagation();
			}
		}
	},

	handleKeyUp(event) {
		if (["j", "k"].includes(event.key)) {
			if (this.scrollState.interval) {
				clearInterval(this.scrollState.interval);
				this.scrollState.interval = null;
				this.scrollState.currentSpeed = 100;
				this.scrollState.isScrolling = false;
			}
		}
	},

	handleFocusIn(event) {
		//no specific focus handling needed for navigation mode
	},

	handleScroll(direction) {
		if (!this.scrollState.isScrolling) {
			this.scrollState.isScrolling = true;
			this.scrollState.currentSpeed = 100; //reset speed on new scroll
		}

		//use requestAnimationFrame for smoother scrolling
		requestAnimationFrame(() => {
			this.scrollState.currentSpeed = Math.min(
				this.scrollState.currentSpeed * this.scrollState.acceleration,
				this.scrollState.maxSpeed,
			);

			window.scrollBy({
				top: direction * this.scrollState.currentSpeed,
				behavior: "smooth",
			});
		});
	},

	handleHorizontalNavigation(direction) {
		//get fresh list of visible elements
		this.focusableElements = ElementUtils.getVisibleFocusableElements();

		if (this.focusableElements.length === 0) {
			this.stateManager.focusedElement = null;
			return;
		}

		const startIndex = Math.max(
			this.focusableElements.indexOf(this.stateManager.focusedElement),
			0,
		);
		const relativePos = ElementUtils.getElementViewframePosition(
			this.stateManager.focusedElement,
		);
		let nextVisibleIndex = -1;

		//determine which element to focus next
		if (direction === "l" || relativePos === -1) {
			for (let i = startIndex + 1; i < this.focusableElements.length; i++) {
				if (
					ElementUtils.getElementViewframePosition(
						this.focusableElements[i],
					) === 0
				) {
					nextVisibleIndex = i;
					break;
				}
			}
		} else if (direction === "h" || relativePos === 1) {
			for (let i = startIndex - 1; i >= 0; i--) {
				if (
					ElementUtils.getElementViewframePosition(
						this.focusableElements[i],
					) === 0
				) {
					nextVisibleIndex = i;
					break;
				}
			}
		}

		//default to first/last if needed
		if (nextVisibleIndex === -1 && this.focusableElements.length > 0) {
			nextVisibleIndex =
				direction === "l" ? 0 : this.focusableElements.length - 1;
		}

		//focus the element
		const elementToFocus = this.focusableElements[nextVisibleIndex];
		if (elementToFocus) {
			this.focusElement(elementToFocus);
		}
	},

	focusElement(element) {
		if (!element) return;

		//remove highlight from previously focused element
		if (this.stateManager.focusedElement) {
			this.stateManager.focusedElement.classList.remove("highlight-focus");
		}

		//update reference
		this.stateManager.focusedElement = element;

		//add highlight to newly focused element
		element.classList.add("highlight-focus");

		//set focus without scrolling
		element.focus({ preventScroll: true });

		//ensure element is visible
		ElementUtils.ensureElementIsVisible(element);
	},

	//navigate between search results
	navigateSearchResults(direction) {
		const searchResults = this.stateManager.searchResults || [];
		let currentSearchIndex = this.stateManager.searchResults.indexOf(
			this.stateManager.focusedElement,
		);

		if (
			currentSearchIndex === -1 &&
			this.stateManager.currentSearchIndex !== null
		) {
			currentSearchIndex = this.stateManager.currentSearchIndex;
		}

		if (searchResults.length === 0) {
			return;
		}

		if (direction === "next") {
			currentSearchIndex = (currentSearchIndex + 1) % searchResults.length;
		} else {
			currentSearchIndex = currentSearchIndex - 1;
			if (currentSearchIndex < 0) {
				currentSearchIndex = searchResults.length - 1;
			}
		}

		const element = searchResults[currentSearchIndex];

		this.focusElement(element);
		this.stateManager.currentSearchIndex = currentSearchIndex;
	},
};

export default NavigationMode;
