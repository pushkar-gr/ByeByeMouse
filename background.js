const tabStates = {}; //object to store the state for each tab (key: tabId, value: string)

//get the current state for a tab
async function getTabState(tabId) {
	return tabStates[tabId] || "navigation"; //default to navigation
}

//set the state for a tab and notify content script
async function setTabState(tabId, newState) {
	tabStates[tabId] = newState;
	//notify content script in that tab
	try {
		await browser.tabs.sendMessage(tabId, {
			action: "updateContentState",
			state: newState !== "disabled", // convert to boolean for compatibility
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
		if (sender.tab && sender.tab.id !== undefined) {
			// Convert boolean to state string
			const newState = request.state ? "navigation" : "disabled";
			await setTabState(sender.tab.id, newState);
			return { success: true };
		}
	} else if (request.action === "updateState") {
		if (
			sender.tab &&
			sender.tab.id !== undefined &&
			typeof request.state === "string"
		) {
			await setTabState(sender.tab.id, request.state);
			return { success: true };
		}
	} else if (request.action === "getStateForPopup") {
		const tabId = request.tabId;
		if (tabId !== undefined) {
			const state = await getTabState(tabId);
			return state !== "disabled"; // convert to boolean for popup
		}
	} else if (request.action === "setStateFromPopup") {
		const tabId = request.tabId;
		const newState = request.state ? "navigation" : "disabled";
		if (tabId !== undefined) {
			await setTabState(tabId, newState);
		}
	}
});

//when a tab is closed, remove its state
browser.tabs.onRemoved.addListener((tabId) => {
	delete tabStates[tabId];
});

//handle keyboard shortcut
browser.commands.onCommand.addListener(async (command) => {
	if (command === "toggle-navigation") {
		const tabs = await browser.tabs.query({
			active: true,
			currentWindow: true,
		});
		if (tabs.length > 0) {
			const tabId = tabs[0].id;
			const currentState = await getTabState(tabId);
			const newState = currentState === "disabled" ? "navigation" : "disabled";
			await setTabState(tabId, newState);
		}
	}
});
