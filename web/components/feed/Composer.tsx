import { Avatar } from "@/components/ui/Avatar";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/icons";
import { firstName } from "@/lib/time";
import type { User } from "@/lib/types";

// static facebook composer. the musing composer is a separate surface.
export function Composer({ me }: { me: User }) {
  return (
    <Card className="px-4 pt-3 pb-2.5">
      <div className="flex items-center gap-2">
        <Avatar seed={me.avatar_seed} name={me.name} size={40} />
        <div className="flex h-10 flex-1 items-center rounded-full bg-fb-input px-4 text-[17px] text-fb-muted hover:bg-fb-divider/60">
          What&apos;s on your mind, {firstName(me.name)}?
        </div>
      </div>
      <div className="mt-3 border-t border-fb-divider pt-2">
        <div className="grid grid-cols-3">
          <ComposerAction icon="video" color="text-fb-red" label="Live video" short="Live" />
          <ComposerAction icon="photo" color="text-fb-green" label="Photo/video" short="Photo" />
          <ComposerAction icon="emoji" color="text-fb-yellow" label="Feeling/activity" short="Feeling" />
        </div>
      </div>
    </Card>
  );
}

function ComposerAction({ icon, color, label, short }: { icon: "video" | "photo" | "emoji"; color: string; label: string; short: string }) {
  return (
    <div className="flex h-10 items-center justify-center gap-2 rounded-lg px-2 text-[15px] font-medium text-fb-muted hover:bg-fb-hover">
      <Icon name={icon} className={`h-6 w-6 ${color}`} />
      <span className="hidden sm:inline">{label}</span>
      <span className="sm:hidden">{short}</span>
    </div>
  );
}
