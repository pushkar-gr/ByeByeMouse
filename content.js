(function (params) {
	if (window.hasVimNavigation) {
		return; //prevent multiple injections
	}
	window.hasVimNavigation = true;
	let navigationEnabled = false;
	let lastFocusedElement = null;
	let focusableElements = [];

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

	//get all the visible, interactive elements from the webpage that are not part of header/footer/navigation
	function getVisibleFocusableElements() {
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

			//check if the element is within the viewport
			if (
				rect.bottom < 0 ||
				rect.right < 0 ||
				rect.top > window.innerHeight ||
				rect.left > window.innerWidth
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
		}
	}

	//unfocus focused element and update lastFocusedElement
	function unfocusElement() {
		//check if there's a currently focused element
		if (lastFocusedElement) {
			//remove the highlight class
			lastFocusedElement.classList.remove("highlight-focus");

			//remove focus from the element
			lastFocusedElement.blur();
		}

		//blur document's active element if it exists
		if (document.activeElement && document.activeElement !== document.body) {
			document.activeElement.blur();
		}
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

		//foucs element
		elementToFocus = focusableElements[nextVisibleIndex];
		if (elementToFocus) {
			focusElement(elementToFocus);
			elementToFocus.scrollIntoView({ block: "nearest", inline: "nearest" });
		}
	}

	//handle user input
	function handleKeyDown(event) {
		if (!navigationEnabled) {
			return;
		}

		switch (event.key) {
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
				browser.runtime.sendMessage({
					action: "updateBackgroundState",
					state: false,
				});
				if (document.activeElement) {
					document.activeElement.blur();
				}
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
			console.log("Bye Bye Mouse disabled.");
		} else {
			handleHorizontalNavigation();
			console.log("Bye Bye Mouse enabled (scroll/focus).");
		}
	}

	//start scrolling
	document.addEventListener("keydown", (event) => {
		if (navigationEnabled && ["j", "k"].includes(event.key)) {
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
})();
