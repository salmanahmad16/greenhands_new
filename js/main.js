/* ─────────────────────────────────────────────────
   Green Hands — Main JavaScript
   ───────────────────────────────────────────────── */

document.addEventListener('DOMContentLoaded', () => {

  /* ── Sticky nav: shift up when announcement scrolls away ── */
  const nav = document.getElementById('mainNav');
  window.addEventListener('scroll', () => {
    if (window.scrollY > 80) nav.classList.add('scrolled');
    else nav.classList.remove('scrolled');
  });

  /* ── Mobile hamburger ── */
  const hamburger = document.getElementById('hamburger');
  const mobileMenu = document.getElementById('mobileMenu');

  hamburger.addEventListener('click', () => {
    hamburger.classList.toggle('open');
    mobileMenu.classList.toggle('open');
    document.body.style.overflow = mobileMenu.classList.contains('open') ? 'hidden' : '';
  });

  mobileMenu.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
      hamburger.classList.remove('open');
      mobileMenu.classList.remove('open');
      document.body.style.overflow = '';
    });
  });

  /* ── Portfolio filter buttons ── */
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  /* ── Scroll reveal ── */
  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry, i) => {
      if (entry.isIntersecting) {
        setTimeout(() => entry.target.classList.add('visible'), i * 60);
        revealObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1 });

  document.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el));

  /* ── Floating gold particles in hero ── */
  const particlesContainer = document.getElementById('particles');
  if (particlesContainer) {
    for (let i = 0; i < 18; i++) {
      const p = document.createElement('div');
      p.className = 'particle';
      p.style.left   = Math.random() * 100 + '%';
      p.style.bottom = (Math.random() * 30) + '%';
      p.style.setProperty('--dur',   (4 + Math.random() * 8) + 's');
      p.style.setProperty('--delay', (Math.random() * 8) + 's');
      const size = (2 + Math.random() * 4) + 'px';
      p.style.width  = size;
      p.style.height = size;
      particlesContainer.appendChild(p);
    }
  }

  /* ── Smooth scroll for all in-page anchors ── */
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', (e) => {
      const id     = anchor.getAttribute('href');
      const target = document.querySelector(id);
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });

  /* ── Contact form → Backend API + WhatsApp ── */
  const form      = document.getElementById('contactForm');
  const submitBtn = document.getElementById('formSubmit');

  if (form && submitBtn) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      /* Client-side validation */
      const firstName = document.getElementById('firstName').value.trim();
      const email     = document.getElementById('email').value.trim();
      if (!firstName) { showFormError('Please enter your first name.'); return; }
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        showFormError('Please enter a valid email address.');
        return;
      }

      /* Loading state */
      submitBtn.textContent = 'Sending…';
      submitBtn.disabled    = true;
      clearFormError();

      try {
        const res  = await fetch('/api/contact', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({
            firstName,
            lastName: document.getElementById('lastName').value.trim(),
            email,
            phone:   document.getElementById('phone').value.trim(),
            service: document.getElementById('service').value,
            message: document.getElementById('message').value.trim(),
          }),
        });

        const data = await res.json();

        if (!res.ok || !data.ok) {
          throw new Error(data.message || 'Something went wrong. Please try again.');
        }

        /* Success */
        submitBtn.textContent = '✓ Request Sent — Opening WhatsApp…';
        submitBtn.classList.add('sent');
        form.reset();

        /* Open WhatsApp with the pre-filled message the server built */
        if (data.whatsapp) {
          setTimeout(() => window.open(data.whatsapp, '_blank', 'noopener,noreferrer'), 800);
        }

        /* Re-enable after 8 s */
        setTimeout(() => {
          submitBtn.textContent = 'Send Consultation Request ↗';
          submitBtn.classList.remove('sent');
          submitBtn.disabled = false;
        }, 8000);

      } catch (err) {
        showFormError(err.message);
        submitBtn.textContent = 'Send Consultation Request ↗';
        submitBtn.disabled    = false;
      }
    });
  }

  function showFormError(msg) {
    let el = document.getElementById('formError');
    if (!el) {
      el = document.createElement('p');
      el.id = 'formError';
      el.style.cssText = 'color:#c0392b;font-size:13px;margin-top:8px;font-weight:500;';
      submitBtn.insertAdjacentElement('afterend', el);
    }
    el.textContent = msg;
  }

  function clearFormError() {
    const el = document.getElementById('formError');
    if (el) el.textContent = '';
  }

  /* ── Animate stat counters when they enter the viewport ── */
  const counters = document.querySelectorAll('[data-count]');
  const countObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const el     = entry.target;
      const target = parseFloat(el.dataset.count);
      const suffix = el.dataset.suffix || '';
      const prefix = el.dataset.prefix || '';
      const isDecimal = !Number.isInteger(target);
      const duration = 1800;
      const step = 16;
      const steps = duration / step;
      let current = 0;
      const increment = target / steps;

      const timer = setInterval(() => {
        current += increment;
        if (current >= target) {
          current = target;
          clearInterval(timer);
        }
        el.textContent = prefix + (isDecimal ? current.toFixed(1) : Math.floor(current)) + suffix;
      }, step);

      countObserver.unobserve(el);
    });
  }, { threshold: 0.5 });

  counters.forEach(el => countObserver.observe(el));

  /* ── Image Slider ── */
  const track    = document.getElementById('sliderTrack');
  const dotsWrap = document.getElementById('sliderDots');
  const progress = document.getElementById('sliderProgress');
  const prevBtn  = document.getElementById('sliderPrev');
  const nextBtn  = document.getElementById('sliderNext');

  if (track && dotsWrap) {
    const slides     = track.querySelectorAll('.slide');
    const total      = slides.length;
    let current      = 0;
    let autoTimer    = null;
    let progTimer    = null;
    const INTERVAL   = 4500;

    /* Build dots */
    slides.forEach((_, i) => {
      const dot = document.createElement('button');
      dot.className   = 'slider-dot' + (i === 0 ? ' active' : '');
      dot.setAttribute('role', 'tab');
      dot.setAttribute('aria-label', 'Slide ' + (i + 1));
      dot.addEventListener('click', () => goTo(i));
      dotsWrap.appendChild(dot);
    });

    function updateDots() {
      dotsWrap.querySelectorAll('.slider-dot').forEach((d, i) =>
        d.classList.toggle('active', i === current)
      );
    }

    function startProgress() {
      if (progress) {
        progress.style.transition = 'none';
        progress.style.width      = '0%';
        /* force reflow so the transition reset applies */
        void progress.offsetWidth;
        progress.classList.add('animating');
        progress.style.width = '100%';
      }
    }

    function stopProgress() {
      if (progress) {
        progress.classList.remove('animating');
        progress.style.transition = 'none';
        progress.style.width      = '0%';
      }
    }

    function goTo(index) {
      current = (index + total) % total;
      track.style.transform = `translateX(-${current * 100}%)`;
      updateDots();
      resetAuto();
    }

    function resetAuto() {
      clearInterval(autoTimer);
      stopProgress();
      startProgress();
      autoTimer = setInterval(() => goTo(current + 1), INTERVAL);
    }

    prevBtn && prevBtn.addEventListener('click', () => goTo(current - 1));
    nextBtn && nextBtn.addEventListener('click', () => goTo(current + 1));

    /* Pause on hover */
    const section = track.closest('.slider-section');
    if (section) {
      section.addEventListener('mouseenter', () => {
        clearInterval(autoTimer);
        stopProgress();
      });
      section.addEventListener('mouseleave', resetAuto);
    }

    /* Touch / swipe */
    let touchStartX = 0;
    let touchDeltaX = 0;
    track.addEventListener('touchstart', e => {
      touchStartX = e.touches[0].clientX;
      touchDeltaX = 0;
    }, { passive: true });
    track.addEventListener('touchmove', e => {
      touchDeltaX = e.touches[0].clientX - touchStartX;
    }, { passive: true });
    track.addEventListener('touchend', () => {
      if (Math.abs(touchDeltaX) > 50) goTo(touchDeltaX < 0 ? current + 1 : current - 1);
    });

    /* Keyboard */
    document.addEventListener('keydown', e => {
      if (e.key === 'ArrowLeft')  goTo(current - 1);
      if (e.key === 'ArrowRight') goTo(current + 1);
    });

    /* Start */
    resetAuto();
  }

});
