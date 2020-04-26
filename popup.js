import Scraper from "./scraper.js";

chrome.tabs.executeScript(
  {
    code: `[window.location.href, document.all[0].outerHTML]`
  },
  result => {
    !result[0][0].startsWith("chrome") &&
      new Scraper(result[0][0], result[0][1]).scrape().then(res => {
        !!res.title && (document.getElementById("name").innerText = res.title);
      });
  }
);

document.getElementById("add").addEventListener("click", e => {
  chrome.tabs.executeScript(
    {
      code: `!window.location.href.startsWith("chrome") &&
        chrome.storage.local.set({ newUrl: window.location.href }, () => {
          chrome.storage.local.set({ newDoc: document.all[0].outerHTML });
        });`
    },
    () => chrome.tabs.create({ url: "collection.html" })
  );
});

const analytics = ((i, s, o, g, r, a, m) => {
  i["GoogleAnalyticsObject"] = r;
  (i[r] =
    i[r] ||
    function() {
      (i[r].q = i[r].q || []).push(arguments);
    }),
    (i[r].l = 1 * new Date());
  (a = s.createElement(o)), (m = s.getElementsByTagName(o)[0]);
  a.async = 1;
  a.src = g;
  m.parentNode.insertBefore(a, m);
})(
  window,
  document,
  "script",
  "https://www.google-analytics.com/analytics.js",
  "ga"
); // Note: https protocol here

ga("create", "UA-145168497-1", "auto"); // Enter your GA identifier
ga("set", "checkProtocolTask", function() {}); // Removes failing protocol check. @see: http://stackoverflow.com/a/22152353/1958200
ga("require", "displayfeatures");
ga("send", "pageview", "/popup.html");
