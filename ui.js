// UTILS
// ============================================================
function toast(msg, type = "info", duration) {
  const durations = {
    success: 3000,
    warning: 4000,
    error: 5500,
    info: 3500,
  };
  const total = duration ?? durations[type] ?? 3500;
  const c = document.getElementById("toastContainer");
  const t = document.createElement("div");
  t.className = `toast ${type}`;
  const icons = { success: "✅", error: "❌", info: "ℹ️", warning: "⚠️" };
  t.innerHTML = `
    <span style="flex-shrink:0;">${icons[type] || "ℹ️"}</span>
    <span style="flex:1;">${msg}</span>
    <button type="button" aria-label="Dismiss notification" onclick="this.parentElement.remove()" style="background:none;border:none;cursor:pointer;color:var(--text-muted);font-size:16px;padding:0;line-height:1;flex-shrink:0;">✕</button>
    <div class="toast-progress"></div>
  `;
  c.appendChild(t);
  const prog = t.querySelector(".toast-progress");
  let remaining = total;
  let started = Date.now();
  let timeoutId = null;
  let paused = false;

  const dismiss = () => {
    t.style.animation = "toast-out 0.3s ease forwards";
    setTimeout(() => t.remove(), 300);
  };

  const startTimer = () => {
    started = Date.now();
    timeoutId = setTimeout(dismiss, remaining);
    prog.style.transition = `width ${remaining}ms linear`;
    prog.style.width = "100%";
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        prog.style.width = "0%";
      });
    });
  };

  const pauseTimer = () => {
    if (paused) return;
    paused = true;
    clearTimeout(timeoutId);
    remaining -= Date.now() - started;
    const rect = prog.getBoundingClientRect();
    const parent = prog.parentElement.getBoundingClientRect();
    const pct = parent.width ? (rect.width / parent.width) * 100 : 0;
    prog.style.transition = "none";
    prog.style.width = `${pct}%`;
  };

  const resumeTimer = () => {
    if (!paused) return;
    paused = false;
    startTimer();
  };

  startTimer();
  t.addEventListener("mouseenter", pauseTimer);
  t.addEventListener("mouseleave", resumeTimer);
  t.addEventListener("focusin", pauseTimer);
  t.addEventListener("focusout", resumeTimer);
}

