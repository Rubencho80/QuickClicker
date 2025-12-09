# QuickClicker
A Chrome Web Store extension. Find and click elements on any page just by typing.

My extensions website: https://sites.google.com/view/extensiones-rubencho80

A tiny floating search widget that detects links and buttons containing the text you type, highlights them and lets you navigate with the keyboard to activate them with Enter.

## What it does

- Searches the page for clickable elements (links, buttons, inputs) by the text you type.
- Highlights matches and shows which one is selected.
- Activates the selected element with Enter.
- Navigate results with Tab or ↓/↑.
- Configurable shortcut to open/hide the widget (default: -). Works even if “Open automatically” is enabled.
- Options: open automatically on page load, include attribute search (title, aria-label, placeholder), language (EN / ES).


## How to use it

- Open/hide: click the extension icon or press the configured key (default  - ) to toggle the widget.
If Open automatically is enabled, the widget appears on page load but the key still toggles it.

- Type what you’re looking for in the widget’s field. The extension will search visible matches on the page.

- Navigate: use Tab or ↓ to move forward (or ↑ to go back). Press Enter to click the selected element.


## Privacy & permissions

Permissions required: activeTab, storage.
- storage: to save your preferences.
- activeTab/content script: to inject the widget and find elements on pages you visit.

We do not send data to external servers. All searches and highlights happen locally in your browser.
The extension cannot access cross-origin iframes (standard browser security limitation).


## Known limitations

- Cannot inspect elements inside cross-origin iframes (browser security).
- Some pages that block script injection or have very strict protections may not work properly.
- Elements implemented in unusual ways (no cursor:pointer, no accessible roles) might not be detected by the heuristics — enabling Include attributes can help.
