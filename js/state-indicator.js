//UI indicator for current state
const StateIndicator = {
	indicator: null,

	initialize() {
		//create state indicator
		this.indicator = document.createElement("div");
		this.indicator.id = "byebyemouse-state-indicator";
		this.indicator.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      padding: 8px 12px;
      border-radius: 4px;
      font-family: system-ui, -apple-system, sans-serif;
      font-size: 14px;
      color: white;
      z-index: 999999;
      transition: all 0.3s ease;
      opacity: 0;
      pointer-events: none;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
    `;

		document.body.appendChild(this.indicator);
	},

	updateState(state) {
		if (!this.indicator) return;

		const stateColors = {
			disabled: "#888888",
			navigation: "#4d90fe",
			find: "#ff9800",
			text: "#4caf50",
		};

		const stateLabels = {
			disabled: "Disabled",
			navigation: "Navigation",
			find: "Find",
			text: "Text Input",
		};

		this.indicator.style.backgroundColor = stateColors[state] || "#888888";
		this.indicator.textContent = stateLabels[state] || "Unknown";

		//show indicator with animation
		this.indicator.style.opacity = state === "disabled" ? "0" : "0.9";

		//auto hide after 2 seconds unless it's navigation mode
		if (state !== "navigation" && state !== "disabled") {
			setTimeout(() => {
				this.indicator.style.opacity = "0.3";
			}, 2000);
		}
	},

	cleanup() {
		if (this.indicator?.parentNode) {
			this.indicator.parentNode.removeChild(this.indicator);
			this.indicator = null;
		}
	},
};

export default StateIndicator;
