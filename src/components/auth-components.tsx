
"use client";

import { signIn, signOut } from "next-auth/react";
import { Button } from "./ui/button";
import { LogIn, LogOut } from "lucide-react";

export function LoginButton() {
  return (
    <Button onClick={() => signIn("google")} variant="outline">
      <LogIn className="mr-2 h-4 w-4" /> Login dengan Google
    </Button>
  );
}

export function LogoutButton() {
  return (
    <Button onClick={() => signOut()} variant="outline">
      <LogOut className="mr-2 h-4 w-4" /> Logout
    </Button>
  );
}
