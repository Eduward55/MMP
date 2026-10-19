// Script clássico (não-módulo) carregado antes de tudo: guarda erros para diagnóstico.
window.__mmpErrors = [];
window.addEventListener('error', (e) => {
  const msg = String(e.message || '');
  if (msg.includes('ResizeObserver loop')) return;
  window.__mmpErrors.push(msg);
});
window.addEventListener('unhandledrejection', (e) => {
  const r = e.reason;
  window.__mmpErrors.push(String((r && r.message) || r));
});
