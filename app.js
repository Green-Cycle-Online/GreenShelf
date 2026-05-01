import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm'

const SUPABASE_URL = 'https://wvladknkebqiqutboohw.supabase.co'
const SUPABASE_KEY = 'sb_publishable_J0JrrWBQipfP201_L3A0pw_UGF6R1qL'

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)
let allListings = []
let currentUser = null

// ---- AUTH ----
function updateNav() {
  const navAuth = document.getElementById('nav-auth')
  if (currentUser) {
    const email = currentUser.email
    const displayEmail = email.length > 22 ? email.slice(0, 20) + '…' : email
    navAuth.innerHTML = `
      <a href="#browse">Browse</a>
      <span class="nav-user">${escapeHtml(displayEmail)}</span>
      <button class="btn-secondary" id="signout-btn">Sign out</button>
    `
    document.getElementById('signout-btn').addEventListener('click', signOut)
  } else {
    navAuth.innerHTML = `
      <a href="#browse">Browse</a>
      <button class="btn-primary" id="signin-btn">Sign in</button>
    `
    document.getElementById('signin-btn').addEventListener('click', showAuthModal)
  }
}

function showAuthModal() {
  const modal = document.getElementById('auth-modal')
  modal.innerHTML = `
    <div class="modal auth-modal">
      <button class="modal-close" id="auth-close" aria-label="Close">×</button>
      <div class="auth-body">
        <h2 class="auth-title">Welcome to GreenCycle</h2>
        <p class="auth-subtitle">Sign in or create an account to share books.</p>
        <div class="auth-tabs">
          <button type="button" class="auth-tab active" data-mode="signin">Sign in</button>
          <button type="button" class="auth-tab" data-mode="signup">Create account</button>
        </div>
        <form id="auth-form">
          <label class="auth-label">
            Email
            <input type="email" id="auth-email" required autocomplete="email">
          </label>
          <label class="auth-label">
            Password
            <input type="password" id="auth-password" required minlength="6" autocomplete="current-password">
          </label>
          <div class="auth-error" id="auth-error"></div>
          <button type="submit" class="btn-primary auth-submit" id="auth-submit">Sign in</button>
        </form>
      </div>
    </div>
  `
  modal.classList.remove('hidden')

  let mode = 'signin'
  const tabs = modal.querySelectorAll('.auth-tab')
  const submitBtn = modal.querySelector('#auth-submit')
  const passwordInput = modal.querySelector('#auth-password')
  const errorDiv = modal.querySelector('#auth-error')

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'))
      tab.classList.add('active')
      mode = tab.dataset.mode
      submitBtn.textContent = mode === 'signin' ? 'Sign in' : 'Create account'
      passwordInput.autocomplete = mode === 'signin' ? 'current-password' : 'new-password'
      errorDiv.textContent = ''
    })
  })

  modal.querySelector('#auth-form').addEventListener('submit', async (e) => {
    e.preventDefault()
    const email = modal.querySelector('#auth-email').value.trim()
    const password = modal.querySelector('#auth-password').value
    errorDiv.textContent = ''
    submitBtn.disabled = true
    submitBtn.textContent = mode === 'signin' ? 'Signing in…' : 'Creating account…'

    try {
      if (mode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      } else {
        const { error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
      }
      closeAuthModal()
    } catch (err) {
      errorDiv.textContent = friendlyAuthError(err.message)
      submitBtn.disabled = false
      submitBtn.textContent = mode === 'signin' ? 'Sign in' : 'Create account'
    }
  })

  modal.querySelector('#auth-close').addEventListener('click', closeAuthModal)
  modal.querySelector('.modal').addEventListener('click', e => e.stopPropagation())
  modal.addEventListener('click', (e) => { if (e.target === modal) closeAuthModal() })
}

function closeAuthModal() {
  document.getElementById('auth-modal').classList.add('hidden')
}

function friendlyAuthError(msg) {
  if (!msg) return 'Something went wrong. Try again?'
  if (/invalid login credentials/i.test(msg)) return 'Wrong email or password.'
  if (/already registered/i.test(msg)) return 'An account with that email already exists. Try signing in.'
  if (/password.*6/i.test(msg)) return 'Password needs to be at least 6 characters.'
  return msg
}

async function signOut() {
  await supabase.auth.signOut()
}

supabase.auth.onAuthStateChange((event, session) => {
  currentUser = session?.user || null
  updateNav()
})

// ---- LISTINGS ----
async function loadListings() {
  const { data, error } = await supabase
    .from('listings')
    .select('*')
    .eq('status', 'available')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Supabase error:', error)
    document.getElementById('listings-grid').innerHTML =
      `<div class="empty">Couldn't load listings. Open the browser console for details.</div>`
    document.getElementById('listings-meta').textContent = 'Error loading'
    return
  }
  allListings = data || []
  renderListings(allListings)
}

function renderListings(listings) {
  const grid = document.getElementById('listings-grid')
  const meta = document.getElementById('listings-meta')
  meta.textContent = listings.length === 1 ? '1 book available' : `${listings.length} books available`

  if (listings.length === 0) {
    grid.innerHTML = '<div class="empty">No books match your filters. Try clearing them.</div>'
    return
  }

  grid.innerHTML = listings.map(l => `
    <article class="card" data-id="${l.id}">
      <div class="card-image">
        ${l.photo_url ? `<img src="${escapeHtml(l.photo_url)}" alt="${escapeHtml(l.title)}">` : '📖'}
      </div>
      <div class="card-body">
        <div class="card-title">${escapeHtml(l.title)}</div>
        <div class="card-meta">
          <span class="tag tag-grade">${escapeHtml(l.grade_level)}</span>
          <span class="tag tag-subject">${escapeHtml(l.subject)}</span>
          <span class="tag tag-condition ${l.condition}">${escapeHtml(l.condition)}</span>
        </div>
        ${l.school ? `<div class="card-school">${escapeHtml(l.school)}</div>` : ''}
      </div>
    </article>
  `).join('')
}

function applyFilters() {
  const search = document.getElementById('search').value.toLowerCase().trim()
  const grade = document.getElementById('grade-filter').value
  const subject = document.getElementById('subject-filter').value
  const condition = document.getElementById('condition-filter').value

  const filtered = allListings.filter(l => {
    if (search && !l.title.toLowerCase().includes(search) && !l.subject.toLowerCase().includes(search)) return false
    if (grade && l.grade_level !== grade) return false
    if (subject && l.subject !== subject) return false
    if (condition && l.condition !== condition) return false
    return true
  })
  renderListings(filtered)
}

function showModal(listing) {
  const modal = document.getElementById('modal')
  const contactLink = getContactLink(listing.contact_method, listing.contact_value)
  const contactLabel = contactLabelFor(listing.contact_method)

  modal.innerHTML = `
    <div class="modal">
      <button class="modal-close" aria-label="Close">×</button>
      <div class="modal-image">
        ${listing.photo_url ? `<img src="${escapeHtml(listing.photo_url)}" alt="${escapeHtml(listing.title)}">` : '📖'}
