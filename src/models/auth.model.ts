import z from "zod";

export const userLoginSchema = z.object({
  email: z.email("Email not valid"),
  password: z.string("Password is required").min(1, "Password is required"),
});

export const userRegisterSchema = z
  .object({
    email: z.email("Email not valid"),
    firstName: z
      .string("First name is required")
      .min(1, "First name is required"),
    lastName: z.string("Last name is required").min(1, "Last name is required"),
    password: z
      .string("Password is required")
      .min(5, "Password not strong enough"),
    confirmPassword: z
      .string("Confirm password is required")
      .min(1, "Confirm password is required"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const verifyUserSchema = z.object({
  email: z.email("Email not valid"),
  otp: z.string("Otp is required").min(1, "Otp is required"),
});

export const userForgotPasswordSchema = z.object({
  email: z.email("Email not valid"),
});

export const userResetPasswordSchema = z
  .object({
    email: z.email("Email not valid"),
    otp: z.string("Otp is required").min(1, "Otp is required"),
    newPassword: z
      .string("New password is required")
      .min(5, "Password not strong enough"),
    confirmPassword: z
      .string("Confirm new password is required")
      .min(1, "Confirm new password is required"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });
