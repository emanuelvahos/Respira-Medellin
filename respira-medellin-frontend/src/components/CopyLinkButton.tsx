"use client";

import { useState } from "react";
import { CheckIcon, LinkSimpleIcon } from "@phosphor-icons/react/dist/ssr";
import { Button } from "@/components/ui/button";

const CONFIRMACION_MS = 2000;

/**
 * Copia `window.location.href` (URL actual completa, con los query params ya
 * reflejando el estado en pantalla — pesos AHP o comuna seleccionada) al
 * portapapeles. Confirmación visual breve (ícono -> check) en vez de
 * `alert()`, que bloquea el hilo y es intrusivo.
 */
export function CopyLinkButton({ label = "Copiar link de esta vista" }: { label?: string }) {
  const [copiado, setCopiado] = useState(false);

  const handleClick = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopiado(true);
      setTimeout(() => setCopiado(false), CONFIRMACION_MS);
    } catch {
      // Portapapeles no disponible (permiso denegado, contexto no seguro,
      // etc.) — no hay fallback silencioso razonable aquí más que no
      // marcar la confirmación; el usuario puede copiar la URL manualmente.
    }
  };

  return (
    <Button variant="outline" size="sm" onClick={handleClick}>
      {copiado ? <CheckIcon size={16} className="text-vegetation" /> : <LinkSimpleIcon size={16} />}
      {copiado ? "¡Copiado!" : label}
    </Button>
  );
}
