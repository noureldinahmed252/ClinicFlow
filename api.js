// ========================
// API Configuration & Service
// ========================

const BASE_URL = "https://osamarabea-001-site1.jtempurl.com";

function apiAbsoluteUrl(url) {
  if (!url) return "";
  const value = String(url).trim();
  if (/^(https?:|data:|blob:)/i.test(value)) return value;
  return value.startsWith("/") ? BASE_URL + value : `${BASE_URL}/${value}`;
}

// Generic API Request Handler with Retry & Validation
async function apiRequest(endpoint, method = "GET", body = null) {
  try {
    // 🔐 Use validated token
    const token = AuthValidator.getValidToken();

    const response = await fetch(BASE_URL + endpoint, {
      method: method,
      headers: {
        "Content-Type": "application/json",

        ...(token && { Authorization: "Bearer " + token }),
      },
      body: body ? JSON.stringify(body) : null,
    });

    // Get response text first
    const responseText = await response.text();

    // Try to parse JSON safely
    let data = {};
    if (responseText) {
      try {
        data = JSON.parse(responseText);
      } catch {
        console.error("❌ Invalid JSON response");
        throw new Error("Server returned invalid response");
      }
    }

    // Handle unauthorized - give better error message
    if (response.status === 401) {
      AuthValidator.clearToken();
      // Dispatch auth error event
      window.dispatchEvent(new CustomEvent("unauthorized"));
      // Use the API message if available (e.g., "Invalid email or password")
      const errorMsg = data.message || "Invalid credentials or session expired";
      throw new Error(errorMsg);
    }

    if (!response.ok) {
      // Clean error messages STRICTLY to remove file paths and dangerous content
      let errorMessage = data.message || `Error: ${response.status}`;

      // 🔥 STRICT CLEANING - Remove all dangerous patterns
      errorMessage = String(errorMessage)
        // Remove Windows paths (C:\, D:\, etc.)
        .replace(/[A-Z]:\\[^\s"]*/gi, "[path]")
        // Remove Unix/Linux paths (/home/, /root/, etc.)
        .replace(/\/[a-zA-Z0-9_\-\/]+/g, "[path]")
        // Remove file extensions patterns
        .replace(/\.[a-zA-Z0-9]{2,}:/g, "[error]")
        // Remove stack traces
        .replace(/at\s+[^\n]*/gi, "")
        // Remove function calls with paths
        .replace(/\([^()]*[A-Z]:\\[^)]*\)/gi, "[error]")
        // Remove URLs that might navigate
        .replace(/https?:\/\/[^\s]*/gi, "[url]")
        // Keep only first line
        .split("\n")[0]
        // Trim whitespace
        .trim();

      // Fallback message for status codes
      if (!errorMessage || errorMessage.length === 0) {
        if (response.status === 401) {
          errorMessage = "Invalid email or password";
        } else if (response.status === 404) {
          errorMessage = "Server not available";
        } else if (response.status === 500) {
          errorMessage = "Server error";
        } else {
          errorMessage = "Connection error";
        }
      }

      throw new Error(errorMessage);
    }

    return data;
  } catch (error) {
    console.error("🔴 API Error:", error);
    throw error;
  }
}

function unwrapApiData(response) {
  return response?.data?.data ?? response?.data ?? response?.result ?? response;
}

function arrayFromApiResponse(response, keys = []) {
  const data = unwrapApiData(response);
  if (Array.isArray(data)) return data;
  if (data && typeof data === "object") {
    for (const key of keys) {
      if (Array.isArray(data[key])) return data[key];
    }
  }
  return [];
}

function normalizeApiDisease(disease = {}) {
  return {
    id: disease.diseaseId ?? disease.id,
    name: disease.diseasesName ?? disease.diseaseName ?? disease.name ?? "",
    severity: disease.diseaseSeverity ?? disease.severity ?? "",
  };
}

function normalizeApiMedicine(medicine = {}) {
  return {
    id: medicine.medicineId ?? medicine.id,
    name:
      medicine.medicineName ??
      medicine.medicationName ??
      medicine.drugName ??
      medicine.name ??
      "",
  };
}

// ========================
// AUTH ENDPOINTS
// ========================

// Login Doctor - Correct endpoint
async function apiLogin(email, password) {
  const response = await apiRequest("/api/auth/doctor/login", "POST", {
    email: email,
    password: password,
  });

  // Save token if returned - using authToken consistently
  const token = response.token || response.access_token || response.data?.token;

  if (token) {
    localStorage.setItem("authToken", token);
  } else {
    console.warn("⚠️ No token in login response");
  }

  return response;
}

// Register Doctor - Correct endpoint (multipart/form-data)
async function apiSignup(signupData) {
  try {
    // Convert object to FormData (API expects multipart/form-data, not JSON)
    const formData = new FormData();

    formData.append("FullName", signupData.FullName || "");
    formData.append("Email", signupData.Email || "");
    formData.append("Password", signupData.Password || "");
    formData.append("Phone", signupData.Phone || "");
    formData.append("City", signupData.City || "");
    formData.append("SpecialtyName", signupData.SpecialtyName || "");
    formData.append("Certificate", signupData.Certificate || "");
    formData.append("LicenseNumber", signupData.LicenseNumber || "");
    formData.append("NationalNumber", signupData.NationalNumber || 0);

    const response = await fetch(BASE_URL + "/api/auth/doctor/register", {
      method: "POST",
      headers: {
        // NOTE: Don't set Content-Type header, let browser set it with boundary for multipart/form-data
      },
      body: formData,
    });

    // Get response text first
    const responseText = await response.text();

    // Handle unauthorized
    if (response.status === 401) {
      localStorage.removeItem("authToken");
      throw new Error("Your session has expired. Please login again");
    }

    // Try to parse JSON safely
    let data = {};
    if (responseText) {
      try {
        data = JSON.parse(responseText);
      } catch {
        console.error("❌ Invalid JSON response");
        throw new Error("Server returned invalid response");
      }
    }

    if (!response.ok) {
      // Handle error response
      let errorMessage =
        data.message || data.Message || `Error: ${response.status}`;

      // Clean error message
      errorMessage = String(errorMessage)
        .replace(/[A-Z]:\\[^\s"]*/gi, "[path]")
        .replace(/\/[a-zA-Z0-9_\-\/]+/g, "[path]")
        .split("\n")[0]
        .trim();

      if (!errorMessage || errorMessage.length === 0) {
        if (response.status === 400) {
          errorMessage = data.message || "Invalid data provided";
        } else if (response.status === 404) {
          errorMessage = "Server not available";
        } else if (response.status === 500) {
          errorMessage = "Server error - please check your input";
        } else {
          errorMessage = "Failed to register";
        }
      }

      throw new Error(errorMessage);
    }

    // Save token if returned
    if (data.token) {
      localStorage.setItem("authToken", data.token);
    } else if (data.access_token) {
      localStorage.setItem("authToken", data.access_token);
    } else if (data.data?.token) {
      localStorage.setItem("authToken", data.data.token);
    }

    return data;
  } catch (error) {
    console.error("🔴 Registration error:", error);
    throw error;
  }
}

// Register Doctor with Photo Upload
async function apiSignupWithPhoto(formData) {
  try {
    const token = localStorage.getItem("authToken");

    const response = await fetch(BASE_URL + "/api/auth/doctor/register", {
      method: "POST",
      headers: {
        // NOTE: Don't set Content-Type header, let browser set it with boundary
        // NOTE: No Authorization header - registration is public
      },
      body: formData,
    });


    // Get response text first
    const responseText = await response.text();

    // Handle unauthorized
    if (response.status === 401) {
      localStorage.removeItem("authToken");
      throw new Error("Your session has expired. Please login again");
    }

    // Try to parse JSON safely
    let data = {};
    if (responseText) {
      try {
        data = JSON.parse(responseText);
      } catch {
        console.error("❌ Invalid JSON response");
        throw new Error("Server returned invalid response");
      }
    }

    if (!response.ok) {
      // Clean error messages STRICTLY to remove file paths and dangerous content
      let errorMessage =
        data.message || data.Message || `Error: ${response.status}`;

      // 🔥 STRICT CLEANING - Remove all dangerous patterns
      errorMessage = String(errorMessage)
        // Remove Windows paths (C:\, D:\, etc.)
        .replace(/[A-Z]:\\[^\s"]*/gi, "[path]")
        // Remove Unix/Linux paths (/home/, /root/, etc.)
        .replace(/\/[a-zA-Z0-9_\-\/]+/g, "[path]")
        // Remove file extensions patterns
        .replace(/\.[a-zA-Z0-9]{2,}:/g, "[error]")
        // Remove stack traces
        .replace(/at\s+[^\n]*/gi, "")
        // Remove function calls with paths
        .replace(/\([^()]*[A-Z]:\\[^)]*\)/gi, "[error]")
        // Remove URLs that might navigate
        .replace(/https?:\/\/[^\s]*/gi, "[url]")
        // Keep only first line
        .split("\n")[0]
        // Trim whitespace
        .trim();

      // Fallback message for status codes
      if (
        !errorMessage ||
        errorMessage.length === 0 ||
        errorMessage === "An unexpected error occurred. Please try again later."
      ) {
        if (response.status === 401) {
          errorMessage = "Invalid email or password";
        } else if (response.status === 404) {
          errorMessage = "Server not available";
        } else if (response.status === 500) {
          errorMessage = "Data processing error - please check your input";
        } else {
          errorMessage = "Connection error - please try again later";
        }
      }

      throw new Error(errorMessage);
    }


    // Save token if returned
    if (data.token) {
      localStorage.setItem("authToken", data.token);
    } else if (data.access_token) {
      localStorage.setItem("authToken", data.access_token);
    } else if (data.data?.token) {
      localStorage.setItem("authToken", data.data.token);
    }

    return data;
  } catch (error) {
    console.error("🔴 Registration error:", error);
    throw error;
  }
}

// Get Doctor Profile Data
async function getProfileData(doctorId) {
  try {
    const response = await apiRequest(`/api/DoctorProfile/${doctorId}`, "GET");

    return response;
  } catch (error) {
    console.error("🔴 Profile fetch error:", error);
    throw error;
  }
}

// Update Doctor Profile
async function apiUpdateProfile(doctorId, profileData) {
  try {
    const source =
      profileData instanceof FormData
        ? Object.fromEntries(profileData.entries())
        : profileData || {};
    const payload = {
      doctorName: source.doctorName || "",
      doctorPhone: source.doctorPhone || "",
      doctorEmail: source.doctorEmail || "",
      doctorCity: source.doctorCity || "",
      currentPassword: source.currentPassword || "",
      newPassword: source.newPassword || "",
    };

    const updatedProfile = await apiRequest(
      `/api/DoctorProfile/${doctorId}`,
      "PUT",
      payload,
    );
    return updatedProfile;

    const token = localStorage.getItem("authToken");


    // Convert FormData to object for inspection and potential JSON conversion
    const dataObject = {};
    for (let [key, value] of formData.entries()) {
      if (value instanceof File) {
        dataObject[key] = value; // Keep file as-is
      } else {
        dataObject[key] = value;
      }
    }

    // Check if there are any files in the data
    const hasFiles = Object.values(dataObject).some(
      (val) => val instanceof File,
    );

    let requestConfig;

    if (hasFiles) {
      // If there are files, send FormData
      requestConfig = {
        method: "PUT",
        headers: {
          ...(token && { Authorization: "Bearer " + token }),
          // Don't set Content-Type for multipart/form-data
        },
        body: formData,
      };
    } else {
      // If no files, send as JSON wrapped in 'dto'

      // Create dto wrapper object with all fields as strings
      const dtoData = {};
      for (let [key, value] of formData.entries()) {
        // Keep everything as string for backend compatibility
        dtoData[key] = String(value || "");
      }


      // Wrap in dto object
      const requestBody = { dto: dtoData };

      requestConfig = {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(token && { Authorization: "Bearer " + token }),
        },
        body: JSON.stringify(requestBody),
      };
    }

    const response = await fetch(
      BASE_URL + `/api/DoctorProfile/${doctorId}`,
      requestConfig,
    );


    // Get response text first
    const responseText = await response.text();

    // Try to parse JSON safely
    let data = {};
    if (responseText) {
      try {
        data = JSON.parse(responseText);
      } catch {
        console.error("❌ Invalid JSON response");
        throw new Error("Server returned invalid response");
      }
    }

    if (!response.ok) {
      // Handle error response
      let errorMessage =
        data.message || data.Message || `Error: ${response.status}`;

      // If there are validation errors, extract them
      if (data.errors) {
        const errorList = Object.entries(data.errors)
          .map(
            ([field, msgs]) =>
              `${field}: ${Array.isArray(msgs) ? msgs[0] : msgs}`,
          )
          .join("; ");
        errorMessage = errorList || errorMessage;
      }

      // Clean error message
      errorMessage = String(errorMessage)
        .replace(/[A-Z]:\\[^\s"]*/gi, "[path]")
        .replace(/\/[a-zA-Z0-9_\-\/]+/g, "[path]")
        .split("\n")[0]
        .trim();

      if (!errorMessage || errorMessage.length === 0) {
        if (response.status === 401) {
          errorMessage = "Unauthorized - please login again";
        } else if (response.status === 404) {
          errorMessage = "Doctor profile not found";
        } else if (response.status === 400) {
          errorMessage = data.message || "Invalid data provided";
        } else if (response.status === 415) {
          errorMessage = "Invalid data format";
        } else {
          errorMessage = "Failed to update profile";
        }
      }

      throw new Error(errorMessage);
    }

    return data;
  } catch (error) {
    console.error("🔴 Profile update error:", error);
    throw error;
  }
}

async function getMyDiseasesAndMedicines() {
  try {
    const response = await apiRequest(
      "/api/Appointment/my-diseases-and-medicines",
      "GET",
    );
    const data = unwrapApiData(response) || {};
    return {
      diseases: arrayFromApiResponse(data.diseases ?? data, ["diseases"])
        .map(normalizeApiDisease)
        .filter(
          (disease) =>
            disease.id !== undefined && disease.id !== null && disease.name,
        ),
      medicines: arrayFromApiResponse(
        data.medicines ?? data.medications ?? data,
        ["medicines", "medications"],
      )
        .map(normalizeApiMedicine)
        .filter(
          (medicine) =>
            medicine.id !== undefined && medicine.id !== null && medicine.name,
        ),
    };
  } catch (error) {
    console.error("🔴 Failed to fetch diseases and medicines:", error);
    throw error;
  }
}

async function completeAppointment(appointmentId, payload) {
  try {
    if (!appointmentId) {
      throw new Error("Appointment ID is required");
    }

    const requestPayload = {
      notes: payload?.notes || "",
      diseaseDescription: payload?.diseaseDescription || "",
      diseasesIds: Array.isArray(payload?.diseasesIds)
        ? payload.diseasesIds
        : [],
      medicineIds: Array.isArray(payload?.medicineIds)
        ? payload.medicineIds
        : [],
      dose: payload?.dose || "",
      form: payload?.form || "",
      frequency: payload?.frequency || "",
      days: Number(payload?.days) || 0,
      timing: payload?.timing || "",
    };

    return await apiRequest(
      `/api/Appointment/complete/${appointmentId}`,
      "PUT",
      requestPayload,
    );
  } catch (error) {
    console.error("🔴 Failed to complete appointment:", error);
    throw error;
  }
}

// Logout
async function apiLogout() {
  localStorage.removeItem("authToken");
}

// ========================
// DOCTOR PROFILE ENDPOINTS
// ========================

/**
 * Fetch all doctors from the system
 * Returns an array of doctors with basic info (id, name, specialty, rating, locations)
 * Throws if the backend is unavailable
 * @returns {Promise<Array>} Array of doctor objects formatted for rendering
 */
async function getAllDoctors() {
  try {
    const response = await apiRequest("/api/DoctorProfile/all", "GET");


    // Format response for frontend if needed
    return Array.isArray(response) ? response : response.data || [];
  } catch (error) {
    console.error("Failed to fetch doctors:", error.message);
    throw error;
  }
}

/**
 * Fetch detailed profile for a specific doctor
 * Returns comprehensive doctor information including biography, ratings, and qualifications
 * Throws if the backend is unavailable
 * @param {number|string} doctorId - The ID of the doctor to fetch
 * @returns {Promise<Object>} Doctor object with detailed information
 */
async function getDoctorById(doctorId) {
  try {
    const response = await apiRequest(`/api/DoctorProfile/${doctorId}`, "GET");


    return response.data || response;
  } catch (error) {
    console.error(`Failed to fetch doctor ${doctorId}:`, error.message);
    throw error;
  }
}

/**
 * Fetch doctor's profile image
 * Returns image URL or blob for rendering doctor avatar
 * Throws if the backend image endpoint is unavailable
 * @param {number|string} doctorId - The ID of the doctor
 * @returns {Promise<string|Blob>} Image URL or blob data
 */
async function getDoctorImage(doctorId) {
  try {
    const response = await fetch(
      `${BASE_URL}/api/DoctorProfile/${doctorId}/image`,
      {
        method: "GET",
        headers: {},
      },
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.status}`);
    }

    // Return blob URL for image rendering
    const blob = await response.blob();
    const imageUrl = URL.createObjectURL(blob);

    return imageUrl;
  } catch (error) {
    console.error(`Failed to fetch doctor image:`, error.message);
    throw error;
  }
}

/**
 * Upload doctor profile image
 * Posts image to API endpoint: POST /api/DoctorProfile/{doctorId}/image
 * Accepts multipart/form-data with 'image' field
 * @param {number|string} doctorId - The ID of the doctor
 * @param {File} imageFile - The image file to upload
 * @returns {Promise<Object>} Response with imageUrl
 */
async function uploadDoctorProfileImage(doctorId, imageFile) {
  try {
    const token = localStorage.getItem("authToken");


    // Create FormData with image file
    const formData = new FormData();
    formData.append("image", imageFile);

    const response = await fetch(
      `${BASE_URL}/api/DoctorProfile/${doctorId}/image`,
      {
        method: "POST",
        headers: {
          ...(token && { Authorization: "Bearer " + token }),
          // Don't set Content-Type, let browser set it with boundary
        },
        body: formData,
      },
    );


    // Get response text first
    const responseText = await response.text();

    // Try to parse JSON safely
    let data = {};
    if (responseText) {
      try {
        data = JSON.parse(responseText);
      } catch {
        console.error("❌ Invalid JSON response");
        throw new Error("Server returned invalid response");
      }
    }

    if (!response.ok) {
      // Handle error response
      let errorMessage =
        data.message || data.Message || `Error: ${response.status}`;

      // Clean error message
      errorMessage = String(errorMessage)
        .replace(/[A-Z]:\\[^\s"]*/gi, "[path]")
        .replace(/\/[a-zA-Z0-9_\-\/]+/g, "[path]")
        .split("\n")[0]
        .trim();

      if (!errorMessage || errorMessage.length === 0) {
        if (response.status === 401) {
          errorMessage = "Unauthorized - please login again";
        } else if (response.status === 404) {
          errorMessage = "Doctor profile not found";
        } else if (response.status === 400) {
          errorMessage = data.message || "Invalid image format";
        } else {
          errorMessage = "Failed to upload image";
        }
      }

      throw new Error(errorMessage);
    }

    return data;
  } catch (error) {
    console.error("🔴 Image upload error:", error);
    throw error;
  }
}

// ========================
// APPOINTMENT ENDPOINTS
// ========================

/**
 * Fetch available appointment slots for a specific doctor
 * Returns doctor info, clinics, working days, and available time slots
 * Throws if the backend is unavailable
 * @param {number|string} doctorId - The ID of the doctor
 * @returns {Promise<Object>} Availability object with slots organized by date
 */
async function getDoctorAvailability(doctorId) {
  try {
    const response = await apiRequest(
      `/api/Appointment/doctor-availability/${doctorId}`,
      "GET",
    );


    return response.data || response;
  } catch (error) {
    console.error(`Failed to fetch availability:`, error.message);
    throw error;
  }
}

/**
 * Fetch the current user's appointments (patient perspective)
 * Returns list of appointments with doctor, clinic, and timing details
 * Throws if the backend is unavailable
 * @returns {Promise<Array>} Array of appointment objects
 */
async function getMyAppointments() {
  try {
    const response = await apiRequest(
      "/api/Appointment/my-appointments",
      "GET",
    );


    return Array.isArray(response) ? response : response.data || [];
  } catch (error) {
    console.error("Failed to fetch appointments:", error.message);
    throw error;
  }
}

/**
 * Fetch all appointments for the logged-in doctor
 * Returns list of patients' appointments scheduled with this doctor
 * Throws if the backend is unavailable
 * @returns {Promise<Array>} Array of appointment objects for the doctor's schedule
 */
async function getDoctorAppointments() {
  try {
    const response = await apiRequest(
      "/api/Appointment/doctor-appointments",
      "GET",
    );


    return Array.isArray(response) ? response : response.data || [];
  } catch (error) {
    console.error("Failed to fetch doctor appointments:", error.message);
    throw error;
  }
}

// ========================
// CLINIC ENDPOINTS
// ========================

/**
 * Fetch all clinics associated with the current doctor
 * Returns clinic details including address, hours, and services
 * Throws if the backend is unavailable
 * @returns {Promise<Array>} Array of clinic objects
 */
async function getMyClinics() {
  try {
    const response = await apiRequest("/api/Clinic/my-clinics", "GET");


    return Array.isArray(response) ? response : response.data || [];
  } catch (error) {
    console.error("Failed to fetch clinics:", error.message);
    throw error;
  }
}

/**
 * Create a new clinic for the current doctor
 * Requires authentication token
 * @param {Object} clinicData - Clinic information
 * @param {string} clinicData.clinicName - Name of the clinic
 * @param {string} clinicData.clinicPhone - Phone number
 * @param {string} clinicData.clinicEmail - Email address
 * @param {string} clinicData.location - Clinic location
 * @param {string} clinicData.workingDays - Working days (e.g., "Sat-Sun-Mon")
 * @param {string} clinicData.workStartTime - Start time (e.g., "09:00")
 * @param {string} clinicData.workEndTime - End time (e.g., "18:00")
 * @param {number} clinicData.doctorPrice - Consultation fee
 * @param {number} clinicData.slotDurationMinutes - Appointment duration in minutes
 * @returns {Promise<Object>} New clinic object with clinicId
 */
async function createClinic(clinicData) {
  try {

    // Verify authentication token exists
    const token = localStorage.getItem("authToken");
    if (!token) {
      throw new Error("❌ Authentication required. Please login first.");
    }

    const response = await apiRequest("/api/Clinic", "POST", clinicData);


    return response;
  } catch (error) {
    console.error("🔴 Failed to create clinic:", error.message);
    throw error;
  }
}

/**
 * Delete a clinic by ID
 * Requires authentication token
 * @param {number} clinicId - The ID of the clinic to delete
 * @returns {Promise<Object>} Deletion confirmation message
 */
/**
 * Update an existing clinic by ID
 * Requires authentication token
 * @param {number} clinicId - The ID of the clinic to update
 * @param {Object} clinicData - Updated clinic information
 * @param {string} clinicData.clinicName - Name of the clinic
 * @param {string} clinicData.clinicPhone - Phone number
 * @param {string} clinicData.clinicEmail - Email address
 * @param {string} clinicData.location - Clinic location
 * @param {string} clinicData.workingDays - Working days (e.g., "Saturday,Sunday,Monday")
 * @param {string} clinicData.workStartTime - Start time (e.g., "09:00")
 * @param {string} clinicData.workEndTime - End time (e.g., "18:00")
 * @param {number} clinicData.doctorPrice - Consultation fee
 * @param {number} clinicData.slotDurationMinutes - Appointment duration in minutes
 * @returns {Promise<Object>} Updated clinic object
 */
async function updateClinic(clinicId, clinicData) {
  try {

    // Verify authentication token exists
    const token = localStorage.getItem("authToken");
    if (!token) {
      throw new Error("❌ Authentication required. Please login first.");
    }

    const response = await apiRequest(
      `/api/Clinic/${clinicId}`,
      "PUT",
      clinicData,
    );


    return response;
  } catch (error) {
    console.error("🔴 Failed to update clinic:", error.message);
    throw error;
  }
}

async function deleteClinic(clinicId) {
  try {

    // Verify authentication token exists
    const token = localStorage.getItem("authToken");
    if (!token) {
      throw new Error("❌ Authentication required. Please login first.");
    }

    const response = await apiRequest(`/api/Clinic/${clinicId}`, "DELETE");


    return response;
  } catch (error) {
    console.error("🔴 Failed to delete clinic:", error.message);
    throw error;
  }
}
