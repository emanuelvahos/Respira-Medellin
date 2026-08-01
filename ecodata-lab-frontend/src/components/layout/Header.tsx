import Link from "next/link";
import { LeafIcon } from "@phosphor-icons/react/dist/ssr";
import { MainContainer } from "@/components/layout/MainContainer";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { siteConfig } from "@/config/site";

export function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <MainContainer className="flex h-16 items-center justify-between gap-4">
        <Link
          href="/"
          className="flex items-center gap-2 rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span
            className="flex size-9 shrink-0 items-center justify-center rounded-full bg-vegetation text-vegetation-foreground"
            aria-hidden="true"
          >
            <LeafIcon size={20} weight="fill" />
          </span>
          <span className="font-heading text-lg font-semibold leading-none text-foreground">
            {siteConfig.shortName}
            <span className="block text-xs font-sans font-normal text-muted-foreground">
              Medellín
            </span>
          </span>
        </Link>

        <nav aria-label="Navegación principal" className="hidden md:block">
          <ul className="flex items-center gap-6">
            {siteConfig.nav.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex items-center gap-2">
          <ThemeToggle />
        </div>
      </MainContainer>

      <nav aria-label="Navegación principal móvil" className="border-t border-border md:hidden">
        <MainContainer>
          <ul className="flex items-center gap-5 overflow-x-auto py-2 text-sm">
            {siteConfig.nav.map((item) => (
              <li key={item.href} className="shrink-0">
                <Link
                  href={item.href}
                  className="font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </MainContainer>
      </nav>
    </header>
  );
}
