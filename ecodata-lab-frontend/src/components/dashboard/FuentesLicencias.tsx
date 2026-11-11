import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const FUENTES: { nombre: string; url: string; licencia?: string }[] = [
  {
    nombre: "MEData · Mortalidad (Secretaría de Salud de Medellín)",
    url: "https://medata.app.medellin.gov.co/dataset/1-026-22-000161",
    licencia: "CC BY(-SA) 4.0",
  },
  {
    nombre: "SAU, árbol urbano (Alcaldía de Medellín)",
    url: "https://www.medellin.gov.co/sau/",
  },
  { nombre: "SIATA, PM2.5", url: "https://siata.gov.co" },
  {
    nombre: "Perfil de morbilidad ESE Metrosalud (datos.gov.co, pypc-7h3w)",
    url: "https://www.datos.gov.co/Salud-y-Protecci-n-Social/Perfil-de-morbilidad-de-la-ESE-Metrosalud/pypc-7h3w",
  },
];

export function FuentesLicencias() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Fuentes y licencias</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm text-foreground">
        <ul className="list-disc space-y-1 pl-5">
          {FUENTES.map((f) => (
            <li key={f.url}>
              <a
                href={f.url}
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-2"
              >
                {f.nombre}
              </a>
              {f.licencia && <> · Licencia {f.licencia}</>}
            </li>
          ))}
          <li>Proyecciones de población (DANE vía Alcaldía) y límites de comunas (GeoMedellín).</li>
        </ul>
        <p>
          <strong>Uso de IA:</strong> Claude (Anthropic) como asistente de programación y análisis;
          el equipo revisa y puede explicar la solución.
        </p>
      </CardContent>
    </Card>
  );
}
