import "dotenv/config";
import { Resend } from "resend";

const RESEND_API_KEY = process.env["RESEND_API_KEY"] || "";
export const RESEND_CONTACT_EMAIL = process.env["RESEND_CONTACT_EMAIL"] || "";

export const resend = new Resend(RESEND_API_KEY);
