import { it, describe, expect, afterEach, afterAll, vi } from "vitest";
import request from "supertest";
import app, { version } from "../src/app.js";
import { prisma } from "../src/config/prisma.js";
import redisClient from "../src/cache/index.js";

describe("Registeration and User email verification ", () => {
  const userPayload = {
    firstName: "Joe",
    lastName: "Doe",
    email: "joe@doe.com",
    password: "123456",
    confirmPassword: "123456",
  };

  it("should verify a user and return proper message", async () => {
    const registrationRes = await request(app)
      .post(`/${version}/auth/register`)
      .send(userPayload);
    expect(registrationRes.status).toBe(201);
    expect(registrationRes.body.message).toBe(
      "User created successfully. Otp sent to your email, verify to login",
    );
    const otp = await redisClient.get(`otp:auth:${userPayload.email}`);
    expect(otp).toBeTruthy();
    const verifyRes = await request(app).post(`/${version}/auth/verify`).send({
      email: userPayload.email,
      otp,
    });

    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.message).toBe("User verified successfully");
  });
});

describe("Login flow", () => {
  const userPayload = {
    firstName: "Joe",
    lastName: "Doe",
    email: "joe@doe.com",
    password: "123456",
    confirmPassword: "123456",
  };

  it("should register and verify a user and login", async () => {
    const registerRes = await request(app)
      .post(`/${version}/auth/register`)
      .send(userPayload);
    expect(registerRes.status).toBe(201);
    const otp = await redisClient.get(`otp:auth:${userPayload.email}`);

    expect(otp).toBeTruthy();

    const verifyRes = await request(app).post(`/${version}/auth/verify`).send({
      email: userPayload.email,
      otp,
    });

    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.message).toBe("User verified successfully");

    const res = await request(app)
      .post(`/${version}/auth/login`)
      .send(userPayload);
    expect(res.status).toBe(200);
    expect(res.body.user.id).toBeTruthy();
    expect(res.headers["set-cookie"]).toBeTruthy();
    expect(res.body.user.email).toBe(userPayload.email);
  });
});
