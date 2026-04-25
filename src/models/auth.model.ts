import z from "zod";

export const userLoginSchema = z.object({
  email: z.email("Email not valid"),
  password: z.string().min(1, "Password is required"),
});

export const userRegisterSchema = z
  .object({
    email: z.email("Email not valid"),
    firstName: z.string().min(1, "First name is required"),
    lastName: z.string().min(1, "Last name is required"),
    password: z
      .string()
      .min(1, "Password is required")
      .refine((data) => {
        if (data.length < 5) {
          return {
            message: "Password not strong enough",
          };
        }
      }),
    confirmPassword: z.string().min(1, "Confirm password is required"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
  });

export const verifyUserSchema = z.object({
  email: z.email("Email not valid"),
  otp: z.string().min(1, "Otp is required"),
});
