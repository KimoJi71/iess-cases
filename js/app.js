(function () {
  const NAV = [
    {
      id: "war-room",
      label: "戰情室",
      children: [
        {
          id: "maintenance",
          label: "維修服務",
          children: [
            { id: "maintenance-cases", label: "叫修案件", module: "MaintenanceModule" },
            { id: "case-records", label: "叫修案件紀錄", module: "CaseRecordsModule" },
          ],
        },
      ],
    },
  ];

  let currentPrimary = "war-room";
  let currentSecondary = "maintenance";
  let currentTertiary = "maintenance-cases";
  let activeModule = null;

  const primaryNav = document.getElementById("primary-nav");
  const secondaryNav = document.getElementById("secondary-nav");
  const content = document.getElementById("app-content");

  function getPrimary() {
    return NAV.find((n) => n.id === currentPrimary) || null;
  }

  function getSecondary() {
    return getPrimary()?.children.find((c) => c.id === currentSecondary) || null;
  }

  function getTertiary() {
    return getSecondary()?.children?.find((c) => c.id === currentTertiary) || null;
  }

  function resolveModule() {
    const secondary = getSecondary();
    if (secondary?.children?.length) return getTertiary();
    return secondary;
  }

  function renderPrimary() {
    primaryNav.innerHTML = NAV.map((item) => `
      <button type="button" class="nav-btn ${item.id === currentPrimary ? "active" : ""}"
        data-primary="${item.id}">${item.label}</button>
    `).join("");
  }

  function renderTertiary(secondary) {
    if (!secondary.children?.length) return "";
    return `
      <div class="tertiary-nav" aria-label="第三層功能">
        ${secondary.children.map((child) => `
          <button type="button" class="nav-btn nav-btn-sub ${child.id === currentTertiary ? "active" : ""}"
            data-tertiary="${child.id}">${child.label}</button>
        `).join("")}
      </div>
    `;
  }

  function renderSecondary() {
    const primary = getPrimary();
    secondaryNav.innerHTML = (primary?.children || []).map((child) => {
      const isActive = child.id === currentSecondary;
      const tertiary = isActive ? renderTertiary(child) : "";
      return `
        <button type="button" class="nav-btn ${isActive ? "active" : ""}"
          data-secondary="${child.id}">${child.label}</button>
        ${tertiary}
      `;
    }).join("");
  }

  function mountModule() {
    if (activeModule?.unmount) activeModule.unmount();
    content.innerHTML = "";
    const target = resolveModule();
    const mod = target ? window[target.module] : null;
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
    currentSecondary = getPrimary()?.children[0]?.id || null;
    currentTertiary = getSecondary()?.children?.[0]?.id || null;
    renderPrimary();
    renderSecondary();
    mountModule();
  });

  secondaryNav.addEventListener("click", (e) => {
    const tertiaryBtn = e.target.closest("[data-tertiary]");
    if (tertiaryBtn) {
      currentTertiary = tertiaryBtn.dataset.tertiary;
      renderSecondary();
      mountModule();
      return;
    }
    const btn = e.target.closest("[data-secondary]");
    if (!btn) return;
    currentSecondary = btn.dataset.secondary;
    currentTertiary = getSecondary()?.children?.[0]?.id || null;
    renderSecondary();
    mountModule();
  });

  renderPrimary();
  renderSecondary();
  mountModule();
})();
