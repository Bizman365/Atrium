import { Suspense } from "react";
import type { Metadata } from "next";
import { Source_Serif_4 } from "next/font/google";
import { ClientPortalSignInForm } from "./sign-in-form";

const sourceSerif = Source_Serif_4({
  subsets: ["latin"],
  variable: "--font-pexlo-serif",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Client sign in",
  robots: { index: false, follow: false },
};

export default function SignInPage() {
  return (
    <div className={sourceSerif.variable}>
      <Suspense fallback={null}>
        <ClientPortalSignInForm />
      </Suspense>
    </div>
  );
}
