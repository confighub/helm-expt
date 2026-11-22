(function () {
  var root = document.documentElement;
  function readTheme() {
    try {
      var v = localStorage.getItem("confighub-theme");
      return v === "light" || v === "dark" ? v : "system";
    } catch (e) { return "system"; }
  }
  function applyTheme(mode) {
    if (mode === "system") root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", mode);
    document.querySelectorAll("[data-theme-switch] button[data-th]").forEach(function (b) {
      b.setAttribute("aria-pressed", String(b.getAttribute("data-th") === mode));
    });
  }
  document.querySelectorAll("[data-theme-switch]").forEach(function (sw) {
    sw.addEventListener("click", function (e) {
      var btn = e.target.closest("button[data-th]");
      if (!btn) return;
      var mode = btn.getAttribute("data-th");
      try {
        if (mode === "system") localStorage.removeItem("confighub-theme");
        else localStorage.setItem("confighub-theme", mode);
      } catch (err) {}
      applyTheme(mode);
    });
  });
  applyTheme(readTheme());

  var clientTabs = document.querySelectorAll("[data-client-tab]");
  var clientPanes = document.querySelectorAll("[data-client-pane]");
  function setClient(c) {
    if (c !== "claude" && c !== "codex") return;
    clientTabs.forEach(function (b) {
      b.setAttribute("aria-selected", b.getAttribute("data-client-tab") === c ? "true" : "false");
    });
    clientPanes.forEach(function (p) {
      p.hidden = p.getAttribute("data-client-pane") !== c;
    });
    try { localStorage.setItem("confighub-client", c); } catch (e) {}
  }
  clientTabs.forEach(function (b) {
    b.addEventListener("click", function () { setClient(b.getAttribute("data-client-tab")); });
  });
  try {
    var saved = localStorage.getItem("confighub-client");
    if (saved === "codex" || saved === "claude") setClient(saved);
  } catch (e) {}

  document.querySelectorAll("[data-copy]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var code = btn.parentElement.querySelector("code");
      if (!code || !navigator.clipboard) return;
      navigator.clipboard.writeText(code.textContent).then(function () {
        var orig = btn.textContent;
        btn.textContent = "Copied";
        setTimeout(function () { btn.textContent = orig; }, 1400);
      });
    });
  });

  document.querySelectorAll("[data-filter-group]").forEach(function (bar) {
    var group = bar.getAttribute("data-filter-group");
    var items = document.querySelectorAll('[data-filter-target="' + group + '"] [data-tags]');
    var buttons = bar.querySelectorAll("[data-filter]");
    buttons.forEach(function (btn) {
      btn.addEventListener("click", function () {
        var tag = btn.getAttribute("data-filter");
        buttons.forEach(function (b) {
          b.setAttribute("aria-pressed", b === btn ? "true" : "false");
        });
        items.forEach(function (item) {
          var tags = (item.getAttribute("data-tags") || "").split(/\s+/);
          item.hidden = tag !== "all" && tags.indexOf(tag) === -1;
        });
      });
    });
  });

  var pSel = document.querySelector("[data-recipe-plugin]");
  var sSel = document.querySelector("[data-recipe-starter]");
  var out = document.querySelector("[data-recipe-out]");
  if (pSel && sSel && out) {
    var PLUGINS = {
      nono: { name: "nono sandbox plugin", status: "Early", role: "Runs the coding agent inside an OS-level nono sandbox while recording supported settings edits." },
      claude: { name: "Claude Code plugin", status: "Works", role: "Keeps the request with supported settings edits." },
      codex: { name: "Codex CLI hooks", status: "Works", role: "Records apply_patch and CLI config edits after they run and works with scoped app launchers." },
      daytona: { name: "Daytona sandbox", status: "Works", role: "Runs agent experiments in a disposable cloud sandbox and brings proposed settings back for review." },
      ci: { name: "GitHub Actions CI", status: "Works", role: "Runs an ephemeral local hub per pull request and comments changed settings with their reasons." }
    };
    var STARTERS = {
      vercel: { name: "Vercel / Next.js starter", cmd: "Try a warmer banner in staging on Vercel, and hold production for my approval.", url: "https://github.com/confighubai/confighub-mini-plugin/blob/main/docs/nextjs-on-vercel.md", label: "Next.js on Vercel guide" },
      web: { name: "Web (.env) starter", hint: "Try the prompt in a local Node app with a heading it reads from .env.", cmd: "Try \"Evening collection\" as the heading. Keep the usual app as it is. I'd like to open the preview again tomorrow.", url: "https://github.com/confighubai/confighub-mini-plugin/blob/main/docs/journeys/existing-app.md#run-a-preview-of-my-app", label: "Local preview guide" },
      daytona: { name: "Daytona settings experiment", cmd: "Try a batch size of 240 in my Daytona sandbox because the queue is backing up. Keep production at 120 and bring the change back for review.", url: "https://github.com/confighubai/confighub-mini-plugin/blob/main/examples/walkthroughs/starter-daytona.md", label: "Daytona experiment guide" },
      fly: { name: "Rails on Fly starter", cmd: "Connect this Rails app with staging and production copies, and hold Fly production for my approval.", url: "https://github.com/confighubai/confighub-mini-plugin/blob/main/docs/rails-on-fly.md", label: "Rails on Fly guide" },
      ssm: { name: "AWS Parameter Store starter", cmd: "Keep our app settings in ConfigHub and deliver approved production values to AWS Parameter Store.", url: "https://github.com/confighubai/confighub-mini-plugin/blob/main/examples/walkthroughs/starter-parameter-store.md", label: "Parameter Store walkthrough" },
      temporal: { name: "Temporal worker starter", cmd: "Rehearse raising the activity retry limit in staging and hold production until I approve.", url: "https://github.com/confighubai/confighub-mini-plugin/blob/main/examples/walkthroughs/starter-temporal-worker.md", label: "Temporal worker walkthrough" },
      gitops: { name: "Argo CD / Flux starter", cmd: "Keep our Kustomize overlays in ConfigHub so staging syncs and production waits for approval.", url: "https://github.com/confighubai/confighub-mini-plugin/blob/main/docs/journeys/gitops-app.md", label: "Argo CD & Flux guide" }
    };
    function renderRecipe() {
      var p = PLUGINS[pSel.value] || PLUGINS.claude;
      var s = STARTERS[sSel.value] || STARTERS.web;
      var titleEl = out.querySelector("[data-r-title]");
      var statusEl = out.querySelector("[data-r-status]");
      var summaryEl = out.querySelector("[data-r-summary]");
      var promptEl = out.querySelector("[data-r-prompt]");
      var linkEl = out.querySelector("[data-r-link]");
      if (titleEl) titleEl.textContent = p.name + " + " + s.name;
      if (statusEl) {
        statusEl.hidden = p.status !== "Early";
      }
      if (summaryEl) summaryEl.textContent = p.role + (s.hint ? " " + s.hint : "");
      if (promptEl) promptEl.textContent = s.cmd;
      if (linkEl) { linkEl.href = s.url; linkEl.textContent = s.label; }
    }
    pSel.addEventListener("change", renderRecipe);
    sSel.addEventListener("change", renderRecipe);
    renderRecipe();
  }
})();
