import GateFeature from "@/app/ui/GateFeature";

export default function Layout({ children }: { children: React.ReactNode }) {
  return <GateFeature feature="emitir_nfe">{children}</GateFeature>;
}
