// script.js
// virtual-particles + site interactions
// Particles live in virtual document coordinates and are rendered into a fixed viewport canvas.
// counters (fallback), gallery modal, flip-cards, timeline progress,
// form demo, download, ripple, nav. Adds debug helper window._particleDebug().

(function () {
  ("use strict");

  /*Utilities*/
  const $ = (sel, ctx = document) => (ctx || document).querySelector(sel);
  const $$ = (sel, ctx = document) =>
    Array.from((ctx || document).querySelectorAll(sel));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const debounce = (fn, wait = 120) => {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), wait);
    };
  };

  function onReady(fn) {
    if (document.readyState === "loading")
      document.addEventListener("DOMContentLoaded", fn);
    else fn();
  }

  function safeRegisterScrollTrigger() {
    if (
      window.gsap &&
      window.ScrollTrigger &&
      typeof window.gsap.registerPlugin === "function"
    ) {
      try {
        gsap.registerPlugin(ScrollTrigger);
      } catch (e) {
        /* ignore */
      }
    }
  }

  /* Background Canvas (virtual document particles) */
  function initBackgroundCanvas() {
    // Create or reuse canvas
    const canvas =
      document.getElementById("bg-canvas") ||
      (function () {
        const c = document.createElement("canvas");
        c.id = "bg-canvas";
        document.body.appendChild(c);
        return c;
      })();

    // Defensive CSS
    canvas.style.position = "fixed";
    canvas.style.top = "0";
    canvas.style.left = "0";
    canvas.style.width = "100vw";
    canvas.style.height = "100vh";
    canvas.style.pointerEvents = "none";
    canvas.style.zIndex = canvas.style.zIndex || "-1";
    canvas.style.display = "block";

    const ctx = canvas.getContext && canvas.getContext("2d");
    console.log(
      "Canvas size:",
      canvas.width,
      canvas.height,
      "Context OK?",
      !!ctx
    );
    ctx.fillStyle = "red";
    ctx.fillRect(10, 10, 50, 50); // test block

    if (!ctx) return;

    // Viewport & document dims
    let DPR = Math.max(1, window.devicePixelRatio || 1);
    let vw = Math.max(320, window.innerWidth);
    let vh = Math.max(320, window.innerHeight);

    function getDocDims() {
      const doc = document.documentElement;
      return {
        docW: Math.max(
          doc.scrollWidth,
          doc.clientWidth,
          window.innerWidth || 0
        ),
        docH: Math.max(
          doc.scrollHeight,
          doc.clientHeight,
          window.innerHeight || 0
        ),
      };
    }
    let { docW, docH } = getDocDims();

    // Particle policy
    const isTouch = "ontouchstart" in window || navigator.maxTouchPoints > 0;
    const AREA_PER_PARTICLE = 40000; // smaller area = more particles
    const MIN_PARTICLES = 60,
      MAX_PARTICLES = 450;

    // Force full density for testing
    let PARTICLE_COUNT = clamp(
      Math.round((docW * docH) / AREA_PER_PARTICLE),
      MIN_PARTICLES,
      MAX_PARTICLES
    );

    // Ignore reduced-motion during debug phase

    if (
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      PARTICLE_COUNT = Math.max(20, Math.floor(PARTICLE_COUNT * 0.35));
    }

    const LAYERS = 4;
    const colors = { heritage: "#F6A15C", dev: "#7BE6DD", neutral: "#9FB0C1" };
    const particles = [];

    console.log(
      "Particle system init: docW",
      docW,
      "docH",
      docH,
      "viewport",
      vw,
      vh
    );

    const rand = (a, b) => Math.random() * (b - a) + a;

    function initParticles() {
      particles.length = 0;
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        const layer = Math.floor(Math.random() * LAYERS);
        const depth = (layer + 1) / LAYERS;
        const size = clamp(rand(2, 8) * (0.7 + depth * 0.8), 1, 22);
        const r = Math.random();
        const color =
          r > 0.72 ? colors.heritage : r > 0.36 ? colors.dev : colors.neutral;
        particles.push({
          x: Math.random() * docW,
          y: Math.random() * docH,
          vx: rand(-0.2, 0.2) * (0.6 + depth),
          vy: rand(-0.12, 0.12) * (0.6 + depth),
          size,
          depth,
          layer,
          color,
          alpha: clamp(0.06 + Math.random() * 0.2 + depth * 0.06, 0.04, 0.95),
          wobble: Math.random() * Math.PI * 2,
          wobbleSpeed: 0.0008 + Math.random() * 0.004,
        });
      }
    }

    function adjustParticleCount() {
      ({ docW, docH } = getDocDims());
      const desired = clamp(
        Math.round((docW * docH) / AREA_PER_PARTICLE),
        MIN_PARTICLES,
        MAX_PARTICLES
      );
      PARTICLE_COUNT = desired;
      if (
        window.matchMedia &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ) {
        PARTICLE_COUNT = Math.max(20, Math.floor(PARTICLE_COUNT * 0.35));
      }
      while (particles.length < PARTICLE_COUNT) {
        const layer = Math.floor(Math.random() * LAYERS);
        const depth = (layer + 1) / LAYERS;
        const size = clamp(rand(2, 8) * (0.7 + depth * 0.8), 1, 22);
        const r = Math.random();
        const color =
          r > 0.72 ? colors.heritage : r > 0.36 ? colors.dev : colors.neutral;
        particles.push({
          x: Math.random() * docW,
          y: Math.random() * docH,
          vx: rand(-0.2, 0.2) * (0.6 + depth),
          vy: rand(-0.12, 0.12) * (0.6 + depth),
          size,
          depth,
          layer,
          color,
          alpha: clamp(0.06 + Math.random() * 0.2 + depth * 0.06, 0.04, 0.95),
          wobble: Math.random() * Math.PI * 2,
          wobbleSpeed: 0.0008 + Math.random() * 0.004,
        });
      }
      while (particles.length > PARTICLE_COUNT) particles.pop();
    }

    // Pointer for parallax
    const pointer = { tx: vw / 2, ty: vh / 2, x: vw / 2, y: vh / 2 };
    function pointerMove(e) {
      if (e.touches && e.touches[0]) {
        pointer.tx = e.touches[0].clientX;
        pointer.ty = e.touches[0].clientY;
      } else {
        pointer.tx = e.clientX;
        pointer.ty = e.clientY;
      }
    }
    window.addEventListener("mousemove", pointerMove, { passive: true });
    window.addEventListener("touchmove", pointerMove, { passive: true });

    // Resize & observe content change
    function setupViewport() {
      DPR = Math.max(1, window.devicePixelRatio || 1);
      vw = Math.max(320, window.innerWidth);
      vh = Math.max(320, window.innerHeight);
      canvas.width = Math.round(vw * DPR);
      canvas.height = Math.round(vh * DPR);
      canvas.style.width = vw + "px";
      canvas.style.height = vh + "px";
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      adjustParticleCount();
    }
    window.addEventListener("resize", debounce(setupViewport, 120));
    window.addEventListener("load", () => {
      ({ docW, docH } = getDocDims());
      setupViewport();
    });

    try {
      const mo = new MutationObserver(
        debounce(() => {
          ({ docW, docH } = getDocDims());
          adjustParticleCount();
        }, 300)
      );
      mo.observe(document.documentElement || document.body, {
        childList: true,
        subtree: true,
        attributes: true,
      });
    } catch (e) {
      /* ignore if not supported */
    }

    // Animation loop with single timestamp variable (no duplicate declarations)
    let lastTs = performance.now();
    let paused = false;
    document.addEventListener("visibilitychange", () => {
      paused = document.hidden;
      if (!paused) {
        lastTs = performance.now();
        requestAnimationFrame(loop);
      }
    });

    function hexToRgba(hex, a) {
      const h = hex.replace("#", "");
      const r = parseInt(h.slice(0, 2), 16);
      const g = parseInt(h.slice(2, 4), 16);
      const b = parseInt(h.slice(4, 6), 16);
      return `rgba(${r},${g},${b},${a})`;
    }

    function loop(now) {
      if (paused) return;
      const dt = Math.min(40, now - lastTs) || 16;
      lastTs = now;

      pointer.x =
        pointer.x === undefined
          ? pointer.tx
          : pointer.x + (pointer.tx - pointer.x) * 0.12;
      pointer.y =
        pointer.y === undefined
          ? pointer.ty
          : pointer.y + (pointer.ty - pointer.y) * 0.12;

      // clear viewport
      ctx.clearRect(0, 0, vw, vh);

      // subtle background gradient for contrast
      const bg = ctx.createLinearGradient(0, 0, vw, vh);
      bg.addColorStop(0, "#071226");
      bg.addColorStop(1, "#041322");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, vw, vh);

      // scroll offsets (virtual doc -> screen mapping)
      const scrollX = window.scrollX || window.pageXOffset || 0;
      const scrollY = window.scrollY || window.pageYOffset || 0;

      const cx = vw / 2,
        cy = vh / 2;
      const nx = (pointer.x - cx) / cx;
      const ny = (pointer.y - cy) / cy;
      const BUFFER = 140;

      // draw visible particles
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];

        p.wobble += p.wobbleSpeed * (dt / 16);
        p.x += Math.cos(p.wobble) * 0.03 * (1 + p.depth * 0.8);
        p.y += Math.sin(p.wobble * 1.1) * 0.03 * (1 + p.depth * 0.8);

        p.x += p.vx * (dt / 16);
        p.y += p.vy * (dt / 16);

        // wrap within virtual doc
        if (p.x < -60) p.x = docW + 60;
        if (p.x > docW + 60) p.x = -60;
        if (p.y < -60) p.y = docH + 60;
        if (p.y > docH + 60) p.y = -60;

        const sx = p.x - scrollX;
        const sy = p.y - scrollY;

        if (
          sx < -BUFFER ||
          sx > vw + BUFFER ||
          sy < -BUFFER ||
          sy > vh + BUFFER
        )
          continue;

        const parallax = 28 * p.depth;
        const ox = -nx * parallax;
        const oy = -ny * parallax * 0.6;

        const dx = sx + ox;
        const dy = sy + oy;

        // glow
        const r = Math.max(1, p.size);
        const grad = ctx.createRadialGradient(dx, dy, 0, dx, dy, r * 6);
        grad.addColorStop(
          0,
          hexToRgba(p.color, clamp(p.alpha + 0.18, 0.06, 1))
        );
        grad.addColorStop(1, hexToRgba(p.color, 0));
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(dx, dy, r * 6, 0, Math.PI * 2);
        ctx.fill();

        // center dot
        ctx.beginPath();
        ctx.fillStyle = hexToRgba("#ffffff", clamp(p.alpha + 0.18, 0.06, 1));
        ctx.arc(dx, dy, Math.max(0.6, r * 0.45), 0, Math.PI * 2);
        ctx.fill();
      }

      // occasional subtle lines connecting nearby particles
      if (
        !(
          window.matchMedia &&
          window.matchMedia("(prefers-reduced-motion: reduce)").matches
        )
      ) {
        ctx.globalAlpha = 0.06;
        ctx.lineWidth = 0.6;
        for (let k = 0; k < 6; k++) {
          const a = particles[Math.floor(Math.random() * particles.length)];
          const b = particles[Math.floor(Math.random() * particles.length)];
          if (!a || !b) continue;
          if (Math.abs(a.layer - b.layer) > 1) continue;
          const ax = a.x - ((pointer.x - cx) / cx) * (a.depth * 12) - scrollX;
          const ay = a.y - ((pointer.y - cy) / cy) * (a.depth * 8) - scrollY;
          const bx = b.x - ((pointer.x - cx) / cx) * (b.depth * 12) - scrollX;
          const by = b.y - ((pointer.y - cy) / cy) * (b.depth * 8) - scrollY;
          const dx = ax - bx,
            dy = ay - by;
          if (dx * dx + dy * dy < 30000) {
            ctx.strokeStyle = hexToRgba(
              a.color,
              clamp(0.04 + a.depth * 0.02, 0.02, 0.12)
            );
            ctx.beginPath();
            ctx.moveTo(ax, ay);
            ctx.lineTo(bx, by);
            ctx.stroke();
          }
        }
        ctx.globalAlpha = 1;
      }

      requestAnimationFrame(loop);
    } // loop()

    // initialize and kick off
    ({ docW, docH } = getDocDims());
    initParticles();
    setupViewport();
    requestAnimationFrame(loop);

    // expose debug helper (safe)
    window._particleDebug = function () {
      console.info("particle debug", {
        docW,
        docH,
        vw,
        vh,
        particleCount: particles.length,
        prefersReduced: !!(
          window.matchMedia &&
          window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ),
      });
    };
  } // initBackgroundCanvas()

  /* ---------------- Stats Counter (gsap safe) ---------------- */
  function initStatsCounter() {
    const wrap = document.querySelector(".impact-stats");
    if (!wrap) return;
    const nums = Array.from(wrap.querySelectorAll(".num"));
    if (!nums.length) return;

    const targets = nums.map((el) => {
      const attr = el.getAttribute("data-target");
      if (attr !== null) {
        const n = Number(attr);
        return Number.isFinite(n) ? n : parseFloat(attr) || 0;
      }
      return parseFloat(el.textContent.replace(/[^\d.-]/g, "")) || 0;
    });

    function runCount() {
      if (window.gsap) {
        nums.forEach((el, idx) => {
          const t = targets[idx] || 0;
          const obj = { v: 0 };
          gsap.to(obj, {
            v: t,
            duration: 1.6,
            ease: "power2.out",
            onUpdate: () => {
              el.textContent = format(obj.v);
            },
          });
        });
      } else {
        nums.forEach((el, idx) => {
          const t = targets[idx] || 0;
          let cur = 0;
          const step = Math.max(1, Math.round(t / 30));
          const id = setInterval(() => {
            cur += step;
            if (cur >= t) {
              el.textContent = format(t);
              clearInterval(id);
            } else el.textContent = format(cur);
          }, 40);
        });
      }
    }

    if (window.ScrollTrigger && window.gsap) {
      try {
        ScrollTrigger.create({
          trigger: wrap,
          start: "top 85%",
          onEnter: runCount,
          once: true,
        });
        return;
      } catch (e) {
        /* fallback */
      }
    }

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((en) => {
          if (en.isIntersecting) {
            runCount();
            io.disconnect();
          }
        });
      },
      { threshold: 0.35 }
    );
    io.observe(wrap);

    function format(v) {
      const n = Math.round(v);
      return n >= 1000 ? n.toLocaleString() : String(n);
    }
  }

  /* ---------------- Gallery modal ---------------- */
  function initGalleryModal() {
    const modal = document.getElementById("modal");
    if (!modal) return;
    const imgEl = modal.querySelector("#modalImg");
    const titleEl = modal.querySelector("#modalTitle");
    const descEl = modal.querySelector("#modalDesc");

    function open(src, title, desc) {
      if (imgEl) imgEl.src = src;
      if (titleEl) titleEl.textContent = title || "";
      if (descEl) descEl.textContent = desc || "";
      modal.style.display = "flex";
      modal.setAttribute("aria-hidden", "false");
      if (window.gsap)
        gsap.from(".modal .inner", { scale: 0.98, opacity: 0, duration: 0.36 });
    }
    function close() {
      modal.style.display = "none";
      modal.setAttribute("aria-hidden", "true");
      if (imgEl) imgEl.src = "";
    }

    // .gallery images
    $$(".gallery img").forEach((img) => {
      img.style.cursor = "pointer";
      img.addEventListener("click", () =>
        open(
          img.src,
          img.dataset.title || img.alt || "",
          img.dataset.desc || ""
        )
      );
    });

    // snapshots section in home
    const snapSection = Array.from(
      document.querySelectorAll("section.card")
    ).find((s) => {
      const h = s.querySelector("h3");
      return h && /snapshots/i.test(h.textContent || "");
    });
    if (snapSection) {
      Array.from(snapSection.querySelectorAll("img")).forEach((img) => {
        img.style.cursor = "pointer";
        img.addEventListener("click", () => {
          const src = img.src;
          const title = img.dataset.title || img.alt || "Snapshot";
          const desc =
            img.dataset.desc ||
            (img.alt ? generateDesc(img.alt) : "Click to view the full image.");
          open(src, title, desc);
        });
      });
    }

    const closeBtn = modal.querySelector("#modalClose");
    if (closeBtn) closeBtn.addEventListener("click", close);
    modal.addEventListener("click", (e) => {
      if (e.target === modal) close();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") close();
    });

    function generateDesc(a) {
      const alt = (a || "").toLowerCase();
      if (alt.includes("craft"))
        return "Artisans preserving traditional handicraft techniques.";
      if (alt.includes("sky") || alt.includes("skyline"))
        return "Urban skyline representing modern infrastructure and growth.";
      if (alt.includes("perform") || alt.includes("cultural"))
        return "A community performance celebrating cultural heritage.";
      return "Click to view the full image and details.";
    }
  }

  /* ---------------- Other UI inits ---------------- */
  function initFlipCards() {
    $$(".flip-card").forEach((card) => {
      const inner = card.querySelector(".flip-inner");
      if (!inner) return;
      card.addEventListener(
        "mouseenter",
        () => (inner.style.transform = "rotateY(180deg)")
      );
      card.addEventListener(
        "mouseleave",
        () => (inner.style.transform = "rotateY(0deg)")
      );
      card.addEventListener("click", () => {
        inner.style.transform =
          inner.style.transform === "rotateY(180deg)"
            ? "rotateY(0deg)"
            : "rotateY(180deg)";
      });
    });
  }

  function initTimelineProgress() {
    const progress = document.querySelector(".progress");
    const timeline = document.querySelector(".timeline");
    if (!progress || !timeline) return;
    const update = () => {
      const rect = timeline.getBoundingClientRect();
      const vh = window.innerHeight || document.documentElement.clientHeight;
      let frac = Math.min(1, Math.max(0, (vh - rect.top) / (rect.height + vh)));
      progress.style.width = frac * 100 + "%";
    };
    window.addEventListener("scroll", debounce(update, 40));
    window.addEventListener("resize", debounce(update, 120));
    update();
  }

  function initFormDemos() {
    $$("form").forEach((f) => {
      f.addEventListener("submit", (e) => {
        e.preventDefault();
        const nmField = f.querySelector("[name=name]");
        const nm = nmField ? nmField.value || "Participant" : "Participant";
        const msgEl = f.querySelector("#formMsg");
        if (msgEl)
          msgEl.textContent = `Thanks, ${nm}. Your idea has been recorded. 💡`;
        if (window.gsap)
          gsap.fromTo(
            f,
            { scale: 1 },
            { scale: 1.01, duration: 0.12, yoyo: true, repeat: 1 }
          );
      });
    });
  }

  function initDownloadButtons() {
    $$("#downloadSource, #downloadCode").forEach((btn) => {
      if (!btn) return;
      btn.addEventListener("click", () => {
        const html = "<!doctype html>\n" + document.documentElement.outerHTML;
        const blob = new Blob([html], { type: "text/html" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = (document.title || "page").replace(/\s+/g, "_") + ".html";
        a.click();
        URL.revokeObjectURL(a.href);
      });
    });
  }

  function initNavLinks() {
    $$("a[data-transition]").forEach((a) => {
      a.addEventListener("click", (e) => {
        const href = a.getAttribute("href");
        if (!href || href.startsWith("#")) return;
        e.preventDefault();
        window.location.href = href;
      });
    });
  }

  function initRipple() {
    $$(".ripple").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const rect = btn.getBoundingClientRect();
        const circle = document.createElement("span");
        circle.style.position = "absolute";
        circle.style.borderRadius = "50%";
        circle.style.transform = "translate(-50%,-50%)";
        circle.style.left = e.clientX - rect.left + "px";
        circle.style.top = e.clientY - rect.top + "px";
        circle.style.width = circle.style.height = "8px";
        circle.style.background = "rgba(255,255,255,0.12)";
        circle.style.pointerEvents = "none";
        btn.style.position = "relative";
        btn.appendChild(circle);
        if (window.gsap) {
          gsap.to(circle, {
            scale: 40,
            opacity: 0,
            duration: 0.6,
            ease: "power1.out",
            onComplete: () => circle.remove(),
          });
        } else {
          setTimeout(() => circle.remove(), 700);
        }
      });
    });
  }

  /* ---------------- Boot ---------------- */
  function boot() {
    safeRegisterScrollTrigger();
    initBackgroundCanvas();
    initStatsCounter();
    initGalleryModal();
    initFlipCards();
    initTimelineProgress();
    initFormDemos();
    initDownloadButtons();
    initNavLinks();
    initRipple();
    initReadMoreAnimation();

    if (window.gsap) {
      try {
        gsap.from("header", {
          y: -20,
          opacity: 0,
          duration: 0.5,
          ease: "power2.out",
        });
        gsap.utils.toArray(".card, .hero .intro > *").forEach((el, i) => {
          gsap.from(el, {
            y: 12,
            opacity: 0,
            duration: 0.6,
            delay: i * 0.04,
            ease: "power3.out",
          });
        });
      } catch (e) {
        /* ignore animation errors */
      }
    }

    if (document && document.body) document.body.style.opacity = 1;
  }

  onReady(boot);

  /* ==========================================================================
     Additional non-destructive enhancements (appended)
     - Adds detail expand animation + caret insertion
     - Adds gallery tilt effect for elements with data-tilt="true"
     - Adds GSAP/ScrollTrigger-based animations for gallery, timeline, flip-cards, case-study and form
     - Safe: uses feature checks and respects reduced-motion where possible
     ========================================================================== */

  // helper: safe check for reduced motion
  const vb_prefersReduced = !!(
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );

  function vb_initDetailsAnimations() {
    const detailsList = document.querySelectorAll(".timeline-extra");
    if (!detailsList || !detailsList.length) return;
    detailsList.forEach((d) => {
      const summary = d.querySelector("summary");
      const content = d.querySelector("div");
      if (!summary || !content) return;

      // insert a small caret element (non-destructive)
      if (!summary.querySelector(".vb-caret")) {
        const caret = document.createElement("span");
        caret.className = "vb-caret";
        caret.setAttribute("aria-hidden", "true");
        caret.textContent = "▸"; // small triangle
        caret.style.display = "inline-block";
        caret.style.marginRight = "8px";
        caret.style.transition = "transform .22s ease";
        caret.style.transform = "rotate(0deg)";
        caret.style.color = "var(--accent-heritage, #F6A15C)";
        // put the caret before the summary text
        summary.prepend(caret);
      }
      const caretEl = summary.querySelector(".vb-caret");

      // ensure content has overflow hidden to animate height
      content.style.overflow = "hidden";
      // Initialize collapsed state visually (without removing native behavior)
      if (!d.open) {
        content.style.height = "0px";
        content.style.opacity = "0";
        content.style.display = "none";
      } else {
        content.style.display = "block";
        content.style.height = "auto";
        content.style.opacity = "1";
        caretEl.style.transform = "rotate(90deg)";
      }

      // toggle handler (native 'toggle' event)
      d.addEventListener("toggle", () => {
        // If user prefers reduced motion, simply show/hide instantly
        if (vb_prefersReduced || !window.gsap) {
          if (d.open) {
            content.style.display = "block";
            content.style.height = "auto";
            content.style.opacity = "1";
            caretEl.style.transform = "rotate(90deg)";
          } else {
            content.style.height = "0px";
            content.style.opacity = "0";
            // hide after small tick so collapse is clean
            setTimeout(() => {
              if (!d.open) content.style.display = "none";
            }, 220);
            caretEl.style.transform = "rotate(0deg)";
          }
          return;
        }

        if (d.open) {
          // open: animate from 0 -> auto
          content.style.display = "block";
          gsap.fromTo(
            content,
            { height: 0, opacity: 0 },
            {
              height: "auto",
              opacity: 1,
              duration: 0.36,
              ease: "power2.out",
              onComplete() {
                content.style.height = "auto";
              },
            }
          );
          gsap.to(caretEl, {
            rotation: 90,
            duration: 0.22,
            ease: "power1.out",
          });
        } else {
          // close
          gsap.to(content, {
            height: 0,
            opacity: 0,
            duration: 0.28,
            ease: "power2.in",
            onComplete() {
              if (!d.open) content.style.display = "none";
            },
          });
          gsap.to(caretEl, { rotation: 0, duration: 0.2, ease: "power1.in" });
        }
      });
    });
  }

  function vb_initGalleryTilt() {
    // pointer tilt effect for images with data-tilt="true"
    const imgs = document.querySelectorAll('.gallery img[data-tilt="true"]');
    if (!imgs || !imgs.length) return;
    // disable on touch devices
    const isTouch = "ontouchstart" in window || navigator.maxTouchPoints > 0;
    if (isTouch) return;

    imgs.forEach((img) => {
      let rafId = null;
      let mx = 0,
        my = 0,
        tx = 0,
        ty = 0;
      const rect = () => img.getBoundingClientRect();
      const onMove = (e) => {
        const r = rect();
        const x = (e.clientX || (e.touches && e.touches[0].clientX)) - r.left;
        const y = (e.clientY || (e.touches && e.touches[0].clientY)) - r.top;
        mx = (x / r.width) * 2 - 1;
        my = (y / r.height) * 2 - 1;
        if (!rafId) rafId = requestAnimationFrame(update);
      };
      const reset = () => {
        if (rafId) cancelAnimationFrame(rafId);
        rafId = null;
        mx = my = tx = ty = 0;
        img.style.transition = "transform 300ms cubic-bezier(.2,.9,.2,1)";
        img.style.transform =
          "perspective(700px) rotateX(0deg) rotateY(0deg) scale(1)";
        setTimeout(() => (img.style.transition = ""), 320);
      };
      const update = () => {
        rafId = null;
        // smooth lerp
        tx += (mx - tx) * 0.16;
        ty += (my - ty) * 0.16;
        const rotateX = (-ty * 7).toFixed(2);
        const rotateY = (tx * 7).toFixed(2);
        const scale = 1.02;
        img.style.transform = `perspective(700px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(${scale})`;
      };

      img.addEventListener("mousemove", onMove, { passive: true });
      img.addEventListener("mouseleave", reset);
      img.addEventListener("touchstart", () => {}, { passive: true });
      img.addEventListener("touchmove", onMove, { passive: true });
      img.addEventListener("touchend", reset);
    });
  }

  function vb_initGSAPAnimations() {
    if (!window.gsap) return;
    // register ScrollTrigger safely
    try {
      if (window.ScrollTrigger && typeof gsap.registerPlugin === "function") {
        gsap.registerPlugin(ScrollTrigger);
      }
    } catch (e) {
      /* ignore */
    }

    // Respect reduced motion
    if (vb_prefersReduced) {
      // quick visible state, no animations
      document.querySelectorAll('[data-anim="gallery-img"]').forEach((el) => {
        el.style.opacity = 1;
        el.style.transform = "none";
      });
      document.querySelectorAll('[data-anim="timeline-item"]').forEach((el) => {
        el.style.opacity = 1;
        el.style.transform = "none";
      });
      return;
    }

    // Gallery images: subtle scale/slide in as they enter
    gsap.utils.toArray('[data-anim="gallery-img"]').forEach((img) => {
      gsap.from(img, {
        y: 20,
        opacity: 0,
        scale: 0.98,
        duration: 0.9,
        ease: "power3.out",
        scrollTrigger: {
          trigger: img,
          start: "top 92%",
          toggleActions: "play none none none",
        },
      });
    });

    // Timeline items: alternate from left/right
    gsap.utils.toArray('[data-anim="timeline-item"]').forEach((el, idx) => {
      const dir =
        el.getAttribute("data-direction") || (idx % 2 === 0 ? "left" : "right");
      const fromX = dir === "left" ? -80 : 80;
      const card = el.querySelector(".timeline-card");
      const dot = el.querySelector(".dot");

      if (card) {
        gsap.from(card, {
          x: fromX,
          opacity: 0,
          duration: 0.82,
          ease: "power3.out",
          scrollTrigger: {
            trigger: el,
            start: "top 88%",
            toggleActions: "play none none none",
          },
        });
      }

      if (dot) {
        gsap.fromTo(
          dot,
          { scale: 0.82, boxShadow: "0 0 0 rgba(0,0,0,0)" },
          {
            scale: 1.06,
            boxShadow: "0 0 14px rgba(247,166,93,0.10)",
            duration: 0.6,
            ease: "power1.out",
            scrollTrigger: {
              trigger: el,
              start: "top 88%",
              toggleActions: "play none none none",
            },
          }
        );
      }
    });

    // Progress bar: map scroll progress to width
    const tlEl = document.querySelector(".timeline");
    const progress = document.querySelector(".progress");
    if (tlEl && progress && window.ScrollTrigger) {
      try {
        ScrollTrigger.create({
          trigger: tlEl,
          start: "top center",
          end: "bottom bottom",
          scrub: 0.35,
          onUpdate(self) {
            gsap.to(progress, {
              width: `${(self.progress * 100).toFixed(2)}%`,
              ease: "none",
              overwrite: true,
            });
          },
        });
      } catch (e) {
        // fallback handled elsewhere
      }
    }

    // Flip cards: fade & lift in
    // if (document.querySelector(".flip-grid")) {
    //   gsap.from(".flip-card", {
    //     y: 20,
    //     opacity: 0,
    //     duration: 0.8,
    //     stagger: 0.12,
    //     ease: "power3.out",
    //     scrollTrigger: {
    //       trigger: ".flip-grid",
    //       start: "top 90%",
    //       toggleActions: "play none none none",
    //     },
    //   });
    // }

    // Case study: heading fade & parallax on article
    const caseHeading = document.querySelector("#case-heading");
    const caseArticle = caseHeading
      ? caseHeading.closest("section").querySelector("article")
      : null;
    if (caseHeading && caseArticle) {
      gsap.from([caseHeading, caseHeading.nextElementSibling], {
        y: 16,
        opacity: 0,
        duration: 0.7,
        stagger: 0.06,
        ease: "power3.out",
        scrollTrigger: {
          trigger: caseHeading,
          start: "top 92%",
          toggleActions: "play none none none",
        },
      });
      gsap.to(caseArticle, {
        yPercent: -6,
        ease: "none",
        scrollTrigger: {
          trigger: caseArticle,
          start: "top bottom",
          end: "bottom top",
          scrub: 0.6,
        },
      });
    }

    // Form: inputs fade in sequentially
    const form = document.querySelector("form");
    if (form) {
      const inputs = [
        form.querySelector('[name="name"]'),
        form.querySelector('[name="email"]'),
        form.querySelector('[name="interest"]'),
        form.querySelector("textarea"),
        form.querySelector(".form-actions"),
      ].filter(Boolean);
      if (inputs.length) {
        gsap.from(inputs, {
          y: 12,
          opacity: 0,
          duration: 0.6,
          stagger: 0.06,
          ease: "power3.out",
          scrollTrigger: {
            trigger: form,
            start: "top 92%",
            toggleActions: "play none none none",
          },
        });
      }
    }

    // small refresh after setup
    if (window.ScrollTrigger) ScrollTrigger.refresh();
  }

  // Run extra initializers after boot completes
  function vb_runExtraInits() {
    // idempotent
    if (window.__vb_extraInitsDone) return;
    window.__vb_extraInitsDone = true;

    vb_initDetailsAnimations();
    vb_initGalleryTilt();
    // GSAP animations (if gsap available) - will safely no-op otherwise
    vb_initGSAPAnimations();
  }

  /* ---------------- Read More animation ---------------- */
  function initReadMoreAnimation() {
    $$(".read-more-btn").forEach((btn) => {
      const content = btn.previousElementSibling; // element with extra text
      if (!content) return;

      // Ensure content starts hidden (but measurable)
      content.style.overflow = "hidden";
      content.style.maxHeight = "0px";
      content.style.opacity = "0";

      let isOpen = false;

      btn.addEventListener("click", () => {
        if (window.gsap) {
          if (!isOpen) {
            gsap.to(content, {
              maxHeight: content.scrollHeight + "px",
              opacity: 1,
              duration: 0.5,
              ease: "power2.out",
            });
            btn.textContent = "Read less";
          } else {
            gsap.to(content, {
              maxHeight: 0,
              opacity: 0,
              duration: 0.4,
              ease: "power2.in",
            });
            btn.textContent = "Read more";
          }
        } else {
          // Fallback without GSAP
          content.style.maxHeight = isOpen
            ? "0px"
            : content.scrollHeight + "px";
          content.style.opacity = isOpen ? "0" : "1";
          btn.textContent = isOpen ? "Read more" : "Read less";
        }
        isOpen = !isOpen;
      });
    });
  }

  /* ==========================================================================
   Vikas page enhancements (append only) - non-destructive, idempotent
   - Timeline scroll animations + drawing line
   - Counters for .counter
   - Flip-card / highlight entrance animations
   - Carousel drag + autoplay
   - Quote banner parallax
   ========================================================================== */
  (function () {
    if (window.__vb_vikas_done) return;
    window.__vb_vikas_done = true;

    const $ = (s, ctx = document) => (ctx || document).querySelector(s);
    const $$ = (s, ctx = document) =>
      Array.from((ctx || document).querySelectorAll(s));
    const vb_prefersReduced = !!(
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    );

    // Helper: simple number formatter
    function vb_formatNumber(v) {
      const n = Math.round(v);
      return n >= 1000 ? n.toLocaleString() : String(n);
    }

    // Timeline: add vertical line and animate items on scroll
    function vb_initTimeline() {
      const timelines = $$(".timeline");
      if (!timelines.length) return;

      // Register plugin if possible
      try {
        if (
          window.gsap &&
          window.ScrollTrigger &&
          typeof gsap.registerPlugin === "function"
        ) {
          gsap.registerPlugin(ScrollTrigger);
        }
      } catch (e) {
        /* ignore */
      }

      timelines.forEach((tl) => {
        // create a JS-controlled vertical line (so we can animate easily)
        if (!tl.querySelector(".vb-timeline-line")) {
          const line = document.createElement("div");
          line.className = "vb-timeline-line";
          tl.insertBefore(line, tl.firstChild);
        }
        const lineEl = tl.querySelector(".vb-timeline-line");

        const items = Array.from(tl.querySelectorAll(".timeline-item"));
        if (!items.length) return;

        // If GSAP available and user doesn't prefer reduced motion => use ScrollTrigger
        if (window.gsap && window.ScrollTrigger && !vb_prefersReduced) {
          try {
            // draw the line as user scrolls through the timeline
            gsap.to(lineEl, {
              scaleY: 1,
              ease: "none",
              scrollTrigger: {
                trigger: tl,
                start: "top center",
                end: "bottom bottom",
                scrub: 0.6,
              },
            });

            // animate each item + milestone-year
            items.forEach((item, idx) => {
              const dir =
                item.dataset.direction || (idx % 2 ? "right" : "left");
              const card = item.querySelector(".timeline-card") || item;
              const year = item.querySelector(".milestone-year");

              gsap.from(card, {
                x: dir === "left" ? -60 : 60,
                opacity: 0,
                duration: 0.8,
                ease: "power3.out",
                scrollTrigger: {
                  trigger: item,
                  start: "top 85%",
                  toggleActions: "play none none none",
                },
              });

              if (year) {
                gsap.fromTo(
                  year,
                  { scale: 0 },
                  {
                    scale: 1,
                    duration: 0.6,
                    ease: "back.out(1.2)",
                    scrollTrigger: {
                      trigger: item,
                      start: "top 86%",
                      toggleActions: "play none none none",
                    },
                  }
                );
              }
            });
          } catch (err) {
            // fall back to observer below
            console.warn(
              "GSAP timeline init failed, falling back to simple observer",
              err
            );
            vb_timelineObserverFallback(tl, items, lineEl);
          }
        } else {
          vb_timelineObserverFallback(tl, items, lineEl);
        }
      });

      function vb_timelineObserverFallback(tl, items, lineEl) {
        // quick fallback: observe items and reveal them, and expand line progressively
        const vh = window.innerHeight || document.documentElement.clientHeight;
        const obs = new IntersectionObserver(
          (entries) => {
            entries.forEach((en) => {
              const it = en.target;
              if (en.isIntersecting) {
                it.querySelector(".timeline-card").style.opacity = 1;
                it.querySelector(".timeline-card").style.transform = "none";
                const year = it.querySelector(".milestone-year");
                if (year) year.style.transform = "scale(1)";
              }
            });
          },
          { threshold: 0.28 }
        );

        items.forEach((it) => {
          const card = it.querySelector(".timeline-card");
          if (card) {
            card.style.opacity = 0;
            card.style.transform = "translateY(12px)";
            card.style.transition = "opacity .42s ease, transform .42s ease";
          }
          const year = it.querySelector(".milestone-year");
          if (year) {
            year.style.transform = "scale(0)";
            year.style.transition = "transform .5s cubic-bezier(.2,.9,.2,1)";
          }
          obs.observe(it);
        });

        // simple line expansion based on scroll position
        function updateLine() {
          const rect = tl.getBoundingClientRect();
          const top = Math.max(
            0,
            Math.min(
              1,
              (window.innerHeight - rect.top) /
                (rect.height + window.innerHeight)
            )
          );
          lineEl.style.transform = `scaleY(${top})`;
        }
        updateLine();
        window.addEventListener("scroll", throttle(updateLine, 45));
        window.addEventListener("resize", throttle(updateLine, 150));
      }
    }

    // Counters for elements with .counter
    function vb_initCounters() {
      const counters = $$(".counter");
      if (!counters.length) return;

      const animateCounter = (el) => {
        const target = Number(el.getAttribute("data-target")) || 0;
        if (isNaN(target)) return;
        if (window.gsap && !vb_prefersReduced) {
          const obj = { v: 0 };
          gsap.to(obj, {
            v: target,
            duration: Math.min(2.2, 0.8 + target / 400),
            ease: "power2.out",
            onUpdate: () => {
              el.textContent = vb_formatNumber(obj.v);
            },
          });
        } else {
          // fallback
          let cur = 0;
          const step = Math.max(1, Math.round(target / 30));
          const id = setInterval(() => {
            cur += step;
            if (cur >= target) {
              el.textContent = vb_formatNumber(target);
              clearInterval(id);
            } else el.textContent = vb_formatNumber(cur);
          }, 40);
        }
      };

      // IntersectionObserver to trigger once
      const io = new IntersectionObserver(
        (entries, obs) => {
          entries.forEach((en) => {
            if (en.isIntersecting) {
              const el = en.target;
              animateCounter(el);
              obs.unobserve(el);
            }
          });
        },
        { threshold: 0.35 }
      );

      counters.forEach((c) => io.observe(c));
    }

    // Simple draggable carousel with autoplay
    function vb_initCarousel() {
      const car = $(".carousel");
      if (!car) return;

      // pointer drag
      let isDown = false,
        startX = 0,
        scrollLeft = 0;
      const onDown = (e) => {
        isDown = true;
        car.classList.add("vb-dragging");
        startX = e.clientX || (e.touches && e.touches[0].clientX);
        scrollLeft = car.scrollLeft;
      };
      const onMove = (e) => {
        if (!isDown) return;
        const x = e.clientX || (e.touches && e.touches[0].clientX);
        const walk = startX - x;
        car.scrollLeft = scrollLeft + walk;
      };
      const onUp = () => {
        isDown = false;
        car.classList.remove("vb-dragging");
      };

      car.addEventListener("mousedown", onDown);
      car.addEventListener("touchstart", onDown, { passive: true });
      window.addEventListener("mousemove", onMove, { passive: true });
      window.addEventListener("touchmove", onMove, { passive: true });
      window.addEventListener("mouseup", onUp);
      window.addEventListener("touchend", onUp);

      // autoplay: advance by container width every 3.5s; pause on hover/touch
      let autoplayId = null;
      const startAutoplay = () => {
        if (autoplayId) return;
        autoplayId = setInterval(() => {
          const cw = car.clientWidth || 300;
          if (car.scrollLeft + cw >= car.scrollWidth - 2) {
            // loop back smoothly
            car.scrollTo({ left: 0, behavior: "smooth" });
          } else {
            car.scrollBy({ left: cw, behavior: "smooth" });
          }
        }, 3500);
      };
      const stopAutoplay = () => {
        if (autoplayId) {
          clearInterval(autoplayId);
          autoplayId = null;
        }
      };
      car.addEventListener("mouseenter", stopAutoplay);
      car.addEventListener("mouseleave", startAutoplay);
      car.addEventListener("touchstart", stopAutoplay, { passive: true });
      car.addEventListener("touchend", startAutoplay, { passive: true });

      // start autoplay only if not touch device
      const isTouch = "ontouchstart" in window || navigator.maxTouchPoints > 0;
      if (!isTouch) startAutoplay();
    }

    // Quote banner parallax
    function vb_initQuoteParallax() {
      const quote = document.querySelector("section.card blockquote");
      if (!quote) return;
      if (window.gsap && window.ScrollTrigger && !vb_prefersReduced) {
        try {
          gsap.to(quote, {
            yPercent: -6,
            ease: "none",
            scrollTrigger: {
              trigger: quote,
              start: "top bottom",
              end: "bottom top",
              scrub: 0.6,
            },
          });
        } catch (e) {
          /* ignore */
        }
      } else {
        // fallback: tiny CSS transform on scroll (throttled)
        const onScroll = throttle(() => {
          const r = quote.getBoundingClientRect();
          const winH =
            window.innerHeight || document.documentElement.clientHeight;
          const pct = clamp((winH - r.top) / (winH + r.height), 0, 1);
          quote.style.transform = `translateY(${-(pct * 6)}%)`;
        }, 40);
        window.addEventListener("scroll", onScroll);
        onScroll();
      }
    }

    /* ----------------- utility helpers ----------------- */
    function throttle(fn, wait) {
      let busy = false,
        lastArgs;
      return (...args) => {
        lastArgs = args;
        if (busy) return;
        busy = true;
        setTimeout(() => {
          fn(...lastArgs);
          busy = false;
        }, wait);
      };
    }
    function clamp(v, a, b) {
      return Math.max(a, Math.min(b, v));
    }

    // Boot the Vikas extras (idempotent)
    function vb_bootVikasExtras() {
      try {
        vb_initCounters();
        vb_initCarousel();
        vb_initQuoteParallax();
      } catch (err) {
        console.error("vb_bootVikasExtras failed", err);
      }
    }

    // Run after DOM is ready; schedule small delay to allow primary boot() to run first
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () =>
        setTimeout(vb_bootVikasExtras, 260)
      );
    } else {
      setTimeout(vb_bootVikasExtras, 260);
    }
  })();

  // Auto-scrolling carousel for Gallery of Progress
  document.querySelectorAll(".progress-gallery").forEach((gallery) => {
    const track = gallery.querySelector(".carousel-track");
    let totalWidth = 0;

    // Calculate total width for smooth loop
    track.querySelectorAll("img").forEach((img) => {
      totalWidth += img.offsetWidth + 16; // includes gap
    });

    gsap.to(track, {
      x: -totalWidth / 2,
      duration: 20,
      ease: "none",
      repeat: -1,
    });

    // Pause on hover
    gallery.addEventListener("mouseenter", () => gsap.globalTimeline.pause());
    gallery.addEventListener("mouseleave", () => gsap.globalTimeline.resume());
  });

  // Mobile nav toggle with GSAP animation
  document.addEventListener("DOMContentLoaded", () => {
    const toggle = document.querySelector(".nav-toggle");
    const nav = document.querySelector("header nav");

    if (toggle && nav) {
      let isOpen = false;

      // Only control with GSAP on mobile
      const mq = window.matchMedia("(max-width: 760px)");

      const setup = () => {
        if (mq.matches) {
          // Mobile: start collapsed
          gsap.set(nav, { height: 0, opacity: 0, display: "none" });
          isOpen = false;
        } else {
          // Desktop: reset nav to normal
          gsap.set(nav, { clearProps: "all" }); // removes GSAP inline styles
          nav.style.display = "flex";
        }
      };

      // Run on load + whenever viewport changes
      setup();
      mq.addEventListener("change", setup);

      toggle.addEventListener("click", () => {
        if (!mq.matches) return; // Ignore clicks on desktop

        if (isOpen) {
          // Animate close
          gsap.to(nav, {
            height: 0,
            opacity: 0,
            duration: 0.35,
            ease: "power2.inOut",
            onComplete: () => (nav.style.display = "none"),
          });
        } else {
          // Animate open
          nav.style.display = "flex";
          gsap.fromTo(
            nav,
            { height: 0, opacity: 0 },
            { height: "auto", opacity: 1, duration: 0.35, ease: "power2.inOut" }
          );
        }
        isOpen = !isOpen;
      });
    }
  });

  // run extras shortly after DOM ready (gives boot() time to run first)
  onReady(() => {
    setTimeout(() => {
      try {
        vb_runExtraInits();
      } catch (err) {
        console.warn("vb_runExtraInits failed", err);
      }
    }, 240);
  });

  // end IIFE
})();
