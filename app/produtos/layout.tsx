import GateFeature from "@/app/ui/GateFeature";

export default function Layout({ children }: { children: React.ReactNode }) {
  return <GateFeature feature="produtos">{children}</GateFeature>;
}
