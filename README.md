# ByeByeMouse

**Navigate Webpages Using Your Keyboard!**

Tired of constantly switching between your keyboard and mouse? ByeByeMouse lets you navigate and interact with web pages using only your keyboard, boosting your productivity and reducing strain.

## Features

* **Keyboard Navigation:**
    * `j`: Scroll down the page.
    * `k`: Scroll up the page.
    * `h`: Select the previous focusable element (links, buttons, input fields, etc.).
    * `l`: Select the next focusable element.
* **Toggle Navigation:**
    * Use the extension's popup icon to easily enable or disable keyboard navigation.
    * Alternatively, press `Ctrl + Space` (or `Cmd + Space` on macOS) to toggle navigation quickly.

## Installation (For Development/Testing)

**Firefox:**

1.  **Clone the Repository:**
    ```bash
    git clone <repository_url>
    cd ByeByeMouse
    ```
2.  **Open Firefox's Debugging Page:**
    * In Firefox, type `about:debugging#/runtime/this-firefox` in the address bar and press Enter.
3.  **Load Temporary Add-on:**
    * Click the "Load Temporary Add-on..." button.
    * Navigate to the cloned repository and select the `manifest.json` file.
4.  The extension is now installed and active. Note that temporary add-ons are removed when you close Firefox.

**Note:** For permanent installation, you will need to package the extension and submit it to the Firefox Add-ons store.

## Usage

1.  **Enable Navigation:**
    * Click the ByeByeMouse icon in your Firefox toolbar.
    * or press `Ctrl + Space` (or `Cmd + Space`).
2.  **Navigate:**
    * Use the `j`, `k`, `h`, and `l` keys to navigate the page as described in the "Features" section.
3.  **Disable Navigation:**
    * Click the ByeByeMouse icon again.
    * or press `Ctrl + Space` (or `Cmd + Space`).

## Future Enhancements

* **Customizable Keybindings:** Allow users to remap keyboard shortcuts.
* **Visual Indicators:** Provide clearer visual feedback for the currently focused element.
* **Search and Focus:** Implement a feature to search for and focus on specific elements.
* **More Granular Scrolling:** add pageUp, pageDown, home, and end functionality.
* **Clicking Functionality:** Add a key to simulate a mouse click on the focused element.
* **Cross Browser Support:** Add support for Chrome and other browsers.

## Contributing

Contributions are welcome! If you have ideas for improvements or find any issues, please feel free to:

* Open an issue on GitHub.
* Submit a pull request with your changes.

Let's make web navigation more efficient and accessible!