function openModal(id) {
  document.getElementById(id).classList.remove("hidden");
}
function openModal(id) {
  document.getElementById(id).classList.remove("hidden");
}
function closeModal(id) {
  document.getElementById(id).classList.add("hidden");
}
function closeModal(id) {
  document.getElementById(id).classList.add("hidden");
}
function formatDate(d) {
  return new Date(d).toLocaleDateString("en-EG", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
function formatTime(t) {
  if (!t) return "—";
  const [h, m] = t.split(":");
  const hr = +h;
  return `${hr > 12 ? hr - 12 : hr}:${m} ${hr >= 12 ? "PM" : "AM"}`;
}

function calcBMI(h, w) {
  if (!h || !w) return null;
  const bmi = (w / (h / 100) ** 2).toFixed(1);
  let cls = "bmi-normal",
    label = "Normal";
  if (bmi < 18.5) {
    cls = "bmi-underweight";
    label = "Underweight";
  } else if (bmi >= 25 && bmi < 30) {
    cls = "bmi-overweight";
    label = "Overweight";
  } else if (bmi >= 30) {
    cls = "bmi-obese";
    label = "Obese";
  }
  return { bmi, cls, label };
}

function getInitials(name) {
  return String(name || "")
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
}

function badgeHtml(status) {
  const normalized =
    typeof normalizeAppointmentStatus === "function"
      ? normalizeAppointmentStatus(status)
      : status;
  const map = {
    Pending: "badge-pending",
    Cancelled: "badge-cancelled",
    Completed: "badge-done",
    improving: "badge-confirmed",
  };
  return `<span class="badge ${map[normalized] || "badge-pending"}">${normalized}</span>`;
}

// ============================================================
// CLOSE AUTOCOMPLETE ON OUTSIDE CLICK
// ============================================================
document.addEventListener("click", (e) => {
  ["diagDrop", "drugDrop", "flagDrop"].forEach((id) => {
    const el = document.getElementById(id);
    if (el && !el.contains(e.target)) el.style.display = "none";
  });
});
// 1. LIVE CLOCK
function startClock() {
  const el = document.getElementById("liveClock");
  if (!el) return;
  function tick() {
    const now = new Date();
    let h = now.getHours();
    const m = String(now.getMinutes()).padStart(2, "0");
    const s = String(now.getSeconds()).padStart(2, "0");
    const ampm = h >= 12 ? "PM" : "AM";
    h = h % 12 || 12;
    const hStr = String(h).padStart(2, "0");
    el.innerHTML = `${hStr}:${m}:<span style="opacity:0.6;font-size:11px;">${s}</span> <span style="font-size:10px;letter-spacing:1px;color:var(--primary);font-weight:700;">${ampm}</span>`;
  }
  tick();
  setInterval(tick, 1000);
}
// 2. SCROLL PROGRESS BAR
function initScrollProgress() {
  const bar = document.getElementById("scrollProgress");
  if (!bar) return;
  document
    .querySelector(".main-content")
    ?.addEventListener("scroll", function () {
      const el = this;
      const pct = (el.scrollTop / (el.scrollHeight - el.clientHeight)) * 100;
      bar.style.width = Math.min(pct, 100) + "%";
    });
}
// 4. STAT CARD RIPPLE EFFECT
function addRipples() {
  document.querySelectorAll(".stat-card").forEach((card) => {
    card.addEventListener("click", function (e) {
      const r = document.createElement("div");
      r.className = "stat-ripple";
      const rect = this.getBoundingClientRect();
      const size = Math.max(rect.width, rect.height);
      r.style.cssText = `width:${size}px;height:${size}px;left:${e.clientX - rect.left - size / 2}px;top:${e.clientY - rect.top - size / 2}px;`;
      this.appendChild(r);
      setTimeout(() => r.remove(), 700);
    });
  });
}
// 6. AUTH BUTTON LOADING STATE
function setAuthLoading(btn, loading) {
  if (loading) {
    btn.classList.add("loading");
    btn.disabled = true;
  } else {
    btn.classList.remove("loading");
    btn.disabled = false;
  }
}
// 7. TYPEWRITER EFFECT for topbar subtitle
function typewriterEffect(el, text, speed = 35) {
  el.textContent = "";
  let i = 0;
  const timer = setInterval(() => {
    el.textContent += text[i++];
    if (i >= text.length) clearInterval(timer);
  }, speed);
}
// 9. SMOOTH PAGE SCROLL reset on page change
function resetPageScroll() {
  const mc = document.querySelector(".main-content");
  if (mc) mc.scrollTo({ top: 0, behavior: "smooth" });
}
// ============================================================
// 🚀 GSAP ANIMATIONS
// ============================================================
function gsapRevealPage() {
  if (typeof gsap === "undefined") return;
  const reveal = (selector, options) => {
    if (document.querySelector(selector)) gsap.from(selector, options);
  };
  reveal(".stat-card", {
    y: 30,
    opacity: 0,
    duration: 0.5,
    stagger: 0.08,
    ease: "back.out(1.4)",
    clearProps: "all",
  });
  reveal(".chart-card", {
    y: 20,
    opacity: 0,
    duration: 0.4,
    stagger: 0.1,
    delay: 0.2,
    ease: "power2.out",
    clearProps: "all",
  });
  reveal(".welcome-banner", {
    x: -20,
    opacity: 0,
    duration: 0.5,
    ease: "power2.out",
    clearProps: "all",
  });
  reveal(".quick-actions .qa-btn", {
    y: 20,
    opacity: 0,
    duration: 0.4,
    stagger: 0.07,
    delay: 0.1,
    ease: "back.out(1.6)",
    clearProps: "all",
  });
}

function gsapRevealCards(selector) {
  if (typeof gsap === "undefined") return;
  if (document.querySelector(selector)) {
    gsap.from(selector, {
      y: 16,
      opacity: 0,
      duration: 0.35,
      stagger: 0.05,
      ease: "power2.out",
      clearProps: "all",
    });
  }
}
// ============================================================
// 🔢 COUNTUP.JS
// ============================================================
function animateCountUp(elId, target) {
  const el = document.getElementById(elId);
  if (!el) return;
  if (typeof CountUp !== "undefined") {
    try {
      const cu = new CountUp.CountUp(elId, target, {
        duration: 1.2,
        useEasing: true,
      });
      cu.start();
    } catch (e) {
      el.textContent = target;
    }
  } else {
    el.textContent = target;
  }
}
// ============================================================
// 🎯 3D TILT
// ============================================================
function initTilt() {
  document.querySelectorAll(".tilt-card").forEach((card) => {
    card.addEventListener("mousemove", (e) => {
      const r = card.getBoundingClientRect();
      const x = (e.clientX - r.left - r.width / 2) / r.width;
      const y = (e.clientY - r.top - r.height / 2) / r.height;
      card.style.transform = `perspective(800px) rotateX(${-y * 8}deg) rotateY(${x * 8}deg) scale(1.03)`;
    });
    card.addEventListener("mouseleave", () => {
      card.style.transform = "";
    });
  });
}
// ============================================================
// ✨ SPARKLE CURSOR TRAIL
// ============================================================
function initSparkle() {
  const colors = [
    "#0ea5e9",
    "#8b5cf6",
    "#06b6d4",
    "#10b981",
    "#f59e0b",
    "#f43f5e",
  ];
  let last = 0;
  document.addEventListener("mousemove", (e) => {
    const now = Date.now();
    if (now - last < 40) return; // 25fps max
    last = now;
    if (Math.random() > 0.5) return;
    const s = document.createElement("div");
    s.className = "sparkle";
    const size = Math.random() * 9 + 4;
    const color = colors[Math.floor(Math.random() * colors.length)];
    const isSquare = Math.random() > 0.6;
    s.style.cssText = `left:${e.clientX - size / 2}px;top:${e.clientY - size / 2}px;width:${size}px;height:${size}px;background:${color};border-radius:${isSquare ? "3px" : "50%"};box-shadow:0 0 ${size}px ${color};`;
    document.body.appendChild(s);
    setTimeout(() => s.remove(), 650);
  });
}
function spawnParticles(containerId) {
  const c = document.getElementById(containerId);
  if (!c) return;
  c.innerHTML = "";
  const count = 22;
  for (let i = 0; i < count; i++) {
    const p = document.createElement("div");
    p.className = "particle";
    const size = Math.random() * 3 + 2;
    p.style.cssText = `
      left: ${Math.random() * 100}%;
      width: ${size}px; height: ${size}px;
      animation-duration: ${Math.random() * 8 + 6}s;
      animation-delay: ${Math.random() * 8}s;
      opacity: ${Math.random() * 0.5 + 0.2};
      background: rgba(${Math.random() > 0.5 ? "14,165,233" : "6,182,212"},${Math.random() * 0.5 + 0.3});
    `;
    c.appendChild(p);
  }
}
// ============================================================
// ANIMATED COUNTER
// ============================================================
function animateCounter(el, target, duration = 800) {
  if (!el) return;
  const start = parseInt(el.textContent) || 0;
  const diff = target - start;
  if (diff === 0) {
    el.textContent = target;
    return;
  }
  const startTime = performance.now();
  function step(now) {
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / duration, 1);
    // ease-out cubic
    const eased = 1 - Math.pow(1 - progress, 3);
    el.textContent = Math.round(start + diff * eased);
    if (progress < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

// ============================================================
// 🔐 GLOBAL AUTH ERROR HANDLER
// ============================================================
// Handle 401 Unauthorized globally
window.addEventListener("unauthorized", () => {
  console.warn("🔑 Session expired");
  toast("Your session has expired. Please login again.", "warning");
  if (typeof logout === "function") {
    setTimeout(logout, 1000);
  }
});
