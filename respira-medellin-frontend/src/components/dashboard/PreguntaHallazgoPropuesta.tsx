import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * Bloque "Pregunta, hallazgo y propuesta" (texto de docs/hallazgo_ecodata.md).
 * Texto estático: no depende de ningún fetch.
 */
export function PreguntaHallazgoPropuesta() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Pregunta, hallazgo y propuesta</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-6 text-sm text-foreground lg:grid-cols-3">
        <section className="space-y-2">
          <h3 className="font-heading text-sm font-semibold">Pregunta</h3>
          <p>
            ¿Dónde conviene sembrar primero en Medellín para reducir la exposición a PM2.5 y
            cerrar la brecha de arbolado, y qué tan confiable es esa priorización?
          </p>
        </section>
        <section className="space-y-2">
          <h3 className="font-heading text-sm font-semibold">Hallazgo</h3>
          <p>
            Las comunas del nororiente tienen muy poco arbolado por habitante: Santa Cruz 21,5,
            Popular 25,8 y Manrique 27,7 árboles vivos por 1.000 hab., frente a 506,7 en El
            Poblado (hasta 23,6 veces más) y 171,1 en promedio de ciudad.
          </p>
          <p>
            Doce de Octubre (29,0 µg/m³) y Popular (27,1 µg/m³) son las más expuestas a PM2.5 y
            quedan primero y segundo en el ranking de prioridad (score AHP con PM2.5 45 %, déficit
            de mitigadores 35 %, área disponible 20 %).
          </p>
        </section>
        <section className="space-y-2">
          <h3 className="font-heading text-sm font-semibold">Propuesta</h3>
          <ol className="list-decimal space-y-1 pl-5">
            <li>
              Priorizar la siembra en Doce de Octubre y Popular, previo inventario de zonas
              plantables (hoy 0).
            </li>
            <li>
              Instalar o ampliar estaciones PM2.5 en las 6 comunas sin dato, empezando por las de
              mayor población (Buenos Aires, San Javier, Aranjuez).
            </li>
            <li>
              Reemplazar PM2.5 interpolado por medido en las comunas prioritarias antes de
              invertir.
            </li>
          </ol>
        </section>
      </CardContent>
    </Card>
  );
}
