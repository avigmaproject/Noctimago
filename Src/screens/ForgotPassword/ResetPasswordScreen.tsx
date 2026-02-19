import React, { useState, useEffect } from "react";
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  StyleSheet, 
  Image,
  Alert 
} from "react-native";
import { resetpassword } from "../../utils/apiconfig";
import { AvoidSoftInputView } from "react-native-avoid-softinput";
export default function ResetPasswordScreen({ route, navigation }) {
  const { key, login } = route.params || {};  // use "key" instead of "token"
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [isValid, setIsValid] = useState(false);

  useEffect(() => {
    if (!password || !confirm) {
      setIsValid(false);
      return;
    }
    if (password.length < 6) {
      setIsValid(false);
      return;
    }
    if (password !== confirm) {
      setIsValid(false);
      return;
    }
    setIsValid(true);
  }, [password, confirm]);

  const handleReset = async () => {
    if (!isValid) return;
  
    try {
      const payload = {
        login,
        key,
        password,
      };
      console.log("payload", payload);
  
      const res = await resetpassword(payload);
      console.log("Reset Password Response:", res);
  
      if (res?.status === "success") {
        Alert.alert("✅ Success", res.message || "Password has been reset successfully");
        navigation.navigate("SignIn");
      } else {
        Alert.alert("❌ Error", res?.message || "Failed to reset password.");
      }
    } catch (error) {
      console.log("Reset error:", error);
  
      // ✅ Extract server error response
      if (error.response?.data) {
        const { code, message } = error.response.data;
        if (code === "invalid_key") {
          Alert.alert("❌ Error", message || "Invalid or expired key");
          return;
        }
        Alert.alert("❌ Error", message || "Failed to reset password. Try again.");
      } else {
        Alert.alert("❌ Error", "Something went wrong. Please try again later.");
      }
    }
  };
  
  

  return (
    <View style={{flex:1}}>
  <AvoidSoftInputView
    style={styles.container}
       
       
      >
      <View style={styles.iconContainer}>
        <Image
          source={require("../../assets/lock.png")}
          style={styles.lockIcon}
        />
      </View>

      <Text style={styles.title}>Reset Password</Text>
      <Text style={styles.subtitle}>
        Enter your new password below.
      </Text>

      {/* New Password */}
      <TextInput
        style={styles.input}
        placeholder="New Password"
        placeholderTextColor="#aaa"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />

      {/* Confirm Password */}
      <TextInput
        style={styles.input}
        placeholder="Confirm Password"
        placeholderTextColor="#aaa"
        secureTextEntry
        value={confirm}
        onChangeText={setConfirm}
      />

      {/* Error Message */}
      {error ? <Text style={styles.error}>{error}</Text> : null}

      {/* Submit Button */}
      <TouchableOpacity
        style={[styles.button, !isValid && styles.buttonDisabled]}
        onPress={handleReset}
        disabled={!isValid}
      >
        <Text style={styles.buttonText}>Submit</Text>
      </TouchableOpacity>

      {/* Back to Login */}
      <TouchableOpacity onPress={() => navigation.navigate("SignIn")}>
        <Text style={styles.backText}>Back to Sign In</Text>
      </TouchableOpacity>
  </AvoidSoftInputView>  </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    justifyContent: "center", 
    alignItems: "center", 
    backgroundColor: "#0A0A0F", 
    padding: 20 
  },
  iconContainer: { marginBottom: 30 },
  lockIcon: { width: 100, height: 100, resizeMode: "contain" },
  title: { fontSize: 22, fontWeight: "bold", color: "#fff", marginBottom: 10 },
  subtitle: { fontSize: 14, color: "#aaa", marginBottom: 20, textAlign: "center" },
  input: { 
    width: "100%", 
    backgroundColor: "#1A1A1F", 
    color: "#fff", 
    padding: 15, 
    borderRadius: 8, 
    marginBottom: 15, 
    borderWidth: 1, 
    borderColor: "#333"
  },
  error: { color: "red", marginBottom: 10 },
  button: { 
    backgroundColor: "#0B0552", 
    padding: 15, 
    borderRadius: 8, 
    width: "100%", 
    alignItems: "center", 
    marginBottom: 20 
  },
  buttonDisabled: { backgroundColor: "#444" },
  buttonText: { color: "#fff", fontWeight: "bold" },
  backText: { color: "#aaa", fontSize: 14, textDecorationLine: "underline" },
});
