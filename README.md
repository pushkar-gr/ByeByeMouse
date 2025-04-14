# ByeByeMouse

![License](https://img.shields.io/badge/License-MIT-green.svg)
![Firefox](https://img.shields.io/badge/Firefox-Compatible-FF7139)

A Firefox extension that enables mouse-free browsing with intuitive keyboard shortcuts, allowing you to navigate the web efficiently without reaching for your mouse.

## 🚀 Features

- **Focus Navigation**: Use `h` and `l` to move between focusable elements
- **Scrolling**: Use `j` and `k` to scroll down and up
- **Search**: Use `f` to activate find mode and `n`/`N` to navigate through results
- **Quick Toggle**: Use `Ctrl+Space` or extension popup to enable/disable functionality

## 📋 Installation

### From Firefox Add-ons Store
1. Visit the [ByeByeMouse Firefox Add-on page](https://addons.mozilla.org/en-US/firefox/addon/bye-bye-mouse/)
2. Click "Add to Firefox"
3. Grant the necessary permissions

### Manual Installation (Developer)
1. Clone this repository
   ```
   git clone https://github.com/pushkar-gr/ByeByeMouse.git
   ```
2. Open Firefox and navigate to `about:debugging`
3. Click "This Firefox"
4. Click "Load Temporary Add-on..."
5. Navigate to the cloned repository and select any file (like `manifest.json`)

## 🎮 Usage

After installation, ByeByeMouse will be active on all web pages. Use the following keyboard shortcuts:

| Shortcut | Action |
|----------|--------|
| `h` | Focus on previous element |
| `l` | Focus on next element |
| `j` | Scroll down |
| `k` | Scroll up |
| `f` | Activate find mode |
| `n` | Go to next search result |
| `N` | Go to previous search result |
| `Ctrl+Space` | Toggle extension on/off |

You can also enable/disable the extension by clicking its icon in the toolbar.

## 🧩 How It Works

ByeByeMouse intercepts keyboard events on web pages and translates them into navigation actions. It maintains focus management, scrolling behavior, and integrates with the browser's native find functionality.

## 🛠️ Development

### Project Structure

- `manifest.json`: Extension configuration
- `content.js`: Content script that runs on web pages
- `popup/`: Contains the extension popup UI
- `background.js`: Background script for extension-wide functionality

### Contributing

Contributions are welcome! Feel free to:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📜 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 👏 Acknowledgments

- Inspired by Vim-style keyboard navigation
- Thanks to all contributors who have helped shape this extension

---

Copyright © 2025 [pushkar-gr](https://github.com/pushkar-gr)
