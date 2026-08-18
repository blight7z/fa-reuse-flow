import { expect, test } from "@playwright/test";

test("demo user can sign in and see the operations dashboard", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "เข้าสู่ระบบ" })).toBeVisible();
  await page.getByLabel("อีเมล").fill("estimator@demo.local");
  await page.getByRole("textbox", { name: "รหัสผ่าน", exact: true }).fill("Demo123!");
  await page.getByRole("button", { name: "เข้าสู่ระบบ" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { name: "ภาพรวมงาน" })).toBeVisible();
});

test("login page remains usable at a mobile viewport", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "เข้าสู่ระบบ" })).toBeVisible();
  await expect(page.getByRole("button", { name: /เจ้าหน้าที่ประเมินราคา/ })).toBeVisible();
});
