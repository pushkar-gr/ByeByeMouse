import ElementUtils from "./element-utils.js";
import NavigationMode from "./navigation-mode.js";
import DomUtils from "./dom-utils.js";

//handles search/find mode functionality
const FindMode = {
	stateManager: null,
	searchBox: null,
	searchInfoBox: null,
	searchInput: null,

	initialize(stateManager) {
		this.stateManager = stateManager;
	},

	enter() {
		this.createSearchBox();
	},

	exit() {
		this.hideSearchBox();
	},

	cleanup() {
		this.exit();
		this.stateManager.searchResults = [];
		this.stateManager.currentSearchIndex = -1;
	},

	handleKeyDown(event) {
		if (event.key === "Escape") {
			this.stateManager.searchResults = [];
			document.querySelectorAll(".search-result").forEach((element) => {
				element.classList.remove("search-result");
			});
			this.stateManager.setState(this.stateManager.STATES.NAVIGATION);
			event.preventDefault();
			event.stopPropagation();
      return;
		}

		//search box input is handled by its own event listener
		if (event.key === "Enter") {
			if (this.stateManager.currentSearchIndex >= 0) {
				const element =
					this.stateManager.searchResults[this.stateManager.currentSearchIndex];
				if (element) {
					//focus selected element and switch to navigation mode
					this.stateManager.focusedElement = element;
				}
			}
			this.stateManager.setState(this.stateManager.STATES.NAVIGATION);
			event.preventDefault();
			event.stopPropagation();
			return;
		}
	},

	handleKeyUp(event) {
		//no specific key up handling needed for find mode
	},

	handleFocusIn(event) {
		//no specific focus handling needed for find mode
	},

	createSearchBox() {
		if (!this.searchBox) {
			//create elements once and reuse
			this.searchBox = document.createElement("div");
			this.searchBox.id = "byebyemouse-search";
			this.searchBox.style.cssText = `
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

			this.searchInput = document.createElement("input");
			this.searchInput.type = "text";
			this.searchInput.id = "byebyemouse-search-input";
			this.searchInput.style.cssText = `
        padding: 5px;
        border: none;
        border-radius: 3px;
        outline: none;
        width: 300px;
        font-size: 14px;
      `;

			this.searchInfoBox = document.createElement("span");
			this.searchInfoBox.id = "byebyemouse-search-info";
			this.searchInfoBox.style.marginLeft = "10px";
			this.searchInfoBox.style.fontSize = "12px";
			this.searchInfoBox.style.opacity = "0.8";

			//build DOM structure
			this.searchBox.appendChild(searchLabel);
			this.searchBox.appendChild(this.searchInput);
			this.searchBox.appendChild(this.searchInfoBox);

			//debounced search
			this.searchInput.addEventListener(
				"input",
				DomUtils.debounce(() => {
					this.performSearch(this.searchInput.value);
				}, 300),
			);
		}

		this.searchInput.value = "";
		document.body.appendChild(this.searchBox);
		document.getElementById("byebyemouse-search-input").focus();
	},

	//update search info in search box
	updateSearchInfo() {
		if (this.searchInfoBox) {
			this.searchInfoBox.textContent =
				this.stateManager.searchResults.length > 0
					? `${this.stateManager.currentSearchIndex + 1}/${
							this.stateManager.searchResults.length
					  } matches`
					: "No matches";
		}
	},

	hideSearchBox() {
		if (this.searchBox?.parentNode) {
			this.searchBox.parentNode.removeChild(this.searchBox);
		}
	},

	performSearch(searchText) {
		if (!searchText || searchText.trim() === "") {
			this.stateManager.searchResults = [];
			this.stateManager.currentSearchIndex = -1;
			this.updateSearchInfo();
			return;
		}

		const searchLower = searchText.toLowerCase();

		//get all focusable elements for search
		const allElements = ElementUtils.getAllFocusableElements();

		//use efficient filtering with fewer DOM operations
		this.stateManager.searchResults = allElements.filter((element) => {
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
				if (value?.toLowerCase().includes(searchLower)) {
					return true;
				}
			}

			//check alt text for images more efficiently
			if (element.querySelectorAll) {
				const imgs = element.querySelectorAll("img[alt]");
				for (const img of imgs) {
					const alt = img.getAttribute("alt");
					if (alt?.toLowerCase().includes(searchLower)) {
						return true;
					}
				}
			}

			return false;
		});

		NavigationMode.clearHighlights();
		//batch DOM operations for highlighting
		requestAnimationFrame(() => {
			//highlight all matches
			this.stateManager.searchResults.forEach((element) => {
				element.classList.add("search-result");
			});

			//find which results are in viewport
			const visibleResults = this.stateManager.searchResults.filter(
				(element) => {
					const rect = element.getBoundingClientRect();
					return (
						rect.top >= 0 &&
						rect.left >= 0 &&
						rect.bottom <= window.innerHeight &&
						rect.right <= window.innerWidth
					);
				},
			);

			//set index to first visible result or first result
			if (visibleResults.length > 0) {
				this.stateManager.currentSearchIndex =
					this.stateManager.searchResults.indexOf(visibleResults[0]);
			} else {
				this.stateManager.currentSearchIndex =
					this.stateManager.searchResults.length > 0 ? 0 : -1;
			}

			this.updateSearchInfo();
		});
	},
};

export default FindMode;
