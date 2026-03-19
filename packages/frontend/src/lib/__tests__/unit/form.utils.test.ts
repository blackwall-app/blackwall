import { beforeAll, beforeEach, describe, expect, it, mock } from "bun:test";
import { overwriteGetLocale } from "../../../paraglide/runtime.js";

const toastCalls = {
  success: [] as string[],
  error: [] as string[],
};

mock.module("@/components/custom-ui/toast", () => ({
  toast: {
    success: (message: string) => {
      toastCalls.success.push(message);
    },
    error: (message: string) => {
      toastCalls.error.push(message);
    },
  },
}));

beforeAll(() => {
  overwriteGetLocale(() => "en");
});

describe("form utils", () => {
  beforeEach(() => {
    toastCalls.success.length = 0;
    toastCalls.error.length = 0;
  });

  it("collects field errors after validating requested fields", async () => {
    const { validateFields } = await import("../../form.utils");

    const validatedFields: string[] = [];
    const form = {
      validateField: (field: string) => {
        validatedFields.push(field);
      },
      getAllErrors: () => ({
        fields: {
          name: { errors: ["Name is required"] },
          email: { errors: ["Email is invalid"] },
        },
      }),
    };

    const errors = validateFields(form as any, ["name", "email"]);

    expect(validatedFields).toEqual(["name", "email"]);
    expect(errors).toEqual(["Name is required", "Email is invalid"]);
  });

  it("shows a success toast for successful actions and resets the form", async () => {
    const { actionWrapper } = await import("../../form.utils");

    let resetCalls = 0;

    const result = await actionWrapper(Promise.resolve({ message: "Saved", ok: true }), {
      reset: () => {
        resetCalls++;
      },
    } as any);

    expect(result).toEqual({ message: "Saved", ok: true });
    expect(toastCalls.success).toEqual(["Saved"]);
    expect(toastCalls.error).toEqual([]);
    expect(resetCalls).toBe(1);
  });

  it("shows an error toast for Error instances and rethrows them", async () => {
    const { actionWrapper } = await import("../../form.utils");

    let resetCalls = 0;

    await expect(
      actionWrapper(Promise.reject(new Error("Broken request")), {
        reset: () => {
          resetCalls++;
        },
      } as any),
    ).rejects.toThrow("Broken request");

    expect(toastCalls.error).toEqual(["Broken request"]);
    expect(resetCalls).toBe(1);
  });

  it("shows the localized fallback message for unknown errors", async () => {
    const { actionWrapper } = await import("../../form.utils");

    await expect(actionWrapper(Promise.reject("boom"))).rejects.toBe("boom");

    expect(toastCalls.error).toEqual(["An unexpected error occurred"]);
  });
});
