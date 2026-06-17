"use server";

import { estadoLicencaUsuario, type EstadoLicenca } from "@/lib/licenca";

// Arquivo "use server" só pode exportar funções async — o tipo vive em lib/licenca.
export async function obterEstadoLicenca(): Promise<EstadoLicenca> {
  return estadoLicencaUsuario();
}
