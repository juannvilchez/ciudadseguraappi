import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from "react-native";
import resetPassword from "./service/resetPassword.service";

export default function ResetPasswordScreen({ route, navigation }) {
  const { correo } = route.params; // viene de la pantalla anterior
  const [resetCode, setResetCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleResetPassword = async () => {
    if (!resetCode || !newPassword) {
      Alert.alert("Error", "Todos los campos son obligatorios.");
      return;
    }

    setLoading(true);
    try {
      const data = {
        correo: (correo || "").trim().toLowerCase(),
        resetCode: String(resetCode).trim(),
        newPassword: newPassword,
      };
      console.log("Llamando a reset-password con:", data);

      const result = await resetPassword(data);
      console.log("Respuesta del backend:", result);

      if (result?.message?.toLowerCase().includes("contraseña actualizada")) {
        Alert.alert("Éxito", result.message, [
          { text: "Aceptar", onPress: () => navigation.replace("Login") },
        ]);
      } else {
        // Muestra mensaje de backend (404/400/401/500 manejados en el service)
        Alert.alert("Error", result?.message || "No se pudo restablecer la contraseña.");
      }
    } catch (error) {
      console.error("Error en ResetPasswordScreen:", error);
      Alert.alert("Error", "No se pudo conectar con el servidor.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Restablecer Contraseña</Text>
      <Text style={styles.caption}>Enviamos un código a {correo}</Text>

      <TextInput
        placeholder="Código de recuperación (6 dígitos)"
        value={resetCode}
        onChangeText={setResetCode}
        style={styles.input}
        keyboardType="number-pad"
        maxLength={6}
      />
      <TextInput
        placeholder="Nueva Contraseña"
        value={newPassword}
        onChangeText={setNewPassword}
        style={styles.input}
        secureTextEntry
      />

      <TouchableOpacity
        style={[styles.button, loading && { opacity: 0.6 }]}
        onPress={handleResetPassword}
        disabled={loading}
      >
        <Text style={styles.buttonText}>
          {loading ? "Actualizando..." : "Restablecer"}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center", padding: 20 },
  title: { fontSize: 24, fontWeight: "bold", color: "#003F74", marginBottom: 8 },
  caption: { fontSize: 14, color: "#666", marginBottom: 16, textAlign: "center" },
  input: {
    width: "85%",
    height: 50,
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    paddingHorizontal: 15,
    marginBottom: 12,
    backgroundColor: "#fff",
  },
  button: {
    width: "85%",
    backgroundColor: "#00A6E8",
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 6,
  },
  buttonText: { color: "#FFFFFF", fontSize: 18, fontWeight: "600" },
});
