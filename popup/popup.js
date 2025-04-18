const toggleExtension = document.getElementById("toggleExtension");
const statusText = document.getElementById("statusText");
const stateIndicator = document.getElementById("stateIndicator");
let currentTabId;

//update the popup UI based on the state
function updatePopup(state) {
	const isEnabled = state !== "disabled";
	toggleExtension.checked = isEnabled;

	//update status text and indicator based on the state
	if (state === "disabled") {
		statusText.textContent = "Disabled";
		stateIndicator.className = "state-indicator disabled";
	} else {
		statusText.textContent = `${
			state.charAt(0).toUpperCase() + state.slice(1)
		} Mode`;
		stateIndicator.className = `state-indicator ${state}`;
	}
}

//get the current tab ID and initial state when the popup opens
async function initializePopup() {
	const currentTabs = await browser.tabs.query({
		active: true,
		currentWindow: true,
	});
	if (currentTabs && currentTabs.length > 0) {
		currentTabId = currentTabs[0].id;
		const state = await browser.runtime.sendMessage({
			action: "getStateForPopup",
			tabId: currentTabId,
		});

		//convert boolean response to state string for backward compatibility
		const stateString =
			typeof state === "boolean" ? (state ? "navigation" : "disabled") : state;

		updatePopup(stateString);
	}
}

//initialize popup when loaded
initializePopup();

//listen for changes on the toggle switch
toggleExtension.addEventListener("change", async () => {
	if (currentTabId !== undefined) {
		await browser.runtime.sendMessage({
			action: "setStateFromPopup",
			tabId: currentTabId,
			state: toggleExtension.checked,
		});
		window.close();
	}
});

//add keyboard shortcut reminder to popup
document.getElementById("shortcutInfo").textContent =
	"Shortcut: Ctrl+Space to toggle, ESC to exit";

//add state information
document.getElementById("stateInfo").innerHTML =
	"<strong>States:</strong> Navigation (default), Find (f), Text (when typing)";
