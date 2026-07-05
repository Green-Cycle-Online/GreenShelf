// Supabase is self-hosted (vendor/supabase.js, loaded as a classic script before
// this module), so createClient comes off the global it exposes. No third-party
// CDN at runtime: better supply-chain safety and full offline support.
const { createClient } = window.supabase
const SUPABASE_URL = window.GS_CONFIG.SUPABASE_URL
const SUPABASE_KEY = window.GS_CONFIG.SUPABASE_KEY
// Native (Capacitor iOS) vs web. Inside the app the origin is capacitor://localhost,
// which is useless as an email-confirm target, so auth links point at the real site;
// the link opens in the browser, confirms the account, then the user returns to the app.
const IS_NATIVE = !!(window.Capacitor && typeof window.Capacitor.isNativePlatform === 'function' && window.Capacitor.isNativePlatform())
const SITE_URL = 'https://greenshelf.online'
const AUTH_REDIRECT = IS_NATIVE ? SITE_URL : window.location.origin
const PHOTO_BUCKET = 'book-photos'
// Allowed upload types. Blocks SVG (can carry scripts) and anything exotic;
// the storage key extension comes from this map, never from the client filename.
const PHOTO_TYPES = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif', 'image/heic': 'heic', 'image/heif': 'heif' }
// Only SVG is a real upload risk (it can carry scripts); every other image is fine,
// including phone photos that arrive with an empty MIME type. Derive the storage
// extension from a whitelist, never straight from the untrusted filename.
function isSafePhoto(file) {
  const t = (file.type || '').toLowerCase()
  if (t === 'image/svg+xml') return false
  if (t && !t.startsWith('image/')) return false
  return true
}
function safePhotoExt(file) {
  if (PHOTO_TYPES[file.type]) return PHOTO_TYPES[file.type]
  const e = ((file.name || '').split('.').pop() || '').toLowerCase().replace(/[^a-z0-9]/g, '')
  return /^(jpg|jpeg|png|webp|gif|heic|heif)$/.test(e) ? e : 'jpg'
}
const BASE_SUBJECTS = ['Math', 'Science', 'English', 'Arabic', 'Social Studies', 'Business']
const AREAS_MUSCAT = ['Al Khoud', 'Al Khuwair', 'Al Hail', 'Al Mabela', 'Al Mawaleh', 'Azaiba', 'Bausher', 'Ghubra', 'Madinat Qaboos', 'Mutrah', 'Qurum', 'Ruwi', 'Seeb']
const AREAS_OTHER_OMAN = ['Bahla', 'Barka', 'Buraimi', 'Ibri', 'Khasab', 'Liwa', 'Nizwa', 'Rustaq', 'Saham', 'Salalah', 'Sohar', 'Sur', 'Suwaiq']
const ALL_AREAS = [...AREAS_MUSCAT, ...AREAS_OTHER_OMAN]
const MAX_PHOTOS = 4
const PAGE_SIZE = 24
const REPORT_REASONS = {
  spam: 'Spam or scam',
  inappropriate: 'Inappropriate content',
  duplicate: 'Duplicate listing',
  wrong_info: 'Wrong information',
  other: 'Other',
}
// Session storage. On the web, localStorage is fine. Inside the iOS app, WKWebView
// can evict Web Storage under memory pressure and silently sign the user out, so we
// route the session through Capacitor Preferences (native UserDefaults, persists
// until the app is uninstalled). The Preferences plugin is reached through the
// Capacitor bridge proxy, so no bundler/import is needed.
const AUTH_STORAGE = (IS_NATIVE && window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Preferences)
  ? {
      getItem: async (key) => (await window.Capacitor.Plugins.Preferences.get({ key })).value,
      setItem: async (key, value) => { await window.Capacitor.Plugins.Preferences.set({ key, value }) },
      removeItem: async (key) => { await window.Capacitor.Plugins.Preferences.remove({ key }) },
    }
  : window.localStorage
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    storage: AUTH_STORAGE,
    detectSessionInUrl: !IS_NATIVE,
    lock: async (name, acquireTimeout, fn) => await fn(),
  }
})
window.supabase = supabase
let allListings = []
let myListings = []
let currentUser = null
let currentProfile = null
let isAdmin = false
let siteSettings = { show_live_counter: false }
const BOOK_ICON_SVG = `<svg class="ph-book" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 7v13"/><path d="M3 18a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z"/></svg>`
// Small leaf mark (matches the brand logo) used as the imprint on generated covers.
const LEAF_MARK_SVG = `<svg class="bc-leaf" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z" fill="currentColor" fill-opacity="0.16"/><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/></svg>`
// Deterministic 0..N-1 index from a string, so a given subject always gets the
// same cover colourway (a muted publisher-series look, not random per render).
function coverIndex(str, n) {
  let h = 0
  const s = String(str || '')
  for (let i = 0; i < s.length; i++) { h = (h * 31 + s.charCodeAt(i)) >>> 0 }
  return h % n
}
// Generated typographic book cover for listings without a photo. Turns an empty
// placeholder box into a real, distinct "book on a shelf".
function bookCoverHTML(l) {
  const idx = coverIndex(l.subject || l.title || '', 5)
  const foot = [l.grade_level, l.subject].filter(Boolean).join(' · ')
  return `<div class="book-cover cover-${idx}" aria-hidden="true">
      <div class="bc-head">
        <span class="bc-mark">${LEAF_MARK_SVG}</span>
        <span class="bc-title">${escapeHtml(l.title)}</span>
      </div>
      ${foot ? `<span class="bc-foot">${escapeHtml(foot)}</span>` : ''}
    </div>`
}
let currentView = 'browse'
let currentPage = 1
let currentFilteredListings = []
// ---- ERROR LOG (admin diagnostics) ----
// Quietly captures uncaught errors and unhandled promise rejections so the admin
// diagnostics panel can surface crashes that would otherwise vanish into the console.
// Kept small and saved to localStorage so a refresh does not wipe the trail.
const ERROR_LOG_KEY = 'gs-error-log'
const ERROR_LOG_MAX = 50
function readErrorLog() {
  try { return JSON.parse(localStorage.getItem(ERROR_LOG_KEY)) || [] } catch (e) { return [] }
}
function recordError(type, message, source) {
  try {
    const log = readErrorLog()
    log.unshift({
      time: new Date().toISOString(),
      type,
      message: String(message == null ? 'Unknown error' : message).slice(0, 500),
      source: String(source || '').slice(0, 300),
    })
    localStorage.setItem(ERROR_LOG_KEY, JSON.stringify(log.slice(0, ERROR_LOG_MAX)))
  } catch (e) { /* never let logging throw */ }
}
window.addEventListener('error', (e) => {
  const where = e.filename ? `${e.filename}:${e.lineno || 0}:${e.colno || 0}` : ''
  recordError('error', e.message || (e.error && e.error.message), where)
})
window.addEventListener('unhandledrejection', (e) => {
  const reason = e.reason
  let msg = 'Unhandled promise rejection'
  if (reason && reason.message) msg = reason.message
  else if (typeof reason === 'string') msg = reason
  else if (reason) { try { msg = JSON.stringify(reason) } catch (err) {} }
  recordError('promise', msg, 'unhandled rejection')
})
// ---- TOASTS & CONFIRM ----
function showToast(message, type = 'info') {
  let container = document.getElementById('toast-container')
  if (!container) {
    container = document.createElement('div')
    container.id = 'toast-container'
    document.body.appendChild(container)
  }
  const toast = document.createElement('div')
  toast.className = `toast toast-${type}`
  toast.textContent = message
  container.appendChild(toast)
  requestAnimationFrame(() => toast.classList.add('toast-visible'))
  setTimeout(() => {
    toast.classList.remove('toast-visible')
    setTimeout(() => toast.remove(), 300)
  }, 3200)
}
function customConfirm({ title, message, confirmText = 'Confirm', cancelText = 'Cancel', danger = false }) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div')
    overlay.className = 'modal-backdrop'
    overlay.innerHTML = `
      <div class="modal confirm-modal">
        <div class="confirm-body">
          <div class="confirm-title">${escapeHtml(title)}</div>
          <p class="confirm-message">${escapeHtml(message)}</p>
          <div class="confirm-actions">
            <button class="btn-secondary" id="cancel-btn">${escapeHtml(cancelText)}</button>
            <button class="${danger ? 'btn-danger' : 'btn-primary'}" id="confirm-btn">${escapeHtml(confirmText)}</button>
          </div>
        </div>
      </div>
    `
    document.body.appendChild(overlay)
    const close = (result) => { overlay.remove(); resolve(result) }
    overlay.querySelector('#cancel-btn').addEventListener('click', () => close(false))
    overlay.querySelector('#confirm-btn').addEventListener('click', () => close(true))
    overlay.querySelector('.modal').addEventListener('click', e => e.stopPropagation())
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(false) })
    setTimeout(() => overlay.querySelector('#confirm-btn').focus(), 50)
  })
}
// ---- AUTH ----
function updateNav() {
  const navAuth = document.getElementById('nav-auth')
  if (currentUser) {
    const email = currentUser.email
    const displayEmail = email.length > 22 ? email.slice(0, 20) + '…' : email
    const viewLink = currentView === 'browse'
      ? `<a href="#" id="profile-link">My profile</a>`
      : `<a href="#" id="browse-link">Browse</a>`
    navAuth.innerHTML = `
      ${viewLink}
      <button class="btn-primary" id="new-listing-btn">+ List<span class="cta-extra">&nbsp;a book</span></button>
      <span class="nav-user">${escapeHtml(displayEmail)}</span>
      ${isAdmin ? '<a href="#" class="admin-badge admin-link" id="admin-link">ADMIN</a>' : ''}
      <button class="btn-secondary" id="signout-btn">Sign out</button>
    `
    document.getElementById('signout-btn').addEventListener('click', signOut)
    document.getElementById('new-listing-btn').addEventListener('click', () => showCreateListingModal())
    const profileLink = document.getElementById('profile-link')
    const browseLink = document.getElementById('browse-link')
    const adminLink = document.getElementById('admin-link')
    if (profileLink) profileLink.addEventListener('click', (e) => { e.preventDefault(); showProfileView() })
    if (browseLink) browseLink.addEventListener('click', (e) => { e.preventDefault(); showBrowseView() })
    if (adminLink) adminLink.addEventListener('click', (e) => { e.preventDefault(); showAdminView() })
  } else {
    navAuth.innerHTML = `
      <a href="#browse" id="browse-anchor">Browse</a>
      <button class="btn-secondary" id="nav-list-btn">+ List<span class="cta-extra">&nbsp;a book</span></button>
      <button class="btn-primary" id="signin-btn">Sign in</button>
    `
    document.getElementById('signin-btn').addEventListener('click', showAuthModal)
    document.getElementById('nav-list-btn').addEventListener('click', () => showCreateListingModal())
    const browseAnchor = document.getElementById('browse-anchor')
    if (browseAnchor) browseAnchor.addEventListener('click', (e) => {
      e.preventDefault()
      if (currentView !== 'browse') showBrowseView()
      const b = document.getElementById('browse')
      if (b) b.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' })
    })
  }
}
function showAuthModal(opts = {}) {
  const modal = document.getElementById('auth-modal')
  const pending = !!opts.pendingListing
  let mode = pending ? 'signup' : 'signin'
  function render() {
    const isForgot = mode === 'forgot'
    const title = isForgot ? 'Reset your password' : (pending ? 'Almost there 🌿' : 'Welcome to GreenShelf')
    const subtitle = isForgot
      ? "We'll email you a link to set a new password."
      : (pending
          ? "Create a quick account to publish your listing. We've saved everything you typed."
          : 'Sign in or create an account to share books.')
    modal.innerHTML = `
      <div class="modal auth-modal">
        <button class="modal-close" id="auth-close" aria-label="Close">×</button>
        <div class="auth-body">
          <h2 class="auth-title">${title}</h2>
          <p class="auth-subtitle">${subtitle}</p>
          ${isForgot ? '' : `
            <div class="auth-tabs">
              <button type="button" class="auth-tab ${mode === 'signin' ? 'active' : ''}" data-mode="signin">Sign in</button>
              <button type="button" class="auth-tab ${mode === 'signup' ? 'active' : ''}" data-mode="signup">Create account</button>
            </div>
          `}
          <form id="auth-form">
            <label class="auth-label">Email
              <input type="email" id="auth-email" required autocomplete="email">
            </label>
            ${isForgot ? '' : `
              <label class="auth-label">Password
                <div class="password-wrap">
                  <input type="password" id="auth-password" required minlength="6" autocomplete="${mode === 'signin' ? 'current-password' : 'new-password'}">
                  <button type="button" class="password-toggle" id="password-toggle">Show</button>
                </div>
              </label>
              ${mode === 'signin' ? `<div class="auth-forgot"><a id="forgot-link">Forgot password?</a></div>` : ''}
            `}
            <div class="auth-error" id="auth-error"></div>
            <button type="submit" class="btn-primary auth-submit" id="auth-submit">${
              isForgot ? 'Send reset link' : (mode === 'signin' ? 'Sign in' : 'Create account')
            }</button>
            ${isForgot ? `<div class="auth-back"><a id="back-to-signin">← Back to sign in</a></div>` : ''}
          </form>
        </div>
      </div>
    `
    wireUp()
  }
  function wireUp() {
    const submitBtn = modal.querySelector('#auth-submit')
    const errorDiv = modal.querySelector('#auth-error')
    const emailInput = modal.querySelector('#auth-email')
    const pwInput = modal.querySelector('#auth-password')
    if (pwInput) {
      const pwToggle = modal.querySelector('#password-toggle')
      pwToggle.addEventListener('click', () => {
        pwInput.type = pwInput.type === 'password' ? 'text' : 'password'
        pwToggle.textContent = pwInput.type === 'password' ? 'Show' : 'Hide'
      })
    }
    modal.querySelectorAll('.auth-tab').forEach(tab => {
      tab.addEventListener('click', () => { mode = tab.dataset.mode; render() })
    })
    const forgotLink = modal.querySelector('#forgot-link')
    if (forgotLink) forgotLink.addEventListener('click', () => { mode = 'forgot'; render() })
    const backLink = modal.querySelector('#back-to-signin')
    if (backLink) backLink.addEventListener('click', () => { mode = 'signin'; render() })
    modal.querySelector('#auth-form').addEventListener('submit', async (e) => {
      e.preventDefault()
      const email = emailInput.value.trim()
      const password = pwInput ? pwInput.value : null
      errorDiv.textContent = ''
      submitBtn.disabled = true
      const originalText = submitBtn.textContent
      submitBtn.textContent = 'One sec…'
      try {
        if (mode === 'signin') {
          const { error } = await supabase.auth.signInWithPassword({ email, password })
          if (error) throw error
          showToast('Welcome back 🌿', 'success')
          closeAuthModal()
        } else if (mode === 'signup') {
          const { data, error } = await supabase.auth.signUp({
            email, password,
            options: { emailRedirectTo: AUTH_REDIRECT }
          })
          if (error) throw error
          if (data?.session) {
            showToast('Welcome to GreenShelf 🌿', 'success')
          } else {
            showToast(pending
              ? "Check your inbox to verify. We've saved your listing for when you come back."
              : 'Check your inbox to verify your email 📬',
              'success')
          }
          closeAuthModal()
        } else if (mode === 'forgot') {
          const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: AUTH_REDIRECT })
          if (error) throw error
          showToast('Check your inbox for a reset link.', 'success')
          closeAuthModal()
        }
      } catch (err) {
        errorDiv.textContent = friendlyAuthError(err.message)
        submitBtn.disabled = false
        submitBtn.textContent = originalText
      }
    })
    modal.querySelector('#auth-close').addEventListener('click', closeAuthModal)
    modal.querySelector('.modal').addEventListener('click', e => e.stopPropagation())
    modal.addEventListener('click', (e) => { if (e.target === modal) closeAuthModal() })
  }
  modal.classList.remove('hidden')
  render()
}
function closeAuthModal() {
  document.getElementById('auth-modal').classList.add('hidden')
}
function showSetNewPasswordModal() {
  let modal = document.getElementById('reset-modal')
  if (!modal) {
    modal = document.createElement('div')
    modal.id = 'reset-modal'
    modal.className = 'modal-backdrop'
    document.body.appendChild(modal)
  }
  modal.innerHTML = `
    <div class="modal auth-modal">
      <div class="auth-body">
        <h2 class="auth-title">Set a new password</h2>
        <p class="auth-subtitle">Choose something at least 6 characters long.</p>
        <form id="reset-form">
          <label class="auth-label">New password
            <div class="password-wrap">
              <input type="password" id="reset-password" required minlength="6" autocomplete="new-password">
              <button type="button" class="password-toggle" id="reset-toggle">Show</button>
            </div>
          </label>
          <div class="auth-error" id="reset-error"></div>
          <button type="submit" class="btn-primary auth-submit" id="reset-submit">Update password</button>
        </form>
      </div>
    </div>
  `
  modal.classList.remove('hidden')
  const pwInput = modal.querySelector('#reset-password')
  const pwToggle = modal.querySelector('#reset-toggle')
  pwToggle.addEventListener('click', () => {
    pwInput.type = pwInput.type === 'password' ? 'text' : 'password'
    pwToggle.textContent = pwInput.type === 'password' ? 'Show' : 'Hide'
  })
  modal.querySelector('#reset-form').addEventListener('submit', async (e) => {
    e.preventDefault()
    const submitBtn = modal.querySelector('#reset-submit')
    const errorDiv = modal.querySelector('#reset-error')
    errorDiv.textContent = ''
    submitBtn.disabled = true
    submitBtn.textContent = 'Updating…'
    const { error } = await supabase.auth.updateUser({ password: pwInput.value })
    if (error) {
      errorDiv.textContent = error.message
      submitBtn.disabled = false
      submitBtn.textContent = 'Update password'
      return
    }
    modal.remove()
    showToast("Password updated. You're signed in.", 'success')
    history.replaceState(null, '', window.location.pathname)
  })
}
function friendlyAuthError(msg) {
  if (!msg) return 'Something went wrong. Try again?'
  if (/invalid login credentials/i.test(msg)) return 'Wrong email or password.'
  if (/already registered/i.test(msg)) return 'An account with that email already exists. Try signing in.'
  if (/password.*6/i.test(msg)) return 'Password needs to be at least 6 characters.'
  if (/email not confirmed/i.test(msg)) return 'Check your inbox. You need to verify your email before signing in.'
  return msg
}
async function signOut() {
  await supabase.auth.signOut()
  showToast('Signed out.', 'info')
}
async function loadCurrentUserProfile() {
  if (!currentUser) { currentProfile = null; isAdmin = false; return }
  const { data, error } = await supabase.from('profiles').select('*').eq('id', currentUser.id).single()
  if (error) { console.error(error); return }
  currentProfile = data
  isAdmin = !!data.is_admin
}
supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'PASSWORD_RECOVERY') {
    showSetNewPasswordModal()
    return
  }
  const wasUnauth = !currentUser
  currentUser = session?.user || null
  updateNav()
  loadCurrentUserProfile().then(() => {
    updateNav()
    if (currentUser && wasUnauth) resumePendingListingIfAny()
  }).catch(console.error)
  if (!currentUser && currentView !== 'browse' && currentView !== 'about' && currentView !== 'faq') {
    showBrowseView()
  }
})
// Draft fields we accept back from localStorage, with hard length caps.
// localStorage is same-origin but treat it as untrusted anyway: another tab,
// an old bug, or a devtools paste could leave arbitrary content in it.
const DRAFT_LIMITS = {
  title: 120, subject: 60, grade_level: 20, area: 60, school: 120,
  condition: 30, description: 500, owner_name: 60, contact_method: 20, contact_value: 60,
}
function resumePendingListingIfAny() {
  let draft = null
  try {
    const raw = localStorage.getItem('gs_pending_listing')
    if (raw) draft = JSON.parse(raw)
  } catch (_) {}
  if (!draft || typeof draft !== 'object') return
  localStorage.removeItem('gs_pending_listing')
  // Drafts expire after 24h so an abandoned draft's PII never lingers
  if (!draft._ts || (Date.now() - draft._ts) > 864e5) return
  const clean = {}
  for (const key in DRAFT_LIMITS) {
    if (typeof draft[key] === 'string') clean[key] = draft[key].slice(0, DRAFT_LIMITS[key])
  }
  if (Array.isArray(draft.photos)) {
    const safePhotos = draft.photos.filter(p => typeof p === 'string' && /^https:\/\//.test(p)).slice(0, 5)
    if (safePhotos.length) clean.photos = safePhotos
  }
  // Give the auth modal a beat to close
  setTimeout(() => {
    const hadFiles = !!draft._guestHadFiles
    showCreateListingModal(null, clean)
    if (hadFiles) showToast("You'll need to re-add your photos, sorry!", 'info')
    else showToast("Welcome 🌿 Your listing is ready. Click Post to publish.", 'success')
  }, 250)
}
// ---- SAVED BOOKS (favourites: no account, localStorage, offline-safe) ----
// Visitors keep a private shortlist without signing up. We store just the listing
// ids in localStorage, so it survives reloads, works fully offline, and never
// leaves the device. Fits the no-account, privacy-first nature of GreenShelf.
const SAVED_KEY = 'gs_saved'
let savedOnly = false
function getSavedIds() {
  try {
    const ids = JSON.parse(localStorage.getItem(SAVED_KEY))
    return Array.isArray(ids) ? ids : []
  } catch (e) { return [] }
}
function isSaved(id) { return getSavedIds().includes(String(id)) }
function savedCount() { return getSavedIds().length }
function toggleSaved(id) {
  id = String(id)
  const ids = getSavedIds()
  const at = ids.indexOf(id)
  if (at === -1) ids.push(id)
  else ids.splice(at, 1)
  try { localStorage.setItem(SAVED_KEY, JSON.stringify(ids)) } catch (e) {}
  return at === -1 // true when it is now saved
}
// Keep every control bound to this listing (card heart + modal button) in sync
// after a toggle, so the heart fills everywhere at once.
function reflectSavedState(id, nowSaved) {
  document.querySelectorAll(`[data-save="${CSS.escape(String(id))}"]`).forEach(b => {
    b.classList.toggle('is-saved', nowSaved)
    b.setAttribute('aria-pressed', String(nowSaved))
    if (b.classList.contains('card-save')) {
      b.setAttribute('aria-label', nowSaved ? 'Remove from saved' : 'Save this book')
      b.title = nowSaved ? 'Saved' : 'Save'
    }
    const lbl = b.querySelector('.save-btn-label')
    if (lbl) lbl.textContent = nowSaved ? 'Saved' : 'Save'
  })
}
function handleSaveToggle(id, originBtn) {
  const nowSaved = toggleSaved(id)
  reflectSavedState(id, nowSaved)
  if (originBtn && !reduceMotion) {
    originBtn.classList.remove('pop'); void originBtn.offsetWidth; originBtn.classList.add('pop')
  }
  updateSavedToggle()
  showToast(nowSaved ? 'Saved to your list' : 'Removed from saved', nowSaved ? 'success' : 'info')
  if (savedOnly) applyFilters() // re-filter so an un-saved book drops out of the saved view
}
function updateSavedToggle() {
  const btn = document.getElementById('saved-toggle')
  if (!btn) return
  const count = savedCount()
  if (count === 0 && savedOnly) savedOnly = false
  const countEl = document.getElementById('saved-count')
  if (countEl) countEl.textContent = count
  btn.hidden = count === 0
  btn.classList.toggle('is-active', savedOnly)
  btn.setAttribute('aria-pressed', String(savedOnly))
}

// ---- VIEW SWITCHING ----
// Home view = hero + browse + how + why. Hide all of those when switching to profile/about/faq/admin.
const HOME_SECTIONS = ['.intro', '.impact', '.browse', '.how', '.sdg', '.partners', '.why', '.cta-band']
function hideAllSections() {
  HOME_SECTIONS.forEach(sel => {
    const el = document.querySelector(sel)
    if (el) el.classList.add('hidden-section')
  })
  ;['profile-section', 'about-section', 'faq-section', 'admin-section'].forEach(id => {
    const el = document.getElementById(id)
    if (el) el.classList.add('hidden-section')
  })
}
function showBrowseView() {
  currentView = 'browse'
  hideAllSections()
  HOME_SECTIONS.forEach(sel => {
    const el = document.querySelector(sel)
    if (el) el.classList.remove('hidden-section')
  })
  updateNav()
  loadListings()
}
function showProfileView() {
  if (!currentUser) return
  currentView = 'profile'
  hideAllSections()
  ensureProfileSection().classList.remove('hidden-section')
  updateNav()
  loadProfile()
  loadMyListings()
  window.scrollTo({ top: 0, behavior: 'smooth' })
}
function showAboutView() {
  currentView = 'about'
  hideAllSections()
  ensureAboutSection().classList.remove('hidden-section')
  updateNav()
  window.scrollTo({ top: 0, behavior: 'smooth' })
}
function showFaqView() {
  currentView = 'faq'
  hideAllSections()
  ensureFaqSection().classList.remove('hidden-section')
  updateNav()
  window.scrollTo({ top: 0, behavior: 'smooth' })
}
function showAdminView() {
  if (!isAdmin) return
  currentView = 'admin'
  hideAllSections()
  ensureAdminSection().classList.remove('hidden-section')
  updateNav()
  loadAdminStats()
  window.scrollTo({ top: 0, behavior: 'smooth' })
}
function ensureProfileSection() {
  let section = document.getElementById('profile-section')
  if (section) return section
  section = document.createElement('section')
  section.id = 'profile-section'
  section.className = 'profile-section'
  const grades = Array.from({length: 12}, (_, i) => `Grade ${i + 1}`)
  section.innerHTML = `
    <div class="profile-header">
      <h1>My profile</h1>
      <p id="profile-email"></p>
    </div>
    <div class="profile-card">
      <h3>Your details</h3>
      <form id="profile-form" class="profile-form">
        <label class="auth-label">Name
          <input type="text" name="full_name" maxlength="60" placeholder="What should we call you?">
        </label>
        <div class="profile-row">
          <label class="auth-label">School (optional)
            <input type="text" name="school" maxlength="120" placeholder="e.g. British School Muscat">
          </label>
          <label class="auth-label">Grade (optional)
            <select name="grade_level">
              <option value="">Choose…</option>
              ${grades.map(g => `<option>${g}</option>`).join('')}
            </select>
          </label>
        </div>
        <div class="auth-error" id="profile-error"></div>
        <div class="profile-actions">
          <button type="submit" class="btn-primary" id="profile-save">Save changes</button>
          <span class="profile-saved" id="profile-saved" style="display: none;">✓ Saved</span>
        </div>
      </form>
    </div>
    <h2 class="section-title">Your listings</h2>
    <div class="listings-meta" id="my-listings-meta">Loading…</div>
    <div class="grid" id="my-listings-grid">
      <div class="loading">Fetching your listings…</div>
    </div>
    <div class="profile-card danger-zone" style="margin-top: 40px;">
      <h3>Danger zone</h3>
      <p>Removes all your listings and clears your profile data. Your email is retained. To have it fully erased, email us at greenshelf1320@gmail.com.</p>
      <button type="button" class="btn-danger" id="delete-account-btn">Delete my account</button>
    </div>
  `
  document.querySelector('main').appendChild(section)
  section.querySelector('#profile-form').addEventListener('submit', saveProfile)
  section.querySelector('#my-listings-grid').addEventListener('click', handleCardClick)
  section.querySelector('#delete-account-btn').addEventListener('click', deleteAccount)
  return section
}
function ensureAboutSection() {
  let section = document.getElementById('about-section')
  if (section) return section
  section = document.createElement('section')
  section.id = 'about-section'
  section.className = 'about-section'
  section.innerHTML = `
    <div class="about-header">
      <h1>About GreenShelf</h1>
      <p>Built by two students in Oman who got tired of WhatsApp chaos.</p>
    </div>
    <div class="about-grid">
      <div class="about-person">
        <div class="about-photo">
          <img src="hitesh.jpeg" alt="Hitesh Gurnani, co-founder of GreenShelf" loading="lazy">
          <div class="about-photo-fallback" style="display:none;">H</div>
        </div>
        <h3>Hitesh Gurnani</h3>
        <p>My name is Hitesh and I really like side-quest projects like GreenShelf. Building stuff that makes everyday life in Oman a little easier is the goal, and I hope this helps you find or give a book away :)</p>
      </div>
      <div class="about-person">
        <div class="about-photo">
          <img src="anshul.jpeg" alt="Anshul Date, co-founder of GreenShelf" loading="lazy">
          <div class="about-photo-fallback" style="display:none;">A</div>
        </div>
        <h3>Anshul Date</h3>
        <p>My name is Anshul and I really like doing maths (go follow bobodoesmaths on insta). I'm building GreenShelf with Hitesh because passing your books on shouldn't be this hard.</p>
      </div>
    </div>
    <div class="about-mission">
      <h2>Why we built this</h2>
      <p>At the end of every school year, our friends' parents would post in WhatsApp groups: "Anyone need a Grade 9 math book?" Within minutes, the message would be lost in 200 unrelated messages. Books that could have been passed on quietly ended up in the recycling.</p>
      <p>We thought: surely there's a calmer way. So we built GreenShelf, a small, free site to make book-sharing simple, searchable, and human. Pass it on, don't bin it.</p>
    </div>
  `
  // Photo fallback wired in JS: inline onerror attributes are blocked by our CSP
  section.querySelectorAll('.about-photo img').forEach((img) => {
    img.addEventListener('error', () => {
      img.style.display = 'none'
      const fallback = img.nextElementSibling
      if (fallback) fallback.style.display = 'flex'
    })
  })
  document.querySelector('main').appendChild(section)
  return section
}
function ensureFaqSection() {
  let section = document.getElementById('faq-section')
  if (section) return section
  section = document.createElement('section')
  section.id = 'faq-section'
  section.className = 'faq-section'
  section.innerHTML = `
    <div class="faq-header">
      <h1>Questions you might have</h1>
      <p>Short answers. If yours isn't here, email greenshelf1320@gmail.com.</p>
    </div>
    <div class="faq-list">
      <details class="faq-item"><summary>Is GreenShelf free?</summary><div class="faq-answer">Yes, completely. No fees, no commission.</div></details>
      <details class="faq-item"><summary>Is GreenShelf safe?</summary><div class="faq-answer">Safety matters, especially because many of our users are students. Every user creates a profile with a real first name. Listings show your neighborhood, never your exact address. Anyone can report a listing or user behaving badly, and we review reports within 24 hours. For in-person handovers, we recommend meeting in public places during daytime, and that anyone under 18 is accompanied by a parent.</div></details>
      <details class="faq-item"><summary>How do I list a book?</summary><div class="faq-answer">Click <strong>+ List a book</strong> anywhere on the site. Fill in the title, grade, subject, condition and how people can reach you. If you don't have an account yet, we'll have you create one in 20 seconds at the end. Your draft is saved.</div></details>
      <details class="faq-item"><summary>How do I get a book someone listed?</summary><div class="faq-answer">Click the listing, see contact info, reach out directly.</div></details>
      <details class="faq-item"><summary>Is my contact info safe?</summary><div class="faq-answer">Your account email is private. We only ask for your area, never full address. Read our <a href="/privacy.html">Privacy Policy</a> for details.</div></details>
      <details class="faq-item"><summary>What if the book is damaged?</summary><div class="faq-answer">Be honest about condition when listing. Use photos.</div></details>
      <details class="faq-item"><summary>What happens after a book is claimed?</summary><div class="faq-answer">Mark it as claimed. You can un-claim if needed.</div></details>
      <details class="faq-item"><summary>How do I delete my account?</summary><div class="faq-answer">In your profile, scroll down → Delete my account.</div></details>
      <details class="faq-item"><summary>I saw a spammy listing.</summary><div class="faq-answer">Click <strong>Report</strong> on the listing. We'll review it within 24 hours.</div></details>
    </div>
  `
  document.querySelector('main').appendChild(section)
  return section
}
function ensureAdminSection() {
  let section = document.getElementById('admin-section')
  if (section) return section
  section = document.createElement('section')
  section.id = 'admin-section'
  section.className = 'admin-section'
  section.innerHTML = `
    <div class="admin-header">
      <h1>Admin dashboard</h1>
      <p>Overview of GreenShelf activity. Visible only to admins.</p>
    </div>
    <div id="admin-content"><div class="loading">Loading stats…</div></div>
  `
  document.querySelector('main').appendChild(section)
  return section
}
async function loadAdminStats() {
  if (!isAdmin) return
  const content = document.getElementById('admin-content')
  if (!content) return
  const [listingsRes, reportsRes] = await Promise.all([
    supabase.from('listings').select('*').order('created_at', { ascending: false }),
    supabase.from('reports').select('*, listing:listings(id, title, owner_name, status)').eq('status', 'pending').order('created_at', { ascending: false }),
  ])
  if (listingsRes.error) {
    content.innerHTML = `<div class="empty">Couldn't load stats: ${escapeHtml(listingsRes.error.message)}</div>`
    return
  }
  const all = listingsRes.data || []
  const pendingReports = reportsRes.data || []
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
  const stats = {
    total: all.length,
    available: all.filter(l => l.status === 'available').length,
    claimed: all.filter(l => l.status === 'claimed').length,
    last7Days: all.filter(l => new Date(l.created_at).getTime() > sevenDaysAgo).length,
    totalPhotos: all.reduce((sum, l) => sum + (Array.isArray(l.photos) ? l.photos.length : 0), 0),
    pendingReports: pendingReports.length,
    byArea: countBy(all, 'area'),
    bySubject: countBy(all, 'subject'),
    byGrade: countBy(all, 'grade_level'),
    recent: all.slice(0, 10),
  }
  content.innerHTML = `
    <div class="admin-card">
      <h3>Site settings</h3>
      <label class="admin-setting">
        <span>
          <span class="admin-setting-title">Live counter on homepage</span>
          <span class="admin-setting-desc">Shows "${stats.available} books shared so far" in the hero.</span>
        </span>
        <button type="button" class="switch ${siteSettings.show_live_counter ? 'is-on' : ''}" id="toggle-live-counter" role="switch" aria-checked="${siteSettings.show_live_counter}" aria-label="Toggle live counter">
          <span class="switch-thumb"></span>
        </button>
      </label>
    </div>
    ${pendingReports.length > 0 ? `
      <div class="admin-card">
        <h3>Pending reports (${pendingReports.length})</h3>
        <div class="reports-list" id="reports-list">
          ${pendingReports.map(r => renderReport(r)).join('')}
        </div>
      </div>
    ` : `
      <div class="admin-card">
        <h3>Pending reports</h3>
        <div class="no-reports">No pending reports. 🌿</div>
      </div>
    `}
    <div class="stat-row">
      <div class="stat-card">
        <div class="stat-num">${stats.total}</div>
        <div class="stat-label">Total listings</div>
      </div>
      <div class="stat-card">
        <div class="stat-num">${stats.available}</div>
        <div class="stat-label">Available</div>
      </div>
      <div class="stat-card">
        <div class="stat-num">${stats.claimed}</div>
        <div class="stat-label">Claimed</div>
      </div>
      <div class="stat-card">
        <div class="stat-num">${stats.last7Days}</div>
        <div class="stat-label">Posted (last 7 days)</div>
      </div>
      <div class="stat-card">
        <div class="stat-num">${stats.totalPhotos}</div>
        <div class="stat-label">Photos uploaded</div>
      </div>
    </div>
    <div class="admin-grid">
      <div class="admin-card">
        <h3>By area</h3>
        ${renderBars(stats.byArea)}
      </div>
      <div class="admin-card">
        <h3>By subject</h3>
        ${renderBars(stats.bySubject)}
      </div>
      <div class="admin-card">
        <h3>By grade</h3>
        ${renderBars(stats.byGrade)}
      </div>
    </div>
    <div class="admin-card">
      <h3>Recent listings</h3>
      ${stats.recent.length === 0 ? '<p class="muted">No listings yet.</p>' : `
        <table class="admin-table">
          <thead>
            <tr><th>Title</th><th>Area</th><th>Subject</th><th>Status</th><th>When</th></tr>
          </thead>
          <tbody>
            ${stats.recent.map(l => `
              <tr>
                <td>${escapeHtml(l.title)}</td>
                <td>${escapeHtml(l.area || '-')}</td>
                <td>${escapeHtml(l.subject || '-')}</td>
                <td><span class="admin-status-chip ${escapeHtml(l.status)}">${escapeHtml(l.status)}</span></td>
                <td class="muted">${formatRelativeTime(l.created_at)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `}
    </div>
    <div class="admin-card">
      <div class="diag-head">
        <h3>Diagnostics</h3>
        <button type="button" class="btn-secondary" id="run-health-checks">Run health checks</button>
      </div>
      <div id="health-results" class="diag-results">
        <p class="muted">Run a check to test the database, storage, sign-in, service worker, and offline cache.</p>
      </div>
    </div>
    <div class="admin-card">
      <div class="diag-head">
        <h3>Error log</h3>
        <div class="diag-head-actions">
          <button type="button" class="btn-secondary" id="copy-error-log">Copy</button>
          <button type="button" class="btn-secondary" id="clear-error-log">Clear</button>
        </div>
      </div>
      <div id="error-log-list" class="error-log"></div>
    </div>
  `
  content.querySelectorAll('[data-report-action]').forEach(btn => {
    btn.addEventListener('click', () => handleReportAction(btn.dataset.reportId, btn.dataset.reportAction, btn.dataset.listingId))
  })
  wireDiagnostics(content)
  const counterToggle = content.querySelector('#toggle-live-counter')
  if (counterToggle) counterToggle.addEventListener('click', async () => {
    const next = !siteSettings.show_live_counter
    counterToggle.disabled = true
    const ok = await setLiveCounter(next)
    counterToggle.disabled = false
    if (ok) {
      counterToggle.classList.toggle('is-on', next)
      counterToggle.setAttribute('aria-checked', String(next))
      showToast(next ? 'Live counter enabled.' : 'Live counter hidden.', 'success')
    }
  })
}
function renderReport(r) {
  const listing = r.listing
  const listingTitle = listing ? listing.title : '(listing deleted)'
  const reasonLabel = REPORT_REASONS[r.reason] || r.reason
  return `
    <div class="report-row">
      <div class="report-info">
        <div class="report-listing-title">${escapeHtml(listingTitle)}</div>
        <div class="report-meta">
          <span class="report-reason-chip">${escapeHtml(reasonLabel)}</span>
          ${listing ? `Owner: ${escapeHtml(listing.owner_name || '-')} · ` : ''}${formatRelativeTime(r.created_at)}
        </div>
        ${r.notes ? `<div class="report-notes">"${escapeHtml(r.notes)}"</div>` : ''}
      </div>
      <div class="report-actions">
        ${listing ? `<button class="btn-secondary" data-report-action="view" data-report-id="${escapeHtml(r.id)}" data-listing-id="${escapeHtml(listing.id)}">View</button>` : ''}
        <button class="btn-secondary" data-report-action="dismiss" data-report-id="${escapeHtml(r.id)}">Dismiss</button>
      </div>
    </div>
  `
}
async function handleReportAction(reportId, action, listingId) {
  if (action === 'view' && listingId) {
    let listing = allListings.find(l => l.id === listingId)
    if (!listing) {
      const { data } = await supabase.from('listings').select('*').eq('id', listingId).maybeSingle()
      listing = data
    }
    if (listing) showModal(listing)
    else showToast('Listing not found.', 'error')
    return
  }
  if (action === 'dismiss') {
    const ok = await customConfirm({
      title: 'Dismiss this report?',
      message: 'The report will be marked as reviewed and removed from the pending list.',
      confirmText: 'Dismiss',
    })
    if (!ok) return
    const { error } = await supabase.from('reports').update({ status: 'dismissed' }).eq('id', reportId)
    if (error) { showToast("Couldn't dismiss: " + error.message, 'error'); return }
    showToast('Report dismissed.', 'success')
    await loadAdminStats()
  }
}
// ---- ADMIN DIAGNOSTICS ----
function wireDiagnostics(content) {
  const errorLogList = content.querySelector('#error-log-list')
  if (errorLogList) errorLogList.innerHTML = renderErrorLogEntries()

  const runBtn = content.querySelector('#run-health-checks')
  if (runBtn) runBtn.addEventListener('click', async () => {
    const out = content.querySelector('#health-results')
    runBtn.disabled = true
    if (out) out.innerHTML = '<div class="loading">Running checks…</div>'
    const results = await runHealthChecks()
    if (out) out.innerHTML = renderHealthChecks(results)
    runBtn.disabled = false
  })

  const copyBtn = content.querySelector('#copy-error-log')
  if (copyBtn) copyBtn.addEventListener('click', async () => {
    const log = readErrorLog()
    const text = log.length
      ? log.map(e => `[${e.time}] ${e.type}: ${e.message}${e.source ? ' (' + e.source + ')' : ''}`).join('\n')
      : 'No errors logged.'
    try {
      await navigator.clipboard.writeText(text)
      showToast('Error log copied.', 'success')
    } catch (err) {
      showToast("Couldn't copy to clipboard.", 'error')
    }
  })

  const clearBtn = content.querySelector('#clear-error-log')
  if (clearBtn) clearBtn.addEventListener('click', async () => {
    const ok = await customConfirm({
      title: 'Clear the error log?',
      message: 'This removes all captured errors from this browser. It cannot be undone.',
      confirmText: 'Clear',
    })
    if (!ok) return
    try { localStorage.removeItem(ERROR_LOG_KEY) } catch (e) {}
    if (errorLogList) errorLogList.innerHTML = renderErrorLogEntries()
    showToast('Error log cleared.', 'success')
  })
}
async function runHealthChecks() {
  const results = []
  const push = (label, status, detail) => results.push({ label, status, detail })

  // Network
  push('Network', navigator.onLine ? 'pass' : 'warn',
    navigator.onLine ? 'Browser reports online.' : 'Browser is offline. Live data will not load.')

  // Auth session
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (session && session.user) push('Sign-in session', 'pass', `Signed in as ${session.user.email}.`)
    else push('Sign-in session', 'warn', 'No active session.')
  } catch (e) { push('Sign-in session', 'fail', e.message) }

  // Admin rights
  push('Admin access', isAdmin ? 'pass' : 'warn',
    isAdmin ? 'Current user has admin rights.' : 'Current user is not an admin.')

  // Database tables
  const tables = ['listings', 'profiles', 'reports', 'site_settings']
  for (const t of tables) {
    try {
      const { count, error } = await supabase.from(t).select('*', { count: 'exact', head: true })
      if (error) push(`Table: ${t}`, 'fail', error.message)
      else push(`Table: ${t}`, 'pass', `Reachable${typeof count === 'number' ? ` (${count} rows readable)` : ''}.`)
    } catch (e) { push(`Table: ${t}`, 'fail', e.message) }
  }

  // Storage bucket
  try {
    const { error } = await supabase.storage.from(PHOTO_BUCKET).list('', { limit: 1 })
    if (error) push(`Storage: ${PHOTO_BUCKET}`, 'fail', error.message)
    else push(`Storage: ${PHOTO_BUCKET}`, 'pass', 'Photo bucket reachable.')
  } catch (e) { push(`Storage: ${PHOTO_BUCKET}`, 'fail', e.message) }

  // Service worker
  try {
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.getRegistration()
      if (reg && (reg.active || reg.waiting || reg.installing)) {
        const state = reg.active ? 'active' : reg.waiting ? 'waiting' : 'installing'
        push('Service worker', 'pass', `Registered (${state}).`)
      } else push('Service worker', 'warn', 'Not registered yet. Reload once to install it.')
    } else push('Service worker', 'warn', 'Not supported in this browser.')
  } catch (e) { push('Service worker', 'fail', e.message) }

  // Offline cache
  try {
    if ('caches' in window) {
      const keys = await caches.keys()
      const gsCache = keys.find(k => k.startsWith('greenshelf-'))
      if (gsCache) push('Offline cache', 'pass', `Present (${gsCache}).`)
      else push('Offline cache', 'warn', 'No GreenShelf cache found yet.')
    } else push('Offline cache', 'warn', 'Cache API not supported.')
  } catch (e) { push('Offline cache', 'fail', e.message) }

  // Captured errors
  const errCount = readErrorLog().length
  push('Captured errors', errCount === 0 ? 'pass' : 'warn',
    errCount === 0 ? 'No JavaScript errors logged.' : `${errCount} error${errCount === 1 ? '' : 's'} logged. See the error log below.`)

  return results
}
function renderHealthChecks(results) {
  const counts = results.reduce((a, r) => (a[r.status] = (a[r.status] || 0) + 1, a), {})
  const summary = `${counts.pass || 0} passed, ${counts.warn || 0} warnings, ${counts.fail || 0} failed`
  return `
    <div class="diag-summary">${summary}</div>
    <ul class="diag-list">
      ${results.map(r => `
        <li class="diag-row diag-${r.status}">
          <span class="diag-dot" aria-hidden="true"></span>
          <span class="diag-text">
            <span class="diag-label">${escapeHtml(r.label)}</span>
            <span class="diag-detail">${escapeHtml(r.detail || '')}</span>
          </span>
          <span class="diag-badge">${r.status}</span>
        </li>
      `).join('')}
    </ul>
  `
}
function renderErrorLogEntries() {
  const log = readErrorLog()
  if (!log.length) return '<p class="muted">No errors captured. 🌿</p>'
  return log.map(e => `
    <div class="error-entry">
      <div class="error-entry-head">
        <span class="error-entry-type error-${e.type === 'promise' ? 'promise' : 'error'}">${escapeHtml(e.type)}</span>
        <span class="error-entry-time">${formatRelativeTime(e.time)}</span>
      </div>
      <div class="error-entry-msg">${escapeHtml(e.message)}</div>
      ${e.source ? `<div class="error-entry-src">${escapeHtml(e.source)}</div>` : ''}
    </div>
  `).join('')
}
function countBy(items, key) {
  // Null prototype: user-entered values like "constructor" must not collide
  // with Object.prototype keys and corrupt the counts
  const counts = Object.create(null)
  for (const item of items) {
    const v = item[key]
    if (v == null || v === '') continue
    counts[v] = (counts[v] || 0) + 1
  }
  return Object.entries(counts).sort((a, b) => b[1] - a[1])
}
function renderBars(entries, limit = 8) {
  if (entries.length === 0) return '<p class="muted">No data yet.</p>'
  const visible = entries.slice(0, limit)
  const more = entries.length - limit
  const max = Math.max(...visible.map(([_, c]) => c), 1)
  const bars = visible.map(([label, count]) => {
    const pct = (count / max) * 100
    return `
      <div class="bar-row">
        <div class="bar-label" title="${escapeHtml(label)}">${escapeHtml(label)}</div>
        <div class="bar-track"><div class="bar-fill" style="width: ${pct}%"></div></div>
        <div class="bar-count">${count}</div>
      </div>
    `
  }).join('')
  return bars + (more > 0 ? `<div class="muted" style="margin-top: 8px;">+ ${more} more</div>` : '')
}
function formatRelativeTime(iso) {
  if (!iso) return '-'
  const diff = Date.now() - new Date(iso).getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  return new Date(iso).toLocaleDateString()
}
async function loadProfile() {
  await loadCurrentUserProfile()
  if (!currentProfile) return
  const form = document.getElementById('profile-form')
  if (form) {
    form.full_name.value = currentProfile.full_name || ''
    form.school.value = currentProfile.school || ''
    form.grade_level.value = currentProfile.grade_level || ''
  }
  const emailEl = document.getElementById('profile-email')
  if (emailEl) emailEl.textContent = currentUser.email
}
async function saveProfile(e) {
  e.preventDefault()
  const form = e.target
  const errorDiv = document.getElementById('profile-error')
  const savedDiv = document.getElementById('profile-saved')
  const btn = document.getElementById('profile-save')
  errorDiv.textContent = ''
  savedDiv.style.display = 'none'
  btn.disabled = true
  btn.textContent = 'Saving…'
  const updates = {
    full_name: form.full_name.value.trim().slice(0, 60) || null,
    school: form.school.value.trim().slice(0, 120) || null,
    grade_level: form.grade_level.value || null,
  }
  const { error } = await supabase.from('profiles').update(updates).eq('id', currentUser.id)
  btn.disabled = false
  btn.textContent = 'Save changes'
  if (error) { errorDiv.textContent = error.message; return }
  savedDiv.style.display = 'inline'
  setTimeout(() => { savedDiv.style.display = 'none' }, 2000)
  currentProfile = { ...currentProfile, ...updates }
}
async function deleteAccount() {
  const ok = await customConfirm({
    title: 'Delete your account?',
    message: 'All your listings will be permanently removed and your profile cleared. Your email is retained. To have it fully erased, email greenshelf1320@gmail.com.',
    confirmText: 'Yes, delete everything',
    danger: true,
  })
  if (!ok) return
  const { error: e1 } = await supabase.from('listings').delete().eq('owner_id', currentUser.id)
  if (e1) { showToast("Couldn't delete listings: " + e1.message, 'error'); return }
  const { error: e2 } = await supabase.from('profiles').update({
    full_name: null, school: null, grade_level: null,
  }).eq('id', currentUser.id)
  if (e2) { showToast("Couldn't clear profile: " + e2.message, 'error'); return }
  await supabase.auth.signOut()
  showToast("Account data deleted. We'll miss you 🌿", 'success')
  showBrowseView()
}
async function loadMyListings() {
  const { data, error } = await supabase
    .from('listings').select('*').eq('owner_id', currentUser.id)
    .order('created_at', { ascending: false })
  if (error) {
    console.error(error)
    document.getElementById('my-listings-grid').innerHTML = `<div class="empty">Couldn't load your listings.</div>`
    return
  }
  myListings = data || []
  renderMyListings(myListings)
}
function renderMyListings(listings) {
  const grid = document.getElementById('my-listings-grid')
  const meta = document.getElementById('my-listings-meta')
  meta.textContent = listings.length === 1 ? '1 listing' : `${listings.length} listings`
  if (listings.length === 0) {
    grid.innerHTML = `<div class="empty">You haven't listed any books yet. Click <strong>+ List a book</strong> at the top to share one.</div>`
    return
  }
  grid.innerHTML = listings.map(renderCard).join('')
}
// ---- CREATE / EDIT LISTING ----
function showCreateListingModal(editingListing = null, prefillDraft = null) {
  const isEditing = !!editingListing
  const isGuest = !currentUser && !isEditing
  let modal = document.getElementById('create-modal')
  if (!modal) {
    modal = document.createElement('div')
    modal.id = 'create-modal'
    modal.className = 'modal-backdrop hidden'
    document.body.appendChild(modal)
  }
  const grades = Array.from({length: 12}, (_, i) => `Grade ${i + 1}`)
  const subjects = [...BASE_SUBJECTS, 'Other']
  const d = isEditing ? editingListing : (prefillDraft || {})
  const isCustomSubject = isEditing && d.subject && !BASE_SUBJECTS.includes(d.subject)
  const subjectValue = isCustomSubject ? 'Other' : (d.subject || '')
  const customSubjectValue = isCustomSubject ? d.subject : ''
  const isCustomArea = isEditing && d.area && !ALL_AREAS.includes(d.area)
  const areaValue = isCustomArea ? 'Other' : (d.area || '')
  const customAreaValue = isCustomArea ? d.area : ''
  const ownerNameValue = d.owner_name || (currentProfile && currentProfile.full_name) || ''
  const schoolValue = d.school || (currentProfile && currentProfile.school) || ''
  let photoSlots = (isEditing && Array.isArray(d.photos)) ? d.photos.map(url => ({ url, file: null })) : []
  modal.innerHTML = `
    <div class="modal create-modal">
      <button class="modal-close" id="create-close" aria-label="Close">×</button>
      <div class="auth-body">
        <h2 class="auth-title">${isEditing ? 'Edit listing' : 'List a book'}</h2>
        <p class="auth-subtitle">${isEditing ? 'Update the details below.' : (isGuest ? "Fill this in, then we'll have you create a quick account to publish." : 'Pass it on to another student. No money, no fuss.')}</p>
        <form id="create-form">
          <div class="auth-label">Photos (optional, up to ${MAX_PHOTOS})
            <div class="photos-grid" id="photos-grid"></div>
            <input type="file" id="photos-input" accept="image/*" class="visually-hidden-input">
          </div>
          <label class="auth-label">Book title
            <input type="text" name="title" required maxlength="120" value="${escapeHtml(d.title || '')}">
          </label>
          <div class="form-row">
            <label class="auth-label">Subject
              <select name="subject" required>
                <option value="">Choose…</option>
                ${subjects.map(s => `<option ${s === subjectValue ? 'selected' : ''}>${s}</option>`).join('')}
              </select>
            </label>
            <label class="auth-label">Grade
              <select name="grade_level" required>
                <option value="">Choose…</option>
                ${grades.map(g => `<option ${g === d.grade_level ? 'selected' : ''}>${g}</option>`).join('')}
              </select>
            </label>
          </div>
          <label class="auth-label" id="custom-subject-wrap" style="display: ${isCustomSubject ? '' : 'none'};">Specify subject
            <input type="text" name="custom_subject" maxlength="60" placeholder="e.g. Geography, Computer Science" value="${escapeHtml(customSubjectValue)}" ${isCustomSubject ? 'required' : ''}>
          </label>
          <label class="auth-label">Pickup area
            <select name="area" required>
              <option value="">Choose your area…</option>
              <optgroup label="Muscat">
                ${AREAS_MUSCAT.map(a => `<option ${a === areaValue ? 'selected' : ''}>${a}</option>`).join('')}
              </optgroup>
              <optgroup label="Outside Muscat">
                ${AREAS_OTHER_OMAN.map(a => `<option ${a === areaValue ? 'selected' : ''}>${a}</option>`).join('')}
              </optgroup>
              <option value="Other" ${areaValue === 'Other' ? 'selected' : ''}>Other</option>
            </select>
            <small style="display:block; margin-top:4px; color: var(--text-muted); font-size: 0.85rem;">Just the general area, please. Never share your full address.</small>
          </label>
          <label class="auth-label" id="custom-area-wrap" style="display: ${isCustomArea ? '' : 'none'};">Specify area
            <input type="text" name="custom_area" maxlength="60" placeholder="Type the area only, not your address" value="${escapeHtml(customAreaValue)}" ${isCustomArea ? 'required' : ''}>
          </label>
          <label class="auth-label">School (optional)
            <input type="text" name="school" maxlength="120" placeholder="e.g. British School Muscat" value="${escapeHtml(schoolValue)}">
          </label>
          <label class="auth-label">Condition
            <select name="condition" required>
              <option value="">Choose…</option>
              <option value="new" ${d.condition === 'new' ? 'selected' : ''}>New</option>
              <option value="good" ${d.condition === 'good' ? 'selected' : ''}>Good</option>
              <option value="worn" ${d.condition === 'worn' ? 'selected' : ''}>Worn</option>
            </select>
          </label>
          <label class="auth-label">About this book (optional)
            <textarea name="description" rows="3" maxlength="500" placeholder="Anything worth mentioning: highlighting, missing pages, etc.">${escapeHtml(d.description || '')}</textarea>
          </label>
          <label class="auth-label">Your name (shown on the listing)
            <input type="text" name="owner_name" required maxlength="60" value="${escapeHtml(ownerNameValue)}">
          </label>
          <div class="form-row">
            <label class="auth-label">Contact via
              <select name="contact_method" required>
                <option value="whatsapp" ${d.contact_method === 'whatsapp' ? 'selected' : ''}>WhatsApp</option>
                <option value="phone" ${d.contact_method === 'phone' ? 'selected' : ''}>Phone</option>
                <option value="email" ${d.contact_method === 'email' ? 'selected' : ''}>Email</option>
              </select>
            </label>
            <label class="auth-label">Contact details
              <input type="text" name="contact_value" required maxlength="60" placeholder="96891234567" value="${escapeHtml(d.contact_value || '')}">
              <small style="display:block; margin-top:4px; color: var(--text-muted); font-size: 0.85rem;">Shown on your listing so people can reach you directly. For phone or WhatsApp, include the 968 country code.</small>
            </label>
          </div>
          <div class="auth-error" id="create-error"></div>
          <button type="submit" class="btn-primary auth-submit" id="create-submit">${isEditing ? 'Save changes' : (isGuest ? 'Continue → Create account' : 'Post listing')}</button>
        </form>
      </div>
    </div>
  `
  modal.classList.remove('hidden')
  function renderPhotosGrid() {
    const grid = document.getElementById('photos-grid')
    let html = photoSlots.map((slot, i) => {
      const src = slot.url || (slot.file ? URL.createObjectURL(slot.file) : '')
      return `
        <div class="photo-slot">
          <img src="${escapeHtml(src)}" alt="Selected photo ${i + 1}" loading="lazy">
          <button type="button" class="photo-remove" data-index="${i}" aria-label="Remove photo ${i + 1}">×</button>
        </div>
      `
    }).join('')
    if (photoSlots.length < MAX_PHOTOS) {
      // A real <label for> opens the picker natively. iOS Safari blocks a
      // programmatic input.click(), which made "tap does nothing" on phones.
      html += `<label class="photo-slot empty" id="add-photo-slot" for="photos-input"><span>+ Add photo</span></label>`
    }
    grid.innerHTML = html
    grid.querySelectorAll('.photo-remove').forEach(btn => {
      btn.addEventListener('click', () => {
        photoSlots.splice(Number(btn.dataset.index), 1)
        renderPhotosGrid()
      })
    })
    // No click handler needed: the label[for] opens the file picker natively,
    // which is the only reliable way on iOS Safari.
  }
  renderPhotosGrid()
  document.getElementById('photos-input').addEventListener('change', (e) => {
    const file = e.target.files[0]
    if (!file) return
    if (!isSafePhoto(file)) { showToast('That file is not a supported photo. Try a JPG, PNG, or HEIC.', 'error'); e.target.value = ''; return }
    if (file.size > 5 * 1024 * 1024) { showToast('Image is over 5MB.', 'error'); e.target.value = ''; return }
    photoSlots.push({ url: null, file })
    e.target.value = ''
    renderPhotosGrid()
  })
  const subjectSelect = modal.querySelector('select[name="subject"]')
  const customSubjectWrap = modal.querySelector('#custom-subject-wrap')
  const customSubjectInput = customSubjectWrap.querySelector('input[name="custom_subject"]')
  subjectSelect.addEventListener('change', () => {
    if (subjectSelect.value === 'Other') {
      customSubjectWrap.style.display = ''
      customSubjectInput.required = true
    } else {
      customSubjectWrap.style.display = 'none'
      customSubjectInput.required = false
      customSubjectInput.value = ''
    }
  })
  const areaSelect = modal.querySelector('select[name="area"]')
  const customAreaWrap = modal.querySelector('#custom-area-wrap')
  const customAreaInput = customAreaWrap.querySelector('input[name="custom_area"]')
  areaSelect.addEventListener('change', () => {
    if (areaSelect.value === 'Other') {
      customAreaWrap.style.display = ''
      customAreaInput.required = true
    } else {
      customAreaWrap.style.display = 'none'
      customAreaInput.required = false
      customAreaInput.value = ''
    }
  })
  modal.querySelector('#create-close').addEventListener('click', closeCreateModal)
  modal.querySelector('.modal').addEventListener('click', e => e.stopPropagation())
  modal.addEventListener('click', (e) => { if (e.target === modal) closeCreateModal() })
  modal.querySelector('#create-form').addEventListener('submit', async (e) => {
    e.preventDefault()
    const form = e.target
    const submitBtn = modal.querySelector('#create-submit')
    const errorDiv = modal.querySelector('#create-error')
    errorDiv.textContent = ''
    // Whitespace-only values satisfy the HTML required attribute but are junk data
    if (!form.title.value.trim() || !form.owner_name.value.trim() || !form.contact_value.value.trim()) {
      errorDiv.textContent = 'Please fill in the book title, your name, and your contact details.'
      return
    }
    const contactMethod = form.contact_method.value
    const contactValue = form.contact_value.value.trim()
    if (contactMethod === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactValue)) {
      errorDiv.textContent = "That email address doesn't look right. Double-check it?"
      return
    }
    if ((contactMethod === 'phone' || contactMethod === 'whatsapp') && !/^\+?[0-9 ()-]{7,20}$/.test(contactValue)) {
      errorDiv.textContent = "That number doesn't look right. Use digits with the 968 country code, e.g. 96891234567."
      return
    }
    const finalSubject = (form.subject.value === 'Other' && form.custom_subject && form.custom_subject.value.trim())
      ? form.custom_subject.value.trim()
      : form.subject.value
    const finalArea = (form.area.value === 'Other' && form.custom_area && form.custom_area.value.trim())
      ? form.custom_area.value.trim()
      : form.area.value
    // ---- GUEST PATH: save draft, prompt signup, auto-publish after auth ----
    if (isGuest) {
      // photos can't survive the redirect/storage round-trip easily, so we keep them in-memory
      // only if they're already-uploaded URLs. Files require auth to upload, so skip those.
      const photoUrlsSurvive = photoSlots.filter(s => s.url && !s.file).map(s => s.url)
      const draft = {
        title: form.title.value.trim(),
        subject: finalSubject,
        grade_level: form.grade_level.value,
        area: finalArea,
        school: form.school.value.trim() || null,
        condition: form.condition.value,
        description: form.description.value.trim() || null,
        owner_name: form.owner_name.value.trim(),
        contact_method: form.contact_method.value,
        contact_value: form.contact_value.value.trim(),
        photos: photoUrlsSurvive.length ? photoUrlsSurvive : null,
        _guestHadFiles: photoSlots.some(s => s.file),
        _ts: Date.now(),
      }
      try { localStorage.setItem('gs_pending_listing', JSON.stringify(draft)) } catch (_) {}
      closeCreateModal()
      showAuthModal({ pendingListing: true })
      return
    }
    submitBtn.disabled = true
    const photoUrls = []
    let uploadingShown = false
    for (const slot of photoSlots) {
      if (slot.url && !slot.file) { photoUrls.push(slot.url); continue }
      if (slot.file) {
        if (!uploadingShown) { submitBtn.textContent = 'Uploading photos…'; uploadingShown = true }
        const ext = safePhotoExt(slot.file)
        const fileName = `${currentUser.id}/${Date.now()}-${Math.random().toString(36).slice(2,7)}.${ext}`
        const { error: uploadError } = await supabase.storage.from(PHOTO_BUCKET).upload(fileName, slot.file, {
          contentType: slot.file.type || 'image/jpeg',
        })
        if (uploadError) {
          console.error('Photo upload failed:', uploadError)
          recordError('upload', uploadError.message, 'storage:' + PHOTO_BUCKET)
          errorDiv.textContent = `Couldn't upload photo: ${uploadError.message}`
          showToast(`Photo upload failed: ${uploadError.message}`, 'error')
          submitBtn.disabled = false
          submitBtn.textContent = isEditing ? 'Save changes' : 'Post listing'
          return
        }
        const { data: { publicUrl } } = supabase.storage.from(PHOTO_BUCKET).getPublicUrl(fileName)
        photoUrls.push(publicUrl)
      }
    }
    submitBtn.textContent = isEditing ? 'Saving…' : 'Posting…'
    const data = {
      title: form.title.value.trim(),
      subject: finalSubject,
      grade_level: form.grade_level.value,
      area: finalArea,
      school: form.school.value.trim() || null,
      condition: form.condition.value,
      description: form.description.value.trim() || null,
      owner_name: form.owner_name.value.trim(),
      contact_method: form.contact_method.value,
      contact_value: form.contact_value.value.trim(),
      photos: photoUrls.length > 0 ? photoUrls : null,
    }
    let result
    if (isEditing) {
      result = await supabase.from('listings').update(data).eq('id', editingListing.id)
    } else {
      data.owner_id = currentUser.id
      result = await supabase.from('listings').insert(data)
    }
    if (result.error) {
      errorDiv.textContent = result.error.message || "Something went wrong. Try again?"
      submitBtn.disabled = false
      submitBtn.textContent = isEditing ? 'Save changes' : 'Post listing'
      return
    }
    closeCreateModal()
    showToast(isEditing ? 'Listing updated.' : 'Posted! Your book is live 🌿', 'success')
    await refreshCurrentView()
  })
}
function closeCreateModal() {
  const modal = document.getElementById('create-modal')
  if (modal) modal.classList.add('hidden')
}
// ---- REPORT MODAL ----
function showReportModal(listing) {
  if (!currentUser) {
    closeModal()
    showAuthModal()
    showToast('Sign in to report a listing.', 'info')
    return
  }
  const overlay = document.createElement('div')
  overlay.className = 'modal-backdrop'
  overlay.innerHTML = `
    <div class="modal auth-modal">
      <button class="modal-close" id="report-close" aria-label="Close">×</button>
      <div class="auth-body">
        <h2 class="auth-title">Report this listing</h2>
        <p class="auth-subtitle">Tell us what's wrong with "${escapeHtml(listing.title)}". An admin will review.</p>
        <form id="report-form">
          <label class="auth-label">Reason
            <select name="reason" required>
              <option value="">Choose…</option>
              ${Object.entries(REPORT_REASONS).map(([k, v]) => `<option value="${k}">${escapeHtml(v)}</option>`).join('')}
            </select>
          </label>
          <label class="auth-label">Notes (optional)
            <textarea name="notes" rows="3" maxlength="500" placeholder="Anything else we should know?"></textarea>
          </label>
          <div class="auth-error" id="report-error"></div>
          <button type="submit" class="btn-primary auth-submit" id="report-submit">Submit report</button>
        </form>
      </div>
    </div>
  `
  document.body.appendChild(overlay)
  const close = () => overlay.remove()
  overlay.querySelector('#report-close').addEventListener('click', close)
  overlay.querySelector('.modal').addEventListener('click', e => e.stopPropagation())
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close() })
  overlay.querySelector('#report-form').addEventListener('submit', async (e) => {
    e.preventDefault()
    const form = e.target
    const btn = overlay.querySelector('#report-submit')
    const errorDiv = overlay.querySelector('#report-error')
    errorDiv.textContent = ''
    btn.disabled = true
    btn.textContent = 'Submitting…'
    const { error } = await supabase.from('reports').insert({
      listing_id: listing.id,
      reporter_id: currentUser.id,
      reason: form.reason.value,
      notes: form.notes.value.trim().slice(0, 500) || null,
    })
    if (error) {
      errorDiv.textContent = error.message
      btn.disabled = false
      btn.textContent = 'Submit report'
      return
    }
    close()
    showToast('Thanks, we\'ll review this listing.', 'success')
  })
}
// ---- LISTINGS ----
function renderLoadingSkeleton() {
  const grid = document.getElementById('listings-grid')
  if (!grid) return
  grid.innerHTML = Array.from({length: 6}).map(() => `
    <article class="skeleton-card">
      <div class="skeleton skeleton-image"></div>
      <div class="skeleton-body">
        <div class="skeleton skeleton-line title"></div>
        <div class="skeleton skeleton-line short"></div>
        <div class="skeleton-meta">
          <span class="skeleton skeleton-tag"></span>
          <span class="skeleton skeleton-tag"></span>
          <span class="skeleton skeleton-tag"></span>
        </div>
      </div>
    </article>
  `).join('')
  document.getElementById('listings-meta').textContent = ''
  const pag = document.getElementById('pagination')
  if (pag) pag.innerHTML = ''
}
async function loadListings() {
  renderLoadingSkeleton()
  const sixMonthsAgo = new Date(Date.now() - 1000 * 60 * 60 * 24 * 30 * 6).toISOString()
  const { data, error } = await supabase
    .from('listings').select('*').eq('status', 'available')
    .gte('created_at', sixMonthsAgo)
    .order('created_at', { ascending: false })
  if (error) {
    console.error('Supabase error:', error)
    document.getElementById('listings-grid').innerHTML = `<div class="empty">Couldn't load listings. Check the console.</div>`
    document.getElementById('listings-meta').textContent = 'Error loading'
    return
  }
  allListings = data || []
  ensureAreaFilter()
  updateSubjectFilterOptions()
  updateAreaFilterOptions()
  updateHeroStat()
  refreshImpactFallback()
  currentPage = 1
  applyFilters()
  openListingFromHash()
}
function ensureAreaFilter() {
  if (document.getElementById('area-filter')) return
  const filterGrid = document.querySelector('.filter-grid')
  if (!filterGrid) return
  const select = document.createElement('select')
  select.id = 'area-filter'
  select.setAttribute('aria-label', 'Filter by area')
  filterGrid.appendChild(select)
  select.addEventListener('change', applyFilters)
}
function updateSubjectFilterOptions() {
  const select = document.getElementById('subject-filter')
  if (!select) return
  const fromListings = [...new Set(allListings.map(l => l.subject).filter(Boolean))]
  const merged = [...new Set([...BASE_SUBJECTS, ...fromListings])].sort()
  const currentValue = select.value
  select.innerHTML = `<option value="">All subjects</option>` + merged.map(s => `<option>${escapeHtml(s)}</option>`).join('')
  if (currentValue && merged.includes(currentValue)) select.value = currentValue
}
function updateAreaFilterOptions() {
  const select = document.getElementById('area-filter')
  if (!select) return
  const fromListings = [...new Set(allListings.map(l => l.area).filter(Boolean))]
  const merged = [...new Set([...ALL_AREAS, ...fromListings])].sort()
  const currentValue = select.value
  select.innerHTML = `<option value="">All areas</option>` + merged.map(a => `<option>${escapeHtml(a)}</option>`).join('')
  if (currentValue && merged.includes(currentValue)) select.value = currentValue
}
function renderCard(l, i = 0) {
  const firstPhoto = (l.photos && l.photos.length > 0) ? l.photos[0] : null
  const moreCount = (l.photos && l.photos.length > 1) ? l.photos.length - 1 : 0
  const isNew = l.created_at && (Date.now() - new Date(l.created_at).getTime() < 7 * 24 * 60 * 60 * 1000)
  const claimed = l.status === 'claimed'
  const saved = isSaved(l.id)
  const heartSvg = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z"/></svg>`
  const pinSvg = `<svg class="card-location-icon" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>`
  return `
    <article class="card${claimed ? ' is-claimed' : ''}" data-id="${escapeHtml(l.id)}" style="--i:${i}">
      <div class="card-image${firstPhoto ? '' : ' no-photo'}">
        ${isNew && !claimed ? `<div class="card-new-badge">New</div>` : ''}
        <button type="button" class="card-save${saved ? ' is-saved' : ''}" data-save="${escapeHtml(l.id)}" aria-pressed="${saved}" aria-label="${saved ? 'Remove from saved' : 'Save this book'}" title="${saved ? 'Saved' : 'Save'}">${heartSvg}</button>
        ${firstPhoto ? `<img src="${escapeHtml(firstPhoto)}" alt="${escapeHtml(l.title)}" loading="lazy">` : bookCoverHTML(l)}
        ${moreCount > 0 ? `<div class="photo-count">+${moreCount}</div>` : ''}
      </div>
      <div class="card-body">
        <div class="card-title">${escapeHtml(l.title)}</div>
        <div class="card-meta">
          <span class="tag tag-grade">${escapeHtml(l.grade_level)}</span>
          <span class="tag tag-subject">${escapeHtml(l.subject)}</span>
          <span class="tag tag-condition ${escapeHtml(l.condition)}">${escapeHtml(l.condition)}</span>
        </div>
        ${l.area || l.school ? `<div class="card-location">${pinSvg}<span>${escapeHtml([l.area, l.school].filter(Boolean).join(' · '))}</span></div>` : ''}
      </div>
    </article>
  `
}
function renderListings(listings) {
  const grid = document.getElementById('listings-grid')
  const meta = document.getElementById('listings-meta')
  currentFilteredListings = listings
  const totalPages = Math.max(1, Math.ceil(listings.length / PAGE_SIZE))
  if (currentPage > totalPages) currentPage = 1
  renderFilterChips()
  updateSavedToggle()

  if (listings.length === 0) {
    const hasFilters = anyFiltersActive()
    const hasAnyListings = allListings.length > 0
    meta.textContent = '0 books'
    if (savedOnly) {
      const noneSaved = savedCount() === 0
      grid.innerHTML = `
        <div class="empty">
          <div class="empty-title">${noneSaved ? 'No saved books yet.' : 'None of your saved books match these filters.'}</div>
          <div class="empty-msg">${noneSaved ? 'Tap the heart on any book to keep it here for later. Your saves stay on this device, no account needed.' : 'Try clearing the search or filters.'}</div>
          <div class="empty-cta">
            <button type="button" class="btn btn-secondary" id="empty-saved-off">Browse all books</button>
          </div>
        </div>`
      const savedOffBtn = document.getElementById('empty-saved-off')
      if (savedOffBtn) savedOffBtn.addEventListener('click', () => { savedOnly = false; updateSavedToggle(); applyFilters() })
      renderPagination(1)
      return
    }
    if (hasFilters) {
      grid.innerHTML = `
        <div class="empty">
          <div class="empty-title">No books match your filters.</div>
          <div class="empty-msg">Try widening the search, or list a book yourself, you might be the first.</div>
          <div class="empty-cta">
            <button type="button" class="btn btn-secondary" id="empty-clear">Clear filters</button>
            <button type="button" class="btn btn-primary" id="empty-list">List a book</button>
          </div>
        </div>`
    } else if (!hasAnyListings) {
      grid.innerHTML = `
        <div class="empty">
          <div class="empty-title">No books yet.</div>
          <div class="empty-msg">GreenShelf is brand new. Be the first family in Oman to pass a textbook on. It takes under a minute.</div>
          <div class="empty-cta">
            <button type="button" class="btn btn-primary" id="empty-list">List a book</button>
          </div>
        </div>`
    } else {
      grid.innerHTML = `<div class="empty"><div class="empty-msg">No books here.</div></div>`
    }
    const clearBtn = document.getElementById('empty-clear')
    if (clearBtn) clearBtn.addEventListener('click', clearAllFilters)
    const listBtn = document.getElementById('empty-list')
    if (listBtn) listBtn.addEventListener('click', () => showCreateListingModal())
    renderPagination(1)
    return
  }
  const start = (currentPage - 1) * PAGE_SIZE
  const end = Math.min(start + PAGE_SIZE, listings.length)
  const pageItems = listings.slice(start, end)
  meta.textContent = listings.length === 1
    ? '1 book'
    : totalPages === 1
      ? `${listings.length} books`
      : `${listings.length} books · showing ${start + 1} to ${end}`
  grid.innerHTML = pageItems.map(renderCard).join('')
  renderPagination(totalPages)
}

