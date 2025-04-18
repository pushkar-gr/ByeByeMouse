import ElementUtils from "./element-utils.js";
import StateIndicator from "./state-indicator.js";
import NavigationMode from "./navigation-mode.js";
import FindMode from "./find-mode.js";
import TextMode from "./text-mode.js";

//manages extension states and transitions
const StateManager = {
	STATES: {
		DISABLED: "disabled",
		NAVIGATION: "navigation",
		FIND: "find",
		TEXT: "text",
	},

	currentState: "disabled",
	focusedElement: null,
	searchResults: [], //store search results for use across modes
	currentSearchIndex: -1, //current selected search result

	initialize() {
		//setup state indicator
		StateIndicator.initialize();

		//initialize modes
		NavigationMode.initialize(this);
		FindMode.initialize(this);
		TextMode.initialize(this);

		//listen for browser messages
		browser.runtime.onMessage.addListener((request) => {
			if (request.action === "updateContentState") {
				if (!request.state && this.currentState !== this.STATES.DISABLED) {
					this.setState(this.STATES.DISABLED);
				} else if (
					request.state &&
					this.currentState === this.STATES.DISABLED
				) {
					this.setState(this.STATES.NAVIGATION);
				}
			}
		});

		//enter navigation mode immediately
		this.setState(this.STATES.NAVIGATION);

		this.setupListeners();
	},

	setupListeners() {
		//global key listeners
		document.addEventListener("keydown", (event) => {
			//handle ctrl+space (toggle navigation)
			if (event.ctrlKey && event.key === " ") {
				this.toggleEnabled();
				event.preventDefault();
				event.stopPropagation();
				return;
			}

			//delegate to current mode handler
			switch (this.currentState) {
				case this.STATES.NAVIGATION:
					NavigationMode.handleKeyDown(event);
					break;
				case this.STATES.FIND:
					FindMode.handleKeyDown(event);
					break;
				case this.STATES.TEXT:
					TextMode.handleKeyDown(event);
					break;
			}
		});

		document.addEventListener("keyup", (event) => {
			//delegate to current mode handler
			switch (this.currentState) {
				case this.STATES.NAVIGATION:
					NavigationMode.handleKeyUp(event);
					break;
				case this.STATES.FIND:
					FindMode.handleKeyUp(event);
					break;
				case this.STATES.TEXT:
					TextMode.handleKeyUp(event);
					break;
			}
		});

		//detect focus changes
		document.addEventListener("focusin", (event) => {
			switch (this.currentState) {
				case this.STATES.NAVIGATION:
					NavigationMode.handleFocusIn(event);
					break;
				case this.STATES.FIND:
					FindMode.handleFocusIn(event);
					break;
				case this.STATES.TEXT:
					TextMode.handleFocusIn(event);
					break;
			}
		});

		//cleanup on unload
		window.addEventListener("unload", () => {
			NavigationMode.cleanup();
			FindMode.cleanup();
			TextMode.cleanup();
			StateIndicator.cleanup();
		});
	},

	setState(newState) {
		//exit current state
		switch (this.currentState) {
			case this.STATES.NAVIGATION:
				NavigationMode.exit();
				break;
			case this.STATES.FIND:
				FindMode.exit();
				break;
			case this.STATES.TEXT:
				TextMode.exit();
				break;
		}

		//enter new state
		this.currentState = newState;
		StateIndicator.updateState(newState);

		switch (newState) {
			case this.STATES.DISABLED:
				//update browser state
				browser.runtime.sendMessage({
					action: "updateBackgroundState",
					state: false,
				});
				break;
			case this.STATES.NAVIGATION:
				NavigationMode.enter();
				//update browser state
				browser.runtime.sendMessage({
					action: "updateBackgroundState",
					state: true,
				});
				break;
			case this.STATES.FIND:
				FindMode.enter();
				break;
			case this.STATES.TEXT:
				TextMode.enter();
				break;
		}
	},

	toggleEnabled(explicitState) {
		const newEnabled =
			explicitState !== undefined
				? explicitState
				: this.currentState === this.STATES.DISABLED;

		if (newEnabled && this.currentState === this.STATES.DISABLED) {
			this.setState(this.STATES.NAVIGATION);
		} else if (!newEnabled && this.currentState !== this.STATES.DISABLED) {
			this.setState(this.STATES.DISABLED);
		}
	},
};

export default StateManager;
