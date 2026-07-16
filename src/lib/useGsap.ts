import { useEffect, useRef } from 'react';
import gsap from 'gsap';

export function useGsapEntrance(ref: React.RefObject<HTMLElement>, options?: {
  from?: gsap.TweenVars;
  to?: gsap.TweenVars;
  delay?: number;
  duration?: number;
  ease?: string;
}) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    gsap.fromTo(el,
      { opacity: 0, y: 16, scale: 0.98, ...options?.from },
      { opacity: 1, y: 0, scale: 1, duration: options?.duration ?? 0.5, delay: options?.delay ?? 0, ease: options?.ease ?? 'power3.out', ...options?.to }
    );
  }, [ref]);
}

export function useGsapStagger(ref: React.RefObject<HTMLElement>, options?: {
  childSelector?: string;
  from?: gsap.TweenVars;
  to?: gsap.TweenVars;
  stagger?: number;
  delay?: number;
  duration?: number;
  ease?: string;
}) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const children = el.querySelectorAll(options?.childSelector ?? '> *');
    if (!children.length) return;
    gsap.fromTo(children,
      { opacity: 0, y: 20, scale: 0.97, ...options?.from },
      { opacity: 1, y: 0, scale: 1, duration: options?.duration ?? 0.4, stagger: options?.stagger ?? 0.06, delay: options?.delay ?? 0, ease: options?.ease ?? 'power3.out', ...options?.to }
    );
  }, [ref, options?.childSelector]);
}

export function useGsapHover(ref: React.RefObject<HTMLElement>, hoverIn?: gsap.TweenVars, hoverOut?: gsap.TweenVars) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const handleEnter = () => gsap.to(el, { duration: 0.25, ease: 'power2.out', ...(hoverIn ?? { scale: 1.03, y: -2 }) });
    const handleLeave = () => gsap.to(el, { duration: 0.25, ease: 'power2.out', ...(hoverOut ?? { scale: 1, y: 0 }) });
    el.addEventListener('mouseenter', handleEnter);
    el.addEventListener('mouseleave', handleLeave);
    return () => {
      el.removeEventListener('mouseenter', handleEnter);
      el.removeEventListener('mouseleave', handleLeave);
    };
  }, [ref, hoverIn, hoverOut]);
}
