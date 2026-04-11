"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, MapPin, Plus, Building2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { City } from "@/lib/types";
import { addCity } from "../actions";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cities: City[];
};

export function ManageCitiesDialog({ open, onOpenChange, cities }: Props) {
  const [isPending, startTransition] = useTransition();
  const [newCityName, setNewCityName] = useState("");

  const handleAdd = () => {
    const name = newCityName.trim();
    if (!name) {
      toast.error("Enter a city name");
      return;
    }

    startTransition(async () => {
      const result = await addCity(name);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success(`Added "${name}" to the city pool`);
      setNewCityName("");
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            Manage Cities
          </DialogTitle>
          <DialogDescription>
            The central pool of cities. Everyone picks from this list when
            logging monthly travel.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* ── Existing cities ── */}
          <div className="space-y-2">
            <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Cities in Pool ({cities.length})
            </Label>
            <div className="rounded-lg border bg-muted/30 p-1">
              {cities.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
                  <div className="flex size-10 items-center justify-center rounded-full bg-muted">
                    <MapPin className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    No cities yet. Add your first one below.
                  </p>
                </div>
              ) : (
                <div className="max-h-[240px] overflow-y-auto">
                  <div className="flex flex-wrap gap-1.5 p-2">
                    {cities.map((city) => (
                      <div
                        key={city.id}
                        className="inline-flex items-center gap-1.5 rounded-md bg-background border border-border/80 px-2.5 py-1 text-xs font-medium shadow-sm"
                      >
                        <MapPin className="h-3 w-3 text-muted-foreground" />
                        {city.name}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── Add new city ── */}
          <div className="space-y-2 rounded-lg border bg-card p-3">
            <Label
              htmlFor="new-city-input"
              className="text-xs font-medium uppercase tracking-wider text-muted-foreground"
            >
              Add New City
            </Label>
            <div className="flex gap-2">
              <Input
                id="new-city-input"
                placeholder="e.g., Bengaluru"
                value={newCityName}
                onChange={(e) => setNewCityName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAdd();
                  }
                }}
                disabled={isPending}
                className="flex-1"
              />
              <Button
                type="button"
                onClick={handleAdd}
                disabled={isPending || !newCityName.trim()}
              >
                {isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Plus className="mr-1.5 h-4 w-4" />
                    Add
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
