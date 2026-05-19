import type { Metadata } from "next";
import { TerminalShell } from "@/components/terminal/TerminalShell";

export const metadata: Metadata = {
  title: "RaketRadar Terminal",
  description: "Pre-open trading intelligence för svenska småbolag.",
};

export default function TerminalPage() {
  return <TerminalShell />;
}

