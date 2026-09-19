import { expect, test } from "@playwright/test";

test("landing page exposes the product story and signup path", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/AI Hiring Intelligence Platform/);
  await expect(page.getByRole("heading", { level: 1, name: /The Hiring Intelligence Engine/i })).toBeVisible();
  const signup = page.getByRole("link", { name: "Start Hiring Smarter" }).first();
  await expect(signup).toBeVisible();
  await signup.click();
  await expect(page).toHaveURL(/\/signup$/);
  await expect(page.getByRole("heading", { name: "Build your hiring command center." })).toBeVisible();
});

test("login page provides accessible authentication controls", async ({ page }) => {
  await page.goto("/login");
  await expect(page).toHaveTitle(/Sign in/);
  await expect(page.getByLabel("Work email")).toBeVisible();
  await expect(page.getByLabel("Password")).toBeVisible();
  await expect(page.getByRole("button", { name: "Enter workspace" })).toBeEnabled();
  await expect(page.getByRole("link", { name: "Continue with Google" })).toHaveAttribute("href", /\/auth\/google$/);
});
