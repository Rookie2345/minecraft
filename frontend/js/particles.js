/**
 * Minecraft Ambient Particle Canvas
 * Generates subtle floating emerald & cyan pixel embers
 */
(function initParticles() {
  const canvas = document.getElementById('particle-canvas');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  let width, height;
  let particles = [];
  const PARTICLE_COUNT = 45;

  const COLORS = [
    'rgba(16, 185, 129, ',  // Emerald green
    'rgba(5, 150, 105, ',   // Dark emerald
    'rgba(6, 182, 212, ',   // Cyan
    'rgba(52, 211, 153, '   // Mint green
  ];

  function resize() {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
  }

  function createParticle() {
    return {
      x: Math.random() * width,
      y: height + Math.random() * 50,
      size: Math.floor(Math.random() * 3) + 2, // 2-4px pixel blocks
      speedY: Math.random() * 0.7 + 0.3,
      speedX: (Math.random() - 0.5) * 0.4,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      alpha: Math.random() * 0.6 + 0.2,
      fadeSpeed: Math.random() * 0.003 + 0.002,
      fadingIn: true
    };
  }

  function init() {
    resize();
    particles = [];
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const p = createParticle();
      p.y = Math.random() * height; // initial spread
      particles.push(p);
    }
  }

  function animate() {
    ctx.clearRect(0, 0, width, height);

    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];

      // Update position
      p.y -= p.speedY;
      p.x += p.speedX;

      // Alpha pulse
      if (p.fadingIn) {
        p.alpha += p.fadeSpeed;
        if (p.alpha >= 0.7) p.fadingIn = false;
      } else {
        p.alpha -= p.fadeSpeed;
        if (p.alpha <= 0.1) p.fadingIn = true;
      }

      // Reset when off-screen
      if (p.y < -10 || p.x < -10 || p.x > width + 10) {
        particles[i] = createParticle();
      }

      // Render crisp pixel square
      ctx.fillStyle = p.color + p.alpha + ')';
      ctx.fillRect(Math.floor(p.x), Math.floor(p.y), p.size, p.size);
    }

    requestAnimationFrame(animate);
  }

  window.addEventListener('resize', resize);
  init();
  animate();
})();
