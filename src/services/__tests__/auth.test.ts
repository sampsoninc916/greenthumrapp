/// <reference types="vitest" />

import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { authService, apiClient } from "../auth";
import { httpClient } from "../httpClient";
import { API_ENDPOINTS } from "../../config/amplify";

const originalEndpoints = {
  USERS_READ: API_ENDPOINTS.USERS_READ,
  USERS_UPDATE: API_ENDPOINTS.USERS_UPDATE,
  USERS_WRITE: API_ENDPOINTS.USERS_WRITE,
};

const originalWindow = globalThis.window;
const originalCustomEvent = globalThis.CustomEvent;

const setMockWindow = () => {
  const mockLocation = {
    origin: "http://localhost",
    pathname: "/",
    search: "",
    hash: "",
    href: "http://localhost/",
  } as Location;

  (globalThis as any).window = {
    location: mockLocation,
    dispatchEvent: vi.fn(),
  } as unknown as Window;

  (globalThis as any).CustomEvent = class {
    type: string;
    detail: unknown;

    constructor(type: string, init?: CustomEventInit) {
      this.type = type;
      this.detail = init?.detail;
    }
  };
};

beforeEach(() => {
  setMockWindow();
  (API_ENDPOINTS as any).USERS_READ = "/api/users/me";
  (API_ENDPOINTS as any).USERS_UPDATE = "/api/users/me";
  (API_ENDPOINTS as any).USERS_WRITE = "/api/users";
  (authService as any).userIdCache = null;
  (authService as any).roleCache = null;
});

afterEach(() => {
  (API_ENDPOINTS as any).USERS_READ = originalEndpoints.USERS_READ;
  (API_ENDPOINTS as any).USERS_UPDATE = originalEndpoints.USERS_UPDATE;
  (API_ENDPOINTS as any).USERS_WRITE = originalEndpoints.USERS_WRITE;
  (authService as any).userIdCache = null;
  (authService as any).roleCache = null;

  if (originalWindow) {
    (globalThis as any).window = originalWindow;
  } else {
    delete (globalThis as any).window;
  }

  if (originalCustomEvent) {
    (globalThis as any).CustomEvent = originalCustomEvent;
  } else {
    delete (globalThis as any).CustomEvent;
  }

  vi.restoreAllMocks();
});

describe("AuthService user scoping", () => {
  it("prevents fetching another user's profile", async () => {
    const requestSpy = vi.spyOn(httpClient, "request");

    const tokenSpy = vi
      .spyOn(authService as any, "getTokenAndRole")
      .mockResolvedValue({ token: "fake-token", role: "buyer", userId: "user-123" });

    await expect(
      authService.authenticatedFetch("/api/users/me?userId=user-456", {
        requiresAuth: true,
        method: "GET",
      }),
    ).rejects.toThrow(/mismatch/i);

    expect(requestSpy).not.toHaveBeenCalled();
    tokenSpy.mockRestore();
  });

  it("blocks updates targeting another user's profile", async () => {
    const requestSpy = vi.spyOn(httpClient, "request");

    vi.spyOn(authService as any, "getTokenAndRole").mockResolvedValue({
      token: "fake-token",
      role: "buyer",
      userId: "user-123",
    });

    await expect(apiClient.put("/api/users/me?userId=user-456", { description: "nope" }, true)).rejects.toThrow(/mismatch/i);
    expect(requestSpy).not.toHaveBeenCalled();
  });

  it("sanitizes sensitive fields from profile responses", async () => {
    const responsePayload = {
      userId: "user-123",
      fullName: "Test User",
      email: "secret@example.com",
      description: "Bio",
    };

    const requestSpy = vi
      .spyOn(httpClient, "request")
      .mockResolvedValue(
      new Response(JSON.stringify(responsePayload), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    vi.spyOn(authService as any, "getTokenAndRole").mockResolvedValue({
      token: "fake-token",
      role: "buyer",
      userId: "user-123",
    });

    const { data } = await authService.authenticatedFetch<Record<string, unknown>>("/api/users/me", {
      requiresAuth: true,
      method: "GET",
    });

    expect(data).toEqual({
      userId: "user-123",
      fullName: "Test User",
      description: "Bio",
    });
    expect((data as any)?.email).toBeUndefined();
    expect(requestSpy).toHaveBeenCalledTimes(1);
  });
});
