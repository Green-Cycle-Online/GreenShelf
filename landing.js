// Self-hosted Supabase + shared config (no third-party CDN, single source for the key).
    const { createClient } = window.supabase
    const SUPABASE_URL = window.GS_CONFIG.SUPABASE_URL
    const SUPABASE_KEY = window.GS_CONFIG.SUPABASE_KEY
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

    const BASE_SUBJECTS = ['Math', 'Science', 'English', 'Arabic', 'Social Studies', 'Business']
    const GRADES = Array.from({ length: 12 }, (_, i) => `Grade ${i + 1}`)
    const LANDING_MAX = 12

    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const root = document.documentElement

    const el = {
      search: document.getElementById('search'),
      searchBox: document.getElementById('search-box'),
      clear: document.getElementById('clear-search'),
      grade: document.getElementById('grade'),
      subject: document.getElementById('subject'),
      condition: document.getElementById('condition'),
      chips: document.getElementById('chips'),
      grid: document.getElementById('grid'),
      count: document.getElementById('count'),
      statNum: document.getElementById('stat-num'),
      statLabel: document.getElementById('stat-label'),
      ribbon: document.getElementById('ribbon'),
      mq: document.getElementById('mq'),
      nav: document.getElementById('nav'),
      heroBg: document.querySelector('.hero-bg')
    }

    let all = []

    function escapeHtml(s) {
      return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
    }
    // Image fallback without inline onerror attributes (blocked by CSP):
    // error events do not bubble but they do capture.
    document.addEventListener('error', (e) => {
      const img = e.target
      if (!img || img.tagName !== 'IMG') return
      const bk = img.closest('.bk-img')
      if (bk) { bk.classList.add('empty'); img.remove(); return }
      const cell = img.closest('.mq-cell')
      if (cell) cell.remove()
    }, true)

    const bookIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>'
    const pinIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>'

    /* ---- theme ---- */
    document.querySelector('.theme-toggle').addEventListener('click', () => {
      const next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark'
      root.setAttribute('data-theme', next)
      try { localStorage.setItem('gs-theme', next) } catch (e) {}
    })

    /* ---- nav shadow + hero parallax on scroll ---- */
    let scrollQueued = false
    const HERO_FADE = 620
    function applyScroll() {
      scrollQueued = false
      const y = window.scrollY
      el.nav.classList.toggle('scrolled', y > 8)
      if (!reduce && el.heroBg && y < HERO_FADE) {
        el.heroBg.style.transform = `translate3d(0, ${(y * 0.14).toFixed(1)}px, 0)`
        el.heroBg.style.opacity = String(Math.max(0, 1 - y / HERO_FADE))
      }
    }
    const onScroll = () => {
      if (scrollQueued) return
      scrollQueued = true
      requestAnimationFrame(applyScroll)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    applyScroll()

    /* ---- reveal on scroll ---- */
    if ('IntersectionObserver' in window && !reduce) {
      const io = new IntersectionObserver((entries) => {
        entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target) } })
      }, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 })
      document.querySelectorAll('[data-reveal]').forEach(n => io.observe(n))
    } else {
      document.querySelectorAll('[data-reveal]').forEach(n => n.classList.add('in'))
    }

    /* ---- populate selects ---- */
    function fillSelect(select, values, keepFirst = true) {
      const first = keepFirst ? select.querySelector('option') : null
      select.innerHTML = ''
      if (first) select.appendChild(first)
      values.forEach(v => {
        const o = document.createElement('option')
        o.value = v; o.textContent = v
        select.appendChild(o)
      })
    }
    fillSelect(el.grade, GRADES)
    fillSelect(el.subject, BASE_SUBJECTS)

    function mergeSubjects() {
      const fromData = [...new Set(all.map(l => l.subject).filter(Boolean))]
      const merged = [...new Set([...BASE_SUBJECTS, ...fromData])].sort()
      const current = el.subject.value
      fillSelect(el.subject, merged)
      if (current && merged.includes(current)) el.subject.value = current
    }

    /* ---- count up ---- */
    function countUp(node, target) {
      if (reduce || target <= 0 || document.hidden) { node.textContent = String(target); return }
      const dur = 900, t0 = performance.now()
      const ease = p => 1 - Math.pow(1 - p, 3)
      function step(now) {
        const p = Math.min((now - t0) / dur, 1)
        node.textContent = String(Math.round(ease(p) * target))
        if (p < 1) requestAnimationFrame(step)
      }
      requestAnimationFrame(step)
      /* safety: rAF pauses on hidden tabs, so guarantee the final value lands */
      setTimeout(() => { node.textContent = String(target) }, dur + 200)
    }

    /* ---- card ---- */
    function cardHtml(l, i) {
      const photo = (l.photos && l.photos.length && typeof l.photos[0] === 'string' && /^https:\/\//.test(l.photos[0])) ? l.photos[0] : null
      const isNew = l.created_at && (Date.now() - new Date(l.created_at).getTime() < 7 * 864e5)
      const loc = [l.area, l.school].filter(Boolean).join(' · ')
      const cond = (l.condition || '').toLowerCase()
      return `
        <a class="bk" href="index.html#listing/${encodeURIComponent(l.id)}" style="--i:${i}" aria-label="${escapeHtml(l.title)}, ${escapeHtml(l.grade_level || '')} ${escapeHtml(l.subject || '')}">
          <div class="bk-img${photo ? '' : ' empty'}">
            <span class="bk-fallback">${bookIcon}</span>
            ${isNew ? '<span class="bk-new">New</span>' : ''}
            ${photo ? `<img src="${escapeHtml(photo)}" alt="" loading="lazy">` : ''}
            <span class="bk-go" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17 17 7M8 7h9v9"/></svg></span>
          </div>
          <div class="bk-body">
            <div class="bk-title">${escapeHtml(l.title)}</div>
            <div class="bk-tags">
              ${l.grade_level ? `<span class="t t-g">${escapeHtml(l.grade_level)}</span>` : ''}
              ${l.subject ? `<span class="t t-s">${escapeHtml(l.subject)}</span>` : ''}
              ${cond ? `<span class="t t-c c-${escapeHtml(cond)}">${escapeHtml(cond)}</span>` : ''}
            </div>
            ${loc ? `<div class="bk-loc">${pinIcon}<span>${escapeHtml(loc)}</span></div>` : ''}
          </div>
        </a>`
    }

    /* ---- filtering ---- */
    function apply() {
      const q = el.search.value.trim().toLowerCase()
      const g = el.grade.value, s = el.subject.value, c = el.condition.value
      el.searchBox.classList.toggle('has-text', q.length > 0)

      const filtered = all.filter(l => {
        if (g && l.grade_level !== g) return false
        if (s && l.subject !== s) return false
        if (c && (l.condition || '').toLowerCase() !== c) return false
        if (q) {
          const hay = `${l.title || ''} ${l.subject || ''} ${l.grade_level || ''} ${l.area || ''} ${l.school || ''}`.toLowerCase()
          if (!hay.includes(q)) return false
        }
        return true
      })

      renderGrid(filtered)
      syncChips(g, s)
    }

    let lastCount = null
    function setCount(txt) {
      if (txt === lastCount) { el.count.textContent = txt; return }
      lastCount = txt
      el.count.textContent = txt
      if (reduce) return
      el.count.classList.remove('pulse')
      void el.count.offsetWidth
      el.count.classList.add('pulse')
    }

    let firstRender = true
    function renderGrid(list) {
      // lighter motion on re-filters: the first paint earns the stagger, refilters just crossfade
      if (!firstRender) el.grid.classList.add('quick')
      firstRender = false

      if (!list.length) {
        const anyFilter = el.search.value || el.grade.value || el.subject.value || el.condition.value
        setCount('0 books')
        el.grid.innerHTML = anyFilter
          ? `<div class="empty">
               <div class="empty-t">No books match yet.</div>
               <div class="empty-m">Try widening the search, or be the family that lists this one first.</div>
               <div class="empty-cta">
                 <button class="btn btn-ghost" type="button" id="reset">Clear filters</button>
                 <a class="btn btn-primary" href="index.html#cta">Give a book</a>
               </div>
             </div>`
          : `<div class="empty">
               <div class="empty-t">No books on the shelf yet.</div>
               <div class="empty-m">GreenShelf is brand new. Be the first family in Oman to pass a textbook on. It takes under a minute.</div>
               <div class="empty-cta"><a class="btn btn-primary" href="index.html#cta">Give a book</a></div>
             </div>`
        const reset = document.getElementById('reset')
        if (reset) reset.addEventListener('click', clearFilters)
        return
      }
      const shown = list.slice(0, LANDING_MAX)
      setCount(list.length > LANDING_MAX
        ? `Showing ${shown.length} of ${list.length} books`
        : `${list.length} book${list.length === 1 ? '' : 's'}`)
      el.grid.innerHTML = shown.map(cardHtml).join('')
    }

    function syncChips(g, s) {
      el.chips.querySelectorAll('.chip').forEach(chip => {
        const active = (chip.dataset.grade && chip.dataset.grade === g) || (chip.dataset.subject && chip.dataset.subject === s)
        chip.classList.toggle('active', !!active)
      })
    }

    function clearFilters() {
      el.search.value = ''; el.grade.value = ''; el.subject.value = ''; el.condition.value = ''
      apply()
    }

    /* ---- ribbon of real covers ---- */
    function buildRibbon() {
      const withPhotos = all.filter(l => l.photos && typeof l.photos[0] === 'string' && /^https:\/\//.test(l.photos[0])).slice(0, 14)
      if (withPhotos.length < 5) return
      const cells = withPhotos.map(l =>
        `<a class="mq-cell" href="index.html#listing/${encodeURIComponent(l.id)}" title="${escapeHtml(l.title)}" tabindex="-1"><img src="${escapeHtml(l.photos[0])}" alt="" loading="lazy"></a>`
      ).join('')
      el.mq.innerHTML = cells + cells
      el.ribbon.hidden = false
    }

    /* ---- events (debounced search) ---- */
    let t
    el.search.addEventListener('input', () => { clearTimeout(t); t = setTimeout(apply, 140) })
    el.clear.addEventListener('click', () => { el.search.value = ''; el.search.focus(); apply() })
    el.grade.addEventListener('change', apply)
    el.subject.addEventListener('change', apply)
    el.condition.addEventListener('change', apply)
    el.chips.addEventListener('click', (e) => {
      const chip = e.target.closest('.chip')
      if (!chip) return
      if (chip.dataset.grade) el.grade.value = (el.grade.value === chip.dataset.grade) ? '' : chip.dataset.grade
      if (chip.dataset.subject) el.subject.value = (el.subject.value === chip.dataset.subject) ? '' : chip.dataset.subject
      apply()
    })

    /* ---- skeleton ---- */
    function skeleton() {
      el.grid.innerHTML = Array.from({ length: 6 }, () =>
        `<div class="sk"><div class="sk-img shimmer"></div><div class="sk-line shimmer"></div><div class="sk-line s shimmer"></div></div>`
      ).join('')
    }

    /* ---- load ---- */
    async function load() {
      skeleton()
      try {
        const sixMonthsAgo = new Date(Date.now() - 1000 * 60 * 60 * 24 * 30 * 6).toISOString()
        const { data, error } = await supabase
          .from('listings')
          .select('id, title, subject, grade_level, area, school, condition, photos, created_at')
          .eq('status', 'available')
          .gte('created_at', sixMonthsAgo)
          .order('created_at', { ascending: false })
        if (error) throw error
        all = data || []
        mergeSubjects()
        buildRibbon()
        if (all.length === 0) {
          el.statNum.textContent = '0'
          el.statLabel.textContent = 'books yet. Be the first to share one.'
        } else {
          countUp(el.statNum, all.length)
          el.statLabel.textContent = `book${all.length === 1 ? '' : 's'} available across Oman right now`
        }
        apply()
      } catch (err) {
        console.error('GreenShelf load error:', err)
        el.statNum.textContent = '··'
        el.count.textContent = 'Could not load books'
        el.grid.innerHTML = `<div class="empty">
            <div class="empty-t">We could not reach the shelf.</div>
            <div class="empty-m">The connection dropped. Try again, or open the full site.</div>
            <div class="empty-cta">
              <button class="btn btn-ghost" type="button" id="retry">Try again</button>
              <a class="btn btn-primary" href="index.html#browse">Open the full site</a>
            </div>
          </div>`
        const retry = document.getElementById('retry')
        if (retry) retry.addEventListener('click', load)
      }
    }

    /* ---- a quiet hello for the curious ---- */
    try {
      console.log(
        '%cGreenShelf%c\nA free book exchange for families across Oman.\nNo fees, no account, no waste. Built in Muscat, 2026.\nFound a bug or want to help? We would love that.',
        'font:600 20px Georgia,serif;color:#2f7d4f',
        'font:13px system-ui;color:#7a8a7e;line-height:1.6'
      )
    } catch (e) {}

    load()
  
