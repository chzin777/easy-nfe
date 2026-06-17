"use server";

import { minhasFeatures } from "@/lib/permissoes";

export async function obterMinhasFeatures(): Promise<string[]> {
  return minhasFeatures();
}
