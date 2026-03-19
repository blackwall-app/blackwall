import type { Accessor, Component, ComponentProps, JSX, ValidComponent } from "solid-js";
import {
  createContext,
  createEffect,
  createMemo,
  createSignal,
  Match,
  mergeProps,
  onCleanup,
  Show,
  splitProps,
  Switch,
  useContext,
} from "solid-js";

import type { PolymorphicProps } from "@kobalte/core";
import { Polymorphic } from "@kobalte/core";
import type { VariantProps } from "class-variance-authority";
import { cva } from "class-variance-authority";

import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages.js";
import { Button } from "./button";
import { Separator } from "./separator";
import { Sheet, SheetContent } from "./sheet";
import { Skeleton } from "./skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "./tooltip";

const DEFAULT_MOBILE_BREAKPOINT = 768;
const SIDEBAR_WIDTH = "15rem";
const SIDEBAR_WIDTH_MOBILE = "18rem";
const SIDEBAR_WIDTH_ICON = "3rem";
const SIDEBAR_KEYBOARD_SHORTCUT = "\\";

export type SidebarContext = {
  state: Accessor<"expanded" | "collapsed">;
  open: Accessor<boolean>;
  setOpen: (open: boolean) => void;
  openMobile: Accessor<boolean>;
  setOpenMobile: (open: boolean) => void;
  isMobile: Accessor<boolean>;
  toggleSidebar: () => void;
};

const SidebarContext = createContext<SidebarContext | null>(null);

function useSidebar() {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error("useSidebar must be used within a Sidebar.");
  }

  return context;
}

export function useIsMobile(breakpoint = DEFAULT_MOBILE_BREAKPOINT, fallback = false) {
  const [isMobile, setIsMobile] = createSignal(fallback);

  createEffect(() => {
    const mql = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);
    const onChange = (e: MediaQueryListEvent | MediaQueryList) => {
      setIsMobile(e.matches);
    };
    mql.addEventListener("change", onChange);
    onChange(mql);
    onCleanup(() => mql.removeEventListener("change", onChange));
  });

  return isMobile;
}

type SidebarProviderProps = Omit<ComponentProps<"div">, "style"> & {
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  style?: JSX.CSSProperties;
  keybind?: string | false;
  mobileBreakpoint?: number;
};

