import { Rocket } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export function ComingSoon({ title }: { title: string }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
      </div>
      <Card>
        <CardContent className="py-20">
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="rounded-full bg-muted p-4">
              <Rocket className="h-10 w-10 text-muted-foreground" />
            </div>
            <div className="space-y-1">
              <p className="text-lg font-semibold">Coming Soon</p>
              <p className="text-sm text-muted-foreground max-w-sm">
                This feature is currently in development and will be available
                in the next release.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
