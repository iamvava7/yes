import React from "react";
import { AuthComponent } from "@/components/ui/sign-up";

// The wordmark and the page shell both live in AuthLayout, so nothing is
// passed down here. Passing a `logo` AND a `brandName` is what printed
// "VerifiCasa VerifiCasa" at the top of the old screen.
export default function Login() {
  return <AuthComponent />;
}
