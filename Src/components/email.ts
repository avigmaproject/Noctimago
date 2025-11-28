// src/screens/Support/ContactUsScreen.tsx (submit handler)
import { Alert, Platform } from "react-native";
import { openComposer } from "react-native-email-link";

async function sendViaMailApp({ name, email, subject, message }: {
  name: string; email: string; subject?: string; message: string;
}) {
  const subj = subject?.trim() || "Contact from Noctimago app";
  const body =
`Hello Noctimago Team,

I'd like to share the following:

Name: ${name}
Email: ${email}

Message:
${message}

—
Sent from the Noctimago app (${Platform.OS})
`;

  try {
    await openComposer({
      to: "info@noctimago.com",
      subject: subj,
      body,
      // optional: cc: "", bcc: ""
    });
  } catch {
    Alert.alert("No email app found", "Please email us at info@noctimago.com");
  }
}
