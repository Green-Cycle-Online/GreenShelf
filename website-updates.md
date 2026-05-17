# GreenShelf — Website Updates Before Principal Meetings

Three small additions, plus uploading the two new pages. Total time: ~15 mins.

---

## 1. Upload the new pages

In GitHub, **Add file → Upload files**:

- `privacy.html`
- `terms.html`

Both go in the **root** of the repo (same level as `index.html`). Commit.

After Vercel redeploys, test:
- `https://greenshelf.online/privacy.html` ✅
- `https://greenshelf.online/terms.html` ✅

---

## 2. Updated footer

Open `index.html`. Find your existing footer (the bit with About / FAQ links at the bottom).

**Replace it with this** — adjust the surrounding `<footer>` wrapper to match what you already had, but the inner content should look like this:

```html
<footer class="site-footer">
  <div class="footer-inner">
    <div class="footer-brand">
      <span class="footer-logo">GreenShelf</span>
      <p class="footer-tag">Free book sharing for students and parents in Oman.</p>
    </div>

    <nav class="footer-links">
      <a href="/#about">About</a>
      <a href="/#how">How it works</a>
      <a href="/#faq">FAQ</a>
      <a href="/privacy.html">Privacy</a>
      <a href="/terms.html">Terms</a>
      <a href="https://instagram.com/greenshelf.om" target="_blank" rel="noopener">Instagram</a>
      <a href="mailto:greenshelf1320@gmail.com">Contact</a>
    </nav>

    <p class="footer-copy">© 2026 GreenShelf · Built by Hitesh Gurnani & Anshul Date in Oman.</p>
  </div>
</footer>
```

**Append this to your `styles.css`** so the new footer looks right:

```css
.site-footer {
  background: var(--bg-card);
  border-top: 1px solid var(--border);
  margin-top: 60px;
  padding: 36px 24px;
}

.footer-inner {
  max-width: 900px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 18px;
}

.footer-brand .footer-logo {
  font-family: Georgia, "Times New Roman", serif;
  font-size: 1.3rem;
  font-weight: 700;
  color: var(--green-dark);
}

.footer-tag {
  color: var(--text-muted);
  font-size: 0.95rem;
  margin-top: 4px;
}

.footer-links {
  display: flex;
  flex-wrap: wrap;
  gap: 16px 22px;
  justify-content: center;
}

.footer-links a {
  color: var(--text);
  text-decoration: none;
  font-size: 0.95rem;
  font-weight: 500;
}

.footer-links a:hover {
  color: var(--green-dark);
  text-decoration: underline;
}

.footer-copy {
  color: var(--text-muted);
  font-size: 0.85rem;
  margin-top: 8px;
}
```

(If your existing footer styles already cover some of this, just merge — don't duplicate.)

---

## 3. Safety blurb (drop into FAQ or About section)

Pick whichever section feels more natural — FAQ is best because it answers an unasked question. Paste this as a new FAQ entry or as a new sub-section on the About page:

```html
<section class="safety-section">
  <h3>Is GreenShelf safe?</h3>
  <p>
    Safety matters, especially because many of our users are students.
    Every user creates a profile with a real first name. Listings show
    your neighborhood — never your exact address. Anyone can report a
    listing or user that's behaving badly, and we review reports within
    24 hours. For in-person handovers, we recommend meeting in public
    places during daytime, and that anyone under 18 is accompanied by
    a parent.
  </p>
</section>
```

You can style `.safety-section` however you like — or just drop the `<h3>` and `<p>` inside your existing FAQ structure.

This single section pre-answers principals' #1 question before they raise it.

---

## 4. "For schools" line on the home page

Subtle but powerful. Add this somewhere in your hero area or just below it — even one line is enough.

**Option A — sub-headline under the hero:**
> Partnering with schools and families across Oman to keep good books out of the bin.

**Option B — small badge above the main heading:**
> 🌱 Trusted by students, parents, and schools across Oman.

**Option C — keep your existing "For students & parents in Oman" pill, just expand wording slightly:**
> For students, parents, and schools in Oman.

I'd pick **C** — smallest edit, instantly broadens perception. To make it true, just have **one** principal say yes and you're not lying about anything.

---

## 5. Founder bio tweaks (About section)

Your current bios are great — these are just light edits to make them more story-driven and principal-friendly. Use them only if you like them; otherwise keep what you have.

**Opening line for the About section (instead of jumping straight into bios):**

```
We're Hitesh and Anshul — two students from Oman who got tired of
watching perfectly good textbooks end up in the bin every June.
GreenShelf is our attempt to fix that.

It started as a question in a WhatsApp group: "Anyone want my Year 9
Cambridge books?" The answer was always yes. The problem was that
hundreds of those messages get lost, and most books never find a new
reader. We built GreenShelf so they do.

It's free. It always will be. We don't take a cut, we don't run ads,
and we're not building toward an exit. We're building toward less waste
and easier handovers — that's it.
```

Then your existing Hitesh and Anshul bios follow below.

---

## Quick checklist before meetings

- [ ] `privacy.html` uploaded → loads at `/privacy.html`
- [ ] `terms.html` uploaded → loads at `/terms.html`
- [ ] Footer updated with Privacy + Terms + Instagram links
- [ ] Safety blurb added to FAQ or About
- [ ] "For schools" wording added (Option C is easiest)
- [ ] About intro paragraph added (optional, recommended)
- [ ] Tested on phone — every flow works (browse, post, sign in)
- [ ] 25+ listings seeded across multiple subjects/grades/areas
- [ ] Instagram has 5+ posts so the link doesn't lead to a ghost town

---

Once these are live, you're principal-ready from the website side. Next: leave-behind PDF + pitch practice.