// ---- FILTER CHIPS + CLEAR ----
function getActiveFilters() {
  return {
    search: (document.getElementById('search')?.value || '').trim(),
    grade: document.getElementById('grade-filter')?.value || '',
    subject: document.getElementById('subject-filter')?.value || '',
    condition: document.getElementById('condition-filter')?.value || '',
    area: document.getElementById('area-filter')?.value || '',
  }
}
function anyFiltersActive() {
  const f = getActiveFilters()
  return !!(f.search || f.grade || f.subject || f.condition || f.area)
}
function renderFilterChips() {
  const chipsEl = document.getElementById('filter-chips')
  if (!chipsEl) return
  const f = getActiveFilters()
  const chips = []
  if (f.search) chips.push({ key: 'search', label: 'Search', value: f.search })
  if (f.grade)  chips.push({ key: 'grade',  label: 'Grade',  value: f.grade })
  if (f.subject) chips.push({ key: 'subject', label: 'Subject', value: f.subject })
  if (f.condition) chips.push({ key: 'condition', label: 'Condition', value: f.condition.charAt(0).toUpperCase() + f.condition.slice(1) })
  if (f.area) chips.push({ key: 'area', label: 'Area', value: f.area })
  if (chips.length === 0) { chipsEl.innerHTML = ''; return }
  chipsEl.innerHTML = chips.map(c => `
    <span class="fchip">
      <span class="fchip-label">${escapeHtml(c.label)}</span>
      <span>${escapeHtml(c.value)}</span>
      <button type="button" class="fchip-x" data-key="${c.key}" aria-label="Remove ${escapeHtml(c.label)} filter">×</button>
    </span>
  `).join('') + (chips.length > 1 ? `<button type="button" class="fchip-clear" id="fchip-clear">Clear all</button>` : '')
  chipsEl.querySelectorAll('.fchip-x').forEach(btn => {
    btn.addEventListener('click', () => {
      const chip = btn.closest('.fchip')
      if (chip && !reduceMotion) {
        chip.classList.add('fchip-out')
        chip.addEventListener('animationend', () => clearFilter(btn.dataset.key), { once: true })
      } else {
        clearFilter(btn.dataset.key)
      }
    })
  })
  const clearBtn = chipsEl.querySelector('#fchip-clear')
  if (clearBtn) clearBtn.addEventListener('click', clearAllFilters)
}
function clearFilter(key) {
  const map = { search: 'search', grade: 'grade-filter', subject: 'subject-filter', condition: 'condition-filter', area: 'area-filter' }
  const el = document.getElementById(map[key])
  if (el) { el.value = ''; el.dispatchEvent(new Event(key === 'search' ? 'input' : 'change')) }
}
function clearAllFilters() {
  ['search', 'grade-filter', 'subject-filter', 'condition-filter', 'area-filter'].forEach(id => {
    const el = document.getElementById(id)
    if (el) el.value = ''
  })
  applyFilters()
  updateSearchClearBtn()
}
function updateSearchClearBtn() {
  const input = document.getElementById('search')
  const btn = document.getElementById('search-clear')
  if (!input || !btn) return
  if (input.value.trim()) btn.removeAttribute('hidden')
  else btn.setAttribute('hidden', '')
}
function renderPagination(totalPages) {
  const listingsSection = document.querySelector('.browse')
  if (!listingsSection) return
  let pag = document.getElementById('pagination')
  if (!pag) {
    pag = document.createElement('div')
    pag.id = 'pagination'
    pag.className = 'pagination'
    listingsSection.appendChild(pag)
  }
  if (totalPages <= 1) {
    pag.innerHTML = ''
    return
  }
  // Build the list of page numbers, with ellipsis when needed
  const pages = []
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i)
  } else {
    pages.push(1)
    if (currentPage > 3) pages.push('...')
    for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) {
      pages.push(i)
    }
    if (currentPage < totalPages - 2) pages.push('...')
    pages.push(totalPages)
  }
  pag.innerHTML = `
    <button class="pag-btn" ${currentPage === 1 ? 'disabled' : ''} data-page="${currentPage - 1}" aria-label="Previous page">‹</button>
    ${pages.map(p => p === '...'
      ? `<span class="pag-ellipsis">…</span>`
      : `<button class="pag-btn ${p === currentPage ? 'active' : ''}" data-page="${p}" aria-label="Page ${p}">${p}</button>`
    ).join('')}
    <button class="pag-btn" ${currentPage === totalPages ? 'disabled' : ''} data-page="${currentPage + 1}" aria-label="Next page">›</button>
  `
  pag.querySelectorAll('.pag-btn[data-page]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.disabled) return
      const p = Number(btn.dataset.page)
      if (p >= 1 && p <= totalPages && p !== currentPage) {
        currentPage = p
        renderListings(currentFilteredListings)
        const browseSection = document.getElementById('browse')
        if (browseSection) browseSection.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
    })
  })
}
function applyFilters() {
  const search = document.getElementById('search').value.toLowerCase().trim()
  const grade = document.getElementById('grade-filter').value
  const subject = document.getElementById('subject-filter').value
  const condition = document.getElementById('condition-filter').value
  const area = document.getElementById('area-filter') ? document.getElementById('area-filter').value : ''
  const savedSet = savedOnly ? new Set(getSavedIds()) : null
  const filtered = allListings.filter(l => {
    if (savedSet && !savedSet.has(String(l.id))) return false
    if (search && !l.title.toLowerCase().includes(search) && !l.subject.toLowerCase().includes(search)) return false
    if (grade && l.grade_level !== grade) return false
    if (subject && l.subject !== subject) return false
    if (condition && l.condition !== condition) return false
    if (area && l.area !== area) return false
    return true
  })
  currentPage = 1
  renderListings(filtered)
}
// ---- SHARING & URL ROUTING ----
async function shareListing(listing) {
  const url = `${window.location.origin}${window.location.pathname}#listing/${listing.id}`
  const shareData = {
    title: `${listing.title} · GreenShelf`,
    text: `Check out this book on GreenShelf: ${listing.title}`,
    url,
  }
  if (navigator.share) {
    try { await navigator.share(shareData) }
    catch (err) { if (err.name !== 'AbortError') console.error(err) }
  } else {
    try {
      await navigator.clipboard.writeText(url)
      showToast('Link copied. Paste it anywhere', 'success')
    } catch {
      showToast('Couldn\'t copy automatically. Link: ' + url, 'error')
    }
  }
}
function getListingIdFromHash() {
  const m = window.location.hash.match(/^#listing\/(.+)$/)
  return m ? m[1] : null
}
async function openListingFromHash() {
  const id = getListingIdFromHash()
  if (!id) return
  let listing = allListings.find(l => l.id === id)
  if (!listing) {
    const { data } = await supabase.from('listings').select('*').eq('id', id).maybeSingle()
    listing = data
  }
  if (listing) showModal(listing)
  else showToast('Listing not found.', 'error')
}
window.addEventListener('hashchange', () => {
  if (getListingIdFromHash()) openListingFromHash()
})
function showModal(listing) {
  const modal = document.getElementById('modal')
  const contactLink = getContactLink(listing.contact_method, listing.contact_value)
  const contactLabel = contactLabelFor(listing.contact_method)
  const isOwner = currentUser && listing.owner_id === currentUser.id
  const isClaimed = listing.status === 'claimed'
  const photos = (Array.isArray(listing.photos) ? listing.photos : [])
    .filter(p => typeof p === 'string' && /^https:\/\//.test(p))
  let photoBlockHtml
  if (photos.length === 0) {
    // Owners get a clear prompt to add photos to their own photoless listing.
    const addPhotoBtn = isOwner
      ? `<button type="button" class="add-photos-cta" id="add-photos-btn">
           <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><line x1="12" y1="11" x2="12" y2="17"/><line x1="9" y1="14" x2="15" y2="14"/></svg>
           Add photos
         </button>`
      : ''
    photoBlockHtml = `<div class="modal-image no-photo">${bookCoverHTML(listing)}${addPhotoBtn}</div>`
  } else {
    photoBlockHtml = `
      <div class="photo-carousel" data-index="0">
        <img src="${escapeHtml(photos[0])}" alt="${escapeHtml(listing.title)}" id="carousel-img" loading="lazy">
        ${photos.length > 1 ? `
          <button class="carousel-nav prev" id="carousel-prev" aria-label="Previous">‹</button>
          <button class="carousel-nav next" id="carousel-next" aria-label="Next">›</button>
          <div class="carousel-dots">
            ${photos.map((_, i) => `<span class="carousel-dot ${i === 0 ? 'active' : ''}" data-i="${i}"></span>`).join('')}
          </div>
        ` : ''}
      </div>
    `
  }
  const savedNow = isSaved(listing.id)
  const modalHeartSvg = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z"/></svg>`
  let actionsHtml = `
    <div class="owner-actions">
      <button class="btn-secondary action-save${savedNow ? ' is-saved' : ''}" id="save-btn" data-save="${escapeHtml(listing.id)}" aria-pressed="${savedNow}">${modalHeartSvg}<span class="save-btn-label">${savedNow ? 'Saved' : 'Save'}</span></button>
      <button class="btn-secondary action-share" id="share-btn">Share</button>
      ${isOwner ? `
        <button class="btn-secondary" id="edit-btn">Edit</button>
        <button class="btn-secondary action-claim" id="${isClaimed ? 'unclaim-btn' : 'claim-btn'}">${isClaimed ? 'Mark available' : 'Mark claimed'}</button>
        <button class="btn-secondary action-delete" id="delete-btn">Delete</button>
      ` : (isAdmin ? `<button class="btn-secondary action-delete" id="delete-btn">Delete (admin)</button>` : '')}
    </div>
  `
  let reportRowHtml = ''
  if (!isOwner) {
    reportRowHtml = `
      <div class="report-btn-row">
        <button type="button" class="report-link" id="report-btn">Report this listing</button>
      </div>
    `
  }
  modal.innerHTML = `
    <div class="modal">
      <button class="modal-close" aria-label="Close">×</button>
      ${photoBlockHtml}
      <div class="modal-body">
        <h2>${escapeHtml(listing.title)}</h2>
        <div class="modal-tags">
          ${isClaimed ? `<span class="tag tag-status claimed">Claimed</span>` : ''}
          <span class="tag tag-grade">${escapeHtml(listing.grade_level)}</span>
          <span class="tag tag-subject">${escapeHtml(listing.subject)}</span>
          <span class="tag tag-condition ${escapeHtml(listing.condition)}">${escapeHtml(listing.condition)}</span>
        </div>
        ${listing.area ? `<div class="modal-section"><h3>Pickup area</h3><div>${escapeHtml(listing.area)}</div></div>` : ''}
        ${listing.school ? `<div class="modal-section"><h3>School</h3><div>${escapeHtml(listing.school)}</div></div>` : ''}
        ${listing.description ? `<div class="modal-section"><h3>About this book</h3><div>${escapeHtml(listing.description)}</div></div>` : ''}
        <div class="modal-section">
          <h3>Get in touch</h3>
          <div class="contact-card">
            <div class="contact-name">${escapeHtml(listing.owner_name)}</div>
            <a href="${escapeHtml(contactLink)}" class="contact-link" target="_blank" rel="noopener noreferrer">${contactLabel} ${escapeHtml(listing.contact_value)}</a>
          </div>
        </div>
        ${actionsHtml}
        ${reportRowHtml}
      </div>
    </div>
  `
  modal.classList.remove('hidden')
  if (window.location.hash !== `#listing/${listing.id}`) {
    history.replaceState(null, '', `#listing/${listing.id}`)
  }
  modal.querySelector('.modal-close').addEventListener('click', closeModal)
  modal.querySelector('.modal').addEventListener('click', e => e.stopPropagation())
  modal.addEventListener('click', closeModal)
  modal.querySelector('#share-btn').addEventListener('click', () => shareListing(listing))
  const saveBtnModal = modal.querySelector('#save-btn')
  if (saveBtnModal) saveBtnModal.addEventListener('click', () => handleSaveToggle(listing.id, saveBtnModal))
  const reportBtn = modal.querySelector('#report-btn')
  if (reportBtn) reportBtn.addEventListener('click', () => showReportModal(listing))
  if (photos.length > 1) {
    let idx = 0
    const img = modal.querySelector('#carousel-img')
    const dots = modal.querySelectorAll('.carousel-dot')
    function setIdx(i) {
      idx = (i + photos.length) % photos.length
      img.src = /^https:\/\//.test(photos[idx]) ? photos[idx] : ''
      dots.forEach((d, j) => d.classList.toggle('active', j === idx))
    }
    modal.querySelector('#carousel-prev').addEventListener('click', (e) => { e.stopPropagation(); setIdx(idx - 1) })
    modal.querySelector('#carousel-next').addEventListener('click', (e) => { e.stopPropagation(); setIdx(idx + 1) })
    dots.forEach((dot, i) => dot.addEventListener('click', (e) => { e.stopPropagation(); setIdx(i) }))
  }
  if (isOwner) {
    modal.querySelector('#edit-btn').addEventListener('click', () => { closeModal(); showCreateListingModal(listing) })
    const addPhotosBtn = modal.querySelector('#add-photos-btn')
    if (addPhotosBtn) addPhotosBtn.addEventListener('click', () => { closeModal(); showCreateListingModal(listing) })
    if (isClaimed) {
      modal.querySelector('#unclaim-btn').addEventListener('click', () => markAsAvailable(listing.id))
    } else {
      modal.querySelector('#claim-btn').addEventListener('click', () => markAsClaimed(listing.id))
    }
    modal.querySelector('#delete-btn').addEventListener('click', () => deleteListing(listing.id, false))
  } else if (isAdmin) {
    modal.querySelector('#delete-btn').addEventListener('click', () => deleteListing(listing.id, true))
  }
}
async function markAsClaimed(id) {
  const ok = await customConfirm({
    title: 'Mark as claimed?',
    message: "It'll be removed from the public feed. You can mark it back as available anytime from your profile.",
    confirmText: 'Mark as claimed',
  })
  if (!ok) return
  const { error } = await supabase.from('listings').update({ status: 'claimed' }).eq('id', id)
  if (error) { showToast("Couldn't update: " + error.message, 'error'); return }
  closeModal()
  showToast('Marked as claimed.', 'success')
  await refreshCurrentView()
}
async function markAsAvailable(id) {
  const { error } = await supabase.from('listings').update({ status: 'available' }).eq('id', id)
  if (error) { showToast("Couldn't update: " + error.message, 'error'); return }
  closeModal()
  showToast('Back in the feed.', 'success')
  await refreshCurrentView()
}
async function deleteListing(id, asAdmin = false) {
  const ok = await customConfirm({
    title: asAdmin ? 'Delete this listing as admin?' : 'Delete this listing?',
    message: asAdmin
      ? "You're deleting someone else's listing. This can't be undone."
      : "This can't be undone. The listing will be permanently removed.",
    confirmText: 'Delete',
    danger: true,
  })
  if (!ok) return
  const { error } = await supabase.from('listings').delete().eq('id', id)
  if (error) { showToast("Couldn't delete: " + error.message, 'error'); return }
  closeModal()
  showToast(asAdmin ? 'Listing removed.' : 'Listing deleted.', 'success')
  await refreshCurrentView()
}
async function refreshCurrentView() {
  if (currentView === 'browse') await loadListings()
  else if (currentView === 'profile') await loadMyListings()
  else if (currentView === 'admin') await loadAdminStats()
}
function closeModal() {
  document.getElementById('modal').classList.add('hidden')
  if (window.location.hash.startsWith('#listing/')) {
    history.replaceState(null, '', window.location.pathname)
  }
}
// Normalise an Omani number to full international digits (968 + 8 local digits),
// however the lister typed it. Without this, a bare local number like "91234567"
// becomes tel:+91234567 (which dials India, +91) and wa.me/91234567 (which fails),
// so the one thing the whole site exists for, getting in touch, silently breaks.
function normalizeOmanDigits(value) {
  let d = String(value).replace(/\D/g, '')
  if (d.startsWith('00')) d = d.slice(2)            // drop 00 international prefix
  if (d.startsWith('968')) return d                 // already carries the Oman code
  if (d.startsWith('0')) d = d.replace(/^0+/, '')   // drop any domestic trunk zero
  if (d.length === 8) return '968' + d              // bare local number, add the code
  return d                                          // already qualified or foreign, leave as is
}
function getContactLink(method, value) {
  if (method === 'email') return `mailto:${encodeURIComponent(value)}`
  const digits = normalizeOmanDigits(value)
  if (method === 'whatsapp') return `https://wa.me/${digits}`
  if (method === 'phone') return `tel:+${digits}`
  return '#'
}
function contactLabelFor(method) {
  if (method === 'whatsapp') return 'WhatsApp:'
  if (method === 'phone') return 'Call:'
  if (method === 'email') return 'Email:'
  return ''
}
function escapeHtml(s) {
  if (s == null) return ''
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))
}
function handleCardClick(e) {
  const saveBtn = e.target.closest('.card-save')
  if (saveBtn) { e.stopPropagation(); e.preventDefault(); handleSaveToggle(saveBtn.dataset.save, saveBtn); return }
  const card = e.target.closest('.card')
  if (!card) return
  const list = currentView === 'browse' ? allListings : myListings
  const listing = list.find(l => l.id === card.dataset.id)
  if (listing) showModal(listing)
}
document.getElementById('search').addEventListener('input', () => { applyFilters(); updateSearchClearBtn() })
document.getElementById('grade-filter').addEventListener('change', applyFilters)
document.getElementById('subject-filter').addEventListener('change', applyFilters)
document.getElementById('condition-filter').addEventListener('change', applyFilters)
document.getElementById('listings-grid').addEventListener('click', handleCardClick)
const savedToggleEl = document.getElementById('saved-toggle')
if (savedToggleEl) savedToggleEl.addEventListener('click', () => {
  savedOnly = !savedOnly
  currentPage = 1
  updateSavedToggle()
  applyFilters()
})
const searchClearBtn = document.getElementById('search-clear')
if (searchClearBtn) searchClearBtn.addEventListener('click', () => {
  const input = document.getElementById('search')
  if (input) { input.value = ''; input.focus(); applyFilters(); updateSearchClearBtn() }
})
const popularRow = document.getElementById('popular-row')
if (popularRow) popularRow.addEventListener('click', (e) => {
  const chip = e.target.closest('.popular-chip')
  if (!chip) return
  if (chip.dataset.grade) { const s = document.getElementById('grade-filter'); if (s) s.value = chip.dataset.grade }
  if (chip.dataset.condition) { const s = document.getElementById('condition-filter'); if (s) s.value = chip.dataset.condition }
  if (chip.dataset.subject) {
    const s = document.getElementById('subject-filter')
    const has = s && [...s.options].some(o => o.value === chip.dataset.subject)
    if (has) s.value = chip.dataset.subject
    else { const si = document.getElementById('search'); if (si) si.value = chip.dataset.subject }
  }
  applyFilters()
  updateSearchClearBtn()
  document.getElementById('browse')?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' })
})
const logoLink = document.getElementById('logo-link')
if (logoLink) {
  logoLink.addEventListener('click', () => showBrowseView())
  logoLink.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); showBrowseView() }
  })
}
document.getElementById('footer-about').addEventListener('click', (e) => { e.preventDefault(); showAboutView() })
document.getElementById('footer-faq').addEventListener('click', (e) => { e.preventDefault(); showFaqView() })
const ctaListBtn = document.getElementById('cta-list-btn')
if (ctaListBtn) ctaListBtn.addEventListener('click', () => showCreateListingModal())
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
// Animated count-up
function animateCount(el, target, duration = 1400) {
  if (!el) return
  if (reduceMotion) { el.textContent = target.toLocaleString(); return }
  const start = performance.now()
  let done = false
  const step = (now) => {
    if (done) return
    const t = Math.min(1, (now - start) / duration)
    const eased = 1 - Math.pow(1 - t, 3)
    el.textContent = Math.round(target * eased).toLocaleString()
    if (t < 1) requestAnimationFrame(step)
    else done = true
  }
  requestAnimationFrame(step)
  // Safety net: if rAF is throttled or the tab never paints, guarantee the final value lands.
  setTimeout(() => { if (!done) { done = true; el.textContent = target.toLocaleString() } }, duration + 400)
}
// ---- THEME TOGGLE ----
function setTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme)
  try { localStorage.setItem('gs-theme', theme) } catch (e) {}
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', theme === 'dark' ? '#161208' : '#2d5016')
}
const themeToggle = document.getElementById('theme-toggle')
if (themeToggle) {
  themeToggle.addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light'
    setTheme(current === 'dark' ? 'light' : 'dark')
  })
}

