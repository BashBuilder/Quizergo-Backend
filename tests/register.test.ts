import { it, describe, expect, afterEach, afterAll } from "vitest";
import request from "supertest";
import app, { version } from "../src/app.js";
import { prisma } from "../src/config/prisma.js";

afterEach(async () => {
  // await prisma.quizResult.deleteMany();
  // await prisma.session.deleteMany();
  await prisma.user.deleteMany();
});

afterAll(async () => {
  // await prisma.$disconnect();
});

describe("Tests the register functionality", () => {
  //arrange
  const endpoint = `/${version}/auth/register`;
  const userPayload = {
    firstName: "Joen",
    lastName: "Doe",
    email: "joen@doe.com",
    password: "123456",
    confirmPassword: "123456",
  };
  it("Should register a user", async () => {
    //act
    const res = await request(app).post(endpoint).send(userPayload);
    console.log(res.body);
    console.log(res.text);
    // assert
    expect(res.status).toBe(201);
    expect(res.body.message).toBe(
      "User created successfully. Otp sent to your email, verify to login",
    );
  });
});
