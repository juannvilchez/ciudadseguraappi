// LoginScreen.js
import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Image,
  ActivityIndicator,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import jwtDecode from "jwt-decode";
import { Ionicons } from "@expo/vector-icons";
import { login } from "./service/login.service";
import { me } from "./service/refreshToken.service";
import { validateEmail } from "./utils/utils";

export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);

  useEffect(() => {
    console.log("📦 URL de la API (al cargar la pantalla):", process.env.EXPO_PUBLIC_URL);
  }, []);

  const refreshAccessToken = async (token) => {
    try {
      const result = await me(token);
      if (result && result.accessToken) {
        await AsyncStorage.setItem("token", result.accessToken);
        return result.accessToken;
      } else {
        return null;
      }
    } catch (error) {
      console.error("Error refreshing token:", error);
      return null;
    }
  };

  useEffect(() => {
    const checkSuccessAlert = async () => {
      const showAlert = await AsyncStorage.getItem("showRegisterSuccessAlert");
      if (showAlert) {
        Alert.alert("Registro exitoso", "Usuario registrado con éxito. Ahora inicie sesión.");
        await AsyncStorage.removeItem("showRegisterSuccessAlert");
      }
    };
    checkSuccessAlert();
  }, []);

  useEffect(() => {
    const checkPendingFlag = async () => {
      const pending = await AsyncStorage.getItem("pendingApproval");
      if (pending === "true") {
        setIsPending(true);
      }
    };
    checkPendingFlag();
  }, []);

  useEffect(() => {
    const checkAuth = async () => {
      const pending = await AsyncStorage.getItem("pendingApproval");
      if (pending === "true") return;

      const token = await AsyncStorage.getItem("token");
      const userRole = await AsyncStorage.getItem("rol");
      const refreshToken = await AsyncStorage.getItem("refreshToken");
      if (token && userRole && refreshToken) {
        try {
          if (typeof token !== "string" || !token.trim()) {
            throw new Error("Token inválido");
          }
          let decodedToken = jwtDecode(token);
          if (decodedToken.exp * 1000 < Date.now()) {
            const newToken = await refreshAccessToken(refreshToken);
            if (!newToken) {
              await AsyncStorage.removeItem("token");
              await AsyncStorage.removeItem("rol");
              await AsyncStorage.removeItem("refreshToken");
              return;
            }
            if (typeof newToken !== "string" || !newToken.trim()) {
              throw new Error("Token nuevo inválido");
            }
            decodedToken = jwtDecode(newToken);
          }
          const categoria = await AsyncStorage.getItem("categoria");
          if (userRole === "admin") {
            navigation.replace("AdminHome");
          } else if (categoria) {
            navigation.replace(categoria === "ciudadano" ? "CitizenHome" : "UserHome");
          }
        } catch (error) {
          console.error("Error al verificar el token:", error);
          await AsyncStorage.removeItem("token");
          await AsyncStorage.removeItem("rol");
          await AsyncStorage.removeItem("refreshToken");
        }
      }
    };
    checkAuth();
  }, [navigation]);

  useEffect(() => {
    let interval;
    if (isPending) {
      interval = setInterval(async () => {
        try {
          const datos = {
            correo: email.trim().toLowerCase(),
            contrasena: password,
          };

          const result = await login(datos);
          if (result && result.accessToken) {
            await AsyncStorage.setItem("token", result.accessToken);
            if (result.refreshToken) {
              await AsyncStorage.setItem("refreshToken", result.refreshToken);
            }
            await AsyncStorage.setItem("rol", result.rol);
            if (result.categoria) {
              await AsyncStorage.setItem("categoria", result.categoria);
            }
            await AsyncStorage.removeItem("pendingApproval");
            clearInterval(interval);
            if (result.rol === "admin") {
              navigation.replace("AdminHome");
            } else {
              const categoria = result.categoria;
              navigation.replace(categoria === "ciudadano" ? "CitizenHome" : "UserHome");
            }
          }
        } catch (error) {
          console.error("Error al hacer polling del login:", error);
        }
      }, 5000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isPending, email, password, navigation]);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert("Error", "Por favor, complete todos los campos.");
      return;
    }
    if (!validateEmail(email)) {
      Alert.alert("Error", "Por favor ingrese un correo electrónico válido.");
      return;
    }
    setLoading(true);
    try {
      const data = {
        correo: email.trim().toLowerCase(),
        contrasena: password,
      };

      const result = await login(data);
      console.log("➡️ Respuesta login:", result);

      if (result && result.accessToken) {
        await AsyncStorage.setItem("token", result.accessToken);
        if (result.refreshToken) {
          await AsyncStorage.setItem("refreshToken", result.refreshToken);
        }
        await AsyncStorage.setItem("rol", result.rol);
        if (result.categoria) {
          await AsyncStorage.setItem("categoria", result.categoria);
        }
        await AsyncStorage.removeItem("pendingApproval");
        if (result.rol === "admin") {
          navigation.replace("AdminHome");
        } else {
          navigation.replace(result.categoria === "ciudadano" ? "CitizenHome" : "UserHome");
        }
        return;
      }

      if (result && result.message && result.message.toLowerCase().includes("tipo")) {
        navigation.navigate("UserTypeSelection", { email, password });
        return;
      }

      if (result && (result.status === 403 || result.message.toLowerCase().includes("pendiente"))) {
        await AsyncStorage.setItem("pendingApproval", "true");
        setIsPending(true);
        return;
      }

      Alert.alert("Error", result.message || "No se pudo iniciar sesión.");
    } catch (error) {
      console.error("Error al iniciar sesión:", error);
      Alert.alert("Error", "No se pudo conectar con el servidor.");
    } finally {
      setLoading(false);
    }
  };

  if (isPending) {
    return (
      <View style={styles.pendingContainer}>
        <ActivityIndicator size="large" color="#00A6E8" />
        <Text style={styles.pendingText}>En espera de aprobación del admin...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Image source={require("../assets/cds.png")} style={styles.logo} resizeMode="contain" />
      <Text style={styles.title}>Iniciar Sesión</Text>

      <TextInput
        placeholder="Correo electrónico"
        placeholderTextColor="#555"
        value={email}
        onChangeText={setEmail}
        style={styles.input}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        textContentType="username"
      />

      <View style={styles.passwordContainer}>
        <TextInput
          // clave para forzar re-montaje y evitar bugs visuales con secureTextEntry en algunos Android
          key={passwordVisible ? "pwd-visible" : "pwd-hidden"}
          placeholder="Contraseña"
          placeholderTextColor="#555"
          value={password}
          onChangeText={setPassword}
          style={styles.passwordInput}
          secureTextEntry={!passwordVisible}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="password"
          textContentType="password"
        />
        <TouchableOpacity
          onPress={() => setPasswordVisible((prev) => !prev)}
          style={styles.eyeButton}
          accessibilityLabel={passwordVisible ? "Ocultar contraseña" : "Mostrar contraseña"}
        >
          <Ionicons name={passwordVisible ? "eye-off" : "eye"} size={24} color="#003F74" />
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={[styles.loginButton, loading && { opacity: 0.5 }]}
        onPress={handleLogin}
        disabled={loading}
      >
        <Text style={styles.loginButtonText}>{loading ? "Cargando..." : "Entrar"}</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => navigation.navigate("ForgotPassword")}>
        <Text style={styles.forgotPasswordText}>¿Olvidaste tu contraseña?</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => navigation.navigate("Register")}>
        <Text style={styles.registerText}>¿No tenés cuenta? Registrate</Text>
      </TouchableOpacity>

      <Image source={require("../assets/cbs.png")} style={styles.footerLogo} resizeMode="contain" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#EFEFEF",
    paddingHorizontal: 16,
  },
  logo: { width: 220, height: 80, marginBottom: 30 },
  title: {
    fontSize: 24,
    color: "#003F74",
    fontWeight: "bold",
    marginBottom: 20,
    textAlign: "center",
  },
  input: {
    width: "80%",
    height: 50,
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    paddingHorizontal: 15,
    marginBottom: 15,
    fontSize: 16,
    borderColor: "#003F74",   // borde más visible
    borderWidth: 1.5,         // más grueso
    color: "#000",            // fuerza texto negro (evita blanco en modo oscuro)
  },
  passwordContainer: {
    width: "80%",
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    borderColor: "#003F74",   // borde más visible
    borderWidth: 1.5,         // más grueso
    marginBottom: 15,
    paddingHorizontal: 15,
    height: 50,
  },
  passwordInput: {
    flex: 1,
    fontSize: 16,
    color: "#000",            // idem: asegura contraste siempre
  },
  eyeButton: {
    paddingHorizontal: 8,
  },
  loginButton: {
    width: "80%",
    backgroundColor: "#00A6E8",
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 10,
    marginBottom: 10,
  },
  loginButtonText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "600",
  },
  forgotPasswordText: {
    color: "#00A6E8",
    fontSize: 14,
    textAlign: "center",
    marginBottom: 10,
  },
  registerText: {
    color: "#00A6E8",
    fontSize: 14,
    textAlign: "center",
    marginBottom: 30,
  },
  footerLogo: { width: 180, height: 60, marginTop: 30 },
  pendingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#EFEFEF",
    paddingHorizontal: 16,
  },
  pendingText: {
    marginTop: 20,
    fontSize: 18,
    color: "#003F74",
    textAlign: "center",
  },
});
