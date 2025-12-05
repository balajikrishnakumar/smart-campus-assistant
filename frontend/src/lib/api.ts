// frontend/src/lib/api.ts
import axios from "axios";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api";

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { "Content-Type": "application/json" },
});

// Automatically attach token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ---------------- AUTH ----------------
export const authAPI = {
  register: (email: string, password: string) =>
    api.post("/register", { email, password }).then((res) => res.data),

  login: (email: string, password: string) =>
    api.post("/login", { email, password }).then((res) => res.data),
};

// ---------------- DOCUMENTS ----------------
export const documentAPI = {
  upload: async (file: File) => {
    const fd = new FormData();
    fd.append("file", file);

    const res = await api.post("/upload", fd, {
      headers: { "Content-Type": "multipart/form-data" },
    });

    return res.data;
  },

  getAll: () =>
    api.get("/my-documents").then((res) => res.data.documents),

  deleteDocument: (filename: string) =>
    api.delete("/delete-document", { data: { filename } }).then((res) => res.data),
};

// ---------------- STUDY (CHAT / SUMMARY / QUIZ) ----------------
export const studyAPI = {
  chat: (filename: string, question: string) =>
    api.post("/chat", { filename, question }).then((res) => res.data),

  summarize: (filename: string) =>
    api.post("/summary", { filename }).then((res) => res.data),

  generateQuiz: (filename: string) =>
    api.post("/quiz", { filename }).then((res) => res.data),

  getChatHistory: (filename: string) =>
    api.post("/chat-history", { filename }).then((res) => res.data),
};

export default api;
