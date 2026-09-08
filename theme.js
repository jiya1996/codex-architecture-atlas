(() => {
  const root = document.documentElement;
  const storageKey = 'codex-atlas-theme';

  // 只沿用访客主动选过的主题；首次访问保持浅色，避免跟随系统自动变暗。
  let storedTheme;
  try { storedTheme = localStorage.getItem(storageKey); } catch (_) {}
  root.dataset.theme = storedTheme === 'dark' ? 'dark' : 'light';

  function initialize() {
    const button = document.querySelector('.theme-toggle');
    if (!button) return;
    const label = button.querySelector('.theme-label');
    const icon = button.querySelector('.theme-icon');

    function apply(theme) {
      const dark = theme === 'dark';
      root.dataset.theme = dark ? 'dark' : 'light';
      button.setAttribute('aria-pressed', String(dark));
      button.setAttribute('aria-label', dark ? '切换到浅色主题' : '切换到深色主题');
      label.textContent = dark ? '浅色' : '深色';
      icon.textContent = dark ? '☀' : '☾';
    }

    apply(root.dataset.theme);
    button.addEventListener('click', () => {
      const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
      apply(next);
      // 隐私模式禁用存储时仍允许本页切换，不能让持久化失败阻断按钮。
      try { localStorage.setItem(storageKey, next); } catch (_) {}
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize, { once: true });
  } else {
    initialize();
  }
})();