// ---- SCROLL REVEAL ----
function registerReveal(root = document) {
  // app.js booted, so the head-script failsafe is no longer needed.
  if (window.__revealFailsafe) { clearTimeout(window.__revealFailsafe); window.__revealFailsafe = null }
  const els = root.querySelectorAll('.reveal:not(.is-visible)')
  if (!els.length) return
  if (reduceMotion || !('IntersectionObserver' in window)) {
    els.forEach(el => el.classList.add('is-visible'))
    return
  }
  const io = new IntersectionObserver((entries, obs) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible')
        obs.unobserve(entry.target)
      }
    })
  }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' })
  els.forEach(el => io.observe(el))
}
registerReveal()

// ---- STICKY HEADER STATE ----
// Over the leaf-canopy intro the header stays transparent (so the frosted glass never draws a
// band across the leaves); it frosts once you scroll past the intro into the content below.
const headerEl = document.querySelector('header')
if (headerEl) {
  const introEl = document.getElementById('intro')
  const frostAt = () => introEl ? Math.max(introEl.offsetHeight - window.innerHeight - 10, 8) : 8
  const onScroll = () => headerEl.classList.toggle('is-scrolled', window.scrollY > frostAt())
  window.addEventListener('scroll', onScroll, { passive: true })
  window.addEventListener('resize', onScroll, { passive: true })
  onScroll()
}

