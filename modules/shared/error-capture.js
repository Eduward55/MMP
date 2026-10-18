// Script clássico (não-módulo) carregado antes de tudo: guarda erros para diagnóstico.
window.__mmpErrors = [];
window.addEventListener('error', (e) => window.__mmpErrors.push(String(e.message)));
window.addEventListener('unhandledrejection', (e) => {
  const r = e.reason;
  window.__mmpErrors.push(String((r && r.message) || r));
});
