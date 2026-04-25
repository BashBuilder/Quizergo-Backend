import axios from "axios";
import "dotenv/config";

export const alocApi = axios.create({
  baseURL: process.env.ALOC_BASE_URL || "",
  headers: {
    AccessToken: process.env.ALOC_API_KEY,
  },
});