// ---- LIVE HERO STAT ----
function updateHeroStat() {
  const stat = document.getElementById('hero-stat')
  const num = document.getElementById('hero-stat-num')
  if (!stat || !num) return
  const count = allListings.length
  if (!siteSettings.show_live_counter || count <= 0) { stat.hidden = true; return }
  stat.hidden = false
  animateCount(num, count)
}
async function loadSiteSettings() {
  try {
    const { data, error } = await supabase.from('site_settings').select('key, value')
    if (error) return
    ;(data || []).forEach(row => {
      if (row.key === 'show_live_counter') siteSettings.show_live_counter = row.value === true || row.value === 'true'
    })
  } catch (e) { /* table may not exist yet, keep defaults */ }
  updateHeroStat()
}
async function setLiveCounter(enabled) {
  const { error } = await supabase.from('site_settings')
    .upsert({ key: 'show_live_counter', value: enabled }, { onConflict: 'key' })
  if (error) {
    console.error('setLiveCounter failed:', error)
    showToast("Couldn't save your change. Please try again.", 'error')
    return false
  }
  siteSettings.show_live_counter = enabled
  updateHeroStat()
  return true
}

// ---- IMPACT COUNTERS ----
// Environmental estimates per textbook kept in circulation.
const IMPACT_CO2_PER_BOOK = 2.5   // kg CO2e to produce one textbook
const IMPACT_PAPER_PER_BOOK = 1.2 // kg paper per textbook
let impactTargets = null
let impactBaseTotal = 0
function setImpact(total) {
  if (!total || total <= 0) return
  impactTargets = {
    books: total,
    co2: Math.round(total * IMPACT_CO2_PER_BOOK),
    paper: Math.round(total * IMPACT_PAPER_PER_BOOK),
  }
  initImpactCounters()
}
async function loadImpact() {
  try {
    const { count, error } = await supabase.from('listings').select('id', { count: 'exact' }).limit(1)
    if (!error && count) { impactBaseTotal = count; setImpact(count) }
  } catch (e) { /* fall back from loadListings */ }
}
// Called from loadListings once live data is in, in case the count query failed.
function refreshImpactFallback() {
  if (impactTargets) return
  setImpact(Math.max(impactBaseTotal, allListings.length))
}
let impactCountersStarted = false
let impactCountersWired = false
function initImpactCounters() {
  const section = document.getElementById('impact')
  if (!section || !impactTargets || impactCountersWired) return
  impactCountersWired = true
  let onScroll = null
  const run = () => {
    if (impactCountersStarted) return
    impactCountersStarted = true
    if (onScroll) window.removeEventListener('scroll', onScroll)
    animateCount(document.getElementById('impact-books'), impactTargets.books)
    animateCount(document.getElementById('impact-co2'), impactTargets.co2)
    animateCount(document.getElementById('impact-paper'), impactTargets.paper)
  }
  if (reduceMotion) { run(); return }
  const inView = () => {
    const r = section.getBoundingClientRect()
    return r.top < window.innerHeight * 0.85 && r.bottom > 0
  }
  if (inView()) { run(); return }
  onScroll = () => { if (inView()) run() }
  window.addEventListener('scroll', onScroll, { passive: true })
}

