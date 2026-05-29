// AUTH
// ============================================================
function showPage(p) {
  ["login", "signup"].forEach((id) =>
    document.getElementById(id + "Page").classList.toggle("hidden", id !== p),
  );
  currentPage = p;
}

async function handleLogin(e) {
  e.preventDefault();
  const email = document.getElementById("loginEmail").value.trim();
  const password = document.getElementById("loginPassword").value;
  const err = document.getElementById("loginError");
  const btn = e.target.querySelector('button[type="submit"]');

  if (!email || !password) {
    err.textContent = "Please enter email and password.";
    err.style.display = "block";
    return;
  }

  setAuthLoading(btn, true);
  try {
    if (!apiFn("apiLogin")) {
      throw new Error("API layer is unavailable. Please try again later.");
    }
    const loginResponse = await apiLogin(email, password);

    // 🔐 Validate token was returned
    const token = loginResponse.token || loginResponse.data?.token;
    if (!token) throw new Error("No authentication token received");

    // ✅ Store token safely using validator
    AuthValidator.setToken(token);

    await syncApiAfterAuth(loginResponse, { email, password });

    err.style.display = "none";
    launchApp();
  } catch (error) {
    err.textContent = error?.message || "Invalid email or password.";
    err.style.display = "block";
    const card = document.querySelector("#loginPage .auth-card");
    if (card) {
      card.style.animation = "none";
      card.offsetHeight;
      card.style.animation = "shake 0.45s cubic-bezier(.36,.07,.19,.97)";
    }
  } finally {
    setAuthLoading(btn, false);
  }
}

async function handleSignup(e) {
  e.preventDefault();
  const nationalNumber = document.getElementById("sNationalId").value.trim();
  if (!/^\d{14}$/.test(nationalNumber)) {
    document.getElementById("nationalIdError").classList.remove("hidden");
    return;
  }
  document.getElementById("nationalIdError").classList.add("hidden");

  const fullName = document.getElementById("sName").value.trim();
  const email = document.getElementById("sEmail").value.trim();
  const password = document.getElementById("sPassword").value;
  const phone = document.getElementById("sPhone").value.trim();
  const city = document.getElementById("sGovernorate").value;
  const specialtyName = document.getElementById("sSpecialty").value;
  const certificate = document.getElementById("sCertificate").value.trim();
  const licenseNumber = document.getElementById("sLicense").value.trim();

  // 🔐 Strong password validation
  const validation = PasswordValidator.validate(password);
  if (!validation.isValid) {
    toast(`Password must have: ${validation.failures.join(", ")}`, "error");
    return;
  }

  if (
    !fullName ||
    !email ||
    !phone ||
    !city ||
    !specialtyName ||
    !certificate ||
    !licenseNumber
  ) {
    toast("Please fill all required registration fields.", "error");
    return;
  }

  // apiSignup in api.js expects these exact multipart field names.
  const signupPayload = {
    FullName: fullName,
    Email: email,
    Password: password,
    Phone: phone,
    City: city,
    SpecialtyName: specialtyName,
    Certificate: certificate,
    LicenseNumber: licenseNumber,
    NationalNumber: nationalNumber,
  };

  const btn = e.target.querySelector('button[type="submit"]');
  setAuthLoading(btn, true);
  try {
    if (!apiFn("apiSignup") || !apiFn("apiLogin")) {
      throw new Error("API layer is unavailable. Please try again later.");
    }
    await apiSignup(signupPayload);
    const loginResponse = await apiLogin(email, password);
    await syncApiAfterAuth(loginResponse, { email, password });

    toast("Account created! Welcome, " + fullName, "success");
    launchApp();
  } catch (error) {
    toast(error?.message || "Registration failed.", "error");
  } finally {
    setAuthLoading(btn, false);
  }
}

function checkPasswordStrength(val) {
  const result = PasswordValidator.validate(val);
  const bar = document.getElementById("strengthBar");
  const txt = document.getElementById("strengthText");

  const strengthLevels = {
    "very-weak": { width: "20%", color: "#dc2626", label: "Very Weak" },
    weak: { width: "40%", color: "#ef4444", label: "Weak" },
    medium: { width: "60%", color: "#f59e0b", label: "Medium" },
    strong: { width: "80%", color: "#10b981", label: "Strong" },
    "very-strong": { width: "100%", color: "#0ea5e9", label: "Very Strong" },
  };

  const level = strengthLevels[result.strength];
  bar.style.width = level.width;
  bar.style.background = level.color;
  txt.textContent = level.label;
}

function launchApp() {
  document.getElementById("loginPage").classList.add("hidden");
  document.getElementById("signupPage").classList.add("hidden");
  const app = document.getElementById("mainApp");
  app.classList.remove("hidden");
  app.style.opacity = "0";
  app.style.transform = "translateY(10px)";
  app.style.transition = "opacity 0.4s ease, transform 0.4s ease";
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      app.style.opacity = "1";
      app.style.transform = "translateY(0)";
    });
  });
  setTimeout(() => {
    app.style.transition = "";
    app.style.transform = "";
  }, 500);
  updateSidebarDoctor();
  startClock();
  initScrollProgress();
  updatePendingBadge();
  if (
    typeof loadConsultationLookups === "function" &&
    AuthValidator.hasValidToken()
  ) {
    loadConsultationLookups().catch((error) =>
      console.warn("Consultation lookup preload failed:", error),
    );
  }
  showApp("dashboard");
}

async function logout() {
  const app = document.getElementById("mainApp");
  app.style.transition = "opacity 0.35s ease";
  app.style.opacity = "0";
  try {
    // 📊 Clean up charts before logout
    if (typeof ChartManager !== "undefined") {
      ChartManager.destroyAll();
    }
    if (apiFn("apiLogout")) await apiLogout();
  } catch (error) {
    console.warn("Logout API failed:", error);
  }
  // 🔐 Use AuthValidator to clear token
  AuthValidator.clearToken();
  localStorage.removeItem("doctorId");
  setTimeout(() => {
    app.classList.add("hidden");
    app.style.opacity = "";
    app.style.transition = "";
    document.getElementById("loginPage").classList.remove("hidden");
    document.getElementById("loginEmail").value = "";
    document.getElementById("loginPassword").value = "";
    const cb = document.getElementById("themeCheckboxTop");
    if (cb && isDark) {
      isDark = false;
      document.documentElement.setAttribute("data-theme", "light");
      cb.checked = false;
    }
  }, 350);
}

function setAuthLoading(btn, loading) {
  if (loading) {
    btn.classList.add("loading");
    btn.disabled = true;
  } else {
    btn.classList.remove("loading");
    btn.disabled = false;
  }
}
document.addEventListener("DOMContentLoaded", async () => {
  try {
    const token = AuthValidator.getValidToken();

    if (!token) {
      return; // No token -> show login page
    }

    // 🔐 FIX: Verify doctorId exists before launching
    // If token is valid but doctorId missing, session is incomplete
    const doctorId = localStorage.getItem("doctorId");
    if (!doctorId) {
      console.warn(
        "Valid token exists but doctorId is missing. Clearing session.",
      );
      AuthValidator.clearToken();
      return; // Show login page
    }

    // Valid token + doctorId exists -> refresh API data first
    try {
      if (typeof refreshAppointmentsFromApi === "function") {
        await refreshAppointmentsFromApi();
      }
    } catch (error) {
      console.warn("Session refresh sync failed:", error);
    }
    launchApp();
  } catch (error) {
    console.error("Session restore failed:", error);

    AuthValidator.clearToken();

    document.getElementById("loginPage").classList.remove("hidden");
  }
});
