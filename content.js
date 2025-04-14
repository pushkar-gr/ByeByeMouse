(function (params) {
	if (window.hasVimNavigation) {
		return; //prevent multiple injections
	}
	window.hasVimNavigation = true;
	let navigationEnabled = false;
	let searchModeActive = false;
	let lastFocusedElement = null;
	let focusableElements = [];

	//search functionality variables
	let searchResults = [];
	let currentSearchIndex = -1;
	let searchBox = null;
	let currentHighlightedElement = null;

	let scrollInterval = null;
	let currentSpeed = 100; //base speed
	const acceleration = 1.2; //speed multiplier per interval
	const maxSpeed = 800; //maximum scroll speed
	let isScrolling = false;

	//check if element is a header/footer/navigation
	function isElementInAllowedContent(element) {
		const EXCLUDED_SELECTORS = [
			"header",
			"footer",
			"nav",
			'[role="banner"]', //common header role
			'[role="contentinfo"]', //common footer role
			'[role="navigation"]', //common nav role
		].join(", ");

		//check if element is outside all excluded areas
		return !element.closest(EXCLUDED_SELECTORS);
	}

	//get all focusable elements even if they're not visible in the viewport
	function getAllFocusableElements() {
		return Array.from(
			document.querySelectorAll(
				"a[href], button, input:not([type='hidden']), textarea, select, [contenteditable='true'], [tabindex]:not([tabindex='-1'])",
			),
		).filter((element) => {
			//check if in allowed content area
			if (!isElementInAllowedContent(element)) {
				return false;
			}

			//get the element's bounding rectangle
			const rect = element.getBoundingClientRect();

			//check basic visibility properties
			if (
				rect.width <= 0 ||
				rect.height <= 0 ||
				getComputedStyle(element).visibility === "hidden" ||
				getComputedStyle(element).display === "none" ||
				parseFloat(getComputedStyle(element).opacity) === 0
			) {
				return false;
			}

			//check if element is truly visible and not behind other elements
			if (!isActuallyVisible(element)) {
				return false;
			}

			return true;
		});
	}

	//get all the visible, interactive elements from the webpage that are in the viewport
	function getVisibleFocusableElements() {
		return getAllFocusableElements().filter((element) => {
			const rect = element.getBoundingClientRect();
			//check if the element is within the viewport
			return !(
				rect.bottom < 0 ||
				rect.right < 0 ||
				rect.top > window.innerHeight ||
				rect.left > window.innerWidth
			);
		});
	}

	//function to check if an element is actually visible to the user
	function isActuallyVisible(element) {
		const rect = element.getBoundingClientRect();

		//if element has zero dimensions, it's not visible
		if (rect.width === 0 || rect.height === 0) {
			return false;
		}

		//check all parent elements
		let parent = element.parentElement;
		while (parent && parent !== document.body) {
			const parentStyle = getComputedStyle(parent);

			//check if parent or any ancestor has properties that would hide the element
			if (
				parentStyle.display === "none" ||
				parentStyle.visibility === "hidden" ||
				parseFloat(parentStyle.opacity) === 0 ||
				(parentStyle.overflow === "hidden" &&
					!isInViewOfParent(element, parent))
			) {
				return false;
			}

			//special case for collapsed elements (like accordions, dropdowns)
			//check if parent has minimal height but element extends beyond it
			if (
				parent.clientHeight > 0 &&
				parent.clientHeight < 10 &&
				rect.height > parent.clientHeight
			) {
				return false;
			}

			//detect parents with aria attributes that indicate collapsed state
			if (
				parent.getAttribute("aria-expanded") === "false" ||
				parent.getAttribute("aria-hidden") === "true" ||
				parent.hasAttribute("hidden")
			) {
				return false;
			}

			parent = parent.parentElement;
		}

		//check if element is behind other elements (only visible elements at this point)
		const centerX = rect.left + rect.width / 2;
		const centerY = rect.top + rect.height / 2;

		//only check if the element is actually in the viewport
		if (
			centerX >= 0 &&
			centerX <= window.innerWidth &&
			centerY >= 0 &&
			centerY <= window.innerHeight
		) {
			//get the top-most element at the center point of our target
			const topElement = document.elementFromPoint(centerX, centerY);

			//if the element or any of its children isn't the top element, then it's covered
			if (
				topElement &&
				!element.contains(topElement) &&
				!topElement.contains(element)
			) {
				//check if the topmost element is a transparent overlay
				const topElStyle = getComputedStyle(topElement);
				if (parseFloat(topElStyle.opacity) > 0.1) {
					//allow slightly transparent overlays
					return false;
				}
			}
		}

		return true;
	}

	//check if element is within the visible part of a parent with overflow
	function isInViewOfParent(element, parent) {
		const elemRect = element.getBoundingClientRect();
		const parentRect = parent.getBoundingClientRect();

		return !(
			elemRect.top >= parentRect.bottom ||
			elemRect.bottom <= parentRect.top ||
			elemRect.left >= parentRect.right ||
			elemRect.right <= parentRect.left
		);
	}

	//focus given element and update lastFocusedElement
	function focusElement(element) {
		if (element) {
			//remove highlight from previously focused element
			if (lastFocusedElement) {
				lastFocusedElement.classList.remove("highlight-focus");
			}

			//add highlight to newly focused element
			element.classList.add("highlight-focus");

			//set focus on the element
			element.focus({ preventScroll: true });

			//update last focused element reference
			lastFocusedElement = element;

			//ensure the element is visible in the viewport
			ensureElementIsVisible(element);
		}
	}

	//ensure element is visible in viewport
	function ensureElementIsVisible(element) {
		const rect = element.getBoundingClientRect();

		//check if the element is outside the viewport
		if (
			rect.top < 0 ||
			rect.left < 0 ||
			rect.bottom > window.innerHeight ||
			rect.right > window.innerWidth
		) {
			//scroll the element into view
			element.scrollIntoView({
				block: "nearest",
				behavior: "smooth",
			});
		}
	}

	//highlight element without focusing it
	function highlightElement(element, isSearchResult = false) {
		if (element) {
			//add highlight class to the element
			if (isSearchResult) {
				element.classList.add("search-result");
			} else {
				//remove highlight from previously highlighted element
				if (currentHighlightedElement) {
					currentHighlightedElement.classList.remove("highlight-focus");
				}

				//add highlight to newly highlighted element
				element.classList.add("highlight-focus");

				//update highlighted element reference
				currentHighlightedElement = element;
			}
		}
	}

	//unfocus focused element and update lastFocusedElement
	function unfocusElement() {
		//check if there's a currently focused element
		if (lastFocusedElement) {
			//remove the highlight class
			lastFocusedElement.classList.remove("highlight-focus");
		}
	}

	//remove all highlights without changing focus
	function clearHighlights() {
		if (currentHighlightedElement) {
			currentHighlightedElement.classList.remove("highlight-focus");
			currentHighlightedElement = null;
		}

		//clear all search result highlights
		document.querySelectorAll(".search-result").forEach((element) => {
			element.classList.remove("search-result");
		});
	}

	//get element's relative position wrt to viewframe
	//above viewframe -> -1
	//in viewframe -> 0
	//below viewframe -> 1
	//none -> 2
	function getElementViewframePosition(element) {
		if (!element || !element.getBoundingClientRect) return 2;

		const rect = element.getBoundingClientRect();
		const ViewframeHeight =
			window.innerHeight || document.documentElement.clientHeight;

		//check if any part is vertically visible
		const topInView = rect.top <= ViewframeHeight;
		const bottomInView = rect.bottom >= 0;
		const isInView = topInView && bottomInView;

		if (isInView) return 0; //any vertical overlap
		if (rect.bottom < 0) return -1; //fully above
		if (rect.top > ViewframeHeight) return 1; //fully below

		return 2;
	}

	//navigate focus
	function handleHorizontalNavigation(direction) {
		//update focusable elements
		focusableElements = getVisibleFocusableElements();
		if (focusableElements.length === 0) {
			lastFocusedElement = null;
			return;
		}

		const startIndex = Math.max(
			focusableElements.indexOf(lastFocusedElement),
			0,
		);
		const relativePos = getElementViewframePosition(lastFocusedElement);
		let nextVisibleIndex = -1;

		if (direction === "l" || relativePos === -1) {
			for (let i = startIndex + 1; i < focusableElements.length; i++) {
				if (
					getElementViewframePosition(focusableElements[i]) === 0 &&
					focusableElements.includes(focusableElements[i])
				) {
					nextVisibleIndex = focusableElements.indexOf(focusableElements[i]);
					break;
				}
			}
		} else if (direction === "h" || relativePos === 1) {
			for (let i = startIndex - 1; i >= 0; i--) {
				if (
					getElementViewframePosition(focusableElements[i]) === 0 &&
					focusableElements.includes(focusableElements[i])
				) {
					const actualIndexInVisible = focusableElements.indexOf(
						focusableElements[i],
					);
					nextVisibleIndex =
						actualIndexInVisible !== -1
							? actualIndexInVisible
							: focusableElements.length > 0
							? focusableElements.length - 1
							: -1;
					break;
				}
			}
		}

		//element not found
		if (nextVisibleIndex === -1 && focusableElements.length > 0) {
			if (direction === "l") {
				nextVisibleIndex = 0;
			} else if (direction === "h") {
				nextVisibleIndex = focusableElements.length - 1;
			}
		}

		//focus element
		elementToFocus = focusableElements[nextVisibleIndex];
		if (elementToFocus) {
			focusElement(elementToFocus);
		}
	}

	//create search box UI
	function createSearchBox() {
		//create search container if it doesn't exist
		if (!searchBox) {
			searchBox = document.createElement("div");
			searchBox.id = "byebyemouse-search";
			searchBox.style.cssText = `
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

			//create search label
			const searchLabel = document.createElement("span");
			searchLabel.textContent = "Search: ";
			searchLabel.style.marginRight = "5px";
			searchBox.appendChild(searchLabel);

			//create input field
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
			searchBox.appendChild(searchInput);

			//add search info
			const searchInfo = document.createElement("span");
			searchInfo.id = "byebyemouse-search-info";
			searchInfo.style.marginLeft = "10px";
			searchInfo.style.fontSize = "12px";
			searchInfo.style.opacity = "0.8";
			searchBox.appendChild(searchInfo);

			//add keydown event listener to the input
			searchInput.addEventListener("keydown", (event) => {
				if (event.key === "Enter" && searchModeActive) {
					//focus the currently highlighted element
					if (currentHighlightedElement) {
						focusElement(currentHighlightedElement);
					}
					//hide search box but keep search results available for navigation
					hideSearchBox();
					event.preventDefault();
					event.stopPropagation();
				} else if (event.key === "Escape") {
					//exit search mode, return to navigation mode
					exitSearchMode();
					event.preventDefault();
					event.stopPropagation();
				}
			});

			//add input event to search as you type
			searchInput.addEventListener(
				"input",
				debounce(() => {
					performSearch(searchInput.value);
				}, 300),
			);
		}

		//insert styles for search results
		const style = document.createElement("style");
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

		document.body.appendChild(searchBox);
		document.getElementById("byebyemouse-search-input").focus();
	}

	//debounce function to limit how often a function is called
	function debounce(func, wait) {
		let timeout;
		return function executedFunction(...args) {
			const later = () => {
				clearTimeout(timeout);
				func(...args);
			};
			clearTimeout(timeout);
			timeout = setTimeout(later, wait);
		};
	}

	//hide search box
	function hideSearchBox() {
		if (searchBox && searchBox.parentNode) {
			searchBox.parentNode.removeChild(searchBox);
			searchModeActive = false;
		}
	}

	//exit search mode and return to navigation
	function exitSearchMode() {
		hideSearchBox();
		searchModeActive = false;
		clearHighlights();
		if (lastFocusedElement) {
			focusElement(lastFocusedElement);
		}
	}

	//perform search based on input text
	function performSearch(searchText) {
		//clear any existing highlights
		clearHighlights();

		if (!searchText || searchText.trim() === "") {
			searchResults = [];
			updateSearchInfo();
			return;
		}

		const searchLower = searchText.toLowerCase();

		//search through ALL focusable elements, not just those in the viewport
		focusableElements = getAllFocusableElements();

		searchResults = focusableElements.filter((element) => {
			//check text content
			const text = element.textContent.toLowerCase();
			if (text.includes(searchLower)) {
				return true;
			}

			//check aria-label
			const ariaLabel = element.getAttribute("aria-label");
			if (ariaLabel && ariaLabel.toLowerCase().includes(searchLower)) {
				return true;
			}

			//check title
			const title = element.getAttribute("title");
			if (title && title.toLowerCase().includes(searchLower)) {
				return true;
			}

			//check alt text for images
			const imgElements = element.querySelectorAll("img");
			for (const img of imgElements) {
				const alt = img.getAttribute("alt");
				if (alt && alt.toLowerCase().includes(searchLower)) {
					return true;
				}
			}

			//check placeholder for inputs
			const placeholder = element.getAttribute("placeholder");
			if (placeholder && placeholder.toLowerCase().includes(searchLower)) {
				return true;
			}

			//check value for inputs
			const value = element.value;
			if (value && value.toLowerCase().includes(searchLower)) {
				return true;
			}

			return false;
		});

		//highlight ALL matching elements with search-result class
		searchResults.forEach((element) => {
			highlightElement(element, true);
		});

		//find which results are currently in viewport
		const visibleResults = searchResults.filter((element) => {
			const rect = element.getBoundingClientRect();
			return (
				rect.top >= 0 &&
				rect.left >= 0 &&
				rect.bottom <= window.innerHeight &&
				rect.right <= window.innerWidth
			);
		});

		//set index to first result in viewport if any, otherwise the first result
		if (visibleResults.length > 0) {
			currentSearchIndex = searchResults.indexOf(visibleResults[0]);
		} else {
			currentSearchIndex = searchResults.length > 0 ? 0 : -1;
		}

		updateSearchInfo();

		//highlight the current result with the main highlight
		if (currentSearchIndex >= 0) {
			highlightElement(searchResults[currentSearchIndex], false);
		}
	}

	//update the search info text
	function updateSearchInfo() {
		const infoElement = document.getElementById("byebyemouse-search-info");
		if (infoElement) {
			if (searchResults.length > 0) {
				infoElement.textContent = `${currentSearchIndex + 1}/${
					searchResults.length
				} matches`;
			} else {
				infoElement.textContent = "No matches";
			}
		}
	}

	//navigate to next/previous search result
	function navigateSearchResults(direction) {
		if (searchResults.length === 0) {
			return;
		}

		if (direction === "next") {
			currentSearchIndex = (currentSearchIndex + 1) % searchResults.length;
		} else {
			currentSearchIndex =
				(currentSearchIndex - 1 + searchResults.length) % searchResults.length;
		}

		const element = searchResults[currentSearchIndex];

		//if in search mode, only highlight; otherwise focus
		if (searchModeActive) {
			highlightElement(element, false);
			//make sure the element is visible even in search mode
			ensureElementIsVisible(element);
		} else {
			focusElement(element);
		}

		updateSearchInfo();
	}

	//Find the currently active element in the viewport
	function findActiveElementInViewport() {
		const activeElement = document.activeElement;

		//Check if there's an active element and it's not the body or document
		if (
			activeElement &&
			activeElement !== document.body &&
			activeElement !== document
		) {
			//Check if it's visible and in the viewport
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
	}

	//handle user input
	function handleKeyDown(event) {
		if (!navigationEnabled) {
			return;
		}

		//if in search mode, don't process navigation keys
		if (searchModeActive) {
			return;
		}

		switch (event.key) {
			case "f": //enter search mode
				searchModeActive = true;
				//store current focused element to return to later
				if (lastFocusedElement) {
					lastFocusedElement.classList.remove("highlight-focus");
				}
				createSearchBox();
				event.preventDefault();
				event.stopPropagation();
				break;
			case "n": //next search result
				if (searchResults.length > 0) {
					navigateSearchResults("next");
					event.preventDefault();
					event.stopPropagation();
				}
				break;
			case "N": //previous search result
				if (searchResults.length > 0) {
					navigateSearchResults("prev");
					event.preventDefault();
					event.stopPropagation();
				}
				break;
			case "l": //select next element
				handleHorizontalNavigation("l");
				event.preventDefault();
				event.stopPropagation();
				break;
			case "h": //select previous element
				handleHorizontalNavigation("h");
				event.preventDefault();
				event.stopPropagation();
				break;
			case "Escape": //exit navigation
				//clear search results when exiting navigation
				searchResults = [];
				currentSearchIndex = -1;
				clearHighlights();
				browser.runtime.sendMessage({
					action: "updateBackgroundState",
					state: false,
				});
				event.preventDefault();
				event.stopPropagation();
				break;
		}
	}

	//handle scrolling
	function handleScroll(direction) {
		if (!isScrolling) {
			window.scrollBy({
				top: direction * currentSpeed,
				behavior: "smooth",
			});
			isScrolling = true;
		}

		currentSpeed = Math.min(currentSpeed * acceleration, maxSpeed);

		window.scrollBy({
			top: direction * currentSpeed,
			behavior: "smooth",
		});
	}

	//update navigation
	function update(enable) {
		navigationEnabled = enable;
		if (!navigationEnabled) {
			unfocusElement();
			hideSearchBox();
			clearHighlights();
			searchResults = [];
			currentSearchIndex = -1;
			console.log("Bye Bye Mouse disabled.");
		} else {
			//check if there's already an active element in the viewport
			const activeElement = findActiveElementInViewport();

			if (activeElement) {
				//if there's an active element, focus it
				focusElement(activeElement);
			} else {
				//otherwise, use the default navigation behavior
				handleHorizontalNavigation();
			}

			console.log("Bye Bye Mouse enabled (scroll/focus).");
		}
	}

	//start scrolling
	document.addEventListener("keydown", (event) => {
		if (
			navigationEnabled &&
			!searchModeActive &&
			["j", "k"].includes(event.key)
		) {
			event.preventDefault();
			event.stopPropagation();

			const direction = event.key === "j" ? 1 : -1;

			if (!scrollInterval) {
				currentSpeed = 100; //reset speed on new key press
				handleScroll(direction);

				scrollInterval = setInterval(() => {
					handleScroll(direction);
				}, 200); //update speed every 200ms
			}
		}
	});

	//stop scrolling
	document.addEventListener("keyup", (event) => {
		if (["j", "k"].includes(event.key)) {
			if (scrollInterval) {
				clearInterval(scrollInterval);
				scrollInterval = null;
				currentSpeed = 100;
				isScrolling = false;
			}
		}
	});

	//listen to user input
	document.addEventListener("keydown", handleKeyDown);

	//toggle navigation
	document.addEventListener("keydown", (event) => {
		if (event.ctrlKey && event.key === " ") {
			browser.runtime.sendMessage({
				action: "updateBackgroundState",
				state: !navigationEnabled,
			});
			event.preventDefault();
			event.stopPropagation();
		}
	});

	browser.runtime.onMessage.addListener((request) => {
		if (request.action === "updateContentState") {
			update(request.state);
		}
	});

	browser.runtime.sendMessage({
		action: "updateBackgroundState",
		state: !navigationEnabled,
	});
})();