// ---- HERO PARALLAX + FLOAT ----
function initHeroMotion() {
  const visual = document.getElementById('hero-visual')
  if (!visual || reduceMotion) return
  const hero = visual.closest('.hero')
  const cards = [...visual.querySelectorAll('.float-card')]
  if (!cards.length) return
  const rots = [-7, 5, -2]
  const cfg = cards.map((el, i) => {
    const depth = parseFloat(el.dataset.depth) || 18
    return {
      el,
      depth,
      rot: rots[i] ?? 0,
      phase: i * 1.4,
      amp: 6 + i * 3,
      tilt: 7 + i * 3,        // closer cards lean further toward the pointer
      z: (depth - 24) * 1.4,  // base depth plane → real layer separation under perspective
    }
  })
  visual.classList.add('is-interactive')
  let tmx = 0, tmy = 0, mx = 0, my = 0, visible = true
  const clamp = (v) => v < -0.6 ? -0.6 : v > 0.6 ? 0.6 : v
  hero.addEventListener('pointermove', (e) => {
    const r = visual.getBoundingClientRect()
    tmx = clamp((e.clientX - r.left) / r.width - 0.5)
    tmy = clamp((e.clientY - r.top) / r.height - 0.5)
  })
  hero.addEventListener('pointerleave', () => { tmx = 0; tmy = 0 })
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([en]) => { visible = en.isIntersecting }, { threshold: 0 }).observe(hero)
  }
  const start = performance.now()
  function frame(now) {
    if (visible) {
      mx += (tmx - mx) * 0.07
      my += (tmy - my) * 0.07
      // sheen sweep follows the pointer across the whole cluster
      visual.style.setProperty('--lx', ((mx + 0.5) * 100).toFixed(1) + '%')
      visual.style.setProperty('--ly', ((my + 0.5) * 100).toFixed(1) + '%')
      const t = (now - start) / 1000
      for (const c of cfg) {
        const fy = Math.sin(t * 0.85 + c.phase) * c.amp
        const px = mx * c.depth
        const py = my * c.depth + fy
        const rx = (-my * c.tilt).toFixed(2)
        const ry = (mx * c.tilt).toFixed(2)
        c.el.style.transform =
          `translate3d(${px.toFixed(2)}px, ${py.toFixed(2)}px, ${c.z.toFixed(1)}px) ` +
          `rotateX(${rx}deg) rotateY(${ry}deg) rotateZ(${c.rot}deg)`
      }
    }
    requestAnimationFrame(frame)
  }
  requestAnimationFrame(frame)
}

