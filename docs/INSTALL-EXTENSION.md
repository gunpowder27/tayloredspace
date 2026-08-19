# Install the TayloredSpace Chrome extension

TayloredSpace is currently distributed as a private alpha package. Chrome does not install ordinary ZIP files directly, so unzip the download first and load its extension folder in Developer mode.

## Install

1. Download `TayloredSpace-v0.1.0-alpha.2-Chrome.zip` from the [Alpha 2 release](https://github.com/gunpowder27/tayloredspace/releases/tag/v0.1.0-alpha.2).
2. Double-click the ZIP to unzip it.
3. In Chrome, open `chrome://extensions`.
4. Turn on **Developer mode** in the upper-right corner.
5. Select **Load unpacked**.
6. Choose the unzipped folder containing `manifest.json`.
7. Pin TayloredSpace from Chrome's Extensions menu for quick access.

## Use it

1. Open [TayloredSpace](https://tayloredspace.vercel.app/) in one tab.
2. Visit a product page in another tab.
3. Select the TayloredSpace extension and choose **Save to TayloredSpace**.
4. Return to the board. The product appears with its title, price, retailer, source link, and image when the retailer exposes them.

The first background cutout may take longer while the private on-device model is prepared. Later cutouts reuse the browser cache.

## Update or remove

- To update: download the newer package, replace the unzipped folder, then select **Reload** on `chrome://extensions`.
- To remove: select **Remove** on the TayloredSpace extension card in `chrome://extensions`.

## Public launch

The production distribution target is the Chrome Web Store. When approved there, the portfolio's **Install Extension** button can point to the store listing without changing the TayloredSpace card design.
