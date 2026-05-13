// DOM injection from URL -> XSS
window.addEventListener("load", () => {
  const el = document.getElementById("output");
  const message = location.hash.slice(1);
  el.innerHTML = message; // unsafe: XSS if message contains markup
});
