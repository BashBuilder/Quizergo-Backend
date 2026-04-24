import axios from "axios";
import "dotenv/config";

// const token = process.env.ALOC_API_KEY || "";
// axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;

export const alocApi = axios.create({
  baseURL: process.env.ALOC_BASE_URL || "",
  headers: {
    Authorization: `Bearer ${process.env.ALOC_API_KEY || ""}`,
  },
});
