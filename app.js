import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm'

const SUPABASE_URL = 'https://wvladknkebqiqutboohw.supabase.co'
const SUPABASE_KEY = 'sb_publishable_J0JrrWBQipfP201_L3A0pw_UGF6R1qL'
const PHOTO_BUCKET = 'book-photos'
const BASE_SUBJECTS = ['Math', 'Science', 'English', 'Arabic', 'Social Studies', 'Business']

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)
let allListings = []
let myListings = []
let currentUser = null
let currentProfile = null
let currentView = 'browse'

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
      <button class="btn-primary" id="new-listing-btn">+ List a book</button>
      <span class="nav-user">${escapeHtml(displayEmail)}</span>
      <button class="btn-secondary" id="signout-btn">Sign out</button>
    `
    document.getElementById('signout-btn').addEventListener('click', signOut)
    document.getElementById('new-listing-btn').addEventListener('click', () => showCreateListingModal())
    const profileLink = document.getElementById('profile-link')
    const browseLink = document.getElementById('browse-link')
    if (profileLink) profileLink.addEventListener('click', (e) => { e.preventDefault(); showProfileView() })
    if (browseLink) browseLink.addEventListener('click', (e) => { e.preventDefault(); showBrowseView() })
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
  let mode = 'signin'

  function render() {
    const isForgot = mode === 'forgot'
    modal.innerHTML = `
      <div class="modal auth-modal">
        <button class="modal-close" id="auth-close" aria-label="Close">×</button>
        <div class="auth-body">
          <h2 class="auth-title">${isForgot ? 'Reset your password' : 'Welcome to GreenCycle'}</h2>
          <p class="auth-subtitle">${isForgot ? "We'll email you a link to set a new password." : 'Sign in or create an account to share books.'}</p>
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
          const { error } = await supabase.auth.signUp({ email, password })
          if (error) throw error
          showToast('Account created. Welcome!', 'success')
          closeAuthModal()
        } else if (mode === 'forgot') {
          const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin })
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
  return msg
}

async function signOut() {
  await supabase.auth.signOut()
  showToast('Signed out.', 'info')
}

supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'PASSWORD_RECOVERY') {
    showSetNewPasswordModal()
    return
  }
  currentUser = session?.user || null
  if (!currentUser && currentView === 'profile') {
    showBrowseView()
    return
  }
  updateNav()
})

