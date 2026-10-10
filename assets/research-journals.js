// Journals share the research page's view navigation with the conference timeline.
(() => {
  const section = document.getElementById('conference-journals');
  if (!section) return;

  VIEWS.push(['journal', '📖 期刊投稿']);
  const originalRender = render;
  const originalToolbar = renderToolbar;
  const originalCaveat = renderCaveat;
  const originalSetView = setView;

  renderToolbar = function () {
    if (VIEW !== 'journal') originalToolbar();
  };
  renderCaveat = function () {
    if (VIEW !== 'journal') originalCaveat();
  };
  render = function () {
    const journal = VIEW === 'journal';
    section.hidden = !journal;
    for (const id of ['toolbar', 'stats', 'caveat']) {
      document.getElementById(id).style.display = journal ? 'none' : '';
    }
    if (journal) {
      for (const id of ['board', 'countdown', 'tlwrap', 'watchwrap']) {
        document.getElementById(id).style.display = 'none';
      }
    } else {
      originalRender();
    }
  };
  setView = function (view) {
    originalSetView(view);
    const url = new URL(location.href);
    url.searchParams.set('view', view);
    history.replaceState(null, '', url);
  };

  if (new URLSearchParams(location.search).get('view') === 'journal') {
    VIEW = 'journal';
  }
  renderViews();
  if (VIEW === 'journal') render();
})();
