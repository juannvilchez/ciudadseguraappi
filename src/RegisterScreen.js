import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Image,
  ActivityIndicator,
  Modal,
  Alert,
  TouchableWithoutFeedback,
  Keyboard,
  Platform,
  SafeAreaView,
  ScrollView,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { register } from "./service/register.service";

export default function RegisterScreen({ navigation }) {
  const [formData, setFormData] = useState({
    nombre: "",
    apellido: "",
    dni: "",
    correo: "",
    telefono: "",
    contrasena: "",
    direccion: "",
    foto: null,
  });

  const [loading, setLoading] = useState(false);
  const [modalTermsVisible, setModalTermsVisible] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  // padding inferior cuando aparece el teclado
  const [kbPadding, setKbPadding] = useState(0);

  // Refs para scroll/foco
  const scrollRef = useRef(null);
  const inputsRef = useRef({});           // { nombre: TextInput, ... }
  const positionsRef = useRef({});        // { nombre: y, foto: y, terms: y }

  // Etiquetas legibles para el listado de faltantes
  const LABELS = {
    foto: "Foto",
    nombre: "Nombre",
    apellido: "Apellido",
    dni: "DNI",
    correo: "Correo electrónico",
    telefono: "Teléfono",
    contrasena: "Contraseña",
    direccion: "Dirección",
    terms: "Aceptar Términos y Condiciones",
  };

  const requiredOrder = [
    "foto",
    "nombre",
    "apellido",
    "dni",
    "correo",
    "telefono",
    "contrasena",
    "direccion",
  ];

  useEffect(() => {
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const showSub = Keyboard.addListener(showEvent, (e) => {
      const height = e.endCoordinates?.height ?? 0;
      setKbPadding(height + 12);
    });
    const hideSub = Keyboard.addListener(hideEvent, () => setKbPadding(0));

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  // AVISO al entrar
  useEffect(() => {
    Alert.alert(
      "IMPORTANTE",
      "Esta información la usaremos en caso de que usted tenga una emergencia.\n\nPOR FAVOR\n\nColoque sus datos verdaderos y una foto de frente a la cámara para poder identificarlo correctamente."
    );
  }, []);

  const handleInputChange = (name, value) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const pickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permiso requerido", "Necesitamos acceso a tus fotos para continuar.");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 1,
      });

      if (!result.canceled && result.assets.length > 0) {
        setFormData((prev) => ({ ...prev, foto: result.assets[0].uri }));
      }
    } catch (error) {
      console.error("Error al seleccionar la imagen:", error);
      Alert.alert("Error", "Hubo un problema al seleccionar la imagen.");
    }
  };

  const scrollAndFocus = (key) => {
    // calcular Y del elemento
    const y = positionsRef.current[key] ?? 0;
    if (scrollRef.current && typeof scrollRef.current.scrollTo === "function") {
      scrollRef.current.scrollTo({ y: Math.max(y - 40, 0), animated: true });
    }

    // si es un input, darle foco
    if (inputsRef.current[key] && typeof inputsRef.current[key].focus === "function") {
      // pequeño delay para que termine el scroll
      setTimeout(() => {
        inputsRef.current[key].focus();
      }, 200);
    }
  };

  const handleRegister = async () => {
    const { nombre, apellido, dni, correo, telefono, contrasena, direccion, foto } = formData;

    // 1) Armar lista de keys faltantes (en orden)
    const missingKeys = [];
    requiredOrder.forEach((k) => {
      const v = formData[k];
      if (k === "foto") {
        if (!v) missingKeys.push("foto");
      } else if (!v || !String(v).trim()) {
        missingKeys.push(k);
      }
    });
    if (!acceptedTerms) missingKeys.push("terms");

    if (missingKeys.length > 0) {
      const message = `Te faltan los siguientes campos:\n- ${missingKeys.map((k) => LABELS[k]).join("\n- ")}`;

      // Mostrar alert y al cerrarlo, ir al primer faltante
      Alert.alert("Faltan datos", message, [
        { text: "OK", onPress: () => scrollAndFocus(missingKeys[0]) },
      ]);
      return;
    }

    // 2) Validación de formato de correo
    const normalizedEmail = correo.trim().toLowerCase();
    const emailRegex = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
    if (!emailRegex.test(normalizedEmail)) {
      Alert.alert("Error", "Por favor, ingresa un correo electrónico válido.", [
        { text: "OK", onPress: () => scrollAndFocus("correo") },
      ]);
      return;
    }

    // 3) Envío
    setLoading(true);
    try {
      const data = new FormData();
      data.append("nombre", nombre);
      data.append("apellido", apellido);
      data.append("dni", dni);
      data.append("correo", normalizedEmail);
      data.append("telefono", telefono);
      data.append("contrasena", contrasena);
      data.append("direccion", direccion);

      const filename = (foto || "").split("/").pop() || `foto_${Date.now()}.jpg`;
      const match = /\.(\w+)$/.exec(filename);
      const mime = match ? `image/${match[1]}` : "image/jpeg";
      data.append("foto", {
        uri: foto,
        type: mime,
        name: filename,
      });

      const response = await register(data);

      if (response?.status === 201) {
        await AsyncStorage.setItem("showRegisterSuccessAlert", "true");
        Alert.alert("Éxito", "Usuario registrado correctamente.");
        navigation.replace("Login");
      } else {
        Alert.alert("Error", "No se pudo completar el registro.");
      }
    } catch (error) {
      console.error("❌ Error en el registro:", error);
      if (error?.response) {
        Alert.alert("Error", error.response.data?.message || "Hubo un error en el registro.");
      } else {
        Alert.alert("Error", "No se pudo conectar con el servidor.");
      }
    } finally {
      setLoading(false);
    }
  };

  // Campos (sin mensajes/bordes de error)
  const fields = [
    { key: "nombre", placeholder: "Nombre", returnKeyType: "next", autoCapitalize: "words", autoCorrect: false, textContentType: "givenName", autoComplete: "name-given" },
    { key: "apellido", placeholder: "Apellido", returnKeyType: "next", autoCapitalize: "words", autoCorrect: false, textContentType: "familyName", autoComplete: "name-family" },
    { key: "dni", placeholder: "DNI", keyboardType: "numeric", inputMode: "numeric", returnKeyType: "next", autoCapitalize: "none", autoCorrect: false, textContentType: "oneTimeCode", autoComplete: "off" },
    { key: "correo", placeholder: "Correo Electrónico", keyboardType: "email-address", autoCapitalize: "none", autoCorrect: false, returnKeyType: "next", textContentType: "username", autoComplete: "email" },
    { key: "telefono", placeholder: "Teléfono", keyboardType: "phone-pad", inputMode: "tel", returnKeyType: "next", autoCapitalize: "none", autoCorrect: false, textContentType: "telephoneNumber", autoComplete: "tel" },
    { key: "contrasena", placeholder: "Contraseña", secureTextEntry: true, returnKeyType: "next", autoCapitalize: "none", autoCorrect: false, textContentType: "password", autoComplete: "password" },
    { key: "direccion", placeholder: "Dirección", returnKeyType: "done", autoCapitalize: "sentences", autoCorrect: false, textContentType: "fullStreetAddress", autoComplete: "street-address" },
  ];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#EFEFEF" }}>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <View style={{ flex: 1 }}>
          <View style={{ flex: 1 }}>
            <ScrollView
              ref={scrollRef}
              contentContainerStyle={[styles.container, { paddingBottom: kbPadding }]}
              keyboardShouldPersistTaps="handled"
              contentInsetAdjustmentBehavior="always"
            >
              {/* Foto */}
              <View
                onLayout={(e) => {
                  positionsRef.current.foto = e.nativeEvent.layout.y;
                }}
                style={{ width: "100%", alignItems: "center" }}
              >
                <TouchableOpacity style={styles.imagePicker} onPress={pickImage}>
                  {formData.foto ? (
                    <Image source={{ uri: formData.foto }} style={styles.image} />
                  ) : (
                    <Text style={styles.imagePlaceholder}>+</Text>
                  )}
                </TouchableOpacity>
              </View>

              {/* Inputs */}
              {fields.map((field, idx) => (
                <View
                  key={field.key}
                  onLayout={(e) => {
                    positionsRef.current[field.key] = e.nativeEvent.layout.y;
                  }}
                  style={{ width: "100%", alignItems: "center" }}
                >
                  <TextInput
                    ref={(r) => (inputsRef.current[field.key] = r)}
                    placeholder={field.placeholder}
                    placeholderTextColor="#555"
                    value={formData[field.key] || ""}
                    onChangeText={(value) => handleInputChange(field.key, value)}
                    style={styles.input}
                    secureTextEntry={field.secureTextEntry}
                    keyboardType={field.keyboardType || "default"}
                    autoCapitalize={field.autoCapitalize || "sentences"}
                    autoCorrect={field.autoCorrect ?? false}
                    returnKeyType={field.returnKeyType}
                    onSubmitEditing={idx === fields.length - 1 ? Keyboard.dismiss : undefined}
                    textContentType={field.textContentType}
                    autoComplete={field.autoComplete}
                    inputMode={field.inputMode}
                    selectionColor="#003F74"
                  />
                </View>
              ))}

              {/* TyC */}
              <View
                style={styles.termsContainer}
                onLayout={(e) => {
                  positionsRef.current.terms = e.nativeEvent.layout.y;
                }}
              >
                <TouchableOpacity onPress={() => setAcceptedTerms(!acceptedTerms)}>
                  <View style={styles.checkbox}>
                    {acceptedTerms && <Text style={styles.checkmark}>✓</Text>}
                  </View>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setModalTermsVisible(true)}>
                  <Text style={styles.termsLabel}>Acepto los Términos y Condiciones</Text>
                </TouchableOpacity>
              </View>

              {/* Botón */}
              <TouchableOpacity style={styles.registerButton} onPress={handleRegister} disabled={loading}>
                {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.registerButtonText}>Registrarse</Text>}
              </TouchableOpacity>
            </ScrollView>

            {/* Modal TyC */}
            <Modal
              animationType="slide"
              transparent={true}
              visible={modalTermsVisible}
              onRequestClose={() => setModalTermsVisible(false)}
            >
              <View style={styles.modalOverlay}>
                <View style={styles.modalContent}>
                  <Text style={styles.modalTitle}>
                    Ciudad Segura - Términos y Condiciones y Política de Privacidad
                  </Text>
                  <ScrollView style={{ maxHeight: "80%" }} keyboardShouldPersistTaps="handled">
                    <Text style={styles.modalText}>
{`
TÉRMINOS Y CONDICIONES DE USO – APLICACIÓN “CIUDAD SEGURA”

1. ACEPTACIÓN DE LOS TÉRMINOS
...
(pegá aquí tu texto completo)
`}
                    </Text>
                  </ScrollView>
                  <TouchableOpacity style={styles.closeButton} onPress={() => setModalTermsVisible(false)}>
                    <Text style={styles.closeButtonText}>Cerrar</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </Modal>
          </View>
        </View>
      </TouchableWithoutFeedback>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
    backgroundColor: "#EFEFEF",
  },
  imagePicker: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "#D3D3D3",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  imagePlaceholder: {
    fontSize: 24,
    color: "#FFFFFF",
  },
  image: {
    width: 116,
    height: 116,
    borderRadius: 58,
  },
  input: {
    width: "80%",
    height: 45,
    backgroundColor: "#FFF",
    borderRadius: 6,
    paddingHorizontal: 12,
    marginBottom: 10,
    fontSize: 14,
    borderColor: "#003F74",
    borderWidth: 1.5,
    color: "#000",
  },
  termsContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 10,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderWidth: 1,
    borderColor: "#003F74",
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
    backgroundColor: "#FFF",
  },
  checkmark: {
    fontSize: 16,
    color: "#003F74",
  },
  termsLabel: {
    fontSize: 14,
    color: "#003F74",
    textDecorationLine: "underline",
  },
  registerButton: {
    width: "80%",
    backgroundColor: "#003F74",
    paddingVertical: 12,
    borderRadius: 6,
    alignItems: "center",
    marginTop: 15,
  },
  registerButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  modalContent: {
    backgroundColor: "#FFFFFF",
    padding: 20,
    borderRadius: 10,
    width: "90%",
    maxHeight: "85%",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 10,
    textAlign: "center",
  },
  modalText: {
    fontSize: 14,
    color: "#333",
    lineHeight: 20,
  },
  closeButton: {
    marginTop: 10,
    backgroundColor: "#003F74",
    paddingVertical: 10,
    borderRadius: 6,
    alignItems: "center",
  },
  closeButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
  },
});
