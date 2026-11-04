/* نوار شناور «شروع پرسشنامه»: وقتی هیچ‌کدام از دکمه‌های اصلی دیده نمی‌شوند ظاهر می‌شود */
export function mountDock(watchIds = []) {
  const dock = document.getElementById('dock');
  if (!dock) return;
  const targets = watchIds.map(id => document.getElementById(id)).filter(Boolean);
  const visible = new Set();
  let ready = false;
  const update = () => {
    const show = ready && visible.size === 0;
    dock.classList.toggle('show', show);
    dock.setAttribute('aria-hidden', show ? 'false' : 'true');
    dock.tabIndex = show ? 0 : -1;
  };
  if (!('IntersectionObserver' in window) || !targets.length) {
    ready = window.scrollY > 240;
    window.addEventListener('scroll', () => { ready = window.scrollY > 240; update(); }, { passive: true }); update(); return;
  }
  const io = new IntersectionObserver(entries => {
    for (const e of entries) e.isIntersecting ? visible.add(e.target) : visible.delete(e.target);
    ready = true;   // پس از نخستین گزارش ناظر، تا نوار در بارگذاری اول بی‌جهت چشمک نزند
    update();
  }, { threshold: 0.15 });
  targets.forEach(t => io.observe(t));
}
