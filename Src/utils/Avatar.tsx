// src/components/Avatar.tsx
import React from "react";
import { Image, Text, View } from "react-native";

type Props = {
  uri?: string;
  name?: string;
  size?: number;        // px
  border?: boolean;
};

const BLUE = "#3B82F6"; // Tailwind-ish blue-500

const getInitials = (s?: string) => {
  const parts = (s || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
};

export default function Avatar({ uri, name, size = 36, border = false }: Props) {
  const radius = size / 2;
  if (uri && uri.trim().length > 4) {
    return (
      <Image
        source={{ uri }}
        style={{
          width: size,
          height: size,
         
        borderColor:"white",borderWidth:1,
        }}
      />
    );
  }
  return (
    <View
      style={{
        width: size,
        height: size,
        // borderRadius: radius,
        borderColor:'white',borderWidth:1
,        backgroundColor: BLUE,
        alignItems: "center",
        justifyContent: "center",
        ...(border ? { borderWidth: 1, borderColor: "#fff" } : null),
      }}
    >
      <Text
        style={{
          color: "white",
          fontWeight: "700",
          fontSize: Math.round(size * 0.45),
        }}
        numberOfLines={1}
      >
        {getInitials(name)}
      </Text>
    </View>
  );
}
