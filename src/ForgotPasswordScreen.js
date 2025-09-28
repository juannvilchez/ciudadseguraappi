import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from "react-native";
import { forgotPassword } from "./service/forgot.service";

export default function ForgotPasswordScreen({ navigation }) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSendCode = async () => {
    if (!email) {
      Alert.alert("Error", "Por favor, ingrese su correo electrónico.");
      return;
    }

    setLoading(true);

    try {
      const normalizedEmail = email.trim().toLowerCase();
      console.log("Enviando email:", normalizedEmail);

      const result = await forgotPassword(normalizedEmail);
      console.log("Respuesta del backend:", result);

      if (result?.message?.toLowerCase().includes("enviado")) {
        Alert.alert("Éxito", result.message);
        console.log("Navegando a ResetPassword con correo:", normalizedEmail);
        navigation.navigate("ResetPassword", { correo: normalizedEmail });
      } else {
        console.log("Mensaje de error recibido del backend:", result.message);
        Alert.alert("Error", result.message || "No se pudo enviar el código.");
      }
    } catch (error) {
      console.error("Error en forgotPassword:", error);

      if (error.response) {
        console.error("Error response data:", error.response.data);
        console.error("Error response status:", error.response.status);
        console.error("Error response headers:", error.response.headers);
      } else if (error.request) {
        console.error("No hubo respuesta del servidor:", error.request);
      } else {
        console.error("Error al configurar la solicitud:", error.message);
      }

      Alert.alert("Error", "No se pudo conectar con el servidor.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Recuperar Contraseña</Text>
      <TextInput
        placeholder="Ingrese su correo"
        value={email}
        onChangeText={setEmail}
        style={styles.input}
        keyboardType="email-address"
        autoCapitalize="none"
      />
      <TouchableOpacity
        style={[styles.button, loading && { opacity: 0.5 }]}
        onPress={handleSendCode}
        disabled={loading}
      >
        <Text style={styles.buttonText}>
          {loading ? "Enviando..." : "Enviar Código"}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#003F74",
    marginBottom: 20,
  },
  input: {
    width: "80%",
    height: 50,
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    paddingHorizontal: 15,
    marginBottom: 15,
  },
  button: {
    width: "80%",
    backgroundColor: "#00A6E8",
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 10,
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "600",
  },
});
