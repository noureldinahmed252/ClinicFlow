// ============================================================
// PROFILE
// ============================================================
function setTextIfPresent(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function renderProfile() {
  const currentDoctorId = getCurrentDoctorId();
  const doc = normalizeDoctor(DB.get("doctor", {}));
  const patients = SafeDB.get("patients").map(normalizePatient);
  const appts = SafeDB.get("appointments").map(normalizeAppointment);
  const clinics = DB.get("clinics").map(normalizeClinic);
  const now = new Date();
  const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const monthAppts = appts.filter((a) => a.date.startsWith(monthStr));
  const monthDone = appts.filter(
    (a) => a.date.startsWith(monthStr) && a.status === "Completed",
  );

  document.getElementById("profName").textContent = valueOrDash(doc.name);
  document.getElementById("profSpecialty").textContent = valueOrDash(
    doc.specialty,
  );
  document.getElementById("profStatPatients").textContent = patients.length;
  document.getElementById("profStatAppts").textContent = appts.length;
  document.getElementById("profStatClinics").textContent = clinics.length;
  document.getElementById("profRating").textContent = doc.averageRating || "0";
  document.getElementById("profPhone").textContent = valueOrDash(doc.phone);
  document.getElementById("profEmail").textContent = valueOrDash(doc.email);
  document.getElementById("profCity").textContent = valueOrDash(doc.city);
  document.getElementById("profSpec2").textContent = valueOrDash(doc.specialty);
  document.getElementById("profCert").textContent = valueOrDash(
    doc.certificate,
  );
  document.getElementById("profLicense").textContent = valueOrDash(
    doc.licenseNumber,
  );
  setTextIfPresent("profDoctorId", valueOrDash(doc.doctorId));
  setTextIfPresent("profNational", valueOrDash(doc.nationalNumber));
  setTextIfPresent(
    "profFee",
    doc.consultationFee ? `${doc.consultationFee} EGP` : "-",
  );
  document.getElementById("profMonthAppts").textContent = monthAppts.length;
  document.getElementById("profMonthPatients").textContent = patients.filter(
    (p) => p.lastVisit?.startsWith(monthStr),
  ).length;
  document.getElementById("profMonthDone").textContent = monthDone.length;

  renderDoctorImage(doc);
  renderClinics();
}

function renderDoctorImage(doc) {
  const avatar =
    document.getElementById("profileAvatarBig") ||
    document.querySelector(".profile-avatar-big");
  setDoctorAvatarImage(avatar, doc);
}

function renderClinics() {
  const clinics = DB.get("clinics").map(normalizeClinic);
  const grid = document.getElementById("clinicsGrid");
  if (!clinics.length) {
    grid.innerHTML =
      '<div class="empty-state" style="grid-column: 1/-1;"><div class="icon">🏥</div><h3>No clinics yet</h3><p>Add your first clinic to get started</p></div>';
    return;
  }
  grid.innerHTML = clinics
    .map((c) => {
      const days = toWorkingDaysArray(c.workingDays);
      const clinicIdArg = escapeJsString(c.clinicId);
      const safeClinicName = escapeHtml(valueOrDash(c.clinicName));
      const safeLocation = escapeHtml(valueOrDash(c.location));
      const safePhone = escapeHtml(c.clinicPhone);
      const safeEmail = escapeHtml(c.clinicEmail);
      const safeDays = days.map((day) => escapeHtml(day)).join(", ");
      const safeStartTime = escapeHtml(c.workStartTime);
      const safeEndTime = escapeHtml(c.workEndTime);
      const safePrice = escapeHtml(c.doctorPrice);
      const safeSlotDuration = escapeHtml(c.slotDurationMinutes);
      return `
      <div class="clinic-card">
        <div class="clinic-card-header">
          <div>
            <div class="clinic-icon">🏥</div>
          </div>
          <div class="clinic-card-actions">
            <button class="btn btn-ghost" onclick="showEditClinicModal('${clinicIdArg}')" style="padding:8px 12px;font-size:12px;font-weight:600;" title="Edit Clinic">Edit</button>
            <button class="btn btn-danger" onclick="deleteClinic('${clinicIdArg}')" style="padding:8px 12px;font-size:12px;font-weight:600;" title="Delete Clinic">Delete</button>
          </div>
        </div>
        <div class="clinic-name">${safeClinicName}</div>
        <div class="clinic-info-group">
          <div class="clinic-address"><strong>📍</strong> ${safeLocation}</div>
          ${c.clinicPhone ? `<div class="clinic-address"><strong>📞</strong> ${safePhone}</div>` : ""}
          ${c.clinicEmail ? `<div class="clinic-address"><strong>✉️</strong> ${safeEmail}</div>` : ""}
        </div>
        ${days.length ? `<div class="clinic-info-group"><div class="clinic-address"><strong>📅</strong> ${safeDays}</div></div>` : ""}
        ${
          c.workStartTime && c.workEndTime
            ? `<div class="clinic-info-group"><div class="clinic-address"><strong>🕐</strong> ${safeStartTime} – ${safeEndTime}</div></div>`
            : ""
        }
        ${
          c.doctorPrice
            ? `<div class="clinic-info-group"><div class="clinic-address" style="margin-bottom: 0;"><strong>💰</strong> <span class="badge badge-confirmed">${safePrice} EGP</span></div>
               ${c.slotDurationMinutes ? `<div class="clinic-address" style="margin-top: 8px; margin-bottom: 0; font-size: 12px;"><strong>⏱️</strong> ${safeSlotDuration} min slots</div>` : ""}</div>`
            : c.slotDurationMinutes
              ? `<div class="clinic-info-group"><div class="clinic-address" style="font-size: 12px;"><strong>⏱️</strong> ${safeSlotDuration} min slots</div></div>`
              : ""
        }
      </div>`;
    })
    .join("");
}

function openAddClinic() {
  showAddClinicModal();
}

function showAddClinicModal() {
  document.getElementById("clinicModalTitle").textContent = "Add New Clinic";
  document.getElementById("clinicId").value = "";
  document.getElementById("clinicForm").reset();
  document.querySelectorAll(".working-day-checkbox").forEach((cb) => {
    cb.checked = false;
  });
  openModal("clinicModal");
}

function showEditClinicModal(id) {
  const rawClinic = DB.get("clinics").find(
    (c, index) => normalizeClinic(c, index).clinicId === toClinicId(id),
  );
  if (!rawClinic) return;
  const clinic = normalizeClinic(rawClinic);
  document.getElementById("clinicModalTitle").textContent = "Edit Clinic";
  document.getElementById("clinicId").value = clinic.clinicId;
  document.getElementById("cName").value = clinic.clinicName;
  document.getElementById("cEmail").value = clinic.clinicEmail;
  document.getElementById("cPhone").value = clinic.clinicPhone;
  document.getElementById("cLocation").value = clinic.location;
  document.getElementById("cWorkStartTime").value = clinic.workStartTime;
  document.getElementById("cWorkEndTime").value = clinic.workEndTime;
  document.getElementById("cDoctorPrice").value = clinic.doctorPrice;
  document.getElementById("cSlotDuration").value = clinic.slotDurationMinutes;
  const selectedDays = toWorkingDaysArray(clinic.workingDays);
  document.querySelectorAll(".working-day-checkbox").forEach((cb) => {
    cb.checked = selectedDays.includes(cb.value);
  });
  openModal("clinicModal");
}

function openEditClinic(id) {
  showEditClinicModal(id);
}

function buildClinicPayload(id = "") {
  const workingDays = Array.from(
    document.querySelectorAll(".working-day-checkbox:checked"),
  ).map((cb) => cb.value);
  return normalizeClinic({
    clinicId: id ? toClinicId(id) : nextNumericId("clinics"),
    clinicName: document.getElementById("cName").value.trim(),
    clinicEmail: document.getElementById("cEmail").value.trim(),
    clinicPhone: document.getElementById("cPhone").value.trim(),
    location: document.getElementById("cLocation").value.trim(),
    workingDays: workingDays.join(","),
    workStartTime: document.getElementById("cWorkStartTime").value,
    workEndTime: document.getElementById("cWorkEndTime").value,
    doctorPrice: document.getElementById("cDoctorPrice").value,
    slotDurationMinutes: document.getElementById("cSlotDuration").value,
  });
}

function clinicApiPayload(clinic) {
  return {
    clinicName: clinic.clinicName,
    clinicPhone: clinic.clinicPhone,
    clinicEmail: clinic.clinicEmail,
    location: clinic.location,
    workingDays: clinic.workingDays,
    workStartTime: clinic.workStartTime,
    workEndTime: clinic.workEndTime,
    doctorPrice: clinic.doctorPrice,
    slotDurationMinutes: clinic.slotDurationMinutes,
  };
}

async function saveClinic(e) {
  e.preventDefault();
  const id = document.getElementById("clinicId").value;
  const clinic = buildClinicPayload(id);

  if (
    !clinic.clinicName ||
    !clinic.clinicPhone ||
    !clinic.clinicEmail ||
    !clinic.location
  ) {
    toast("Please fill all required clinic fields", "error");
    return;
  }
  if (!toWorkingDaysArray(clinic.workingDays).length) {
    toast("Please select at least one working day", "error");
    return;
  }
  if (clinic.workEndTime <= clinic.workStartTime) {
    toast("Work end time must be after start time", "error");
    return;
  }

  const btn = e.target.querySelector('button[type="submit"]');
  setAuthLoading(btn, true);
  try {
    if (!localStorage.getItem("authToken")) {
      throw new Error("Login is required to save clinic.");
    }
    if (id && apiFn("updateClinic")) {
      await apiFn("updateClinic")(clinic.clinicId, clinicApiPayload(clinic));
    } else if (!id && apiFn("createClinic")) {
      const created = await apiFn("createClinic")(clinicApiPayload(clinic));
      const createdClinicId =
        unpackApiResponse(created)?.clinicId ?? created?.clinicId;
      if (createdClinicId) clinic.clinicId = createdClinicId;
    } else {
      throw new Error("Clinic API is unavailable. Please try again later.");
    }

    const clinics = DB.get("clinics").map((c, index) =>
      normalizeClinic(c, index),
    );
    const index = clinics.findIndex((c) => c.clinicId === clinic.clinicId);
    if (index >= 0) clinics[index] = clinic;
    else clinics.push(clinic);
    DB.set("clinics", clinics);

    closeModal("clinicModal");
    toast(
      id ? "Clinic updated successfully!" : "Clinic added successfully!",
      "success",
    );
    renderProfile();
  } catch (error) {
    toast(error?.message || "Failed to save clinic", "error");
  } finally {
    setAuthLoading(btn, false);
  }
}

async function deleteClinic(id) {
  // Store the ID to be deleted in a data attribute
  window._clinicToDeleteId = id;
  openModal("deleteClinicConfirmModal");
}

async function confirmDeleteClinic() {
  const id = window._clinicToDeleteId;
  if (!id) return;

  try {
    if (!apiFn("deleteClinic") || !localStorage.getItem("authToken")) {
      throw new Error("Clinic API is unavailable. Please try again later.");
    }
    await apiFn("deleteClinic")(toClinicId(id));
    DB.set(
      "clinics",
      DB.get("clinics")
        .map((c, index) => normalizeClinic(c, index))
        .filter((c) => c.clinicId !== toClinicId(id)),
    );
    closeModal("deleteClinicConfirmModal");
    toast("Clinic deleted successfully", "success");
    renderProfile();
    window._clinicToDeleteId = null;
  } catch (error) {
    toast(error?.message || "Failed to delete clinic", "error");
  }
}

function previewProfilePhoto(input) {
  if (!input.files || !input.files[0]) return;
  const reader = new FileReader();
  reader.onload = function (e) {
    const preview = document.getElementById("photoPreview");
    preview.style.backgroundImage = `url(${e.target.result})`;
    preview.style.backgroundSize = "cover";
    preview.style.backgroundPosition = "center";
    preview.textContent = "";
  };
  reader.readAsDataURL(input.files[0]);
}

function openEditProfile() {
  const doc = normalizeDoctor(DB.get("doctor", {}));
  document.getElementById("editName").value = doc.name || "";
  document.getElementById("editEmail").value = doc.email || "";
  document.getElementById("editPhone").value = doc.phone || "";
  document.getElementById("editCity").value = doc.city || "";
  document.getElementById("editCurrentPassword").value = "";
  document.getElementById("editNewPassword").value = "";
  document.getElementById("editConfirmPassword").value = "";

  const preview = document.getElementById("photoPreview");
  setDoctorAvatarImage(preview, doc);
  document.getElementById("profilePhoto").value = "";

  openModal("profileModal");
}

function showEditProfileModal() {
  openEditProfile();
}

function updateProfilePage() {
  renderProfile();
}

async function saveProfile(e) {
  e.preventDefault();
  const doc = normalizeDoctor(DB.get("doctor", {}));
  const newPassword = document.getElementById("editNewPassword").value.trim();
  const confirmPassword = document
    .getElementById("editConfirmPassword")
    .value.trim();
  const currentPassword = document
    .getElementById("editCurrentPassword")
    .value.trim();

  if (!currentPassword) {
    toast("Current password is required", "error");
    return;
  }
  if (!apiFn("apiUpdateProfile")) {
    toast("Profile API is unavailable. Please try again later.", "error");
    return;
  }
  if (newPassword) {
    if (newPassword.length < 8) {
      toast("New password must be at least 8 characters", "error");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast("New passwords do not match", "error");
      return;
    }
  }

  const profilePayload = {
    doctorName: document.getElementById("editName").value.trim(),
    doctorPhone: document.getElementById("editPhone").value.trim(),
    doctorEmail: document.getElementById("editEmail").value.trim(),
    doctorCity: document.getElementById("editCity").value,
    currentPassword,
    newPassword: newPassword || "",
  };

  const btn = e.target.querySelector('button[type="submit"]');
  setAuthLoading(btn, true);
  try {
    if (doc.doctorId && localStorage.getItem("authToken")) {
      await apiUpdateProfile(doc.doctorId, profilePayload);
    } else {
      throw new Error("Login is required to update profile.");
    }

    const photoInput = document.getElementById("profilePhoto");
    if (
      doc.doctorId &&
      photoInput.files?.[0] &&
      apiFn("uploadDoctorProfileImage") &&
      localStorage.getItem("authToken")
    ) {
      await uploadDoctorProfileImage(doc.doctorId, photoInput.files[0]);
      if (apiFn("getDoctorImage")) {
        doc.doctorImage = await getDoctorImage(doc.doctorId);
      }
    } else if (photoInput.files?.[0]) {
      doc.doctorImage = await readFileAsDataUrl(photoInput.files[0]);
    }

    const refreshedProfile = apiFn("getProfileData")
      ? await getProfileData(doc.doctorId)
      : null;
    const updated = normalizeDoctor(unpackApiResponse(refreshedProfile) || {});
    DB.set("doctor", updated);
    closeModal("profileModal");
    toast("Profile updated successfully!", "success");
    renderProfile();
    updateSidebarDoctor();
  } catch (error) {
    toast(error?.message || "Failed to update profile", "error");
  } finally {
    setAuthLoading(btn, false);
  }
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ============================================================
// MODERN PILL BUTTON STYLING FOR WORKING DAYS
// ============================================================
function initWorkingDayPills() {
  document.querySelectorAll(".working-day-checkbox").forEach((checkbox) => {
    const label = checkbox.closest(".working-day-label");

    // Set initial active state
    if (checkbox.checked && label) {
      label.classList.add("active");
    }

    // Add change listener
    checkbox.addEventListener("change", function () {
      if (this.checked) {
        label.classList.add("active");
      } else {
        label.classList.remove("active");
      }
    });
  });
}

// Initialize pills when modals are opened
const originalOpenModal = window.openModal;
window.openModal = function (modalId) {
  originalOpenModal.call(this, modalId);
  if (modalId === "clinicModal") {
    // Use setTimeout to ensure DOM is ready
    setTimeout(() => {
      initWorkingDayPills();
    }, 50);
  }
};

// Initialize on page load
document.addEventListener("DOMContentLoaded", function () {
  initWorkingDayPills();
});
