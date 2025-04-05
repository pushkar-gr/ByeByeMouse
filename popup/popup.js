const toggleExtension = document.getElementById("toggleExtension");
const statusText = document.getElementById("statusText");
let currentTabId;

//update the popup UI based on the state
function updatePopup(state) {
	toggleExtension.checked = state;
	statusText.textContent = state ? "Enabled" : "Disabled";
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
		updatePopup(state);
	}
}

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
