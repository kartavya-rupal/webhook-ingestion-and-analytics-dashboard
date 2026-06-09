"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

const navItems = [
    { href: "/", label: "Overview" },
    { href: "/events", label: "Events" },
    { href: "/endpoints", label: "Endpoints" },
    { href: "/replay", label: "Replay" },
    { href: "/alerts", label: "Alerts" },
    { href: "/logs", label: "Logs" },
];

export function Sidebar() {
    const pathname = usePathname();

    return (
        <aside className="w-full border-b border-white/10 bg-zinc-950/90 lg:sticky lg:top-0 lg:h-screen lg:w-72 lg:border-b-0 lg:border-r">
            <div className="flex items-center justify-between px-6 py-5 lg:block">
                <div>
                    <p className="text-lg font-semibold tracking-tight">FinRelay</p>
                    <p className="text-sm text-zinc-400">Webhook reliability platform</p>
                </div>
                <Badge variant="secondary" className="lg:mt-4">
                    Local
                </Badge>
            </div>

            <Separator className="bg-white/10" />

            <nav className="p-4">
                <div className="space-y-2">
                    {navItems.map((item) => {
                        const active = item.href === pathname;

                        return (
                            <Button
                                key={item.href}
                                asChild
                                variant={active ? "secondary" : "ghost"}
                                className="w-full justify-start"
                            >
                                <Link href={item.href}>{item.label}</Link>
                            </Button>
                        );
                    })}
                </div>
            </nav>

            <div className="p-4">
                <Card className="border-white/10 bg-white/5">
                    <CardContent className="p-4 text-sm text-zinc-300">
                        Local dashboard shell is ready. API and worker will connect in the next phase.
                    </CardContent>
                </Card>
            </div>
        </aside>
    );
}