// ---- MAGNETIC BUTTONS ----
function initMagnetic() {
  if (reduceMotion) return
  document.querySelectorAll('[data-magnetic]').forEach((el) => {
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect()
      const x = (e.clientX - r.left - r.width / 2) * 0.25
      const y = (e.clientY - r.top - r.height / 2) * 0.35
      el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`
    })
    el.addEventListener('pointerleave', () => { el.style.transform = '' })
  })
}

// ---- CARD 3D TILT ----
function initCardTilt() {
  const grid = document.getElementById('listings-grid')
  if (!grid || reduceMotion) return
  grid.addEventListener('pointermove', (e) => {
    const card = e.target.closest('.card')
    if (!card) return
    const img = card.querySelector('.card-image')
    if (!img) return
    const r = img.getBoundingClientRect()
    const px = (e.clientX - r.left) / r.width - 0.5
    const py = (e.clientY - r.top) / r.height - 0.5
    img.style.setProperty('--ry', (px * 7).toFixed(2) + 'deg')
    img.style.setProperty('--rx', (py * -6).toFixed(2) + 'deg')
  })
  grid.addEventListener('pointerout', (e) => {
    const card = e.target.closest('.card')
    if (!card || (e.relatedTarget && card.contains(e.relatedTarget))) return
    const img = card.querySelector('.card-image')
    if (img) { img.style.removeProperty('--rx'); img.style.removeProperty('--ry') }
  })
}

// shared scroll progress (0..1) through the intro, written by the leaf scroll handler
// and read by the WebGL light layer so both stay in lockstep without double maths.
let introProgress = 0

// ---- LEAF-CANOPY INTRO ----
// A screen-filling canopy that hangs from the top and lifts/parts away on scroll to reveal the hero.
// transform + opacity only (no per-leaf filters) so 100+ leaves stay at 60fps.
function initLeafIntro() {
  const intro = document.getElementById('intro')
  const stage = document.getElementById('intro-stage')
  const layer = document.getElementById('scatter-layer')
  if (!intro || !stage || !layer) return
  if (reduceMotion) { stage.style.setProperty('--lp', '1'); return }

  // seeded RNG so the layout is identical on every load
  const mulberry32 = (a) => () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296 }
  const rnd = mulberry32(20260626)

  // light → dark fill pairs: fresh greens through autumn gold / amber / russet (all on-brand)
  const LEAF_PAIRS = [
    ['#88b556', '#477f2c'], ['#a6c659', '#688f31'], ['#6fa472', '#3c7350'], ['#cba93f', '#947019'],
    ['#dc9a36', '#a85f1d'], ['#c56a3a', '#8a3f22'], ['#5f9140', '#36652a'], ['#b8862f', '#876016'],
  ]
  const leafSVG = (id, light, dark) => `<svg viewBox="0 0 64 64" aria-hidden="true">
    <defs><linearGradient id="${id}" x1="0.15" y1="0.05" x2="0.85" y2="0.95"><stop offset="0" stop-color="${light}"/><stop offset="1" stop-color="${dark}"/></linearGradient></defs>
    <path d="M32 2.5 C 13 17 11.5 41.5 32 61 C 52.5 41.5 51 17 32 2.5 Z" transform="translate(1.1 2.6)" fill="rgba(34,46,20,0.17)"/>
    <path d="M32 2.5 C 13 17 11.5 41.5 32 61 C 52.5 41.5 51 17 32 2.5 Z" fill="url(#${id})"/>
    <path d="M32 7 Q 30.5 34 32 58" fill="none" stroke="rgba(255,255,255,0.34)" stroke-width="1.5" stroke-linecap="round"/>
    <g fill="none" stroke="rgba(255,255,255,0.20)" stroke-width="1.1" stroke-linecap="round">
      <path d="M32 19 Q 25 21 20 28"/><path d="M33 30 Q 26 33 21.5 41"/><path d="M33 40 Q 27 43 23.5 49"/>
      <path d="M32 19 Q 39 21 44 28"/><path d="M33 30 Q 40 33 44.5 41"/><path d="M33 40 Q 39 43 42.5 49"/>
    </g>
    <path d="M32 60 Q 31.5 62.5 31 63.6" fill="none" stroke="${dark}" stroke-width="1.8" stroke-linecap="round"/>
  </svg>`

  // build an even, full-width canopy: dense ceiling across the top + columns trailing down the
  // left & right edges (full corners), short/clear in the centre for the headline, soft feather down.
  // lighter canopy on phones / low-power devices: fewer grid cells = fewer leaves to
  // transform per scroll frame, keeping the intro at 60fps. Positions stay percentage-based
  // so the canopy still spans the full width, just less dense.
  const isMobile = window.innerWidth < 700
  const COLS = isMobile ? 12 : 20, ROWS = isMobile ? 12 : 16
  // on phones the headline sits high in a tall, narrow viewport, so pull the canopy up:
  // a denser top strip that clears the eyebrow/headline at rest, still parting on scroll.
  const CENTRE_REACH = isMobile ? 24 : 42   // how far the centre column hangs down
  const CENTRE_LIFT = isMobile ? 9 : 11     // extra lift applied at dead-centre
  const SIDE_REACH = isMobile ? 28 : 42     // how far the left/right edge columns trail down
  let html = '', li = 0
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const left = (c + 0.5) / COLS * 100 + (rnd() * 6 - 3)
      const top = (r + 0.5) / ROWS * 108 - 8 + (rnd() * 6 - 3)
      if (top < 11 && left > 4 && left < 19) continue   // keep the logo wordmark clear
      const cen = 1 - Math.abs(left - 50) / 50
      const topReach = CENTRE_REACH - CENTRE_LIFT * cen  // desktop centre ~31/edges ~42; mobile ~15/~24
      const dTop = Math.max(0, 1 - (top + 8) / topReach)
      const dLeft = Math.max(0, 1 - left / 26) * Math.max(0, 1 - (top + 6) / SIDE_REACH)
      const dRight = Math.max(0, 1 - (100 - left) / 26) * Math.max(0, 1 - (top + 6) / SIDE_REACH)
      const dens = Math.max(dTop, dLeft, dRight)
      const prob = Math.pow(dens, 1.45)
      let stray = false
      if (rnd() > prob) {
        const clearZone = (top < 26 && (left < 32 || left > 68)) || (top < 64 && (left < 6 || left > 94))
        if (clearZone && rnd() < 0.06) stray = true
        else continue
      }
      const depth = rnd()
      const dx = left - 50, dy = top - 50
      const ang = Math.atan2(dy, dx)
      const mag = 16 + depth * 14
      const tx = (Math.cos(ang) * mag).toFixed(1)
      const ty = (Math.sin(ang) * mag - (8 + depth * 8)).toFixed(1)
      const ceiling = top < 6
      const size = Math.round((stray ? 26 : 36) + depth * (stray ? 22 : 44) + (ceiling ? 16 : 0) + rnd() * 14)
      const o0 = (stray ? (0.20 + depth * 0.16) : (0.74 + depth * 0.22)).toFixed(2)
      const r0 = (rnd() * 80 - 40).toFixed(0)
      const dr = ((rnd() * 150 + 70) * (rnd() < 0.5 ? -1 : 1)).toFixed(0)
      const s = (0.02 + (1 - depth) * 0.05).toFixed(3)
      const idle = rnd() < 0.35
      const fdur = (5.5 + rnd() * 4).toFixed(1)
      const fdelay = (-rnd() * 6).toFixed(1)
      // on-load entrance stagger: top of the canopy settles first, edges/lower leaves follow
      const ein = (Math.max(0, (top + 8) / 108) * 0.3 + rnd() * 0.1).toFixed(2)
      const pair = LEAF_PAIRS[li % LEAF_PAIRS.length]
      html += `<div class="leaf-card" style="left:${left.toFixed(1)}%; top:${top.toFixed(1)}%; width:${size}px; height:${size}px; --tx:${tx}vw; --ty:${ty}vh; --r0:${r0}deg; --dr:${dr}deg; --s:${s}; --depth:${depth.toFixed(2)}; --o0:${o0}; --fdur:${fdur}s; --fdelay:${fdelay}s; --ein:${ein}s; z-index:${Math.round(depth * 100)};"><div class="lf-in"><div class="lf-w${idle ? ' idle' : ''}">${leafSVG('lf' + li, pair[0], pair[1])}</div></div></div>`
      li++
    }
  }
  layer.innerHTML = html

  // scroll-driven progress → drives every leaf transform via the --p custom property
  const easeOutCubic = t => 1 - Math.pow(1 - t, 3)
  let ticking = false
  const update = () => {
    ticking = false
    const travel = intro.offsetHeight - window.innerHeight
    const p = travel > 0 ? Math.min(Math.max(window.scrollY / travel, 0), 1) : 0
    stage.style.setProperty('--p', p.toFixed(4))
    stage.style.setProperty('--lp', easeOutCubic(Math.min(p / 0.62, 1)).toFixed(4))
    introProgress = p
  }
  const onScroll = () => { if (!ticking) { ticking = true; requestAnimationFrame(update) } }
  window.addEventListener('scroll', onScroll, { passive: true })
  window.addEventListener('resize', update)
  update()

  // gentle cursor parallax on the canopy (lerped)
  let tmx = 0, tmy = 0, mx = 0, my = 0, raf = null
  const loop = () => {
    mx += (tmx - mx) * 0.08; my += (tmy - my) * 0.08
    layer.style.setProperty('--mx', mx.toFixed(4))
    layer.style.setProperty('--my', my.toFixed(4))
    if (Math.abs(tmx - mx) > 0.001 || Math.abs(tmy - my) > 0.001) raf = requestAnimationFrame(loop)
    else raf = null
  }
  window.addEventListener('pointermove', (e) => {
    tmx = (e.clientX / window.innerWidth - 0.5) * 2
    tmy = (e.clientY / window.innerHeight - 0.5) * 2
    if (!raf) raf = requestAnimationFrame(loop)
  }, { passive: true })
}

// ---- WEBGL VOLUMETRIC LIGHT ----
// Real god-rays through the canopy gap, rendered on the GPU: a fullscreen fragment
// shader (no library, no CDN) painting warm light shafts + a whisper of film grain
// that bloom as you scroll into the clearing. screen-blended over the scene, top-
// weighted so the headline stays crisp. If WebGL is unavailable or the shader fails
// to compile, the CSS .god-rays fallback stays and nothing here runs. Render buffer is
// deliberately low-res (soft light hides it) and paused off-screen to hold 60fps.
function initIntroFX() {
  if (reduceMotion) return
  const stage = document.getElementById('intro-stage')
  const canvas = document.getElementById('intro-fx')
  if (!stage || !canvas) return

  let gl
  try {
    gl = canvas.getContext('webgl', { alpha: true, antialias: false, premultipliedAlpha: false, powerPreference: 'low-power' })
  } catch (e) { gl = null }
  if (!gl) return

  const VERT = 'attribute vec2 aPos; void main(){ gl_Position = vec4(aPos, 0.0, 1.0); }'
  const FRAG = [
    'precision highp float;',
    'uniform vec2 uRes; uniform float uTime; uniform float uP; uniform vec2 uPtr; uniform vec3 uCol; uniform float uDark;',
    'float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }',
    'float noise(vec2 p){ vec2 i=floor(p), f=fract(p); float a=hash(i), b=hash(i+vec2(1.,0.)), c=hash(i+vec2(0.,1.)), d=hash(i+vec2(1.,1.)); vec2 u=f*f*(3.-2.*f); return mix(mix(a,b,u.x), mix(c,d,u.x), u.y); }',
    'float fbm(vec2 p){ float v=0., a=0.5; for(int i=0;i<4;i++){ v+=a*noise(p); p*=2.03; a*=0.5; } return v; }',
    'void main(){',
    '  vec2 uv = gl_FragCoord.xy / uRes;',           // y: 0 bottom, 1 top
    '  vec2 src = vec2(0.5 + uPtr.x*0.07, 1.06);',   // light source just above the top edge
    '  vec2 d = uv - src;',
    '  float dist = length(d);',
    '  float ang = atan(d.x, -d.y);',                // angle fanning down from the source
    '  float streak = fbm(vec2(ang*7.0, dist*2.4 - uTime*0.05));',
    '  streak = pow(clamp(streak, 0.0, 1.0), 1.7);',
    '  float fall = smoothstep(0.30, 1.0, uv.y);',   // bright at top, gone by mid-screen (headline safe)
    '  float core = smoothstep(0.85, 0.0, dist);',   // soft glow blob at the gap
    '  float rays = streak * fall;',
    '  float intensity = (core*0.55 + rays*0.95) * (0.30 + 0.78*uP);',
    '  float g = (hash(uv*uRes*0.5 + uTime) - 0.5) * 0.05 * fall;',  // subtle top-weighted grain
    '  vec3 col = uCol * (intensity + g);',
    '  col *= mix(0.85, 1.25, uDark);',              // a touch hotter in dark mode
    '  gl_FragColor = vec4(max(col, 0.0), 1.0);',    // black where unlit; screen blend drops it
    '}'
  ].join('\n')

  const compile = (type, src) => {
    const sh = gl.createShader(type)
    gl.shaderSource(sh, src); gl.compileShader(sh)
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) { gl.deleteShader(sh); return null }
    return sh
  }
  const vs = compile(gl.VERTEX_SHADER, VERT)
  const fs = compile(gl.FRAGMENT_SHADER, FRAG)
  if (!vs || !fs) return
  const prog = gl.createProgram()
  gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog)
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return
  gl.useProgram(prog)

  // fullscreen triangle
  const buf = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, buf)
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
  const aPos = gl.getAttribLocation(prog, 'aPos')
  gl.enableVertexAttribArray(aPos)
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0)

  const uRes = gl.getUniformLocation(prog, 'uRes')
  const uTime = gl.getUniformLocation(prog, 'uTime')
  const uP = gl.getUniformLocation(prog, 'uP')
  const uPtr = gl.getUniformLocation(prog, 'uPtr')
  const uCol = gl.getUniformLocation(prog, 'uCol')
  const uDark = gl.getUniformLocation(prog, 'uDark')

  // low-res backing store: light is soft, so ~0.5x stays crisp enough and very cheap
  const isMobile = window.innerWidth < 700
  const scale = isMobile ? 0.45 : 0.55
  const resize = () => {
    const r = stage.getBoundingClientRect()
    // fall back through layout queries so the buffer is never degenerate
    const cssW = r.width || stage.clientWidth || window.innerWidth || 1280
    const cssH = r.height || stage.clientHeight || window.innerHeight || 720
    canvas.width = Math.max(2, Math.round(cssW * scale))
    canvas.height = Math.max(2, Math.round(cssH * scale))
    gl.viewport(0, 0, canvas.width, canvas.height)
  }
  resize()
  window.addEventListener('resize', resize)

  // warm gold light, read from the live theme tokens so it tracks brand changes
  const cs = getComputedStyle(document.documentElement)
  const parseCol = (v, fb) => {
    const m = (v || '').trim().match(/^#?([0-9a-f]{6})$/i)
    if (!m) return fb
    const n = parseInt(m[1], 16)
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]
  }
  const warm = parseCol(cs.getPropertyValue('--gold-soft'), [0.85, 0.66, 0.31])

  let ptrX = 0, ptrTargetX = 0
  window.addEventListener('pointermove', (e) => { ptrTargetX = (e.clientX / window.innerWidth - 0.5) * 2 }, { passive: true })

  let visible = true
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([en]) => { visible = en.isIntersecting }, { threshold: 0 }).observe(stage)
  }

  const isDark = () => document.documentElement.getAttribute('data-theme') === 'dark'
  const start = performance.now()
  let running = true
  const render = (now) => {
    if (!running) return
    if (visible) {
      ptrX += (ptrTargetX - ptrX) * 0.05
      gl.uniform2f(uRes, canvas.width, canvas.height)
      gl.uniform1f(uTime, (now - start) / 1000)
      gl.uniform1f(uP, introProgress)
      gl.uniform2f(uPtr, ptrX, 0)
      gl.uniform3f(uCol, warm[0], warm[1], warm[2])
      gl.uniform1f(uDark, isDark() ? 1 : 0)
      gl.drawArrays(gl.TRIANGLES, 0, 3)
    }
    requestAnimationFrame(render)
  }
  // shader is live: hand the rays over from CSS to GPU and fade in
  stage.classList.add('webgl-on')
  requestAnimationFrame(() => canvas.classList.add('is-on'))
  requestAnimationFrame(render)
}

// ---- INTRO LIGHT-MOTE CURSOR ----
// A soft warm glow that trails the pointer through the canopy ("you carry light into the
// clearing"). Sits behind the leaves so it never washes out the headline, leaves the
// native cursor untouched, and only runs on fine pointers (skipped on touch / reduced motion).
function initIntroCursor() {
  if (reduceMotion) return
  if (!window.matchMedia || !window.matchMedia('(pointer: fine)').matches) return
  const stage = document.getElementById('intro-stage')
  if (!stage) return
  const dot = document.createElement('div')
  dot.className = 'intro-cursor'
  dot.setAttribute('aria-hidden', 'true')
  stage.appendChild(dot)
  let tx = 0, ty = 0, x = 0, y = 0, raf = null, active = false
  const loop = () => {
    x += (tx - x) * 0.18; y += (ty - y) * 0.18
    dot.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`
    if (Math.abs(tx - x) > 0.1 || Math.abs(ty - y) > 0.1) raf = requestAnimationFrame(loop)
    else raf = null
  }
  stage.addEventListener('pointermove', (e) => {
    const r = stage.getBoundingClientRect()
    tx = e.clientX - r.left; ty = e.clientY - r.top
    if (!active) { active = true; dot.classList.add('is-active') }
    if (!raf) raf = requestAnimationFrame(loop)
  }, { passive: true })
  stage.addEventListener('pointerleave', () => { active = false; dot.classList.remove('is-active') }, { passive: true })
}

// ---- AMBIENT FOREST SOUND ----
// Off by default, generated live with Web Audio (no audio files): filtered brown noise for
// the wind, two slow LFOs for gusts, and a faint band-passed rustle. Never autoplays (the
// AudioContext is built on the user's click), only sings while the intro is on screen, and
// drops to silence when the tab is hidden. If Web Audio is missing the control stays hidden.
function initAmbientSound() {
  const btn = document.getElementById('sound-toggle')
  if (!btn) return
  const AC = window.AudioContext || window.webkitAudioContext
  if (!AC) return
  btn.hidden = false

  let ctx = null, master = null, enabled = false, introVisible = true

  const build = () => {
    ctx = new AC()
    master = ctx.createGain()
    master.gain.value = 0
    master.connect(ctx.destination)

    // brown noise = the body of the wind
    const len = Math.floor(ctx.sampleRate * 4)
    const buf = ctx.createBuffer(1, len, ctx.sampleRate)
    const d = buf.getChannelData(0)
    let last = 0
    for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; last = (last + 0.02 * w) / 1.02; d[i] = last * 3.2 }

    const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 520; lp.Q.value = 0.6
    const wind = ctx.createGain(); wind.gain.value = 0.5
    src.connect(lp); lp.connect(wind); wind.connect(master)

    // slow gusts: LFOs sweep the cutoff + breathe the gain
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.06
    const lfoF = ctx.createGain(); lfoF.gain.value = 260
    lfo.connect(lfoF); lfoF.connect(lp.frequency)
    const lfo2 = ctx.createOscillator(); lfo2.frequency.value = 0.09
    const lfo2G = ctx.createGain(); lfo2G.gain.value = 0.16
    lfo2.connect(lfo2G); lfo2G.connect(wind.gain)

    // faint high rustle of leaves
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 2200; bp.Q.value = 0.7
    const rsrc = ctx.createBufferSource(); rsrc.buffer = buf; rsrc.loop = true
    const rgain = ctx.createGain(); rgain.gain.value = 0.04
    rsrc.connect(bp); bp.connect(rgain); rgain.connect(master)

    src.start(); rsrc.start(); lfo.start(); lfo2.start()
  }

  const target = () => (enabled && introVisible ? 0.13 : 0)
  const ramp = () => {
    if (!ctx) return
    const g = master.gain, t = target()
    g.cancelScheduledValues(ctx.currentTime)
    g.setValueAtTime(g.value, ctx.currentTime)
    g.linearRampToValueAtTime(t, ctx.currentTime + (t > 0 ? 1.1 : 0.6))
  }

  btn.addEventListener('click', async () => {
    if (!ctx) build()
    if (ctx.state === 'suspended') { try { await ctx.resume() } catch (e) {} }
    enabled = !enabled
    btn.setAttribute('aria-pressed', String(enabled))
    btn.setAttribute('aria-label', enabled ? 'Mute ambient forest sound' : 'Play ambient forest sound')
    ramp()
  })

  const stage = document.getElementById('intro-stage')
  if (stage && 'IntersectionObserver' in window) {
    new IntersectionObserver(([en]) => {
      introVisible = en.isIntersecting
      btn.classList.toggle('is-hidden', !introVisible)
      ramp()
    }, { threshold: 0 }).observe(stage)
  }

  document.addEventListener('visibilitychange', () => {
    if (!ctx) return
    if (document.hidden) { master.gain.cancelScheduledValues(ctx.currentTime); master.gain.setValueAtTime(0, ctx.currentTime) }
    else ramp()
  })
}

