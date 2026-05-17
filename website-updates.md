# GreenShelf — Website Updates Before Principal Meetings

Three things. Quick.

---

## 1. Upload the two new pages

In GitHub: **Add file → Upload files** → drop in:

- `privacy.html`
- `terms.html`

Both go in the repo **root** (next to `index.html`). Commit.

After Vercel redeploys (~30 sec), test:

- `https://greenshelf.online/privacy.html` ✅
- `https://greenshelf.online/terms.html` ✅

---

## 2. Add 3 links to your existing footer

Your current footer says: **About / FAQ / Contact**

You want it to say: **About / FAQ / Privacy / Terms / Instagram / Contact**

In `index.html`, find the existing footer area (the three `<a>` tags for About, FAQ, Contact). Add these three new links **between FAQ and Contact**:

```html
<a href="/privacy.html">Privacy</a>
<a href="/terms.html">Terms</a>
<a href="https://instagram.com/greenshelf.om" target="_blank" rel="noopener">Instagram</a>
```

No CSS changes needed. Your existing footer styling will handle them.

---

## 3. Add a safety blurb (FAQ section)

This pre-answers the #1 question principals will ask. Drop it into your existing FAQ as a new entry, matching whatever HTML pattern your other FAQ entries use.

**Question:** Is GreenShelf safe?

**Answer:**
> Safety matters, especially because many of our users are students. Every user creates a profile with a real first name. Listings show your neighborhood — never your exact address. Anyone can report a listing or user that's behaving badly, and we review reports within 24 hours. For in-person handovers, we recommend meeting in public places during daytime, and that anyone under 18 is accompanied by a parent.

---

## Optional polish

### "For schools" wording (1-second edit)

You have a pill at the top that says **"For students & parents in Oman"**.

Change to: **"For students, parents, and schools in Oman"**

The moment one principal says yes, this becomes literally true.

### Founder bio intro (optional)

Above your existing bios in the About section, add this short paragraph:

> We're Hitesh and Anshul — two students from Oman who got tired of watching perfectly good textbooks end up in the bin every June. GreenShelf is our attempt to fix that.
>
> It started as a question in a WhatsApp group: "Anyone want my Year 9 Cambridge books?" The answer was always yes. The problem was that hundreds of those messages get lost, and most books never find a new reader. We built GreenShelf so they do.
>
> It's free. It always will be. We don't take a cut, we don't run ads, and we're not building toward an exit. We're building toward less waste and easier handovers — that's it.

---

## Pre-meeting checklist

- [ ] `privacy.html` uploaded → loads correctly
- [ ] `terms.html` uploaded → loads correctly
- [ ] Footer has 3 new links (Privacy, Terms, Instagram)
- [ ] Safety FAQ entry added
- [ ] "For schools" wording updated
- [ ] 25+ listings on the site (mix of subjects, grades, areas)
- [ ] Mobile flow tested (browse, post, sign in, photo upload)
- [ ] Instagram has 5+ posts so the link isn't dead

Once these are done, the site is principal-ready.
