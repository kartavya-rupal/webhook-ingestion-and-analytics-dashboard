import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type PlaceholderPageProps = {
    title: string;
    description: string;
    phase: string;
};

export function PlaceholderPage({ title, description, phase }: PlaceholderPageProps) {
    return (
        <div className="space-y-6">
            <div className="space-y-2">
                <Badge variant="secondary">{phase}</Badge>
                <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
                <p className="max-w-2xl text-sm text-zinc-400">{description}</p>
            </div>

            <Card className="border-white/10 bg-white/5">
                <CardHeader>
                    <CardTitle>Coming soon</CardTitle>
                    <CardDescription className="text-zinc-400">
                        This page will be built after the webhook ingestion and worker flow is in place.
                    </CardDescription>
                </CardHeader>
                <CardContent className="text-sm text-zinc-300">
                    Phase 4 and Phase 5 will fill this page with live data, filters, and actions.
                </CardContent>
            </Card>
        </div>
    );
}