import Link from "next/link";
import { LeafIcon } from "@phosphor-icons/react/dist/ssr";
import { MainContainer } from "@/components/layout/MainContainer";
import { siteConfig } from "@/config/site";

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-border bg-card">
      <MainContainer className="flex flex-col gap-6 py-10 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-2">
          <LeafIcon
            size={20}
            weight="fill"
            className="mt-0.5 shrink-0 text-vegetation"
            aria-hidden="true"
          />
          <div>
            <p className="font-heading text-sm font-semibold text-foreground">
              {siteConfig.name}
            </p>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              Un proyecto de ciencia de datos para la {siteConfig.institution}.
            </p>
          </div>
        </div>

        <nav aria-label="Enlaces del pie de página">
          <ul className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
            {siteConfig.footerLinks.map((item) => (
              <li key={item.label}>
                <Link
                  href={item.href}
                  className="text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </MainContainer>

      <MainContainer className="border-t border-border py-4">
        <p className="text-xs text-muted-foreground">
          © {year} {siteConfig.institution}. Datos con fines demostrativos —
          fase de desarrollo.
        </p>
      </MainContainer>
    </footer>
  );
}
