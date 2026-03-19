import type { JSX } from "solid-js";
import { createSignal, onCleanup, onMount } from "solid-js";
import { LogoText } from "./logos";

export function AuthShell(props: { children?: JSX.Element }) {
  const [visible, setVisible] = createSignal(false);

  onMount(() => {
    const t = setTimeout(() => setVisible(true), 500);
    onCleanup(() => clearTimeout(t));
  });

  return (
    <div class="relative min-h-screen flex flex-col-reverse md:flex-row bg-background">
      <div
        class="absolute inset-0 bg-radial from-primary/15 to-background transition-opacity duration-700"
        classList={{ "opacity-0": !visible(), "opacity-100": visible() }}
      />
      <div class="relative z-10 flex flex-1 justify-center items-center flex-col gap-6">
        <LogoText />
        {props.children}
      </div>
    </div>
  );
}

export function AuthCard(props: { children?: JSX.Element; title?: string }) {
  return (
    <div class="p-6 bg-card w-sm rounded-lg ring-[0.5px] ring-foreground/20 shadow-md">
      <div class="flex flex-col items-center gap-3 mb-6">
        <h1 class="text-xl font-medium text-center">{props.title}</h1>
      </div>
      {props.children}
    </div>
  );
}
