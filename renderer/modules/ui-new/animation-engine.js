/**
 * Animation Engine
 * Centralized animation system for Live Hints
 */

export class AnimationEngine {
  constructor() {
    this.defaultDuration = 250;
    this.defaultEasing = 'cubic-bezier(0.16, 1, 0.3, 1)';
    this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  /**
   * Animate element with CSS transition
   */
  animate(element, keyframes, options = {}) {
    if (this.reducedMotion) {
      Object.assign(element.style, keyframes.to || keyframes);
      return Promise.resolve();
    }

    const {
      duration = this.defaultDuration,
      easing = this.defaultEasing,
      delay = 0,
      fill = 'forwards'
    } = options;

    const animation = element.animate(
      keyframes.from && keyframes.to ? [keyframes.from, keyframes.to] : keyframes,
      {
        duration,
        easing,
        delay,
        fill
      }
    );

    return animation.finished;
  }

  /**
   * Fade in element
   */
  fadeIn(element, options = {}) {
    return this.animate(element, {
      from: { opacity: 0 },
      to: { opacity: 1 }
    }, { duration: 200, ...options });
  }

  /**
   * Fade out element
   */
  fadeOut(element, options = {}) {
    return this.animate(element, {
      from: { opacity: 1 },
      to: { opacity: 0 }
    }, { duration: 150, ...options });
  }

  /**
   * Slide up animation
   */
  slideUp(element, options = {}) {
    return this.animate(element, {
      from: { opacity: 0, transform: 'translateY(12px)' },
      to: { opacity: 1, transform: 'translateY(0)' }
    }, { duration: 300, easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)', ...options });
  }

  /**
   * Scale in animation
   */
  scaleIn(element, options = {}) {
    return this.animate(element, {
      from: { opacity: 0, transform: 'scale(0.95)' },
      to: { opacity: 1, transform: 'scale(1)' }
    }, { duration: 250, easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)', ...options });
  }

  /**
   * Scale out animation
   */
  scaleOut(element, options = {}) {
    return this.animate(element, {
      from: { opacity: 1, transform: 'scale(1)' },
      to: { opacity: 0, transform: 'scale(0.95)' }
    }, { duration: 200, ...options });
  }

  /**
   * Add entrance animation to element
   */
  entrance(element, type = 'slide-up', delay = 0) {
    const animations = {
      'slide-up': { from: { opacity: 0, transform: 'translateY(20px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
      'slide-down': { from: { opacity: 0, transform: 'translateY(-20px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
      'slide-left': { from: { opacity: 0, transform: 'translateX(20px)' }, to: { opacity: 1, transform: 'translateX(0)' } },
      'slide-right': { from: { opacity: 0, transform: 'translateX(-20px)' }, to: { opacity: 1, transform: 'translateX(0)' } },
      'scale': { from: { opacity: 0, transform: 'scale(0.9)' }, to: { opacity: 1, transform: 'scale(1)' } },
      'fade': { from: { opacity: 0 }, to: { opacity: 1 } }
    };

    const keyframes = animations[type] || animations['slide-up'];
    return this.animate(element, keyframes, { delay, duration: 300 });
  }

  /**
   * Stagger animations for multiple elements
   */
  stagger(elements, animationType = 'slide-up', staggerDelay = 50) {
    return Promise.all(
      Array.from(elements).map((el, i) =>
        this.entrance(el, animationType, i * staggerDelay)
      )
    );
  }

  /**
   * Animate modal open
   */
  modalOpen(backdrop, modal) {
    if (this.reducedMotion) {
      backdrop.classList.remove('hidden');
      return Promise.resolve();
    }

    backdrop.classList.remove('hidden');
    
    return Promise.all([
      this.animate(backdrop, {
        from: { opacity: 0 },
        to: { opacity: 1 }
      }, { duration: 200 }),
      this.animate(modal, {
        from: { opacity: 0, transform: 'scale(0.95) translateY(-10px)' },
        to: { opacity: 1, transform: 'scale(1) translateY(0)' }
      }, { duration: 300, easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)' })
    ]);
  }

  /**
   * Animate modal close
   */
  modalClose(backdrop, modal) {
    if (this.reducedMotion) {
      backdrop.classList.add('hidden');
      return Promise.resolve();
    }

    return Promise.all([
      this.animate(backdrop, {
        from: { opacity: 1 },
        to: { opacity: 0 }
      }, { duration: 150 }),
      this.animate(modal, {
        from: { opacity: 1, transform: 'scale(1)' },
        to: { opacity: 0, transform: 'scale(0.95)' }
      }, { duration: 200 })
    ]).then(() => {
      backdrop.classList.add('hidden');
    });
  }

  /**
   * Animate sidebar toggle
   */
  sidebarToggle(sidebar, isOpen) {
    const targetWidth = isOpen ? '320px' : '48px';
    
    return this.animate(sidebar, {
      from: { width: sidebar.style.width || (isOpen ? '48px' : '320px') },
      to: { width: targetWidth }
    }, { duration: 250 });
  }

  /**
   * Add hover effect to element
   */
  addHoverEffect(element, options = {}) {
    const {
      scale = 1.02,
      lift = -2,
      shadow = true
    } = options;

    element.addEventListener('mouseenter', () => {
      if (this.reducedMotion) return;
      
      element.style.transform = `translateY(${lift}px) scale(${scale})`;
      if (shadow) {
        element.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.4)';
      }
    });

    element.addEventListener('mouseleave', () => {
      element.style.transform = '';
      element.style.boxShadow = '';
    });
  }

  /**
   * Create loading shimmer effect
   */
  addShimmer(element) {
    if (this.reducedMotion) return;

    element.classList.add('loading-shimmer');
  }

  /**
   * Remove loading shimmer effect
   */
  removeShimmer(element) {
    element.classList.remove('loading-shimmer');
  }

  /**
   * Pulse animation for status indicators
   */
  pulse(element) {
    if (this.reducedMotion) return;

    return element.animate([
      { boxShadow: '0 0 0 0 rgba(201, 162, 39, 0.4)' },
      { boxShadow: '0 0 0 8px rgba(201, 162, 39, 0)' }
    ], {
      duration: 1500,
      iterations: Infinity
    });
  }
}

export const animations = new AnimationEngine();
