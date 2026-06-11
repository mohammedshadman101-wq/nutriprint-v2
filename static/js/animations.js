// ─── NutriPrint Animations Engine ────────────────────────

// ── 1. FLOATING FOOD PARTICLES ────────────────────────────
function initParticles() {
  const canvas = document.getElementById('particleCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  canvas.width  = canvas.offsetWidth;
  canvas.height = canvas.offsetHeight;
  const FOODS = ['🥗','🍱','🥦','🌿','🫘','🥛','🍚','🥕','🧆','🫓','🥬','🍲'];
  const particles = [];
  for (let i = 0; i < 18; i++) {
    particles.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      emoji: FOODS[Math.floor(Math.random() * FOODS.length)],
      size: Math.random() * 16 + 14,
      speedX: (Math.random() - 0.5) * 0.6,
      speedY: (Math.random() - 0.5) * 0.6,
      opacity: Math.random() * 0.4 + 0.15,
      rotation: Math.random() * 360,
      rotSpeed: (Math.random() - 0.5) * 0.8,
    });
  }
  function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles.forEach(p => {
      ctx.save();
      ctx.globalAlpha = p.opacity;
      ctx.translate(p.x, p.y);
      ctx.rotate((p.rotation * Math.PI) / 180);
      ctx.font = `${p.size}px serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(p.emoji, 0, 0);
      ctx.restore();
      p.x += p.speedX;
      p.y += p.speedY;
      p.rotation += p.rotSpeed;
      if (p.x < -30) p.x = canvas.width + 30;
      if (p.x > canvas.width + 30) p.x = -30;
      if (p.y < -30) p.y = canvas.height + 30;
      if (p.y > canvas.height + 30) p.y = -30;
    });
    requestAnimationFrame(animate);
  }
  animate();
  window.addEventListener('resize', () => {
    canvas.width  = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
  });
}

// ── 2. TYPING HEADLINE EFFECT ─────────────────────────────
function initTypingEffect() {
  const el = document.getElementById('heroTyping');
  if (!el) return;
  const lines = [
    "Nourishing Karnataka's Children",
    'Powered by Groq AI',
    'Bilingual · English + ಕನ್ನಡ',
    'Free for All Schools · ₹0',
    "Nourishing Karnataka's Children",
  ];
  let lineIndex = 0, charIndex = 0, deleting = false;
  function type() {
    const current = lines[lineIndex];
    if (!deleting) {
      el.textContent = current.slice(0, charIndex + 1);
      charIndex++;
      if (charIndex === current.length) {
        deleting = true;
        setTimeout(type, 2200);
        return;
      }
    } else {
      el.textContent = current.slice(0, charIndex - 1);
      charIndex--;
      if (charIndex === 0) {
        deleting = false;
        lineIndex = (lineIndex + 1) % lines.length;
      }
    }
    setTimeout(type, deleting ? 35 : 65);
  }
  type();
}

// ── 3. HERO ENTRANCE ANIMATIONS ───────────────────────────
function initHeroAnimations() {
  const heroEls = document.querySelectorAll('.hero-animate');
  heroEls.forEach((el, i) => {
    setTimeout(() => {
      el.style.opacity   = '1';
      el.style.transform = 'translateY(0)';
    }, i * 150);
  });
}

// ── 4. SCROLL REVEAL ──────────────────────────────────────
function initScrollReveal() {
  const elements = document.querySelectorAll('.reveal');
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('revealed');
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
  );
  elements.forEach(el => observer.observe(el));
}

// ── 5. COUNTER ANIMATION ──────────────────────────────────
function animateCounter(id, target, suffix) {
  suffix = suffix || '';
  const el = document.getElementById(id);
  if (!el) return;
  let current = 0;
  const step  = Math.ceil(target / 50);
  const timer = setInterval(() => {
    current = Math.min(current + step, target);
    el.textContent = current.toLocaleString() + suffix;
    if (current >= target) clearInterval(timer);
  }, 35);
}

// ── 6. STAT COUNTERS ──────────────────────────────────────
function initStatCounters() {
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const el  = entry.target;
        const val = parseInt(el.dataset.count || 0);
        const sfx = el.dataset.suffix || '';
        animateCounter(el.id, val, sfx);
        observer.unobserve(el);
      }
    });
  }, { threshold: 0.5 });
  document.querySelectorAll('.count-up').forEach(el => observer.observe(el));
}

// ── 7. TILT CARDS ─────────────────────────────────────────
function initTiltEffect() {
  document.querySelectorAll('.tilt-card').forEach(card => {
    card.addEventListener('mousemove', e => {
      const rect    = card.getBoundingClientRect();
      const x       = e.clientX - rect.left;
      const y       = e.clientY - rect.top;
      const centerX = rect.width  / 2;
      const centerY = rect.height / 2;
      const rotateX = ((y - centerY) / centerY) * -6;
      const rotateY = ((x - centerX) / centerX) *  6;
      card.style.transform =
        `perspective(800px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(1.02)`;
    });
    card.addEventListener('mouseleave', () => {
      card.style.transform  = 'perspective(800px) rotateX(0) rotateY(0) scale(1)';
      card.style.transition = 'transform 0.4s ease';
    });
  });
}

// ── 8. WAVES ──────────────────────────────────────────────
function initWaves() {
  document.querySelectorAll('.wave-path').forEach((wave, i) => {
    wave.style.animationDelay = `${i * 0.5}s`;
  });
}

// ── INIT ALL (runs after splash clears) ───────────────────
function initAllAnimations() {
  initParticles();
  initTypingEffect();
  initHeroAnimations();
  initScrollReveal();
  initTiltEffect();
  initStatCounters();
  initWaves();
}

// Start immediately on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  initAllAnimations();
});
