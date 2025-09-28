import axios from "axios";

const API = process.env.EXPO_PUBLIC_URL;

export const register = async (datos) => {
  try {
    let formData;
    if (datos instanceof FormData) {
      formData = datos;
      console.log("✅ Datos ya están en formato FormData");
    } else {
      formData = new FormData();
      for (const key in datos) {
        formData.append(key, datos[key]);
      }
    }

    const response = await axios.post(`${API}/auth/register`, formData, {
      headers: {
        "Content-Type": "multipart/form-data"
      }
    });
    return response; // ✅ DEVUELVE response COMPLETO
  } catch (error) {
    console.error("❌ Error en el registro (service):", error.response?.data || error.message);
    throw error; // ✅ Lanzamos el error para manejarlo en el frontend
  }
};
