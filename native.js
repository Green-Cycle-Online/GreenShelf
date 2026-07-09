// Native-only glue for the Capacitor iOS app. On the website this file is inert:
// window.Capacitor is undefined, so everything below is skipped. It talks to the
// native layer through the Capacitor bridge proxy (window.Capacitor.Plugins),
// NOT through npm imports, because GreenShelf has no bundler / build step.

(function () {
  const Cap = window.Capacitor
  const isNative = !!(Cap && typeof Cap.isNativePlatform === 'function' && Cap.isNativePlatform())
  if (!isNative) return

  const P = Cap.Plugins || {}

  // ---- Edge-to-edge: kill the white status-bar strip ----
  // On the website the viewport meta stays plain; here (native only) we opt into
  // viewport-fit=cover so env(safe-area-inset-*) becomes real, then let the status
  // bar overlay the WebView. The header pads itself with env() so the clock never
  // sits on the logo. Without this, iOS reserves a white inset bar up top.
  try {
    const vp = document.querySelector('meta[name="viewport"]')
    if (vp && !/viewport-fit/.test(vp.getAttribute('content') || '')) {
      vp.setAttribute('content', vp.getAttribute('content') + ', viewport-fit=cover')
    }
  } catch (e) {}

  // ---- Status bar: match the current theme so the clock/battery stay legible ----
  function syncStatusBar() {
    if (!P.StatusBar) return
    // Overlay the WebView so content runs edge-to-edge under the status bar.
    P.StatusBar.setOverlaysWebView({ overlay: true }).catch(() => {})
    const dark = document.documentElement.getAttribute('data-theme') === 'dark'
    // Style.Dark = light text (for dark backgrounds), Style.Light = dark text.
    P.StatusBar.setStyle({ style: dark ? 'DARK' : 'LIGHT' }).catch(() => {})
  }
  syncStatusBar()
  // Re-sync when the user toggles the theme (attribute flips on <html>).
  try {
    new MutationObserver(syncStatusBar).observe(document.documentElement, {
      attributes: true, attributeFilter: ['data-theme'],
    })
  } catch (e) {}

  // ---- Hardware back / resume niceties ----
  if (P.App) {
    // On iOS there is no hardware back button, but this keeps parity and is harmless.
    P.App.addListener('backButton', ({ canGoBack }) => {
      if (canGoBack) window.history.back()
    }).catch(() => {})
  }

  // ---- Push notifications ----
  // Phase 1 (this build): request permission, register with APNs, keep the token.
  // Phase 2 (needs an APNs key + a Supabase edge function): actually send pushes,
  // e.g. "someone wants your book". See IOS-LAUNCH-GUIDE.md.
  function initPush() {
    const Push = P.PushNotifications
    if (!Push) return

    Push.addListener('registration', (token) => {
      try { localStorage.setItem('gs_push_token', token && token.value ? token.value : '') } catch (e) {}
    }).catch(() => {})

    Push.addListener('registrationError', () => { /* no APNs in Simulator; ignore */ }).catch(() => {})

    // Foreground pushes: let the OS show them (configured in capacitor.config.json).
    Push.addListener('pushNotificationReceived', () => {}).catch(() => {})
    Push.addListener('pushNotificationActionPerformed', () => {}).catch(() => {})

    Push.checkPermissions().then((res) => {
      if (res && res.receive === 'granted') return Push.register()
      if (res && res.receive === 'prompt') {
        return Push.requestPermissions().then((r) => {
          if (r && r.receive === 'granted') return Push.register()
        })
      }
    }).catch(() => {})
  }
  // Delay so it never competes with first paint / splash.
  setTimeout(initPush, 1800)
})()
