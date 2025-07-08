let deferredPrompt;
const installBtn = document.getElementById('btn-instalar-pwa');

window.addEventListener('beforeinstallprompt', (e) => {
  // Previene el mini-infobar automático
  e.preventDefault();
  deferredPrompt = e;
  installBtn.style.display = 'inline-block';
});

installBtn?.addEventListener('click', async () => {
  if (!deferredPrompt) return;
  installBtn.disabled = true;
  deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  // (Opcional) Puedes ocultar el botón si ya se instaló
  if (outcome === 'accepted') {
    installBtn.textContent = "¡Instalado!";
    setTimeout(() => installBtn.style.display = "none", 2500);
  } else {
    installBtn.disabled = false;
  }
  deferredPrompt = null;
});

// Si la app ya está instalada, oculta el botón
window.addEventListener('appinstalled', () => {
  installBtn.style.display = 'none';
});
 
<script>
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js')
    .then(reg => console.log('✅ Service Worker registrado', reg.scope))
    .catch(err => console.error('❌ Error al registrar SW:', err));
}
</script>
