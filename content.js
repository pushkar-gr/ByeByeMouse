(function () {
	//prevent multiple injections
	if (window.hasVimNavigation) {
		return;
	}
	window.hasVimNavigation = true;

	//dynamically import modules and initialize
	(async function () {
		try {
			const stateManagerModule = await import(
				browser.runtime.getURL("js/state-manager.js")
			);
			const StateManager = stateManagerModule.default;

			//initialize the extension
			StateManager.initialize();
			console.log("ByeByeMouse initialized successfully in navigation mode");
		} catch (error) {
			console.error("ByeByeMouse: Error loading modules:", error);
		}
	})();
})();