// ---- SEARCH SHORTCUT ----
// One search lives in the browse section. '/' jumps to it from anywhere on the page.
function initSearchShortcut() {
  document.addEventListener('keydown', (e) => {
    const tag = document.activeElement && document.activeElement.tagName
    const modalOpen = document.querySelector('.modal-backdrop:not(.hidden)')
    if (e.key === '/' && tag !== 'INPUT' && tag !== 'TEXTAREA' && tag !== 'SELECT' && !modalOpen) {
      e.preventDefault()
      const main = document.getElementById('search')
      const browse = document.getElementById('browse')
      if (browse) browse.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' })
      if (main) setTimeout(() => main.focus(), reduceMotion ? 0 : 360)
    }
  })
}

// ---- OFFLINE INDICATOR ----
// Quiet status pill that slides up when the connection drops and slides away when it
// returns. The cached shell still loads offline, but live listings need the network, so
// the message is honest about that.
function initOfflineIndicator() {
  const el = document.createElement('div')
  el.className = 'offline-banner'
  el.setAttribute('role', 'status')
  el.setAttribute('aria-live', 'polite')
  el.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1 1l22 22"/><path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55"/><path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39"/><path d="M10.71 5.05A16 16 0 0 1 22.58 9"/><path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/></svg><span>You're offline. New books won't load until you reconnect.</span>`
  document.body.appendChild(el)
  const sync = () => el.classList.toggle('is-visible', !navigator.onLine)
  window.addEventListener('online', sync)
  window.addEventListener('offline', sync)
  sync()
}

