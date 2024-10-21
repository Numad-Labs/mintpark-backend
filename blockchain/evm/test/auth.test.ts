import request from "supertest";
import express, { Express } from "express";
import { userServices } from "../services/userServices";
import { expect, jest, describe, beforeEach, it } from "@jest/globals";
import { userController } from "../controller/evmUserController";

jest.mock("../services/userServices");
jest.mock("../../../src/repositories/userRepository");
jest.mock("../../../src/utils/jwt");

describe("User Controller", () => {
  let app: Express;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.post("/generate-message", userController.generateMessageToSign);
    app.post("/login", userController.login);
  });

  describe("POST /generate-message", () => {
    it("should generate a message to sign", async () => {
      const address = "0x1234567890123456789012345678901234567890";
      const mockMessage = "Mock message to sign";

      jest
        .spyOn(userServices, "generateMessageToSign")
        .mockResolvedValue(mockMessage);

      const response = await request(app)
        .post("/generate-message")
        .send({ address })
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: { message: mockMessage },
      });
      expect(userServices.generateMessageToSign).toHaveBeenCalledWith(address);
    });

    it("should return 400 if address is not provided", async () => {
      const response = await request(app)
        .post("/generate-message")
        .send({})
        .expect(400);

      expect(response.body).toEqual({
        success: false,
        error: "Please provide a wallet address",
      });
    });
  });

  describe("POST /login", () => {
    it("should log in a user with valid credentials", async () => {
      const address = "0x1234567890123456789012345678901234567890";
      const signedMessage = "signed_message";
      const mockUser = {
        id: "1",
        address,

        layerId: "12",
        createdAt: new Date(),
        xpub: null,
        pubkey: null,
      };
      const mockTokens = {
        accessToken: "access_token",
        refreshToken: "refresh_token",
      };

      jest
        .spyOn(userServices, "login")
        .mockResolvedValue({ user: mockUser, tokens: mockTokens });

      const response = await request(app)
        .post("/login")
        .send({ address, signedMessage })
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: {
          user: mockUser,
          auth: mockTokens,
        },
      });
      expect(userServices.login).toHaveBeenCalledWith(address, signedMessage);
    });

    it("should return 400 if address or signedMessage is not provided", async () => {
      const response = await request(app).post("/login").send({}).expect(400);

      expect(response.body).toEqual({
        success: false,
        error: "Please provide a wallet address, signed message.",
      });
    });
  });
});