// ---- VIEW SWITCHING ----
function showProfileView() {
  if (!currentUser) return
  currentView = 'profile'
  document.querySelector('.hero').classList.add('hidden-section')
  document.getElementById('browse').classList.add('hidden-section')
  document.querySelector('.listings').classList.add('hidden-section')
  const how = document.querySelector('.how')
  const browseSection = document.querySelector('.browse-section')
  const mission = document.querySelector('.mission')
  if (how) how.classList.add('hidden-section')
  if (browseSection) browseSection.classList.add('hidden-section')
  if (mission) mission.classList.add('hidden-section')
  ensureProfileSection().classList.remove('hidden-section')
  updateNav()
  loadProfile()
  loadMyListings()
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

function showBrowseView() {
  currentView = 'browse'
  document.querySelector('.hero').classList.remove('hidden-section')
  document.getElementById('browse').classList.remove('hidden-section')
  document.querySelector('.listings').classList.remove('hidden-section')
  const how = document.querySelector('.how')
  const browseSection = document.querySelector('.browse-section')
  const mission = document.querySelector('.mission')
  if (how) how.classList.remove('hidden-section')
  if (browseSection) browseSection.classList.remove('hidden-section')
  if (mission) mission.classList.remove('hidden-section')
  const ps = document.getElementById('profile-section')
  if (ps) ps.classList.add('hidden-section')
  updateNav()
  loadListings()
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
          <input type="text" name="full_name" placeholder="What should we call you?">
        </label>
        <div class="profile-row">
          <label class="auth-label">School (optional)
            <input type="text" name="school" placeholder="e.g. British School Muscat">
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
  `
  document.querySelector('main').appendChild(section)

  section.querySelector('#profile-form').addEventListener('submit', saveProfile)
  section.querySelector('#my-listings-grid').addEventListener('click', handleCardClick)
  return section
}

async function loadProfile() {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', currentUser.id)
    .single()
  if (error) { console.error(error); return }
  currentProfile = data
  const form = document.getElementById('profile-form')
  if (form) {
    form.full_name.value = data.full_name || ''
    form.school.value = data.school || ''
    form.grade_level.value = data.grade_level || ''
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
    full_name: form.full_name.value.trim() || null,
    school: form.school.value.trim() || null,
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

async function loadMyListings() {
  const { data, error } = await supabase
    .from('listings')
    .select('*')
    .eq('owner_id', currentUser.id)
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
    grid.innerHTML = `<div class="empty">You haven't listed any books yet. Click <strong>+ List a book</strong> to share one.</div>`
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
          <span class="tag tag-status ${l.status}">${l.status === 'available' ? 'Available' : 'Claimed'}</span>
          <span class="tag tag-grade">${escapeHtml(l.grade_level)}</span>
          <span class="tag tag-subject">${escapeHtml(l.subject)}</span>
        </div>
        ${l.school ? `<div class="card-school">${escapeHtml(l.school)}</div>` : ''}
      </div>
    </article>
  `).join('')
}

// ---- CREATE / EDIT LISTING ----
function showCreateListingModal(editingListing = null) {
  const isEditing = !!editingListing
  let modal = document.getElementById('create-modal')
  if (!modal) {
    modal = document.createElement('div')
    modal.id = 'create-modal'
    modal.className = 'modal-backdrop hidden'
    document.body.appendChild(modal)
  }

  const grades = Array.from({length: 12}, (_, i) => `Grade ${i + 1}`)
  const subjects = [...BASE_SUBJECTS, 'Other']

  const d = isEditing ? editingListing : {}
  const isCustomSubject = isEditing && d.subject && !BASE_SUBJECTS.includes(d.subject)
  const subjectValue = isCustomSubject ? 'Other' : (d.subject || '')
  const customSubjectValue = isCustomSubject ? d.subject : ''
  const ownerNameValue = d.owner_name || (currentProfile && currentProfile.full_name) || ''
  const schoolValue = d.school || (currentProfile && currentProfile.school) || ''
  let existingPhotoUrl = isEditing ? (d.photo_url || null) : null
  let removeExistingPhoto = false

  modal.innerHTML = `
    <div class="modal create-modal">
      <button class="modal-close" id="create-close" aria-label="Close">×</button>
      <div class="auth-body">
        <h2 class="auth-title">${isEditing ? 'Edit listing' : 'List a book'}</h2>
        <p class="auth-subtitle">${isEditing ? 'Update the details below.' : 'Pass it on to another student. No money, no fuss.'}</p>
        <form id="create-form">
          <label class="auth-label">Photo (optional)
            <div class="photo-upload-area" id="photo-upload-area">
              <input type="file" name="photo" id="photo-input" accept="image/*" style="display: none;">
              <div class="photo-placeholder ${existingPhotoUrl ? 'hidden' : ''}" id="photo-placeholder">📸 Click to add a photo</div>
              <div class="photo-preview ${existingPhotoUrl ? '' : 'hidden'}" id="photo-preview">
                <img id="photo-preview-img" alt="Preview" src="${existingPhotoUrl ? escapeHtml(existingPhotoUrl) : ''}">
                <button type="button" class="photo-remove" id="photo-remove" aria-label="Remove photo">×</button>
              </div>
            </div>
          </label>
          <label class="auth-label">Book title
            <input type="text" name="title" required value="${escapeHtml(d.title || '')}">
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
            <input type="text" name="custom_subject" placeholder="e.g. Geography, Computer Science" value="${escapeHtml(customSubjectValue)}" ${isCustomSubject ? 'required' : ''}>
          </label>
          <label class="auth-label">School (optional)
            <input type="text" name="school" placeholder="e.g. British School Muscat" value="${escapeHtml(schoolValue)}">
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
            <textarea name="description" rows="3" placeholder="Anything worth mentioning — highlighting, missing pages, etc.">${escapeHtml(d.description || '')}</textarea>
          </label>
          <label class="auth-label">Your name (shown on the listing)
            <input type="text" name="owner_name" required value="${escapeHtml(ownerNameValue)}">
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
              <input type="text" name="contact_value" required placeholder="96891234567" value="${escapeHtml(d.contact_value || '')}">
            </label>
          </div>
          <div class="auth-error" id="create-error"></div>
          <button type="submit" class="btn-primary auth-submit" id="create-submit">${isEditing ? 'Save changes' : 'Post listing'}</button>
        </form>
      </div>
    </div>
  `
  modal.classList.remove('hidden')

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

  const photoInput = modal.querySelector('#photo-input')
  const photoPlaceholder = modal.querySelector('#photo-placeholder')
  const photoPreview = modal.querySelector('#photo-preview')
  const photoPreviewImg = modal.querySelector('#photo-preview-img')
  const photoRemove = modal.querySelector('#photo-remove')

  modal.querySelector('#photo-upload-area').addEventListener('click', (e) => {
    if (e.target === photoRemove || photoRemove.contains(e.target)) return
    photoInput.click()
  })

  photoInput.addEventListener('change', (e) => {
    const file = e.target.files[0]
    if (!file) return
    if (!file.type.startsWith('image/')) { showToast('Please pick an image file.', 'error'); photoInput.value = ''; return }
    if (file.size > 5 * 1024 * 1024) { showToast('Image is over 5MB. Try a smaller one.', 'error'); photoInput.value = ''; return }
    const reader = new FileReader()
    reader.onload = (ev) => {
      photoPreviewImg.src = ev.target.result
      photoPlaceholder.classList.add('hidden')
      photoPreview.classList.remove('hidden')
      removeExistingPhoto = false
    }
    reader.readAsDataURL(file)
  })

  photoRemove.addEventListener('click', (e) => {
    e.stopPropagation()
    photoInput.value = ''
    if (existingPhotoUrl) {
      removeExistingPhoto = true
      existingPhotoUrl = null
    }
    photoPlaceholder.classList.remove('hidden')
    photoPreview.classList.add('hidden')
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
    submitBtn.disabled = true

    let photoUrl = isEditing ? (removeExistingPhoto ? null : existingPhotoUrl) : null
    const file = form.photo.files[0]
    if (file) {
      submitBtn.textContent = 'Uploading photo…'
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
      const fileName = `${currentUser.id}/${Date.now()}.${ext}`
      const { error: uploadError } = await supabase.storage.from(PHOTO_BUCKET).upload(fileName, file)
      if (uploadError) {
        errorDiv.textContent = `Couldn't upload photo: ${uploadError.message}`
        submitBtn.disabled = false
        submitBtn.textContent = isEditing ? 'Save changes' : 'Post listing'
        return
      }
      const { data: { publicUrl } } = supabase.storage.from(PHOTO_BUCKET).getPublicUrl(fileName)
      photoUrl = publicUrl
    }

    submitBtn.textContent = isEditing ? 'Saving…' : 'Posting…'

    const finalSubject = (form.subject.value === 'Other' && form.custom_subject && form.custom_subject.value.trim())
      ? form.custom_subject.value.trim()
      : form.subject.value

    const data = {
      title: form.title.value.trim(),
      subject: finalSubject,
      grade_level: form.grade_level.value,
      school: form.school.value.trim() || null,
      condition: form.condition.value,
      description: form.description.value.trim() || null,
      owner_name: form.owner_name.value.trim(),
      contact_method: form.contact_method.value,
      contact_value: form.contact_value.value.trim(),
      photo_url: photoUrl,
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

// ---- LISTINGS ----
async function loadListings() {
  const { data, error } = await supabase
    .from('listings')
    .select('*')
    .eq('status', 'available')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Supabase error:', error)
    document.getElementById('listings-grid').innerHTML = `<div class="empty">Couldn't load listings. Open the browser console for details.</div>`
    document.getElementById('listings-meta').textContent = 'Error loading'
    return
  }
  allListings = data || []
  updateSubjectFilterOptions()
  renderListings(allListings)
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
  const isOwner = currentUser && listing.owner_id === currentUser.id
  const isClaimed = listing.status === 'claimed'

  let ownerActionsHtml = ''
  if (isOwner) {
    const claimId = isClaimed ? 'unclaim-btn' : 'claim-btn'
    const claimText = isClaimed ? 'Mark available' : 'Mark claimed'
    ownerActionsHtml = `
      <div class="owner-actions">
        <button class="btn-secondary" id="edit-btn">Edit</button>
        <button class="btn-secondary action-claim" id="${claimId}">${claimText}</button>
        <button class="btn-secondary action-delete" id="delete-btn">Delete</button>
      </div>
    `
  }

  modal.innerHTML = `
    <div class="modal">
      <button class="modal-close" aria-label="Close">×</button>
      <div class="modal-image">
        ${listing.photo_url ? `<img src="${escapeHtml(listing.photo_url)}" alt="${escapeHtml(listing.title)}">` : '📖'}
      </div>
      <div class="modal-body">
        <h2>${escapeHtml(listing.title)}</h2>
        <div class="modal-tags">
          ${isClaimed ? `<span class="tag tag-status claimed">Claimed</span>` : ''}
          <span class="tag tag-grade">${escapeHtml(listing.grade_level)}</span>
          <span class="tag tag-subject">${escapeHtml(listing.subject)}</span>
          <span class="tag tag-condition ${listing.condition}">${escapeHtml(listing.condition)}</span>
        </div>
        ${listing.school ? `<div class="modal-section"><h3>School</h3><div>${escapeHtml(listing.school)}</div></div>` : ''}
        ${listing.description ? `<div class="modal-section"><h3>About this book</h3><div>${escapeHtml(listing.description)}</div></div>` : ''}
        <div class="modal-section">
          <h3>Get in touch</h3>
          <div class="contact-card">
            <div class="contact-name">${escapeHtml(listing.owner_name)}</div>
            <a href="${contactLink}" class="contact-link" target="_blank" rel="noopener">${contactLabel} ${escapeHtml(listing.contact_value)}</a>
          </div>
        </div>
        ${ownerActionsHtml}
      </div>
    </div>
  `
  modal.classList.remove('hidden')
  modal.querySelector('.modal-close').addEventListener('click', closeModal)
  modal.querySelector('.modal').addEventListener('click', e => e.stopPropagation())
  modal.addEventListener('click', closeModal)

  if (isOwner) {
    modal.querySelector('#edit-btn').addEventListener('click', () => {
      closeModal()
      showCreateListingModal(listing)
    })
    if (isClaimed) {
      modal.querySelector('#unclaim-btn').addEventListener('click', () => markAsAvailable(listing.id))
    } else {
      modal.querySelector('#claim-btn').addEventListener('click', () => markAsClaimed(listing.id))
    }
    modal.querySelector('#delete-btn').addEventListener('click', () => deleteListing(listing.id))
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

async function deleteListing(id) {
  const ok = await customConfirm({
    title: 'Delete this listing?',
    message: "This can't be undone. The listing will be permanently removed.",
    confirmText: 'Delete',
    danger: true,
  })
  if (!ok) return
  const { error } = await supabase.from('listings').delete().eq('id', id)
  if (error) { showToast("Couldn't delete: " + error.message, 'error'); return }
  closeModal()
  showToast('Listing deleted.', 'success')
  await refreshCurrentView()
}

async function refreshCurrentView() {
  if (currentView === 'browse') await loadListings()
  else await loadMyListings()
}

function closeModal() {
  document.getElementById('modal').classList.add('hidden')
}

function getContactLink(method, value) {
  const digits = String(value).replace(/\D/g, '')
  if (method === 'whatsapp') return `https://wa.me/${digits}`
  if (method === 'phone') return `tel:+${digits}`
  if (method === 'email') return `mailto:${value}`
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
  const card = e.target.closest('.card')
  if (!card) return
  const list = currentView === 'browse' ? allListings : myListings
  const listing = list.find(l => l.id === card.dataset.id)
  if (listing) showModal(listing)
}

document.getElementById('search').addEventListener('input', applyFilters)
document.getElementById('grade-filter').addEventListener('change', applyFilters)
document.getElementById('subject-filter').addEventListener('change', applyFilters)
document.getElementById('condition-filter').addEventListener('change', applyFilters)

document.getElementById('listings-grid').addEventListener('click', handleCardClick)

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeModal()
    closeAuthModal()
    closeCreateModal()
  }
})

updateNav()
loadListings()
