/* ============================================================================
   admin-shell.js — injects the shared admin sidebar + topbar.
   Each screen sets <body data-active="properties" data-crumb="Properties">
   and provides only:  <div class="app"><div class="main">
                         <div class="content">…</div></div></div>
   Loaded after canvas.js. Highlights the active nav item.
   ========================================================================== */
(function () {
  "use strict";

  var NAV = [
    { id: "dashboard", label: "Dashboard", href: "dashboard-overview.html", icon: '<rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/>' },
    { id: "properties", label: "Properties", href: "property-list.html", icon: '<path d="M3 11 12 4l9 7"/><path d="M5 10v9h14v-9"/>' },
    { id: "enquiries", label: "Enquiries", href: "enquiries-queue.html", pip: "12", icon: '<path d="M4 4h16v4H4zM4 12h16v8H4z"/>' },
    { id: "calendar", label: "Calendar", href: "calendar.html", icon: '<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>' },
    { id: "repairs", label: "Repairs", href: "repair-inbox.html", pip: "3", icon: '<path d="M14 7l-1.5-2h-9v14h17V7z"/>' },
    { id: "contacts", label: "Contacts", href: "contacts.html", icon: '<circle cx="9" cy="8" r="3"/><path d="M3 20a6 6 0 0 1 12 0"/><path d="M16 11h5M18.5 8.5v5"/>' },
    { sect: "Configure" },
    { id: "pages", label: "Pages", href: "page-builder.html", icon: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/>' },
    { id: "settings", label: "Settings", href: "settings.html", icon: '<circle cx="12" cy="12" r="3"/><path d="M19.4 13a7.6 7.6 0 0 0 0-2l2-1.5-2-3.4-2.3 1a7.6 7.6 0 0 0-1.7-1L15 3h-4l-.4 2.6a7.6 7.6 0 0 0-1.7 1l-2.3-1-2 3.4 2 1.5a7.6 7.6 0 0 0 0 2l-2 1.5 2 3.4 2.3-1a7.6 7.6 0 0 0 1.7 1L11 21h4l.4-2.6a7.6 7.6 0 0 0 1.7-1l2.3 1 2-3.4z"/>' },
    { id: "users", label: "Users & roles", href: "users-roles.html", icon: '<circle cx="9" cy="8" r="3"/><path d="M3 20a6 6 0 0 1 12 0"/><path d="M16 3.5a3 3 0 0 1 0 5.6"/>' }
  ];

  function svg(paths) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">' + paths + "</svg>";
  }

  function buildSidebar(active) {
    var items = NAV.map(function (n) {
      if (n.sect) return '<div class="sect">' + n.sect + "</div>";
      var cur = n.id === active ? ' aria-current="page"' : "";
      var pip = n.pip ? '<span class="pip">' + n.pip + "</span>" : "";
      return '<a href="' + n.href + '"' + cur + ">" + svg(n.icon) + '<span class="lbl">' + n.label + "</span>" + pip + "</a>";
    }).join("");
    return '<aside class="sidebar" aria-label="Admin navigation">' +
      '<div class="brand"><span class="mark">EA</span><span class="name">Admin</span></div>' +
      "<nav>" + items + "</nav></aside>";
  }

  function buildTopbar(crumb) {
    return '<header class="topbar">' +
      '<button class="tbicon ham" aria-label="Open navigation">' + svg('<path d="M4 7h16M4 12h16M4 17h16"/>') + "</button>" +
      '<nav class="crumbs" aria-label="Breadcrumb"><span>Admin</span><span>\u203a</span><b>' + (crumb || "") + "</b></nav>" +
      '<div class="gsearch" role="search">' + svg('<circle cx="11" cy="11" r="7"/><path d="m20 20-3-3"/>') + "Search or jump to\u2026<kbd>\u2318K</kbd></div>" +
      '<div class="tools">' +
      '<button class="tbicon" aria-label="Notifications">' + svg('<path d="M6 8a6 6 0 0 1 12 0c0 7 2 8 2 8H4s2-1 2-8z"/><path d="M10 20a2 2 0 0 0 4 0"/>') + '<span class="dot"></span></button>' +
      '<span class="avatar" aria-label="Your account">JM</span>' +
      "</div></header>";
  }

  function init() {
    var app = document.querySelector(".app");
    if (!app) return;
    var active = document.body.getAttribute("data-active") || "";
    var crumb = document.body.getAttribute("data-crumb") || "";
    app.insertAdjacentHTML("afterbegin", buildSidebar(active));
    var main = app.querySelector(".main");
    if (main) main.insertAdjacentHTML("afterbegin", buildTopbar(crumb));
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
