import { useState } from "react";
import { Plus, Check, FolderHeart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface ListSelectorProps {
  currentList: string;
  availableLists: string[];
  onSelectList: (listName: string) => void;
  onCreateList: (listName: string) => void;
  trigger?: React.ReactNode;
}

export const ListSelector = ({
  currentList,
  availableLists,
  onSelectList,
  onCreateList,
  trigger,
}: ListSelectorProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [newListName, setNewListName] = useState("");
  const [showNewListInput, setShowNewListInput] = useState(false);

  const handleCreateList = () => {
    if (newListName.trim()) {
      onCreateList(newListName.trim());
      setNewListName("");
      setShowNewListInput(false);
      setIsOpen(false);
    }
  };

  const handleSelectList = (list: string) => {
    onSelectList(list);
    setIsOpen(false);
  };

  // Default lists that are always available
  const defaultLists = ["Favorites"];
  const allLists = [...new Set([...defaultLists, ...availableLists])];

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm" className="gap-2">
            <FolderHeart className="h-4 w-4" />
            {currentList}
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent className="w-64 p-2" align="end">
        <div className="space-y-1">
          <p className="text-sm font-medium px-2 py-1.5 text-muted-foreground">
            Save to list
          </p>
          
          {allLists.map((list) => (
            <button
              key={list}
              onClick={() => handleSelectList(list)}
              className={cn(
                "w-full flex items-center justify-between px-3 py-2 rounded-md text-sm hover:bg-accent transition-colors",
                currentList === list && "bg-accent"
              )}
            >
              <span className="flex items-center gap-2">
                <FolderHeart className="h-4 w-4" />
                {list}
              </span>
              {currentList === list && <Check className="h-4 w-4" />}
            </button>
          ))}

          <div className="border-t my-2" />

          {showNewListInput ? (
            <div className="p-2 space-y-2">
              <Input
                placeholder="List name..."
                value={newListName}
                onChange={(e) => setNewListName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreateList()}
                autoFocus
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1"
                  onClick={() => setShowNewListInput(false)}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  className="flex-1"
                  onClick={handleCreateList}
                  disabled={!newListName.trim()}
                >
                  Create
                </Button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowNewListInput(true)}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm hover:bg-accent transition-colors text-primary"
            >
              <Plus className="h-4 w-4" />
              Create new list
            </button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};
