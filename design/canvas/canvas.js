/* ============================================================================
   canvas.js — shared canvas behaviour
   1. ?embed  -> strips chrome (adds <html class="embed">) so an iframe shows
                 only the artefact at the iframe's own width.
   2. injects the mandatory responsive-verification block (7 breakpoints) into
      any element carrying [data-rv], per RULE ZERO / design-requirements §0.
   No styling values live here — all visuals come from tokens.css / base.css.
   ========================================================================== */
(function () {
  "use strict";

  // -- 1. embed mode: run immediately (script is loaded blocking in <head>) ---
  var params = new URLSearchParams(window.location.search);
  var isEmbed = params.has("embed");
  if (isEmbed) {
    document.documentElement.classList.add("embed");
  }

  // -- 2. inject responsive-verification block --------------------------------
  // The seven mandated breakpoints (design-requirements.md §0 / RULE ZERO).
  var BREAKPOINTS = [
    { w: 320,  h: 600,  label: "320 px · mobile S" },
    { w: 640,  h: 760,  label: "640 px · mobile L" },
    { w: 768,  h: 860,  label: "768 px · tablet" },
    { w: 1024, h: 860,  label: "1024 px · small desktop" },
    { w: 1280, h: 880,  label: "1280 px · desktop" },
    { w: 1440, h: 880,  label: "1440 px · wide" },
    { w: 2560, h: 1100, label: "2560 px · ultra-wide" }
  ];

  function buildVerification(host) {
    if (isEmbed) return; // never nest the harness inside an embed

    var base = window.location.pathname;

    var h2 = document.createElement("h2");
    h2.textContent = "Responsive verification — every breakpoint";

    var p = document.createElement("p");
    p.innerHTML = "Per RULE ZERO and <code>design-requirements.md</code> §0. " +
      "The same artefact rendered at 320 · 640 · 768 · 1024 · 1280 · 1440 · 2560 px. " +
      "Scroll the rail sideways — no resizing needed.";

    var rail = document.createElement("div");
    rail.className = "rv-rail";

    BREAKPOINTS.forEach(function (bp) {
      var fig = document.createElement("figure");
      var cap = document.createElement("figcaption");
      cap.textContent = bp.label;
      var frame = document.createElement("iframe");
      frame.setAttribute("src", base + "?embed&width=" + bp.w);
      frame.setAttribute("width", bp.w);
      frame.setAttribute("height", bp.h);
      frame.setAttribute("loading", "lazy");
      frame.setAttribute("title", bp.label);
      fig.appendChild(cap);
      fig.appendChild(frame);
      rail.appendChild(fig);
    });

    host.classList.add("responsive-verification");
    host.appendChild(h2);
    host.appendChild(p);
    host.appendChild(rail);
  }

  function init() {
    var host = document.querySelector("[data-rv]");
    if (host) buildVerification(host);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