const SidebarProvider: Component<SidebarProviderProps> = (rawProps) => {
  const props = mergeProps(
    {
      defaultOpen: true,
      keybind: SIDEBAR_KEYBOARD_SHORTCUT as string | false,
      mobileBreakpoint: DEFAULT_MOBILE_BREAKPOINT,
    },
    rawProps,
  );
  const [local, others] = splitProps(props, [
    "defaultOpen",
    "open",
    "onOpenChange",
    "class",
    "style",
    "children",
    "keybind",
    "mobileBreakpoint",
  ]);

  const isMobile = useIsMobile(local.mobileBreakpoint);
  const [openMobile, setOpenMobile] = createSignal(false);

  // This is the internal state of the sidebar.
  // We use open and onOpenChange for control from outside the component.
  const [_open, _setOpen] = createSignal(local.defaultOpen);
  const open = () => local.open ?? _open();
  const setOpen = (value: boolean | ((value: boolean) => boolean)) => {
    if (local.onOpenChange) {
      return local.onOpenChange?.(typeof value === "function" ? value(open()) : value);
    }
    _setOpen(value);
  };

  // Helper to toggle the sidebar.
  const toggleSidebar = () => {
    return isMobile() ? setOpenMobile((open) => !open) : setOpen((open) => !open);
  };

  // Adds a keyboard shortcut to toggle the sidebar.
  createEffect(() => {
    if (local.keybind === false) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (target.isContentEditable || target.tagName === "INPUT" || target.tagName === "TEXTAREA")
        return;

      if (event.key === local.keybind && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        toggleSidebar();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    onCleanup(() => window.removeEventListener("keydown", handleKeyDown));
  });

  // We add a state so that we can do data-state="expanded" or "collapsed".
  // This makes it easier to style the sidebar with Tailwind classes.
  const state = () => (open() ? "expanded" : "collapsed");

  const contextValue = {
    state,
    open,
    setOpen,
    isMobile,
    openMobile,
    setOpenMobile,
    toggleSidebar,
  };

  return (
    <SidebarContext.Provider value={contextValue}>
      <div
        style={{
          "--sidebar-width": SIDEBAR_WIDTH,
          "--sidebar-width-icon": SIDEBAR_WIDTH_ICON,
          ...local.style,
        }}
        class={cn(
          "group/sidebar-wrapper flex h-full w-full text-sidebar-foreground has-data-[variant=inset]:bg-sidebar",
          local.class,
        )}
        {...others}
      >
        {local.children}
      </div>
    </SidebarContext.Provider>
  );
};

type SidebarProps = ComponentProps<"div"> & {
  side?: "left" | "right";
  variant?: "sidebar" | "floating" | "inset";
  collapsible?: "offcanvas" | "icon" | "none";
};

const Sidebar: Component<SidebarProps> = (rawProps) => {
  const props = mergeProps<SidebarProps[]>(
    {
      side: "left",
      variant: "sidebar",
      collapsible: "offcanvas",
    },
    rawProps,
  );
  const [local, others] = splitProps(props, [
    "side",
    "variant",
    "collapsible",
    "class",
    "children",
  ]);

  const { isMobile, state, openMobile, setOpenMobile } = useSidebar();

  return (
    <Switch>
      <Match when={local.collapsible === "none"}>
        <div
          class={cn(
            "w-(--sidebar-width) shrink-0 flex h-full flex-col bg-sidebar text-sidebar-foreground",
            local.class,
          )}
          {...others}
        >
          {local.children}
        </div>
      </Match>
      <Match when={isMobile()}>
        <Sheet open={openMobile()} onOpenChange={setOpenMobile} {...others}>
          <SheetContent
            data-sidebar="sidebar"
            data-mobile="true"
            class="w-(--sidebar-width) shrink-0 bg-sidebar p-0 text-sidebar-foreground [&>button]:hidden"
            style={{
              "--sidebar-width": SIDEBAR_WIDTH_MOBILE,
            }}
            position={local.side}
          >
            <div class="flex size-full flex-col">{local.children}</div>
          </SheetContent>
        </Sheet>
      </Match>
      <Match when={!isMobile()}>
        <div
          class={cn(
            "group peer shrink-0 fixed flex w-(--sidebar-width) top-0 bottom-0 flex-col bg-sidebar text-sidebar-foreground overflow-hidden duration-400 ease-out-expo",
            "data-[collapsible=offcanvas]:border-0",
            "data-[collapsible=icon]:w-(--sidebar-width-icon)",
            local.side === "left"
              ? "border-r border-sidebar-border data-[collapsible=offcanvas]:-translate-x-full left-0"
              : "border-l border-sidebar-border data-[collapsible=offcanvas]:translate-x-full right-0",
            local.class,
          )}
          data-sidebar="sidebar"
          data-state={state()}
          data-collapsible={state() === "collapsed" ? local.collapsible : ""}
          data-variant={local.variant}
          data-side={local.side}
          {...others}
        >
          {local.children}
        </div>
        <div
          class="transition-width block shrink-0 duration-400 ease-out-expo"
          style={
            state() === "collapsed"
              ? {
                  width: "0",
                }
              : {
                  width: SIDEBAR_WIDTH,
                }
          }
        />
      </Match>
    </Switch>
  );
};

type SidebarTriggerProps<T extends ValidComponent = "button"> = ComponentProps<typeof Button<T>> & {
  onClick?: (event: MouseEvent) => void;
  side?: "left" | "right";
};

const SidebarTrigger = <T extends ValidComponent = "button">(props: SidebarTriggerProps<T>) => {
  const [local, others] = splitProps(props as SidebarTriggerProps, ["class", "onClick", "side"]);
  const { toggleSidebar, isMobile, open, openMobile } = useSidebar();
  const isOpen = () => (isMobile() ? openMobile() : open());

  return (
    <Button
      data-sidebar="trigger"
      variant="ghost"
      size="iconXs"
      class={local.class}
      onClick={(event: MouseEvent) => {
        if (local.onClick) {
          local.onClick(event);
        } else {
          toggleSidebar();
        }
      }}
      {...others}
    >
      <SidebarIcon
        filled={isOpen()}
        class="size-4"
        classList={{
          "rotate-180": local.side === "left",
        }}
      />
      <span class="sr-only">{m.sidebar_toggle()}</span>
    </Button>
  );
};

const SidebarRail: Component<ComponentProps<"button">> = (props) => {
  const [local, others] = splitProps(props, ["class"]);
  const { toggleSidebar } = useSidebar();

  return (
    <button
      data-sidebar="rail"
      aria-label={m.sidebar_toggle()}
      tabIndex={-1}
      onClick={toggleSidebar}
      title={m.sidebar_toggle()}
      class={cn(
        "absolute inset-y-0 z-20 hidden w-4 -translate-x-1/2 transition-all ease-in-out-circ after:absolute after:inset-y-0 after:left-1/2 after:w-[2px] hover:after:bg-sidebar-border group-data-[side=left]:-right-4 group-data-[side=right]:left-0 sm:flex",
        "in-data-[side=left]:cursor-w-resize in-data-[side=right]:cursor-e-resize",
        "[[data-side=left][data-state=collapsed]_&]:cursor-e-resize [[data-side=right][data-state=collapsed]_&]:cursor-w-resize",
        "group-data-[collapsible=offcanvas]:translate-x-0 group-data-[collapsible=offcanvas]:after:left-full group-data-[collapsible=offcanvas]:hover:bg-sidebar",
        "[[data-side=left][data-collapsible=offcanvas]_&]:-right-2",
        "[[data-side=right][data-collapsible=offcanvas]_&]:-left-2",
        local.class,
      )}
      {...others}
    />
  );
};

const SidebarHeader: Component<ComponentProps<"div">> = (props) => {
  const [local, others] = splitProps(props, ["class"]);
  return (
    <div
      data-sidebar="header"
      class={cn("flex flex-col gap-3 px-3.5 pt-2 pb-3", local.class)}
      {...others}
    />
  );
};

const SidebarFooter: Component<ComponentProps<"div">> = (props) => {
  const [local, others] = splitProps(props, ["class"]);
  return (
    <div data-sidebar="footer" class={cn("flex flex-col gap-2 p-2", local.class)} {...others} />
  );
};

type SidebarSeparatorProps<T extends ValidComponent = "hr"> = ComponentProps<typeof Separator<T>>;

const SidebarSeparator = <T extends ValidComponent = "hr">(props: SidebarSeparatorProps<T>) => {
  const [local, others] = splitProps(props as SidebarSeparatorProps, ["class"]);
  return (
    <Separator
      data-sidebar="separator"
      class={cn("mx-2 w-auto bg-sidebar-border", local.class)}
      {...others}
    />
  );
};

const SidebarContent: Component<ComponentProps<"div">> = (props) => {
  const [local, others] = splitProps(props, ["class"]);
  return (
    <div
      data-sidebar="content"
      class={cn(
        "flex min-h-0 flex-1 flex-col overflow-auto group-data-[collapsible=icon]:overflow-hidden px-3 pt-1 pb-3 gap-2",
        local.class,
      )}
      {...others}
    />
  );
};

const SidebarGroup: Component<ComponentProps<"div">> = (props) => {
  const [local, others] = splitProps(props, ["class"]);
  return (
    <div
      data-sidebar="group"
      class={cn("relative flex w-full min-w-0 flex-col", local.class)}
      {...others}
    />
  );
};

type SidebarGroupLabelProps<T extends ValidComponent = "div"> = ComponentProps<T>;

const SidebarGroupLabel = <T extends ValidComponent = "div">(
  props: PolymorphicProps<T, SidebarGroupLabelProps<T>>,
) => {
  const [local, others] = splitProps(props as SidebarGroupLabelProps, ["class"]);

  return (
    <Polymorphic<SidebarGroupLabelProps>
      as="div"
      data-sidebar="group-label"
      class={cn(
        "flex shrink-0 items-center p-2 text-xs font-medium text-sidebar-foreground/70 outline-none ring-sidebar-ring transition-[margin,opacity] duration-200 ease-in-out-circ focus-visible:ring-2 [&>svg]:size-4 [&>svg]:shrink-0",
        "group-data-[collapsible=icon]:-mt-8 group-data-[collapsible=icon]:opacity-0",
        local.class,
      )}
      {...others}
    />
  );
};

type SidebarGroupActionProps<T extends ValidComponent = "button"> = ComponentProps<T>;

const SidebarGroupAction = <T extends ValidComponent = "button">(
  props: PolymorphicProps<T, SidebarGroupActionProps<T>>,
) => {
  const [local, others] = splitProps(props as SidebarGroupActionProps, ["class"]);
  return (
    <Polymorphic<SidebarGroupActionProps>
      as="button"
      data-sidebar="group-action"
      class={cn(
        "absolute right-3 top-3.5 flex aspect-square w-5 items-center justify-center p-0 text-sidebar-foreground outline-none ring-sidebar-ring transition-transform hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 [&>svg]:size-4 [&>svg]:shrink-0",
        // Increases the hit area of the button on mobile.
        "after:absolute after:-inset-2 after:md:hidden",
        "group-data-[collapsible=icon]:hidden",
        local.class,
      )}
      {...others}
    />
  );
};

const SidebarGroupContent: Component<ComponentProps<"div">> = (props) => {
  const [local, others] = splitProps(props, ["class"]);
  return (
    <div data-sidebar="group-content" class={cn("w-full text-base", local.class)} {...others} />
  );
};

const SidebarMenu: Component<ComponentProps<"ul">> = (props) => {
  const [local, others] = splitProps(props, ["class"]);
  return (
    <ul
      data-sidebar="menu"
      class={cn("flex w-full min-w-0 flex-col gap-1", local.class)}
      {...others}
    />
  );
};

const SidebarMenuItem: Component<ComponentProps<"li">> = (props) => {
  const [local, others] = splitProps(props, ["class"]);
  return (
    <li data-sidebar="menu-item" class={cn("group/menu-item relative", local.class)} {...others} />
  );
};

const sidebarMenuButtonVariants = cva(
  "flex h-7 min-w-0 w-full items-center squircle-sm gap-2 overflow-hidden pr-2 pl-2 text-sidebar-foreground outline-none hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 active:bg-sidebar-accent active:text-sidebar-accent-foreground disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 [&>span:last-child]:truncate [&>svg]:size-4 [&>svg]:shrink-0 [&>svg]:text-sidebar-accent-foreground aria-[current=page]:bg-sidebar-accent aria-[current=page]:text-sidebar-accent-foreground",
  {
    variants: {
      variant: {
        default: "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
        outline:
          "bg-background shadow-[0_0_0_1px_hsl(var(--sidebar-border))] hover:bg-sidebar-accent hover:text-sidebar-accent-foreground hover:shadow-[0_0_0_1px_hsl(var(--sidebar-accent))]",
      },
      size: {
        sm: "h-7 text-sm",
        lg: "h-12 text-base group-data-[collapsible=icon]:!p-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "sm",
    },
  },
);

type SidebarMenuButtonProps<T extends ValidComponent = "button"> = ComponentProps<T> &
  VariantProps<typeof sidebarMenuButtonVariants> & {
    isActive?: boolean;
    tooltip?: string;
    close?: boolean;
  };

const SidebarMenuButton = <T extends ValidComponent = "button">(
  rawProps: PolymorphicProps<T, SidebarMenuButtonProps<T>>,
) => {
  const props = mergeProps(
    { isActive: false, variant: "default", size: "default", close: true },
    rawProps,
  );
  const [local, others] = splitProps(props as SidebarMenuButtonProps & { onClick?: () => void }, [
    "isActive",
    "tooltip",
    "variant",
    "size",
    "class",
    "onClick",
    "close",
  ]);
  const { isMobile, state, setOpenMobile } = useSidebar();

  const handleClick = () => {
    if (isMobile() && local.close) setOpenMobile(false);
    local.onClick?.();
  };

  const button = (
    <Polymorphic<SidebarMenuButtonProps>
      as="button"
      data-sidebar="menu-button"
      data-size={local.size}
      data-active={local.isActive}
      class={cn(
        sidebarMenuButtonVariants({ variant: local.variant, size: local.size }),
        local.class,
      )}
      onClick={handleClick}
      {...others}
    />
  );

  return (
    <Show when={local.tooltip} fallback={button}>
      <Tooltip placement="right">
        <TooltipTrigger class="w-full">{button}</TooltipTrigger>
        <TooltipContent hidden={state() !== "collapsed" || isMobile()}>
          {local.tooltip}
        </TooltipContent>
      </Tooltip>
    </Show>
  );
};

type SidebarMenuActionProps<T extends ValidComponent = "button"> = ComponentProps<T> & {
  showOnHover?: boolean;
};

const SidebarMenuAction = <T extends ValidComponent = "button">(
  rawProps: PolymorphicProps<T, SidebarMenuActionProps<T>>,
) => {
  const props = mergeProps({ showOnHover: false }, rawProps);
  const [local, others] = splitProps(props as SidebarMenuActionProps, ["class", "showOnHover"]);

  return (
    <Polymorphic<SidebarMenuActionProps>
      as="button"
      data-sidebar="menu-action"
      class={cn(
        "absolute right-1 top-1.5 flex aspect-square w-5 items-center justify-center p-0 text-sidebar-foreground outline-none ring-sidebar-ring transition-transform hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 peer-hover/menu-button:text-sidebar-accent-foreground [&>svg]:size-4 [&>svg]:shrink-0",
        // Increases the hit area of the button on mobile.
        "after:absolute after:-inset-2 after:md:hidden",
        "peer-data-[size=sm]/menu-button:top-1",
        "peer-data-[size=default]/menu-button:top-1.5",
        "peer-data-[size=lg]/menu-button:top-2.5",
        "group-data-[collapsible=icon]:hidden",
        local.showOnHover &&
          "group-focus-within/menu-item:opacity-100 group-hover/menu-item:opacity-100 data-[state=open]:opacity-100 peer-data-[active=true]/menu-button:text-sidebar-accent-foreground md:opacity-0",
        local.class,
      )}
      {...others}
    />
  );
};

const SidebarMenuBadge: Component<ComponentProps<"div">> = (props) => {
  const [local, others] = splitProps(props, ["class"]);
  return (
    <div
      data-sidebar="menu-badge"
      class={cn(
        "pointer-events-none absolute right-1 flex h-5 min-w-5 select-none items-center justify-center px-1 text-xs font-medium tabular-nums text-sidebar-foreground",
        "peer-hover/menu-button:text-sidebar-accent-foreground peer-data-[active=true]/menu-button:text-sidebar-accent-foreground",
        "peer-data-[size=sm]/menu-button:top-1",
        "peer-data-[size=default]/menu-button:top-1.5",
        "peer-data-[size=lg]/menu-button:top-2.5",
        "group-data-[collapsible=icon]:hidden",
        local.class,
      )}
      {...others}
    />
  );
};

type SidebarMenuSkeletonProps = ComponentProps<"div"> & {
  showIcon?: boolean;
};

const SidebarMenuSkeleton: Component<SidebarMenuSkeletonProps> = (rawProps) => {
  const props = mergeProps({ showIcon: false }, rawProps);
  const [local, others] = splitProps(props, ["class", "showIcon"]);

  // Random width between 50 to 90%.
  const width = createMemo(() => `${Math.floor(Math.random() * 40) + 50}%`);

  return (
    <div
      data-sidebar="menu-skeleton"
      class={cn("flex h-8 items-center gap-2 px-2", local.class)}
      {...others}
    >
      {local.showIcon && <Skeleton class="size-4" data-sidebar="menu-skeleton-icon" />}
      <Skeleton
        class="max-w-(--skeleton-width) h-4 flex-1"
        data-sidebar="menu-skeleton-text"
        style={{
          "--skeleton-width": width(),
        }}
      />
    </div>
  );
};

const SidebarMenuSub: Component<ComponentProps<"ul">> = (props) => {
  const [local, others] = splitProps(props, ["class"]);
  return (
    <ul
      data-sidebar="menu-sub"
      class={cn(
        "flex min-w-0 flex-col gap-1 py-1",
        "group-data-[collapsible=icon]:hidden",
        local.class,
      )}
      {...others}
    />
  );
};

const SidebarMenuSubItem: Component<ComponentProps<"li">> = (props) => <li {...props} />;

type SidebarMenuSubButtonProps<T extends ValidComponent = "a"> = ComponentProps<T> & {
  size?: "sm" | "md";
};

const SidebarMenuSubButton = <T extends ValidComponent = "a">(
  rawProps: PolymorphicProps<T, SidebarMenuSubButtonProps<T>>,
) => {
  const props = mergeProps({ size: "md" }, rawProps);
  const [local, others] = splitProps(
    props as SidebarMenuSubButtonProps & { onClick?: () => void },
    ["size", "class", "onClick"],
  );
  const { isMobile, setOpenMobile } = useSidebar();

  const handleClick = () => {
    if (isMobile()) setOpenMobile(false);
    local.onClick?.();
  };

  return (
    <Polymorphic<SidebarMenuSubButtonProps>
      as="a"
      data-sidebar="menu-sub-button"
      data-size={local.size}
      class={cn(
        "flex h-7 min-w-0 items-center squircle-sm gap-2 overflow-hidden pr-2 pl-5 text-sidebar-foreground outline-none ring-sidebar-ring hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 active:bg-sidebar-accent active:text-sidebar-accent-foreground disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 [&>span:last-child]:truncate [&>svg]:size-4 [&>svg]:shrink-0 [&>svg]:text-sidebar-accent-foreground",
        "aria-[current=page]:bg-sidebar-accent aria-[current=page]:text-sidebar-accent-foreground",
        local.size === "sm" && "text-sm",
        local.size === "md" && "text-base",
        "group-data-[collapsible=icon]:hidden",
        local.class,
      )}
      onClick={handleClick}
      {...others}
    />
  );
};

const SidebarIcon = (props: ComponentProps<"svg"> & { filled?: boolean }) => {
  const [local, others] = splitProps(props, ["filled", "class"]);
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...others}
    >
      <path
        d="M3 5C3 3.89543 3.89543 3 5 3H14V21H5C3.89543 21 3 20.1046 3 19V5Z"
        stroke="currentColor"
        stroke-width="2"
      />
      <path
        d="M21 19C21 20.1046 20.1046 21 19 21L14 21L14 3L19 3C20.1046 3 21 3.89543 21 5L21 19Z"
        stroke="currentColor"
        fill={local.filled ? "currentColor" : "none"}
        stroke-width="2"
      />
    </svg>
  );
};

export {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
  SidebarRail,
  SidebarSeparator,
  SidebarTrigger,
  useSidebar,
};
