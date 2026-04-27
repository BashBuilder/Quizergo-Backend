import z from "zod";
import { Header } from "../utils/auth.util.js";
// import { Header } from "../utils/AUTH.util.js";

export const ApiKeySchema = z.object({
  apiKey: z.object({
    [Header.API_KEY]: z.string().nonempty("API key is required"),
  }),
});
