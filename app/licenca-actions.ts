"use server";

import { estadoLicencaUsuario, type EstadoLicenca } from "@/lib/licenca";

export async function obterEstadoLicenca(): Promise<EstadoLicenca> {
  return estadoLicencaUsuario();
}

export type { EstadoLicenca };
