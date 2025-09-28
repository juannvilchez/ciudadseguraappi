import React, { useEffect, useState } from "react";
import { ActivityIndicator, View, StyleSheet } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createStackNavigator } from "@react-navigation/stack";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SplashScreen from "expo-splash-screen";

// Importa las pantallas
import WelcomeScreen from "./src/WelcomeScreen";
import LoginScreen from "./src/LoginScreen";
import RegisterScreen from "./src/RegisterScreen";
import UserHomeScreen from "./src/UserHomeScreen";
import AdminHomeScreen from "./src/AdminHomeScreen";
import CitizenHomeScreen from "./src/CitizenHomeScreen";
import UserTypeSelectionScreen from "./src/UserTypeSelectionScreen";

// Pantallas de recuperación de contraseña
import ForgotPasswordScreen from "./src/ForgotPasswordScreen";
import ResetPasswordScreen from "./src/ResetPasswordScreen";

const Stack = createStackNavigator();

export default function App() {
  const [initialRoute, setInitialRoute] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        // Si existe la bandera de aprobación pendiente, se muestra la pantalla de login (la cual ya se encargará de mostrar el mensaje pendiente)
        const pendingApproval = await AsyncStorage.getItem("pendingApproval");
        if (pendingApproval === "true") {
          setInitialRoute("Login");
          return;
        }

        // Verificamos si existe token y rol
        const token = await AsyncStorage.getItem("token");
        const role = await AsyncStorage.getItem("rol");
        const categoria = await AsyncStorage.getItem("categoria");

        if (token && role) {
          if (role === "admin") {
            setInitialRoute("AdminHome");
          } else if (role === "user") {
            // Aquí se comprueba la categoría; nota: si el usuario aún no seleccionó categoría, lo enviamos al Welcome
            if (categoria === "ciudadano" || categoria === "adulto_mayor") {
              setInitialRoute(categoria === "ciudadano" ? "CitizenHome" : "UserHome");
            } else {
              setInitialRoute("Welcome");
            }
          }
        } else {
          setInitialRoute("Welcome");
        }
      } catch (error) {
        console.error("Error verificando la autenticación:", error);
        setInitialRoute("Welcome");
      } finally {
        setLoading(false);
        SplashScreen.hideAsync();
      }
    };

    SplashScreen.preventAutoHideAsync();
    checkAuth();
  }, []);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0000ff" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName={initialRoute}>
        <Stack.Screen name="Welcome" component={WelcomeScreen} options={{ headerShown: false }} />
        <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
        <Stack.Screen name="UserTypeSelection" component={UserTypeSelectionScreen} options={{ headerShown: false }} />
        <Stack.Screen name="Register" component={RegisterScreen} options={{ headerShown: false }} />
        <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} options={{ title: "Recuperar Contraseña" }} />
        <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} options={{ title: "Restablecer Contraseña" }} />
        <Stack.Screen name="UserHome" component={UserHomeScreen} options={{ headerShown: false, gestureEnabled: false }} />
        <Stack.Screen name="AdminHome" component={AdminHomeScreen} options={{ headerShown: false, gestureEnabled: false }} />
        <Stack.Screen name="CitizenHome" component={CitizenHomeScreen} options={{ headerShown: false, gestureEnabled: false }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
});
