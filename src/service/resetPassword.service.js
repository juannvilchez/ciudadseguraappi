// ./service/resetPassword.service.js
import axios from "axios";

const API = process.env.EXPO_PUBLIC_URL; 
// ej: https://testapiciudadsegura.junin.gob.ar/api

export const resetPassword = async (data) => {
  try {
    if (!API) {
      return { success: false, message: "Falta EXPO_PUBLIC_URL en .env" };
    }

    // 👇 aquí va SOLO /auth/reset-password
    const url = `${API}/auth/reset-password`;

    console.log("URL reset:", url, "payload:", data);

    const response = await axios.post(url, data, { timeout: 15000 });
    return { success: true, ...response.data };
  } catch (error) {
    console.error("Error al restablecer la contraseña:", error);

    if (error.response) {
      const serverMsg =
        error.response.data?.message ||
        error.response.data?.error ||
        "Error en el servidor.";
      return { success: false, message: serverMsg, status: error.response.status };
    } else if (error.request) {
      return { success: false, message: "No hubo respuesta del servidor." };
    } else {
      return { success: false, message: "Error al configurar la solicitud." };
    }
  }
};

export default resetPassword;
