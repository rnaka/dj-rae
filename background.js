console.log("background running");

chrome.contextMenus.create({
  title: "Add this Page to Wish List",
  contexts: ["page", "selection", "image", "link"], // link?
  onclick: function(e) {
    if (!e.pageUrl.startsWith("chrome")) {
      chrome.storage.local.set({ newUrl: e.pageUrl }, () => {
        chrome.tabs.executeScript(
          {
            code: `chrome.storage.local.set({ newDoc: document.all[0].outerHTML });`
          },
          () => {
            chrome.tabs.create({ url: "collection.html" });
          }
        );
      });
    } else {
      chrome.tabs.create({ url: "collection.html" });
    }
  }
});
