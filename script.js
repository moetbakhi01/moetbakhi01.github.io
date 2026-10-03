/* Mohammad Tbakhi — portfolio interactions. No dependencies. */
(() => {
  'use strict';

  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
  const hasIO = 'IntersectionObserver' in window;

  /* Run `fn` only while `el` is on screen and the tab is visible. */
  function whileVisible(el, fn) {
    let onScreen = !hasIO;
    const sync = () => fn(onScreen && !document.hidden);
    if (hasIO) {
      new IntersectionObserver(([entry]) => { onScreen = entry.isIntersecting; sync(); }, { threshold: 0.1 }).observe(el);
    }
    document.addEventListener('visibilitychange', sync);
    sync();
  }

  /* ---------- Scroll reveal ------------------------------------------- */
  function initReveal() {
    const items = $$('.reveal');
    const settle = (el) => el.classList.remove('reveal', 'is-visible');
    if (!hasIO || reduceMotion.matches) { items.forEach(settle); return; }

    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const el = entry.target;
        io.unobserve(el);
        el.classList.add('is-visible');
        // Drop the reveal class afterwards so it can't interfere with hover transitions.
        const delay = parseFloat(el.style.getPropertyValue('--d')) || 0;
        setTimeout(() => settle(el), (delay + 1) * 1000);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
    items.forEach((el) => io.observe(el));
  }

  /* ---------- Header: glass on scroll, active link, mobile menu -------- */
  function initHeader() {
    const header = $('.site-header');
    const toggle = $('.nav-toggle');
    const links = $$('.nav-links a');

    let ticking = false;
    const setCurrent = (hash) => links.forEach((a) => {
      if (a.getAttribute('href') === hash) a.setAttribute('aria-current', 'true');
      else a.removeAttribute('aria-current');
    });
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        header.classList.toggle('is-scrolled', window.scrollY > 12);
        // The contact block is short, so at the very bottom of the page it never reaches the spy band.
        if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) setCurrent('#contact');
        ticking = false;
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    if (hasIO) {
      const sections = links.map((a) => $(a.getAttribute('href'))).filter(Boolean);
      const spy = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          setCurrent('#' + entry.target.id);
        });
      }, { rootMargin: '-40% 0px -55% 0px' });
      sections.forEach((s) => spy.observe(s));
      // Clear the highlight when back in the hero.
      new IntersectionObserver(([e]) => { if (e.isIntersecting) links.forEach((a) => a.removeAttribute('aria-current')); }, { threshold: 0.6 })
        .observe($('.hero'));
    }

    const setMenu = (open, returnFocus) => {
      header.dataset.open = String(open);
      toggle.setAttribute('aria-expanded', String(open));
      toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
      if (!open && returnFocus) toggle.focus();
    };
    toggle.addEventListener('click', () => setMenu(header.dataset.open !== 'true'));
    links.forEach((a) => a.addEventListener('click', () => setMenu(false)));
    $('.nav-cta').addEventListener('click', () => setMenu(false));
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && header.dataset.open === 'true') setMenu(false, true); });
    document.addEventListener('click', (e) => { if (header.dataset.open === 'true' && !header.contains(e.target)) setMenu(false); });
    window.matchMedia('(min-width: 761px)').addEventListener('change', (e) => { if (e.matches) setMenu(false); });
  }

  /* ---------- Cursor-following spotlight ------------------------------- */
  function initSpotlight() {
    if (!finePointer.matches) return;
    let frame = 0;
    let target = null;
    let px = 0;
    let py = 0;
    document.addEventListener('pointermove', (e) => {
      const el = e.target.closest && e.target.closest('.spot');
      if (!el) return;
      target = el; px = e.clientX; py = e.clientY;
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const r = target.getBoundingClientRect();
        target.style.setProperty('--x', (px - r.left) + 'px');
        target.style.setProperty('--y', (py - r.top) + 'px');
      });
    }, { passive: true });
  }

  /* ---------- Pointer parallax ([data-parallax] → --mx/--my in -1..1) --- */
  function initParallax() {
    if (!finePointer.matches || reduceMotion.matches) return;
    $$('[data-parallax]').forEach((el) => {
      let frame = 0;
      el.addEventListener('pointermove', (e) => {
        if (frame) return;
        frame = requestAnimationFrame(() => {
          frame = 0;
          const r = el.getBoundingClientRect();
          el.style.setProperty('--mx', (((e.clientX - r.left) / r.width) * 2 - 1).toFixed(3));
          el.style.setProperty('--my', (((e.clientY - r.top) / r.height) * 2 - 1).toFixed(3));
        });
      }, { passive: true });
      el.addEventListener('pointerleave', () => {
        el.style.setProperty('--mx', 0);
        el.style.setProperty('--my', 0);
      });
    });
  }

  /* ---------- Galleries (project screenshot carousels) ----------------- */
  function initGalleries() {
    $$('[data-gallery]').forEach((gallery) => {
      const card = gallery.closest('.project-card') || gallery;
      const track = $('.gallery-track', gallery);
      const slides = $$('.gallery-slide', track);
      const total = slides.length;
      const dotsWrap = $('[data-gallery-dots]', gallery);
      const num = $('[data-gallery-num]', gallery);
      const pills = $$('[data-goto]', card);
      let current = 0;
      let timer = null;
      let hovering = false;
      let visible = false;

      const dots = slides.map((_, i) => {
        const d = document.createElement('button');
        d.type = 'button';
        d.className = 'gallery-dot';
        d.setAttribute('aria-label', 'Go to screenshot ' + (i + 1));
        d.addEventListener('click', () => go(i));
        dotsWrap.appendChild(d);
        return d;
      });
      slides.forEach((s, i) => { s.setAttribute('role', 'group'); s.setAttribute('aria-label', (i + 1) + ' of ' + total); });

      function render() {
        track.style.transform = 'translateX(-' + current * 100 + '%)';
        num.textContent = current + 1;
        slides.forEach((s, i) => s.setAttribute('aria-hidden', String(i !== current)));
        dots.forEach((d, i) => {
          d.classList.toggle('active', i === current);
          if (i === current) d.setAttribute('aria-current', 'true'); else d.removeAttribute('aria-current');
        });
        pills.forEach((p) => {
          const on = Number(p.dataset.goto) === current;
          p.classList.toggle('is-active', on);
          p.setAttribute('aria-pressed', String(on));
        });
      }
      function go(i) { current = (i + total) % total; render(); restart(); }
      function step(dir) { go(current + dir); }

      function stop() { clearInterval(timer); timer = null; }
      function start() {
        if (timer || reduceMotion.matches || hovering || !visible) return;
        timer = setInterval(() => { current = (current + 1) % total; render(); }, 3500);
      }
      function restart() { stop(); start(); }

      $$('[data-dir]', gallery).forEach((b) => b.addEventListener('click', () => step(Number(b.dataset.dir))));
      pills.forEach((p) => p.addEventListener('click', () => go(Number(p.dataset.goto))));
      gallery.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowLeft') { e.preventDefault(); step(-1); }
        if (e.key === 'ArrowRight') { e.preventDefault(); step(1); }
      });

      // Pause while the user is interacting; resume afterwards.
      gallery.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') { hovering = true; stop(); } });
      gallery.addEventListener('pointerleave', () => { hovering = false; start(); });
      gallery.addEventListener('focusin', () => { hovering = true; stop(); });
      gallery.addEventListener('focusout', () => { hovering = false; start(); });

      // Swipe on touch screens.
      let x0 = null;
      gallery.addEventListener('touchstart', (e) => { x0 = e.touches[0].clientX; }, { passive: true });
      gallery.addEventListener('touchend', (e) => {
        if (x0 === null) return;
        const dx = e.changedTouches[0].clientX - x0;
        x0 = null;
        if (Math.abs(dx) > 40) step(dx < 0 ? 1 : -1);
      }, { passive: true });

      render();
      whileVisible(gallery, (on) => { visible = on; on ? start() : stop(); });
    });
  }

  /* ---------- Lifly phones: gently cycle through their screens --------- */
  function initPhones() {
    const phones = $$('[data-cycle]');
    if (!phones.length) return;
    const stage = phones[0].closest('.stage');
    const cyclers = phones.map((phone) => {
      const screens = $$('.screen', phone);
      let index = 0;
      let timeout = null;
      let running = false;
      const show = (i) => screens.forEach((s, n) => s.classList.toggle('is-active', n === i));
      const tick = () => { index = (index + 1) % screens.length; show(index); timeout = setTimeout(tick, 3800); };
      return {
        start() { if (running || screens.length < 2) return; running = true; timeout = setTimeout(tick, 1800 + Number(phone.dataset.offset || 0)); },
        stop() { running = false; clearTimeout(timeout); },
      };
    });
    if (reduceMotion.matches) return;
    whileVisible(stage, (on) => cyclers.forEach((c) => (on ? c.start() : c.stop())));
  }

  function init() {
    initReveal();
    initHeader();
    initSpotlight();
    initParallax();
    initGalleries();
    initPhones();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
