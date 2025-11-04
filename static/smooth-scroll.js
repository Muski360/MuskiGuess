(function () {
  if (typeof window === 'undefined' || window.__lenisInitialized) {
    return;
  }

  const ready = (fn) => {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn, { once: true });
    } else {
      fn();
    }
  };

  const createParallaxManager = () => {
    const targets = [];

    const collect = () => {
      targets.length = 0;
      document.querySelectorAll('[data-parallax-factor]').forEach((el) => {
        const factor = parseFloat(el.getAttribute('data-parallax-factor'));
        if (!Number.isFinite(factor)) {
          return;
        }
        targets.push({ el, factor });
      });
    };

    const update = (scrollPos) => {
      if (!targets.length) {
        return;
      }
      for (let i = 0; i < targets.length; i += 1) {
        const item = targets[i];
        const offset = -(scrollPos * item.factor);
        item.el.style.setProperty('--parallax-offset', `${offset.toFixed(2)}px`);
      }
    };

    return { collect, update };
  };

  const initLenis = () => {
    if (typeof window.Lenis !== 'function') {
      console.warn('[smooth-scroll] Lenis library was not loaded; skipping smooth scroll.');
      return;
    }

    const prefersReducedMotion = window.matchMedia
      ? window.matchMedia('(prefers-reduced-motion: reduce)')
      : null;

    if (prefersReducedMotion && prefersReducedMotion.matches) {
      console.info('[smooth-scroll] Reduced-motion preference detected; Lenis disabled.');
      return;
    }

    const lenis = new window.Lenis({
      duration: 1.1,
      easing: (t) => 1 - Math.pow(1 - t, 4), // easeOutQuart for gentle inertia
      direction: 'vertical',
      gestureDirection: 'vertical',
      smoothWheel: true,
      smoothTouch: true,
      touchMultiplier: 1.12,
      infinite: false,
    });

    window.__lenisInitialized = true;
    window.__lenisInstance = lenis;

    const parallaxManager = createParallaxManager();
    parallaxManager.collect();

    const raf = (time) => {
      lenis.raf(time);
      requestAnimationFrame(raf);
    };
    requestAnimationFrame(raf);

    lenis.on('scroll', ({ scroll }) => {
      parallaxManager.update(scroll);
    });

    let resizeTimer = null;
    window.addEventListener(
      'resize',
      () => {
        if (resizeTimer) {
          window.clearTimeout(resizeTimer);
        }
        resizeTimer = window.setTimeout(() => {
          lenis.resize();
          parallaxManager.collect();
        }, 150);
      },
      { passive: true }
    );

    const observer = new MutationObserver((mutations) => {
      for (let i = 0; i < mutations.length; i += 1) {
        if (mutations[i].type === 'childList') {
          parallaxManager.collect();
          break;
        }
      }
    });

    observer.observe(document.body, {
      subtree: true,
      childList: true,
    });

    if (prefersReducedMotion) {
      prefersReducedMotion.addEventListener('change', (event) => {
        if (event.matches) {
          lenis.stop();
          console.info('[smooth-scroll] Reduced-motion preference enabled; Lenis stopped.');
        } else {
          lenis.start();
          console.info('[smooth-scroll] Reduced-motion preference disabled; Lenis restarted.');
        }
      });
    }

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        lenis.stop();
      } else if (!prefersReducedMotion || !prefersReducedMotion.matches) {
        lenis.start();
      }
    });
  };

  ready(initLenis);
})();
