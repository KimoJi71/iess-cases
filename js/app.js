(function () {
  const NAV = [
    {
      id: "war-room",
      label: "戰情室",
      children: [
        { id: "maintenance", label: "維修服務", module: "MaintenanceModule" },
      ],
    },
  ];

  let currentPrimary = "war-room";
  let currentSecondary = "maintenance";
  let activeModule = null;

  const primaryNav = document.getElementById("primary-nav");
  const secondaryNav = document.getElementById("secondary-nav");
  const content = document.getElementById("app-content");

  function renderPrimary() {
    primaryNav.innerHTML = NAV.map((item) => `
      <button type="button" class="nav-btn ${item.id === currentPrimary ? "active" : ""}"
        data-primary="${item.id}">${item.label}</button>
    `).join("");
  }

  function renderSecondary() {
    const primary = NAV.find((n) => n.id === currentPrimary);
    secondaryNav.innerHTML = (primary?.children || []).map((child) => `
      <button type="button" class="nav-btn ${child.id === currentSecondary ? "active" : ""}"
        data-secondary="${child.id}">${child.label}</button>
    `).join("");
  }

  function mountModule() {
    if (activeModule?.unmount) activeModule.unmount();
    content.innerHTML = "";
    const primary = NAV.find((n) => n.id === currentPrimary);
    const child = primary?.children.find((c) => c.id === currentSecondary);
    const mod = child ? window[child.module] : null;
    if (!mod) {
      content.innerHTML = `<div class="empty-state">功能尚未實作</div>`;
      activeModule = null;
      return;
    }
    activeModule = mod;
    mod.mount(content);
  }

  primaryNav.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-primary]");
    if (!btn) return;
    currentPrimary = btn.dataset.primary;
    const primary = NAV.find((n) => n.id === currentPrimary);
    currentSecondary = primary?.children[0]?.id || null;
    renderPrimary();
    renderSecondary();
    mountModule();
  });

  secondaryNav.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-secondary]");
    if (!btn) return;
    currentSecondary = btn.dataset.secondary;
    renderSecondary();
    mountModule();
  });

  renderPrimary();
  renderSecondary();
  mountModule();
})();