// ---- FIRST-PAINT CURTAIN ----
// The brand curtain in the markup plays + self-clears via CSS even without JS. Here we
// only make it skippable on first interaction and remove the node once it's done, so it
// never lingers in the DOM or eats clicks. Under reduced motion it's already display:none,
// so we just remove it immediately.
function initFirstPaint() {
  const curtain = document.querySelector('.intro-curtain')
  if (!curtain) return
  let removed = false
  const done = () => { if (removed) return; removed = true; cleanup(); curtain.remove() }
  if (reduceMotion) { done(); return }
  const skip = () => {
    if (removed) return
    curtain.classList.add('curtain-skip')
    setTimeout(done, 440)
    cleanup()
  }
  const cleanup = () => {
    window.removeEventListener('pointerdown', skip)
    window.removeEventListener('keydown', skip)
    window.removeEventListener('wheel', skip)
    window.removeEventListener('touchstart', skip)
  }
  curtain.addEventListener('animationend', (e) => { if (e.target === curtain) done() })
  window.addEventListener('pointerdown', skip, { passive: true })
  window.addEventListener('keydown', skip)
  window.addEventListener('wheel', skip, { passive: true })
  window.addEventListener('touchstart', skip, { passive: true })
  setTimeout(done, 2400)   // backstop: clear even if animationend never fires (e.g. backgrounded tab)
}

// ---- READING-PROGRESS LINE (Motion) ----
// Drives the top hairline's scaleX from page scroll. Uses Motion's scroll()
// (self-hosted at /motion.js, exposed as window.Motion) so the fill tracks the
// scrollbar precisely instead of a hand-rolled scroll listener. Degrades to a
// plain scroll listener if Motion is unavailable, and does nothing under reduced
// motion (the bar is display:none there anyway).
function initScrollProgress() {
  const bar = document.querySelector('.scroll-progress')
  if (!bar || reduceMotion) return
  const M = window.Motion
  if (M && typeof M.scroll === 'function' && typeof M.animate === 'function') {
    M.scroll(M.animate(bar, { scaleX: [0, 1] }, { ease: 'linear' }))
    return
  }
  // Fallback: no Motion, track scroll manually.
  const update = () => {
    const doc = document.documentElement
    const max = doc.scrollHeight - doc.clientHeight
    bar.style.transform = `scaleX(${max > 0 ? Math.min(1, window.scrollY / max) : 0})`
  }
  window.addEventListener('scroll', update, { passive: true })
  window.addEventListener('resize', update, { passive: true })
  update()
}

initScrollProgress()
initFirstPaint()
initHeroMotion()
initMagnetic()
initCardTilt()
initLeafIntro()
initIntroFX()
initIntroCursor()
initAmbientSound()
initSearchShortcut()
initOfflineIndicator()

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeModal()
    closeAuthModal()
    closeCreateModal()
  }
})
updateNav()
loadListings()
loadSiteSettings()
loadImpact()
;(async () => {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.user) {
      currentUser = session.user
      updateNav()
      loadCurrentUserProfile().then(() => updateNav()).catch(console.error)
    }
  } catch (e) {
    console.error('getSession failed:', e)
  }
})()
// Register service worker (PWA). Skipped in the native app: assets are already
// bundled in the binary, and a service worker under the capacitor:// scheme just
// adds noise without benefit.
if (!IS_NATIVE && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.error('SW registration failed:', err);
    });
  });
}
