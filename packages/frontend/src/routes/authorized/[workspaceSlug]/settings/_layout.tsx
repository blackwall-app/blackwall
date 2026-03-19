import { SettingsSidebar } from "@/components/blocks/settings-sidebar";
import { ScrollContainer } from "@/components/custom-ui/scroll-area";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import PanelLeftIcon from "lucide-solid/icons/panel-left";
import type { ParentComponent } from "solid-js";

const SettingsLayout: ParentComponent = (props) => {
  return (
    <SidebarProvider keybind={false}>
      <SettingsSidebar />
      <ScrollContainer class="bg-background">
        <div class="md:hidden px-3 pt-2">
          <SidebarTrigger side="left">
            <PanelLeftIcon class="size-4" />
          </SidebarTrigger>
        </div>
        {props.children}
      </ScrollContainer>
    </SidebarProvider>
  );
};

export default SettingsLayout;
