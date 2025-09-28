// ./service/forgot.service.js
import axios from "axios";

const API = process.env.EXPO_PUBLIC_URL;

const handleError = (error) => {
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
};

export const forgotPassword = async (email) => {
  try {
    if (!API) {
      return { success: false, message: "Falta EXPO_PUBLIC_URL en .env" };
    }

    const url = `${API}/auth/forgot-password`;
    console.log("URL forgot:", url, "correo:", email);

    const response = await axios.post(
      url,
      { correo: email },
      { timeout: 15000 }
    );
    return { success: true, ...response.data };
  } catch (error) {
    return handleError(error);
  }
};

export default forgotPassword;
