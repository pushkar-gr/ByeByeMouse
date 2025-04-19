//handles text input mode functionality
const TextMode = {
	stateManager: null,

	initialize(stateManager) {
		this.stateManager = stateManager;
	},

	enter() {},

	exit() {},

	cleanup() {},

	handleKeyDown(event) {
		if (["Escape", "Enter"].includes(event.key)) {
			this.stateManager.setState(this.stateManager.STATES.NAVIGATION);
			event.preventDefault();
			event.stopPropagation();
			return;
		}
	},

	handleKeyUp(event) {},

	handleFocusIn(event) {},
};

export default TextMode;
