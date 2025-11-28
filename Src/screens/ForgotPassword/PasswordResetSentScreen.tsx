import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, Image } from "react-native";
import { openInbox } from "react-native-email-link";

export default function PasswordResetSentScreen({ navigation }) {
  const handleOpenEmail = () => {
    openInbox({
      title: "Open Email App",
      message: "Choose the email app you’d like to use",
      cancelLabel: "Cancel",
    }).catch(() => {
      console.log("No email app available");
    });
  };

  return (
    <View style={styles.container}>
      {/* Lock Icon */}
      <View style={styles.iconWrapper}>
        <Image
          source={require("../../assets/lock.png")} // 👈 put your red lock icon here
          style={styles.icon}
          resizeMode="contain"
        />
      </View>

      {/* Title */}
      <Text style={styles.title}>Password Reset Sent</Text>

      {/* Subtitle */}
      <Text style={styles.subtitle}>
        Please check your email in a few minutes -{"\n"}
        we’ve sent you an email containing {"\n"}
        password recovery link.
      </Text>

      {/* Open Email Button */}
      <TouchableOpacity style={styles.button} onPress={handleOpenEmail}>
        <Text style={styles.buttonText}>Open Email App</Text>
      </TouchableOpacity>

      {/* Back to Sign In */}
      <TouchableOpacity onPress={() => navigation.navigate("SignIn")}>
        <Text style={styles.backText}>Back to Sign In</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000010", // Dark theme background
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  iconWrapper: {

    // padding: 25,
    // borderRadius: 20,
    marginBottom: 30,
  },
  icon: {
    width: 80,
    height: 80,
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 14,
    color: "#aaa",
    textAlign: "center",
    marginBottom: 40,
    lineHeight: 20,
  },
  button: {
    backgroundColor: "#140066",
    paddingVertical: 15,
    borderRadius: 10,
    width: "100%",
    alignItems: "center",
    marginBottom: 20,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  backText: {
    color: "#aaa",
    textDecorationLine: "underline",
    fontSize: 14,
  },
});
