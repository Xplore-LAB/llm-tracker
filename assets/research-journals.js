// Keep the journal supplement in the existing conference tab only.
(() => {
  const section = document.getElementById('conference-journals');
  const timeline = document.getElementById('tlwrap');
  if (!section || !timeline) return;
  function sync() {
    section.hidden = timeline.style.display === 'none';
  }
  new MutationObserver(sync).observe(timeline, {attributes: true, attributeFilter: ['style']});
  sync();
})();
