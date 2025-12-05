// src/contexts/AuthContext.tsx

import React, { createContext, useContext, useEffect, useState } from "react";
import { authAPI } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

interface User {
  email: string;
  name?: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name?: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  // On reload → restore user
  useEffect(() => {
    const saved = localStorage.getItem("user");
    if (saved) setUser(JSON.parse(saved));
    setLoading(false);
  }, []);

  // --------------- LOGIN ----------------
  const login = async (email: string, password: string) => {
    try {
      const data = await authAPI.login(email, password);

      localStorage.setItem("token", data.token);

      const userObj = { email };
      setUser(userObj);
      localStorage.setItem("user", JSON.stringify(userObj));

      toast({ title: "Login successful!" });
    } catch (err: any) {
      toast({
        title: "Login failed",
        description: err.response?.data?.error || "Invalid credentials",
        variant: "destructive",
      });
      throw err;
    }
  };

  // --------------- REGISTER ----------------
  const register = async (email: string, password: string, name?: string) => {
    try {
      await authAPI.register(email, password);

      const userObj = { email, name };
      setUser(userObj);
      localStorage.setItem("user", JSON.stringify(userObj));

      toast({ title: "Account created!" });
    } catch (err: any) {
      toast({
        title: "Registration failed",
        description: err.response?.data?.error,
        variant: "destructive",
      });
      throw err;
    }
  };

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUser(null);

    toast({ title: "Logged out" });
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
