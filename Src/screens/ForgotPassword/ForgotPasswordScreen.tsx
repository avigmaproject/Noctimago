import React, { useState } from "react";
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  StyleSheet, 
  Image,
  ActivityIndicator,
  KeyboardAvoidingView,
  Alert,
  Platform,
  ScrollView
} from "react-native";
import Icon from "react-native-vector-icons/Feather"; 
import { AvoidSoftInputView } from "react-native-avoid-softinput";
import { forgotpassword } from "../../utils/apiconfig";

export default function ForgotPasswordScreen({ navigation }) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false); // 👈 loader state

  const isValidEmail = (email) => {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(email);
  };

  const handleContinue = async () => {
    try {
      setLoading(true);
  
      const payload = {
        email: email.trim(),
        reset_base_url: "https://noctimago.com/reset-password", // or just "https://noctimago.com"
      };
  
      console.log("Forgot Password Payload:", payload);
  
      const res = await forgotpassword(payload);
  
      console.log("Forgot Password Response:", res.data);
  
      setLoading(false);
      navigation.navigate("PasswordResetSentScreen", { email });
  
    } catch (error: any) {
      setLoading(false);
  
      if (error.response) {
        console.log("API Error:", error.response.data);
        Alert.alert("Error", error.response.data.message || "Server error");
      } else {
        console.log("Network Error:", error.message);
        Alert.alert("Error", "Network issue. Please try again.");
      }
    }
  };
  
  

  return (
    <View  style={{flex:1}}>
       <AvoidSoftInputView
    style={styles.container}
       
       
      >
        
      

      {/* Lock Icon */}
      <View style={styles.iconContainer}>
        <Image
          source={require("../../assets/lock.png")}
          style={styles.lockIcon}
        />
      </View>

      {/* Title */}
      <Text style={styles.title}>Forgot Password</Text>

      {/* Subtitle */}
      <Text style={styles.subtitle}>
        Please enter your email address to reset your password.
      </Text>

      {/* Email Input */}
      <Text style={styles.label}>Email Address</Text>
      <View style={styles.inputContainer}>
        <Icon name="mail" size={20} color="#aaa" style={styles.inputIcon} />
        <TextInput
          style={styles.input}
          placeholder="Enter your email address..."
          placeholderTextColor="#aaa"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />
      </View>

      {/* Continue Button */}
      <TouchableOpacity
        style={[
          styles.button,
          (!isValidEmail(email) || loading) && styles.buttonDisabled,
        ]}
        onPress={handleContinue}
        disabled={!isValidEmail(email) || loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" /> // 👈 loader inside button
        ) : (
          <Text style={styles.buttonText}>Continue</Text>
        )}
      </TouchableOpacity>

      {/* Back to Sign In */}
      <TouchableOpacity onPress={() => navigation.goBack()} disabled={loading}>
        <Text style={styles.backText}>Back to Sign In</Text>
      </TouchableOpacity>
      </AvoidSoftInputView>
      </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0A0A0F",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  iconContainer: {
    marginBottom: 40,
  },
  lockIcon: {
    width: 100,
    height: 100,
    resizeMode: "contain",
  },
  title: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 20,
  },
  subtitle: {
    fontSize: 14,
    color: "#aaa",
    textAlign: "center",
    marginBottom: 30,
  },
  label: {
    fontSize: 14,
    color: "#fff",
    alignSelf: "flex-start",
    marginBottom: 5,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1A1A1F",
    borderWidth: 1,
    borderColor: "#333",
    borderRadius: 8,
    paddingHorizontal: 10,
    marginBottom: 20,
    width: "100%",
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    color: "#fff",
    height: 50,
  },
  button: {
    backgroundColor: "#0B0552",
    paddingVertical: 15,
    borderRadius: 8,
    width: "100%",
    alignItems: "center",
    marginBottom: 20,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  backText: {
    color: "#aaa",
    fontSize: 14,
    textDecorationLine: "underline",
  },
});
