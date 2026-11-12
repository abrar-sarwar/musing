import { Avatar } from "@/components/ui/Avatar";
import { Icon } from "@/components/ui/icons";
import { hash } from "@/lib/hash";
import type { User } from "@/lib/types";

export function RightRail({ friends }: { friends: User[] }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between px-2 py-1">
        <h2 className="text-[17px] font-semibold text-fb-muted">Contacts</h2>
        <div className="flex items-center gap-1 text-fb-muted">
          <span className="grid h-8 w-8 place-items-center rounded-full hover:bg-fb-hover">
            <Icon name="search" className="h-4 w-4" />
          </span>
          <span className="grid h-8 w-8 place-items-center rounded-full hover:bg-fb-hover">
            <Icon name="more" className="h-4 w-4" />
          </span>
        </div>
      </div>
      <ul className="flex flex-col">
        {friends.map((f) => (
          <li key={f.id} className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-fb-hover">
            <Avatar seed={f.avatar_seed} name={f.name} size={36} online={hash(f.id) % 3 !== 0} />
            <span className="truncate text-[15px] font-medium">{f.name}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
