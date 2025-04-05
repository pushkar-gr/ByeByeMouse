const tabStates = {}; //object to store the state for each tab (key: tabId, value: boolean)

//get the current state for a tab
async function getTabState(tabId) {
	return tabStates[tabId] || false; //default to disabled
}

//set the state for a tab and notify content script and popup
async function setTabState(tabId, newState) {
	tabStates[tabId] = newState;
	//notify content script in that tab
	try {
		await browser.tabs.sendMessage(tabId, {
			action: "updateContentState",
			state: newState,
		});
	} catch (error) {
		//ignore errors if the tab is no longer active
	}
}

//listen for messages from content scripts and popup
browser.runtime.onMessage.addListener(async (request, sender) => {
	if (request.action === "getInitialState") {
		if (sender.tab && sender.tab.id !== undefined) {
			return getTabState(sender.tab.id);
		}
	} else if (request.action === "updateBackgroundState") {
		if (
			sender.tab &&
			sender.tab.id !== undefined &&
			typeof request.state === "boolean"
		) {
			await setTabState(sender.tab.id, request.state);
		}
	} else if (request.action === "getStateForPopup") {
		const tabId = request.tabId;
		if (tabId !== undefined) {
			return getTabState(tabId);
		}
	} else if (request.action === "setStateFromPopup") {
		const tabId = request.tabId;
		const newState = request.state;
		if (tabId !== undefined && typeof newState === "boolean") {
			await setTabState(tabId, newState);
		}
	}
});

//when a tab is closed, remove its state
browser.tabs.onRemoved.addListener((tabId) => {
	delete tabStates[tabId];
});
