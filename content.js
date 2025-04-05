(function (params) {
	if (window.hasVimNavigation) {
		return; //prevent multiple injections
	}
	window.hasVimNavigation = true;
	let navigationEnabled = false;
	let lastFocusedElement = null;
	let focusableElements = [];

	let scrollInterval = null;
	let currentSpeed = 100; // Base speed
	const acceleration = 1.2; // Speed multiplier per interval
	const maxSpeed = 800; // Maximum scroll speed
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
		return Array.from(document.querySelectorAll("a[href], button")).filter(
			(element) => {
				const rect = element.getBoundingClientRect();
				return (
					rect.width > 0 &&
					rect.height > 0 &&
					getComputedStyle(element).visibility !== "hidden" &&
					isElementInAllowedContent(element)
				);
			},
		);
	}

	//focus given element and update lastFocusedElement
	function focusElement(element) {
		if (element) {
			element.focus();
			lastFocusedElement = element;
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
			window.scrollBy(0, direction * currentSpeed);
			isScrolling = true;
		}

		currentSpeed = Math.min(currentSpeed * acceleration, maxSpeed);

		window.scrollBy(0, direction * currentSpeed);
	}

	//update navigation
	function update(enable) {
		navigationEnabled = enable;
		if (!navigationEnabled) {
			if (document.activeElement) {
				document.activeElement.blur();
			}
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
			console.log(
				"Content Script: Received updateState message:",
				request.state,
			);
			update(request.state);
		}
	});
})();
